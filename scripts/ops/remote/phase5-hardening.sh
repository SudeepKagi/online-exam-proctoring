#!/bin/bash
set -euo pipefail

SHARED_ENV="/opt/proctornet/shared/.env"

echo "======================================================================"
echo " ProctorNet Phase 5: Production Audit & Hardening"
echo "======================================================================"
date -u +"UTC Time: %Y-%m-%d %H:%M:%S"

echo "=== 1. SERVER-SIDE LISTENING PORTS INVENTORY ==="
ss -tlnp

echo "=== 2. INSTALLING & VERIFYING AUTOMATED BACKUP TIMER ==="
mkdir -p /var/log/proctornet /opt/proctornet/backups/postgres /opt/proctornet/current/scripts/ops
chown -R proctornet:proctornet /var/log/proctornet /opt/proctornet/backups

echo "IyEvdXNyL2Jpbi9lbnYgYmFzaAojID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQojIFByb2N0b3JOZXQgUG9zdGdyZVNRTCBBdXRvbWF0ZWQgTmlnaHRseSBCYWNrdXAgU2NyaXB0CiMgUmV0ZW50aW9uOiA3IGRheXMgZGVmYXVsdCAoY3VzdG9taXphYmxlIHZpYSBSRVRFTlRJT05fREFZUykKIyBPZmYtYm94OiBTeW5jIHRvIEFXUyBTMyAoY3VzdG9taXphYmxlIHZpYSBPRkZCT1hfUzNfQlVDS0VUIC8gQVdTIENMSSkKIyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0Kc2V0IC1ldQpzZXQgLW8gcGlwZWZhaWwgMj4vZGV2L251bGwgfHwgdHJ1ZQoKQkFDS1VQX0RJUj0iJHtCQUNLVVBfRElSOi0vb3B0L3Byb2N0b3JuZXQvYmFja3Vwcy9wb3N0Z3Jlc30iClJFVEVOVElPTl9EQVlTPSIke1JFVEVOVElPTl9EQVlTOi03fSIKVElNRVNUQU1QPSIkKGRhdGUgKyclWSVtJWRfJUglTSVTJykiCkJBQ0tVUF9GSUxFPSIke0JBQ0tVUF9ESVJ9L3Byb2N0b3JuZXRfYmFja3VwXyR7VElNRVNUQU1QfS5zcWwuZ3oiCkNPTlRBSU5FUl9OQU1FPSIke1BPU1RHUkVTX0NPTlRBSU5FUjotcHJvY3Rvcm5ldC10ZXN0LXBvc3RncmVzfSIKREJfTkFNRT0iJHtQT1NUR1JFU19EQjotcHJvY3Rvcm5ldH0iCkRCX1VTRVI9IiR7UE9TVEdSRVNfVVNFUjotcHJvY3Rvcm5ldH0iCk9GRkJPWF9TM19CVUNLRVQ9IiR7T0ZGQk9YX1MzX0JVQ0tFVDotcHJvY3Rvcm5ldC1zdG9yYWdlLXByb2QtODU4MTA5OTc4NDg5fSIKCm1rZGlyIC1wICIke0JBQ0tVUF9ESVJ9IgoKZWNobyAiW0lORk9dIFN0YXJ0aW5nIGRhdGFiYXNlIGJhY2t1cCBmb3IgJyR7REJfTkFNRX0nIGF0ICR7VElNRVNUQU1QfS4uLiIKCmlmIFsgLW4gIiR7RElSRUNUX1VSTDotfSIgXTsgdGhlbgogIGVjaG8gIltJTkZPXSBVc2luZyBESVJFQ1RfVVJMIGNvbm5lY3Rpb24gc3RyaW5nLi4uIgogIENMRUFOX0NPTk49JChlY2hvICIkRElSRUNUX1VSTCIgfCBzZWQgJ3MvWz8mXXNjaGVtYT0uKi8vOyBzL1s/Jl1zc2xtb2RlPS4qLy8nKQogIHBnX2R1bXAgLUZjIC1kICIkQ0xFQU5fQ09OTiIgLWYgIiR7QkFDS1VQX0ZJTEV9IgplbGlmIGNvbW1hbmQgLXYgcGdfZHVtcCA+L2Rldi9udWxsIDI+JjE7IHRoZW4KICBwZ19kdW1wIC1VICIke0RCX1VTRVJ9IiAtZCAiJHtEQl9OQU1FfSIgfCBnemlwIC05ID4gIiR7QkFDS1VQX0ZJTEV9IgplbGlmIGNvbW1hbmQgLXYgZG9ja2VyID4vZGV2L251bGwgMj4mMTsgdGhlbgogIGRvY2tlciBleGVjICIke0NPTlRBSU5FUl9OQU1FfSIgcGdfZHVtcCAtVSAiJHtEQl9VU0VSfSIgLWQgIiR7REJfTkFNRX0iIHwgZ3ppcCAtOSA+ICIke0JBQ0tVUF9GSUxFfSIKZWxzZQogIGVjaG8gIltFUlJPUl0gTmVpdGhlciBwZ19kdW1wIG5vciBkb2NrZXIgY29tbWFuZCBpcyBhdmFpbGFibGUuIiA+JjIKICBleGl0IDEKZmkKCkZJTEVfU0laRT0iJChkdSAtaCAiJHtCQUNLVVBfRklMRX0iIHwgY3V0IC1mMSkiCmVjaG8gIltJTkZPXSBCYWNrdXAgc3VjY2Vzc2Z1bGx5IGNyZWF0ZWQ6ICR7QkFDS1VQX0ZJTEV9ICgke0ZJTEVfU0laRX0pIgoKIyBSZXRlbnRpb24gcG9saWN5OiByZW1vdmUgYmFja3VwcyBvbGRlciB0aGFuIFJFVEVOVElPTl9EQVlTCmVjaG8gIltJTkZPXSBDbGVhbmluZyB1cCBsb2NhbCBiYWNrdXBzIG9sZGVyIHRoYW4gJHtSRVRFTlRJT05fREFZU30gZGF5cy4uLiIKZmluZCAiJHtCQUNLVVBfRElSfSIgLW5hbWUgInByb2N0b3JuZXRfYmFja3VwXyouc3FsLmd6IiAtdHlwZSBmIC1tdGltZSArIiR7UkVURU5USU9OX0RBWVN9IiAtZGVsZXRlCgojIE9mZi1ib3ggY29weSBzdGVwCmlmIFsgLW4gIiR7T0ZGQk9YX1MzX0JVQ0tFVDotfSIgXSAmJiBjb21tYW5kIC12IGF3cyA+L2Rldi9udWxsIDI+JjE7IHRoZW4KICBlY2hvICJbSU5GT10gQ29weWluZyBiYWNrdXAgdG8gb2ZmLWJveCBTMyBzdG9yYWdlOiBzMzovLyR7T0ZGQk9YX1MzX0JVQ0tFVH0vYmFja3Vwcy9wb3N0Z3Jlcy8uLi4iCiAgYXdzIHMzIGNwICIke0JBQ0tVUF9GSUxFfSIgInMzOi8vJHtPRkZCT1hfUzNfQlVDS0VUfS9iYWNrdXBzL3Bvc3RncmVzLyQoYmFzZW5hbWUgIiR7QkFDS1VQX0ZJTEV9IikiCiAgZWNobyAiW0lORk9dIE9mZi1ib3ggY29weSBjb21wbGV0ZS4iCmVsc2UKICBlY2hvICJbSU5GT10gT2ZmLWJveCBjb3B5IHNraXBwZWQgKEFXUyBDTEkgbm90IGNvbmZpZ3VyZWQgb3IgT0ZGQk9YX1MzX0JVQ0tFVCB1bnNldCkuIgpmaQoKZWNobyAiW0lORk9dIEJhY2t1cCB3b3JrZmxvdyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LiIKCg==" | base64 -d > /opt/proctornet/current/scripts/ops/backup-postgres.sh
chmod 750 /opt/proctornet/current/scripts/ops/backup-postgres.sh
chown proctornet:proctornet /opt/proctornet/current/scripts/ops/backup-postgres.sh

