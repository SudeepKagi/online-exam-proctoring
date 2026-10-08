#!/usr/bin/env bash
# ProctorNet Clean-Room Local Diagnostic Runner (Bash)
# Phase C0 & C6 Local Parity Diagnostic Tool

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

REPORT_DIR="$REPO_ROOT/reports/diagnostics"
mkdir -p "$REPORT_DIR"

export NODE_ENV="test"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/proctornet_test?schema=public}"
export DIRECT_URL="${DIRECT_URL:-postgresql://postgres:postgres@localhost:5433/proctornet_test?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://guest:guest@localhost:5672}"
export AWS_REGION="ap-south-1"
export S3_MOCK="true"
export FACE_DRIVER="off"
export VPN_ENABLED="false"
export JWT_SECRET="dummy_ci_jwt_secret_must_be_at_least_32_bytes_long_12345"
export AGENT_PAIRING_PEPPER="dummy_ci_pepper_test_secret_at_least_32_chars_123"
export AGENT_POLICY_SIGNING_KEY="dummy_ci_signing_test_secret_at_least_32_chars_456"
export NODE_PATH="$REPO_ROOT/proctornet/backend/node_modules:$REPO_ROOT/proctornet/node_modules"

TEST_FILES=()

# Backend tests
if [ -d "$REPO_ROOT/proctornet/backend/tests" ]; then
    while IFS= read -r file; do
        TEST_FILES+=("$file")
    done < <(find proctornet/backend/tests -maxdepth 1 -name "*.js")
fi

# Root tests
if [ -d "$REPO_ROOT/tests" ]; then
    while IFS= read -r file; do
        TEST_FILES+=("$file")
    done < <(find tests -maxdepth 1 -name "*.test.js")
fi

# Agent tests
if [ -d "$REPO_ROOT/proctornet/device-agent/test" ]; then
    while IFS= read -r file; do
        TEST_FILES+=("$file")
    done < <(find proctornet/device-agent/test -maxdepth 1 -name "*.test.js")
fi

TOTAL=${#TEST_FILES[@]}
echo "Discovered $TOTAL test files across workspaces."

PASS=0
FAIL=0
INDEX=0

for test_path in "${TEST_FILES[@]}"; do
    INDEX=$((INDEX + 1))
    SAFE_NAME=$(echo "$test_path" | tr '/\\:' '_')
    LOG_FILE="$REPORT_DIR/${SAFE_NAME}.log"

    printf "[%d/%d] Running %s ... " "$INDEX" "$TOTAL" "$test_path"

    START_TS=$(date +%s%N)
    set +e
    node --test --test-force-exit "$test_path" > "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    set -e
    END_TS=$(date +%s%N)
    DUR_MS=$(( (END_TS - START_TS) / 1000000 ))

    if [ "$EXIT_CODE" -eq 0 ]; then
        echo -e "\033[32mPASS\033[0m (${DUR_MS}ms)"
        PASS=$((PASS + 1))
    else
        echo -e "\033[31mFAIL\033[0m (exit: $EXIT_CODE, ${DUR_MS}ms)"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "================================================="
echo "DIAGNOSTIC SCAN COMPLETED: Total: $TOTAL | Passed: $PASS | Failed: $FAIL"
echo "================================================="
