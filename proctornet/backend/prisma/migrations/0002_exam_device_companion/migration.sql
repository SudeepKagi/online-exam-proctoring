-- Migration: 0002_exam_device_companion
-- Architecture: Prompt 4 §3.1 (Exam Device Companion)

-- 1. Alter Enum ViolationType
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED_APPLICATION';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'VIRTUAL_CAMERA_DETECTED';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'REMOTE_SESSION_DETECTED';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'VIRTUAL_MACHINE_DETECTED';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'MULTIPLE_DISPLAYS';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'AGENT_DISCONNECTED';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'AGENT_TAMPERED';
ALTER TYPE "ViolationType" ADD VALUE IF NOT EXISTS 'AGENT_POLICY_INVALID';

-- 2. Create Enums
DO $$ BEGIN
    CREATE TYPE "DeviceAgentPolicy" AS ENUM ('REQUIRED', 'OPTIONAL', 'OFF');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AgentPairingScope" AS ENUM ('PRECHECK', 'ATTEMPT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AgentSessionState" AS ENUM ('NOT_PAIRED', 'PAIRED', 'HEALTHY', 'DEGRADED', 'STALE', 'BLOCKED', 'WAIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AgentRuleCategory" AS ENUM ('REMOTE_ACCESS', 'SCREEN_CAPTURE', 'VIRTUAL_CAMERA', 'AI_ASSISTANT', 'VIRTUAL_MACHINE', 'REMOTE_SESSION', 'DISPLAY', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AgentRuleAction" AS ENUM ('FLAG', 'SUSPEND', 'BLOCK_START', 'WARN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Alter Table exams
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "device_agent_policy" "DeviceAgentPolicy" NOT NULL DEFAULT 'REQUIRED';

-- 4. Create Table agent_releases
CREATE TABLE IF NOT EXISTS "agent_releases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "arch" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "min_supported" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_releases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_releases_version_os_arch_key" ON "agent_releases"("version", "os", "arch");

-- 5. Create Table agent_pairings
CREATE TABLE IF NOT EXISTS "agent_pairings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "AgentPairingScope" NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt_id" UUID,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "issue_ip" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pairings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_pairings_code_hash_idx" ON "agent_pairings"("code_hash");

-- 6. Create Table agent_sessions
CREATE TABLE IF NOT EXISTS "agent_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "AgentPairingScope" NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt_id" UUID,
    "token_hash" TEXT NOT NULL,
    "session_key_enc" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "arch" TEXT NOT NULL,
    "build_hash" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "pair_ip" TEXT NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "state" "AgentSessionState" NOT NULL DEFAULT 'PAIRED',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_sessions_token_hash_key" ON "agent_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "agent_sessions_student_id_attempt_id_idx" ON "agent_sessions"("student_id", "attempt_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_state_idx" ON "agent_sessions"("state");

-- 7. Create Table agent_rules
CREATE TABLE IF NOT EXISTS "agent_rules" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" "AgentRuleCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "matchers" JSONB NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'HIGH',
    "action" "AgentRuleAction" NOT NULL DEFAULT 'FLAG',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_rules_pkey" PRIMARY KEY ("id")
);

-- 8. Create Table agent_policy_versions
CREATE TABLE IF NOT EXISTS "agent_policy_versions" (
    "version" INTEGER NOT NULL,
    "bundle" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_policy_versions_pkey" PRIMARY KEY ("version")
);

-- 9. Create Table agent_findings
CREATE TABLE IF NOT EXISTS "agent_findings" (
    "id" BIGSERIAL NOT NULL,
    "session_id" UUID NOT NULL,
    "attempt_id" UUID,
    "rule_id" TEXT NOT NULL,
    "program" TEXT,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleared_at" TIMESTAMPTZ(3),
    "hit_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_findings_session_id_rule_id_idx" ON "agent_findings"("session_id", "rule_id");
CREATE INDEX IF NOT EXISTS "agent_findings_attempt_id_idx" ON "agent_findings"("attempt_id");

-- 10. Create Table device_agent_waivers
CREATE TABLE IF NOT EXISTS "device_agent_waivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_agent_waivers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "device_agent_waivers_attempt_id_key" ON "device_agent_waivers"("attempt_id");