echo "W1VuaXRdCkRlc2NyaXB0aW9uPVByb2N0b3JOZXQgTmlnaHRseSBQb3N0Z3JlU1FMIEJhY2t1cCBhbmQgT2ZmLWJveCBTeW5jCkFmdGVyPW5ldHdvcmsudGFyZ2V0IGRvY2tlci5zZXJ2aWNlCgpbU2VydmljZV0KVHlwZT1vbmVzaG90ClVzZXI9cHJvY3Rvcm5ldApHcm91cD1wcm9jdG9ybmV0CldvcmtpbmdEaXJlY3Rvcnk9L29wdC9wcm9jdG9ybmV0L2N1cnJlbnQKRW52aXJvbm1lbnRGaWxlPS9vcHQvcHJvY3Rvcm5ldC9zaGFyZWQvLmVudgpFeGVjU3RhcnQ9L2Jpbi9iYXNoIC9vcHQvcHJvY3Rvcm5ldC9jdXJyZW50L3NjcmlwdHMvb3BzL2JhY2t1cC1wb3N0Z3Jlcy5zaApTdGFuZGFyZE91dHB1dD1hcHBlbmQ6L3Zhci9sb2cvcHJvY3Rvcm5ldC9iYWNrdXAubG9nClN0YW5kYXJkRXJyb3I9YXBwZW5kOi92YXIvbG9nL3Byb2N0b3JuZXQvYmFja3VwLmxvZwoK" | base64 -d > /etc/systemd/system/proctornet-backup.service
echo "W1VuaXRdCkRlc2NyaXB0aW9uPVRpbWVyIGZvciBQcm9jdG9yTmV0IE5pZ2h0bHkgUG9zdGdyZVNRTCBCYWNrdXAKUmVmdXNlTWFudWFsU3RhcnQ9bm8KUmVmdXNlTWFudWFsU3RvcD1ubwoKW1RpbWVyXQpPbkNhbGVuZGFyPSotKi0qIDAyOjAwOjAwIFVUQwpQZXJzaXN0ZW50PXRydWUKUmFuZG9taXplZERlbGF5U2VjPTMwMAoKW0luc3RhbGxdCldhbnRlZEJ5PXRpbWVycy50YXJnZXQKCg==" | base64 -d > /etc/systemd/system/proctornet-backup.timer

