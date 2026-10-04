-- AlterEnum
ALTER TYPE "AttemptStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "ViolationType" ADD VALUE 'SCREEN_SHARE_STOPPED';
ALTER TYPE "ViolationType" ADD VALUE 'VPN_DISCONNECT';
ALTER TYPE "ViolationType" ADD VALUE 'VPN_IP_MISMATCH';

-- DropIndex
DROP INDEX IF EXISTS "vpn_ip_pool_ip_address_key";
DROP INDEX IF EXISTS "vpn_peers_ip_address_key";

-- AlterTable
ALTER TABLE "exams" ADD COLUMN "vpn_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "violation_events" ADD COLUMN "thumb_key" TEXT;

-- Truncate any temporary data in vpn_ip_pool before altering schema
TRUNCATE TABLE "vpn_ip_pool";

-- AlterTable vpn_ip_pool to align with ADR-010 IPAM
ALTER TABLE "vpn_ip_pool" DROP CONSTRAINT IF EXISTS "vpn_ip_pool_pkey",
DROP COLUMN IF EXISTS "allocated_at",
DROP COLUMN IF EXISTS "allocated_to",
DROP COLUMN IF EXISTS "id",
DROP COLUMN IF EXISTS "ip_address",
DROP COLUMN IF EXISTS "is_allocated",
ADD COLUMN "attempt_id" UUID,
ADD COLUMN "ip" TEXT NOT NULL,
ADD COLUMN "leased_at" TIMESTAMP(3),
ADD COLUMN "released_at" TIMESTAMP(3),
ADD CONSTRAINT "vpn_ip_pool_pkey" PRIMARY KEY ("ip");

-- AlterTable vpn_peers
ALTER TABLE "vpn_peers" ADD COLUMN "attempt_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vpn_ip_pool_attempt_id_key" ON "vpn_ip_pool"("attempt_id");
CREATE INDEX IF NOT EXISTS "idx_vpn_peers_attempt_id" ON "vpn_peers"("attempt_id");
CREATE INDEX IF NOT EXISTS "idx_vpn_peers_ip_address" ON "vpn_peers"("ip_address");
