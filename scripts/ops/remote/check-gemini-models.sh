#!/usr/bin/env bash
set -e
set -a
. /opt/proctornet/shared/.env
set +a
node -e "
const https = require('https');
const key = process.env.GEMINI_API_KEY;
https.get('https://generativelanguage.googleapis.com/v1beta/models?key=' + key, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      if (j.models) {
        console.log('STATUS:', res.statusCode);
        console.log('MODELS_COUNT:', j.models.length);
        console.log('FLASH_MODELS:', j.models.map(m => m.name.replace('models/', '')).filter(n => n.includes('flash')).join(', '));
      } else {
        console.log('STATUS:', res.statusCode, 'BODY:', JSON.stringify(j));
      }
    } catch(e) {
      console.error(e.message);
    }
  });
});
"