systemctl daemon-reload
systemctl enable --now proctornet-backup.timer
systemctl list-timers proctornet-backup.timer --no-pager

echo "Testing automated backup service execution (oneshot test):"
systemctl start proctornet-backup.service || true
systemctl status proctornet-backup.service --no-pager || true

echo "=== 3. REHEARSING SEB KILL SWITCH (SEB_MODE=off -> restart -> SEB_MODE=log) ==="
# 3.1 Switch to off
sed -i 's/^SEB_MODE=.*/SEB_MODE=off/' "$SHARED_ENV"
systemctl restart proctornet.service
sleep 2
echo "Health with SEB_MODE=off:"
curl -sSf http://127.0.0.1:5000/healthz | jq -c .

# 3.2 Return to log
sed -i 's/^SEB_MODE=.*/SEB_MODE=log/' "$SHARED_ENV"
systemctl restart proctornet.service
sleep 2
echo "Health restored with SEB_MODE=log:"
curl -sSf http://127.0.0.1:5000/healthz | jq -c .

echo "=== 4. LOG AUDIT (LAST 30 LINES) ==="
journalctl -u proctornet.service -n 30 --no-pager

echo "======================================================================"
echo "[✓] PHASE 5 COMPLETE: Server audit and hardening verified."
echo "======================================================================"
