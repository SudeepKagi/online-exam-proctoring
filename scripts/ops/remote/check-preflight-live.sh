#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " PROCTORNET LIVE PRE-FLIGHT VERIFICATION"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

echo "--- 1. ENVIRONMENT VARIABLES IN /opt/proctornet/shared/.env (NAMES & LENGTHS ONLY) ---"
if [ -f /opt/proctornet/shared/.env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [ -z "$line" ] || [[ "$line" =~ ^# ]]; then continue; fi
    key="$(echo "$line" | cut -d'=' -f1)"
    val="$(echo "$line" | cut -d'=' -f2-)"
    len=$(printf "%s" "$val" | wc -c | tr -d " ")
    echo "KEY: ${key} | LENGTH: ${len}"
  done < /opt/proctornet/shared/.env
else
  echo "ERROR: /opt/proctornet/shared/.env does not exist!"
fi

echo ""
echo "--- 2. CURRENT RUNNING RELEASE & SERVICE STATUS ---"
CURRENT_TARGET=$(readlink -f /opt/proctornet/current || echo "not-a-symlink")
echo "Current target: ${CURRENT_TARGET}"
if [ -f "${CURRENT_TARGET}/VERSION" ]; then
  cat "${CURRENT_TARGET}/VERSION"
fi
systemctl is-active proctornet.service || true
systemctl is-active caddy.service || true

echo ""
echo "--- 3. DISK SPACE ---"
df -m /

echo ""
echo "--- 4. DATABASE & SCHEDULE AUDIT ---"
CURRENT_DIR=$(readlink -f /opt/proctornet/current)
cd "$CURRENT_DIR/backend"

node --env-file=/opt/proctornet/shared/.env -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const now = new Date();
  console.log('Server time (UTC):', now.toISOString());

  // 1. In-progress attempts
  const inProgressAttempts = await prisma.examAttempt.findMany({
    where: { status: 'IN_PROGRESS' },
    select: { id: true, examId: true, studentId: true, startedAt: true }
  });
  console.log('IN_PROGRESS attempts count:', inProgressAttempts.length);
  if (inProgressAttempts.length > 0) {
    console.log('In-progress details:', JSON.stringify(inProgressAttempts, null, 2));
  }

  // 2. All exams status and schedule
  const exams = await prisma.exam.findMany({
    select: {
      id: true,
      title: true,
      courseCode: true,
      status: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      _count: {
        select: {
          attempts: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total exams count:', exams.length);
  exams.forEach(e => {
    const start = e.startTime ? new Date(e.startTime) : null;
    const end = e.endTime ? new Date(e.endTime) : null;
    let windowStatus = 'NO_WINDOW';
    if (start && end) {
      const minutesToStart = (start.getTime() - now.getTime()) / (60 * 1000);
      const minutesToEnd = (end.getTime() - now.getTime()) / (60 * 1000);
      if (now >= start && now <= end) {
        windowStatus = 'OPEN_NOW (ends in ' + Math.round(minutesToEnd) + 'm)';
      } else if (minutesToStart > 0 && minutesToStart <= 30) {
        windowStatus = 'STARTING_SOON (starts in ' + Math.round(minutesToStart) + 'm)';
      } else if (minutesToStart > 30) {
        windowStatus = 'FUTURE (starts in ' + Math.round(minutesToStart) + 'm)';
      } else {
        windowStatus = 'PAST (ended ' + Math.round(-minutesToEnd) + 'm ago)';
      }
    }
    console.log('Exam: [' + e.id + '] ' + e.title + ' | Status: ' + e.status + ' | Schedule: ' + windowStatus + ' | Attempts: ' + e._count.attempts);
  });

  // 3. System settings
  const settings = await prisma.systemSetting.findMany();
  console.log('System settings count:', settings.length);
  settings.forEach(s => {
    console.log('Setting: ' + s.key + ' | length: ' + (s.value ? s.value.length : 0));
  });

  await prisma.\$disconnect();
}
check().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
"

echo ""
echo "--- 5. RECENT LOCAL BACKUPS ---"
if [ -d /opt/proctornet/backups ]; then
  ls -la /opt/proctornet/backups | tail -n 10
else
  echo "/opt/proctornet/backups does not exist."
fi

echo "================================================================="
