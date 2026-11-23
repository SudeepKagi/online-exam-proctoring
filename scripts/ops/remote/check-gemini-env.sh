#!/usr/bin/env bash
grep GEMINI /opt/proctornet/shared/.env | cut -d'=' -f1
