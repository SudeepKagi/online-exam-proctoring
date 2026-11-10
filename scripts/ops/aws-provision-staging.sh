#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
BUCKET_NAME="${S3_BUCKET:-proctornet-staging-evidence}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
DOMAIN="${DOMAIN:-staging.proctornet.duckdns.org}"
SG_NAME="proctornet-staging-sg"
ROLE_NAME="ProctorNetStagingInstanceRole"
PROFILE_NAME="ProctorNetStagingInstanceProfile"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo " ProctorNet Staging AWS Automated Provisioning"
echo " Region:        $REGION"
echo " S3 Bucket:     $BUCKET_NAME"
echo " Instance Type: $INSTANCE_TYPE"
echo " Subdomain:     $DOMAIN"
echo "=========================================================="

echo -e "\n[1] Verifying AWS CLI caller identity..."
aws sts get-caller-identity

echo -e "\n[2] Provisioning S3 Bucket: $BUCKET_NAME..."
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
fi
aws s3api put-public-access-block --bucket "$BUCKET_NAME" --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-versioning --bucket "$BUCKET_NAME" --versioning-configuration Status=Enabled
if [ -f "$SCRIPT_DIR/s3-cors-staging.json" ]; then
  aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration "file://$SCRIPT_DIR/s3-cors-staging.json"
fi

echo -e "\n[3] Provisioning Security Group..."
VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SG_ID=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" --description "ProctorNet Staging Security Group" --vpc-id "$VPC_ID" --region "$REGION" --query "GroupId" --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "$REGION"
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$REGION"
  aws ec2 create-tags --resources "$SG_ID" --tags Key=Name,Value="$SG_NAME" --region "$REGION"
fi

echo -e "\n[4] Provisioning IAM Role & Instance Profile..."
if ! aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "file://$SCRIPT_DIR/ec2-trust-policy.json"
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "ProctorNetS3EvidenceAccess" --policy-document "file://$SCRIPT_DIR/s3-staging-policy.json"
fi

if ! aws iam get-instance-profile --instance-profile-name "$PROFILE_NAME" 2>/dev/null; then
  aws iam create-instance-profile --instance-profile-name "$PROFILE_NAME"
  aws iam add-role-to-instance-profile --instance-profile-name "$PROFILE_NAME" --role-name "$ROLE_NAME"
fi

echo -e "\n[5] Checking / Launching Staging EC2 Instance..."
INSTANCE_ID=$(aws ec2 describe-instances --region "$REGION" --filters "Name=tag:Name,Values=proctornet-staging" "Name=instance-state-name,Values=pending,running" --query "Reservations[0].Instances[0].InstanceId" --output text 2>/dev/null || echo "None")

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
  AMI_ID=$(aws ssm get-parameter --name "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id" --region "$REGION" --query "Parameter.Value" --output text)
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --iam-instance-profile Name="$PROFILE_NAME" \
    --security-group-ids "$SG_ID" \
    --block-device-mappings "file://$SCRIPT_DIR/staging-block-device.json" \
    --user-data "file://$SCRIPT_DIR/staging-user-data.sh" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=proctornet-staging}]" \
    --region "$REGION" \
    --query "Instances[0].InstanceId" --output text)
fi

echo -e "\n[6] Associating Elastic IP..."
EIP=$(aws ec2 describe-addresses --region "$REGION" --filters "Name=tag:Name,Values=proctornet-staging-eip" --query "Addresses[0].PublicIp" --output text 2>/dev/null || echo "None")
if [ "$EIP" = "None" ] || [ -z "$EIP" ]; then
  ALLOC_ID=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=proctornet-staging-eip}]" --region "$REGION" --query "AllocationId" --output text)
  aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID" --region "$REGION"
  EIP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" --region "$REGION" --query "Addresses[0].PublicIp" --output text)
fi

echo "=========================================================="
echo " Staging Infrastructure Provisioned Successfully!"
echo " Instance ID:   $INSTANCE_ID"
echo " Elastic IP:    $EIP"
echo " Subdomain:     $DOMAIN"
echo " S3 Bucket:     $BUCKET_NAME"
echo " Security Group:$SG_ID"
echo "=========================================================="
