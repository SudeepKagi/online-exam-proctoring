-- AlterTable: Add scope to idempotency_keys and enforce composite primary key (scope, key)
ALTER TABLE "idempotency_keys" ADD COLUMN IF NOT EXISTS "scope" VARCHAR(64) NOT NULL DEFAULT 'global';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'idempotency_keys_pkey' 
        AND conrelid = 'idempotency_keys'::regclass
    ) THEN
        ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_pkey";
    END IF;
END $$;

ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("scope", "key");
