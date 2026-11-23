#!/usr/bin/env bash
set -e
set -a
. /opt/proctornet/shared/.env
set +a
node -e "
const https = require('https');
const key = process.env.GEMINI_API_KEY;

const models = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite'
];

async function run() {
  for (const model of models) {
    await new Promise(resolve => {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
      const payload = JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with valid JSON: {\"status\": \"ok\", \"model\": \"' + model + '\"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });
      const req = https.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          console.log('MODEL:', model, 'STATUS:', res.statusCode);
          try {
            const j = JSON.parse(data);
            const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              console.log('  SUCCESS:', text.trim());
            } else {
              console.log('  ERR:', j.error?.message || j.error?.status);
            }
          } catch(e) {
            console.log('  PARSE_ERR:', e.message);
          }
          resolve();
        });
      });
      req.on('error', e => { console.error('NET_ERR:', e.message); resolve(); });
      req.write(payload);
      req.end();
    });
  }
}
run();
"
