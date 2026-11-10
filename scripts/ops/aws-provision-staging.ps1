<#
.SYNOPSIS
  Automated AWS Staging Provisioning & Host Bootstrapper for ProctorNet.
.DESCRIPTION
  Provisions S3 evidence bucket with CORS, IAM Instance Profile, Security Group,
  launches Ubuntu 24.04 LTS EC2 instance, associates Elastic IP, and initializes
  the staging host via AWS Systems Manager (SSM).
#>

[CmdletBinding()]
param(
    [string]$Region = "ap-south-1",
    [string]$BucketName = "proctornet-staging-evidence",
    [string]$InstanceType = "t3.small",
    [string]$Domain = "staging.proctornet.duckdns.org",
    [string]$SecurityGroupName = "proctornet-staging-sg",
    [string]$RoleName = "ProctorNetStagingInstanceRole",
    [string]$ProfileName = "ProctorNetStagingInstanceProfile",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ProctorNet Staging AWS Automated Provisioning" -ForegroundColor Cyan
Write-Host " Region:        $Region" -ForegroundColor Gray
Write-Host " S3 Bucket:     $BucketName" -ForegroundColor Gray
Write-Host " Instance Type: $InstanceType" -ForegroundColor Gray
Write-Host " Subdomain:     $Domain" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify AWS CLI & Caller Identity
Write-Host "`n[1] Verifying AWS CLI caller identity..." -ForegroundColor Yellow
$caller = aws sts get-caller-identity --output json | ConvertFrom-Json
Write-Host "[✓] Authenticated as: $($caller.Arn) (Account: $($caller.Account))" -ForegroundColor Green

if ($DryRun) {
    Write-Host "[*] Dry-run mode enabled. Exiting before modifying resources." -ForegroundColor Yellow
    exit 0
}

# 2. S3 Bucket Provisioning
Write-Host "`n[2] Checking S3 Bucket: $BucketName..." -ForegroundColor Yellow
$bucketExists = $false
try {
    aws s3api head-bucket --bucket $BucketName --region $Region 2>$null
    $bucketExists = $true
    Write-Host "[✓] S3 Bucket $BucketName already exists." -ForegroundColor Green
} catch {
    Write-Host "[+] Creating S3 Bucket $BucketName in $Region..." -ForegroundColor Cyan
    aws s3api create-bucket --bucket $BucketName --region $Region --create-bucket-configuration LocationConstraint=$Region
    Write-Host "[✓] S3 Bucket created." -ForegroundColor Green
}

Write-Host "[+] Configuring S3 Block Public Access & Versioning..." -ForegroundColor Cyan
aws s3api put-public-access-block --bucket $BucketName --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-versioning --bucket $BucketName --versioning-configuration Status=Enabled

$corsPath = Join-Path $PSScriptRoot "s3-cors-staging.json"
if (Test-Path $corsPath) {
    Write-Host "[+] Applying S3 Presigned CORS Configuration..." -ForegroundColor Cyan
    aws s3api put-bucket-cors --bucket $BucketName --cors-configuration "file://$($corsPath.Replace('\', '/'))"
    Write-Host "[✓] S3 CORS configured." -ForegroundColor Green
}

# 3. Security Group Provisioning
Write-Host "`n[3] Checking Security Group: $SecurityGroupName..." -ForegroundColor Yellow
$vpcId = (aws ec2 describe-vpcs --region $Region --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
$sgId = (aws ec2 describe-security-groups --region $Region --filters "Name=group-name,Values=$SecurityGroupName" "Name=vpc-id,Values=$vpcId" --query "SecurityGroups[0].GroupId" --output text 2>$null)

if (-not $sgId -or $sgId -eq "None") {
    Write-Host "[+] Creating Security Group $SecurityGroupName in VPC $vpcId..." -ForegroundColor Cyan
    $sgId = (aws ec2 create-security-group --group-name $SecurityGroupName --description "ProctorNet Staging Security Group" --vpc-id $vpcId --region $Region --query "GroupId" --output text)
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $Region
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $Region
    aws ec2 create-tags --resources $sgId --tags Key=Name,Value=$SecurityGroupName --region $Region
    Write-Host "[✓] Security Group created: $sgId (Ports 80/443 open, SSH 22 closed)" -ForegroundColor Green
} else {
    Write-Host "[✓] Security Group already exists: $sgId" -ForegroundColor Green
}

# 4. IAM Role & Instance Profile
Write-Host "`n[4] Checking IAM Role: $RoleName..." -ForegroundColor Yellow
try {
    aws iam get-role --role-name $RoleName 2>$null | Out-Null
    Write-Host "[✓] IAM Role $RoleName exists." -ForegroundColor Green
} catch {
    Write-Host "[+] Creating IAM Role $RoleName..." -ForegroundColor Cyan
    $trustPath = Join-Path $PSScriptRoot "ec2-trust-policy.json"
    aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$($trustPath.Replace('\', '/'))"
    aws iam attach-role-policy --role-name $RoleName --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    $s3PolicyPath = Join-Path $PSScriptRoot "s3-staging-policy.json"
    aws iam put-role-policy --role-name $RoleName --policy-name "ProctorNetS3EvidenceAccess" --policy-document "file://$($s3PolicyPath.Replace('\', '/'))"
}

try {
    aws iam get-instance-profile --instance-profile-name $ProfileName 2>$null | Out-Null
    Write-Host "[✓] Instance Profile $ProfileName exists." -ForegroundColor Green
} catch {
    Write-Host "[+] Creating Instance Profile $ProfileName..." -ForegroundColor Cyan
    aws iam create-instance-profile --instance-profile-name $ProfileName
    aws iam add-role-to-instance-profile --instance-profile-name $ProfileName --role-name $RoleName
}

# 5. Check or Launch EC2 Instance
Write-Host "`n[5] Checking Staging EC2 Instance..." -ForegroundColor Yellow
$instanceId = (aws ec2 describe-instances --region $Region --filters "Name=tag:Name,Values=proctornet-staging" "Name=instance-state-name,Values=pending,running" --query "Reservations[0].Instances[0].InstanceId" --output text 2>$null)

if (-not $instanceId -or $instanceId -eq "None") {
    Write-Host "[+] Resolving latest Ubuntu 24.04 LTS AMI..." -ForegroundColor Cyan
    $amiId = (aws ssm get-parameter --name "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id" --region $Region --query "Parameter.Value" --output text)
    Write-Host "[+] Launching $InstanceType EC2 instance ($amiId)..." -ForegroundColor Cyan
    $blockDevicePath = Join-Path $PSScriptRoot "staging-block-device.json"
    $userDataPath = Join-Path $PSScriptRoot "staging-user-data.sh"
    $instanceId = (aws ec2 run-instances --image-id $amiId --instance-type $InstanceType --iam-instance-profile Name=$ProfileName --security-group-ids $sgId --block-device-mappings "file://$($blockDevicePath.Replace('\', '/'))" --user-data "file://$($userDataPath.Replace('\', '/'))" --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=proctornet-staging}]" --region $Region --query "Instances[0].InstanceId" --output text)
    Write-Host "[✓] Launched instance: $instanceId" -ForegroundColor Green
} else {
    Write-Host "[✓] Active staging instance found: $instanceId" -ForegroundColor Green
}

# 6. Elastic IP
Write-Host "`n[6] Checking Elastic IP..." -ForegroundColor Yellow
$eip = (aws ec2 describe-addresses --region $Region --filters "Name=tag:Name,Values=proctornet-staging-eip" --query "Addresses[0].PublicIp" --output text 2>$null)
if (-not $eip -or $eip -eq "None") {
    Write-Host "[+] Allocating new Elastic IP..." -ForegroundColor Cyan
    $allocId = (aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=proctornet-staging-eip}]" --region $Region --query "AllocationId" --output text)
    aws ec2 associate-address --instance-id $instanceId --allocation-id $allocId --region $Region
    $eip = (aws ec2 describe-addresses --allocation-ids $allocId --region $Region --query "Addresses[0].PublicIp" --output text)
    Write-Host "[✓] Allocated and associated Elastic IP: $eip" -ForegroundColor Green
} else {
    Write-Host "[✓] Elastic IP already assigned: $eip" -ForegroundColor Green
}

# 7. Summary
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Staging Infrastructure Provisioned Successfully!" -ForegroundColor Green
Write-Host " Instance ID:   $instanceId" -ForegroundColor Cyan
Write-Host " Elastic IP:    $eip" -ForegroundColor Cyan
Write-Host " Subdomain:     $Domain" -ForegroundColor Cyan
Write-Host " S3 Bucket:     $BucketName" -ForegroundColor Cyan
Write-Host " Security Group:$sgId (SSH closed, HTTP/HTTPS open)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "`nNext Step: Map DuckDNS to $eip" -ForegroundColor Yellow
Write-Host "DuckDNS Update URL:" -ForegroundColor Gray
Write-Host "https://www.duckdns.org/update?domains=$($Domain.Split('.')[0])&token=<YOUR_TOKEN>&ip=$eip" -ForegroundColor White

