<#
.SYNOPSIS
  ProctorNet Backup / Restore Drill (Q7 Task 4)
.DESCRIPTION
  1. pg_dump from the live DB into a timestamped .dump file.
  2. Creates a scratch DB (proctornet_restore_test) inside the same postgres
     container.
  3. pg_restore into the scratch DB.
  4. Queries row counts for key tables and compares them to the source DB.
  5. Drops the scratch DB.
  6. Prints a PASS / FAIL result and exits 0 / 1.

  Results are appended to docs/qa/backup-restore-drill.log.
.EXAMPLE
  .\scripts\ops\backup-restore-drill.ps1
#>
param()
$ErrorActionPreference = "Stop"
$ROOT = (Resolve-Path "$PSScriptRoot\..\..").Path

$TS       = Get-Date -Format "yyyyMMdd-HHmmss"
$DUMP_DIR = "$ROOT\backups"
$DUMP_FILE = "$DUMP_DIR\proctornet-${TS}.dump"
$LOG_FILE  = "$ROOT\docs\qa\backup-restore-drill.log"
$SCRATCH_DB = "proctornet_restore_test"
$CONTAINER  = "proctornet-postgres"

# Load .env for DB credentials
$envPath = "$ROOT\.env"
if (Test-Path $envPath) {
  foreach ($line in Get-Content $envPath) {
    if ($line -match "^([^#][^=]+)=(.*)$") {
      [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim())
    }
  }
}
$PG_USER = $env:POSTGRES_USER ?? "proctornet_admin"
$PG_DB   = $env:POSTGRES_DB  ?? "proctornet"
$PG_PASS = $env:POSTGRES_PASSWORD

New-Item -ItemType Directory -Force $DUMP_DIR | Out-Null
New-Item -ItemType Directory -Force (Split-Path $LOG_FILE) | Out-Null

function Log($msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Host $line
  Add-Content -Path $LOG_FILE -Value $line
}

Log "===== Backup/Restore Drill START TS=${TS} ====="

# -- 1. pg_dump (custom format) ------------------------------------------------
Log "Step 1: pg_dump into $DUMP_FILE"
$env:PGPASSWORD = $PG_PASS
docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
  pg_dump -U $PG_USER -d $PG_DB -Fc -f "/tmp/drill-${TS}.dump"
docker cp "${CONTAINER}:/tmp/drill-${TS}.dump" $DUMP_FILE
Log "  Dump size: $([int]((Get-Item $DUMP_FILE).Length / 1KB)) KB"

# -- 2. Create scratch DB ------------------------------------------------------
Log "Step 2: Creating scratch database '$SCRATCH_DB'"
docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
  psql -U $PG_USER -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
  psql -U $PG_USER -c "CREATE DATABASE ${SCRATCH_DB} OWNER ${PG_USER};"

# -- 3. pg_restore into scratch ------------------------------------------------
Log "Step 3: pg_restore into '$SCRATCH_DB'"
docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
  pg_restore -U $PG_USER -d $SCRATCH_DB --no-owner --role=$PG_USER "/tmp/drill-${TS}.dump"

# -- 4. Row-count comparison ---------------------------------------------------
Log "Step 4: Comparing row counts"
$tables = @("Admin", "Faculty", "Student", "Exam", "Attempt", "ViolationEvent", "Question")
$pass = $true

foreach ($t in $tables) {
  $srcCount = docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
    psql -U $PG_USER -d $PG_DB -tAc "SELECT COUNT(*) FROM `"${t}`";" 2>&1
  $dstCount = docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
    psql -U $PG_USER -d $SCRATCH_DB -tAc "SELECT COUNT(*) FROM `"${t}`";" 2>&1

  $srcCount = $srcCount.Trim()
  $dstCount = $dstCount.Trim()

  if ($srcCount -ne $dstCount) {
    Log "  [FAIL] Table $t: src=$srcCount dst=$dstCount"
    $pass = $false
  } else {
    Log "  [OK]   Table $t: $srcCount rows"
  }
}

# -- 5. Drop scratch DB --------------------------------------------------------
Log "Step 5: Dropping scratch database '$SCRATCH_DB'"
docker exec -e "PGPASSWORD=$PG_PASS" $CONTAINER `
  psql -U $PG_USER -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"

# -- 6. Result -----------------------------------------------------------------
if ($pass) {
  Log "===== Drill RESULT: PASS ====="
  exit 0
} else {
  Log "===== Drill RESULT: FAIL ====="
  exit 1
}
