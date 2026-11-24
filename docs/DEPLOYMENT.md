# Deployment Guide

This document outlines the production architecture, server requirements, and release pipeline for ProctorNet.

## Production Requirements

The platform is designed to run on a Linux server instance. The minimum recommended hardware specifications are:

- **Operating System**: Ubuntu 22.04 LTS or higher.
- **Compute**: 4 vCPUs, 8 GB RAM.
- **Storage**: 40 GB SSD.
- **Database**: PostgreSQL 15 or higher with connection pooling enabled.
- **Memory Cache**: Redis 7 or higher.
- **Network**: Public domain with ports 80 and 443 open for web traffic.

## Architecture and Process Management

The production deployment uses a single-node Linux architecture:

- **Process Management**: Systemd manages backend Node.js processes, providing automatic restarts on unexpected failure.
- **Web Server & Reverse Proxy**: Caddy terminates SSL/TLS connections with automatic certificate provisioning and routes traffic to internal Node.js ports.
- **Object Storage**: AWS S3 stores student reference photos, identification cards, and examination incident snapshots.
- **Biometric Services**: AWS Rekognition processes live candidate selfies against stored reference photos.

## Release Process

Deployments use an automated cutover pipeline:

1. **Pre-Flight Validation**: Automated scripts verify environment variables, database connectivity, and required secrets.
2. **Database Backup**: A snapshot of the PostgreSQL database is taken before executing code migrations.
3. **Application Cutover**: New release bundles unpack into timestamped release folders. Systemd restarts the backend service cleanly.
4. **Smoke Verification**: Automated health checks confirm that the API endpoints, WebSocket gateway, and web assets respond properly.
5. **Rollback Safeguard**: If smoke checks fail, the pipeline automatically restores the previous release directory and restarts services.

## Operational Runbooks

Detailed operational instructions, zero-downtime cutover procedures, and incident response guides are documented in the [Internal Engineering Records](internal/README.md).
