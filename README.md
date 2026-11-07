# 🚀 Enterprise Telecalling CRM & High-Velocity Auto-Dialer

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg)](https://nodejs.org/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-blue.svg)](https://turbo.build/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2012-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/Mobile-Expo%20%2B%20Kotlin-61DAFB.svg)](https://reactnative.dev/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%205-darkblue.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-Proprietary-orange.svg)](#)

> **Enterprise-grade, offline-first Telecalling CRM and auto-dialer platform** engineered for high-velocity sales and telecalling teams (Solar Energy, Real Estate, BFSI, Education, and Logistics). Features real-time call tracking, two-tap dispositions, automated WhatsApp workflows, in-browser audio scrubbing, multi-OEM call recording support, and strict DPDP / TRAI regulatory compliance.

---

## 📑 Quick Navigation
- **[Standard Operating Procedures & User Guide](docs/SOP_AND_USER_GUIDE.md)**
- **[Master Enterprise Quality Assurance Report](docs/AUDIT_REPORT.md)**
- **[System Architecture](#system-architecture)**
- **[Quickstart Guide](#quickstart-guide)**
- **[Default User Credentials](#default-user-credentials)**
- **[Safe Simulation Mode](#safe-simulation-mode)**
- **[Docker Production Deployment](#docker-production-deployment)**

---

## 🏛 System Architecture

The monorepo is managed with **Turborepo** and **pnpm workspaces**:

```
telecalling-crm/
├── apps/
│   ├── api/             # NestJS 12 REST Backend & Monotonic Change-Feed Engine
│   ├── web/             # Next.js 16 Web Manager Dashboard (Shift KPIs, Audio Scrubber, Benchmarks)
│   └── mobile/          # React Native Expo Mobile Caller Client & Auto-Dialer
│       └── modules/
│           └── telephony-engine/   # Native Android Kotlin module (CallLog, ContentObserver, WorkManager)
├── packages/
│   ├── shared/          # Shared TypeScript interfaces, Zod schemas, and DTOs
│   └── api-client/      # Strongly typed API client SDK for Web and Mobile
├── docker-compose.prod.yml  # Multi-container production deployment topology
├── nginx/               # Reverse proxy configuration with SSL and rate limiting
├── scripts/             # Automated backup & database maintenance scripts
├── tests/               # 56 Automated verification gates across all 7 project phases
└── docs/                # Comprehensive SOPs, user manuals, and technical audits
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js:** `>= 22.0.0`
- **Package Manager:** `pnpm >= 9.10`
- **Docker & Docker Compose** (for PostgreSQL and MinIO)

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/KaranGond/CRM.git
cd CRM

# Install dependencies across all monorepo packages
pnpm install

# Configure environment variables
cp .env.example .env
```

### 3. Database & Object Storage Initialization
```bash
# Start PostgreSQL (port 5435) and MinIO (ports 9000-9001)
docker compose up -d postgres minio

# Push Prisma schema and seed initial users and leads
pnpm --filter @telecalling-crm/api exec prisma db push
pnpm --filter @telecalling-crm/api exec prisma db seed
```

### 4. Run Development Servers
```bash
# Terminal 1: Start NestJS API Backend (http://localhost:4000/api)
pnpm dev:api

# Terminal 2: Start Next.js Manager Web Dashboard (http://localhost:3000)
pnpm dev:web
```

---

## 🔑 Default User Credentials

| Role | Email | Password | Primary Interface |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@telecalling.crm` | `Password123!` | Manager Web Dashboard |
| **Operations Manager** | `manager@telecalling.crm` | `Password123!` | Manager Web Dashboard |
| **Telecaller 1 (Amit Verma)** | `caller1@telecalling.crm` | `Password123!` | Mobile Caller App |
| **Telecaller 2 (Sneha Rao)** | `caller2@telecalling.crm` | `Password123!` | Mobile Caller App |

---

## 📱 Mobile App (Android Hardware Connection)

When testing with a physical Android device connected via USB:
```bash
# Enable port forwarding from device to your computer
adb reverse tcp:4000 tcp:4000
adb reverse tcp:3000 tcp:3000

# Launch the app on phone
adb shell monkey -p com.telecalling.crm -c android.intent.category.LAUNCHER 1
```

---

## 🛡️ Safe Simulation Mode

By default, the project runs with **`CFG_SIMULATION_MODE="true"`**:
- Dialing prospects simulates realistic call latencies (1200ms ring) and connected durations (25s - 75s).
- **Zero actual cellular calls are placed to real phone numbers.** Real subscribers are never disturbed.
- All call logs, dispositions, follow-ups, and WhatsApp templates are processed realistically through the CRM pipeline.
- To switch to live carrier dialing in production, toggle **Dialing Mode** to *"Live Carrier Calls"* in Mobile App Settings.

---

## 🐳 Docker Production Deployment

Launch the complete production stack (Nginx, API, Web, Postgres, MinIO, and Daily Backup Cron):
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
- **Web Dashboard:** `http://localhost:80` (or your domain)
- **API Documentation:** `http://localhost:80/api/docs`
- **S3 MinIO Console:** `http://localhost:9001`
- **Database Backups:** Automatically saved to `backups_data` volume at 02:00 AM daily.

---

## 🧪 Automated Testing & Quality Verification

Run the full suite of **56 automated quality gates**:
```bash
# Run all phase verification suites (Phase 1 through 7)
pnpm run test:verification
pnpm run test:phase3
pnpm run test:phase4
pnpm run test:phase5
pnpm run test:phase6
pnpm run test:phase7

# Run high-concurrency offline stress tests
pnpm run test:offline-stress

# Run monorepo typecheck, linting, and build
pnpm run typecheck
pnpm run lint
pnpm run build
```

---

## 📜 Standard Operating Procedures (SOP)
For detailed operational instructions, user workflows, and compliance guidelines, read:
👉 **[Standard Operating Procedures & Master User Guide](docs/SOP_AND_USER_GUIDE.md)**
