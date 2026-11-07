# Telecalling CRM — Standard Operating Procedures (SOP) & Master User Guide

**Document Version:** 1.0.0  
**Target Audience:** System Administrators, Operations Managers, Quality Assurance / Field Testers, and Telecallers  
**Repository:** [github.com/KaranGond/CRM.git](https://github.com/KaranGond/CRM.git)  

---

## Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [SOP-01: System Startup & Environment Restart](#2-sop-01-system-startup--environment-restart)
3. [SOP-02: Roles, Permissions & Default Credentials](#3-sop-02-roles-permissions--default-credentials)
4. [SOP-03: Telecaller Mobile App Operational Guide](#4-sop-03-telecaller-mobile-app-operational-guide)
5. [SOP-04: Manager Web Dashboard Operational Guide](#5-sop-04-manager-web-dashboard-operational-guide)
6. [SOP-05: Human Intervention & Testing Guide (Safe Simulation Mode)](#6-sop-05-human-intervention--testing-guide-safe-simulation-mode)
7. [SOP-06: Infrastructure, Backups & Production Deployment](#7-sop-06-infrastructure-backups--production-deployment)
8. [Troubleshooting & Frequently Asked Questions (FAQ)](#8-troubleshooting--frequently-asked-questions-faq)

---

## 1. System Overview & Architecture

Telecalling CRM is an enterprise-grade, offline-first customer relationship management and high-velocity dialing system. Built specifically for high-call-volume industries (Solar Energy, Real Estate, BFSI, Education, and Logistics), it combines native Android telephony hooks with a modern NestJS API, PostgreSQL system of record, MinIO S3 call recording storage, and a Next.js 16 Web Dashboard.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TELECALLING CRM TOPOLOGY                        │
├────────────────────────────────┬───────────────────────────────────────┤
│    TELECALLER MOBILE CLIENT    │         MANAGER WEB DASHBOARD         │
│   (React Native Expo + Kotlin) │          (Next.js 16 Webpack)         │
│  • Auto-Dialer & Countdown     │  • Live Shift Board & KPI Velocity    │
│  • Two-Tap Dispositions        │  • In-Browser Audio Player Scrubber   │
│  • Local SQLite Store (WAL)    │  • Lead Timeline & Bulk Rebalancing   │
│  • Background WorkManager Sync │  • Fleet Diagnostics & Benchmark Hub  │
└───────────────┬────────────────┴───────────────────┬───────────────────┘
                │ HTTP / REST                        │ HTTP / REST
                ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        API BACKEND (NestJS 12)                         │
│  • JWT Auth & Replay-Defended Refresh Rotation                         │
│  • Monotonic Sequence Change-Feed Sync Engine                          │
│  • Call Capture & Deduplication Engine (SHA-256 Hashes)                │
│  • WhatsApp Cloud API Dispatcher & Webhook Gateway                     │
│  • S3 Presigned Streaming URL Generator (600s TTL)                     │
└───────────────┬────────────────────────────────────┬───────────────────┘
                ▼                                    ▼
┌───────────────────────────────┐    ┌───────────────────────────────────┐
│     POSTGRESQL 16 DATABASE    │    │      MINIO S3 OBJECT STORAGE      │
│  • Compound-Indexed Queries   │    │  • Multi-OEM Call Audio Files     │
│  • Immutable Audit Trails     │    │  • 100MB Direct Ingestion Bounds  │
└───────────────────────────────┘    └───────────────────────────────────┘
```

---

## 2. SOP-01: System Startup & Environment Restart

### 2.1 Prerequisites
- **Node.js:** v22.0.0 or higher
- **Package Manager:** `pnpm` (v9.10+)
- **Containers:** Docker & Docker Compose
- **Mobile Hardware (Optional for live testing):** Android device (Android 10 - 15) with Developer Options & USB Debugging enabled.

### 2.2 Local Development Startup (Step-by-Step)
1. **Ensure Database & MinIO Containers are Running:**
   ```bash
   docker ps
   # If not running:
   docker compose up -d postgres minio
   ```
2. **Apply Database Schema & Seed Data:**
   ```bash
   pnpm --filter @telecalling-crm/api exec prisma db push
   pnpm --filter @telecalling-crm/api exec prisma db seed
   ```
3. **Start NestJS API Backend (Port 4000):**
   ```bash
   pnpm --filter @telecalling-crm/api run dev
   # Verify: http://localhost:4000/api/docs (Swagger UI)
   ```
4. **Start Manager Web Dashboard (Port 3000):**
   ```bash
   pnpm --filter @telecalling-crm/web run dev
   # Verify: http://localhost:3000
   ```
5. **Connect Android Device via USB (If testing on hardware):**
   ```bash
   # Enable port forwarding so phone reaches your Mac's localhost
   adb reverse tcp:4000 tcp:4000
   adb reverse tcp:3000 tcp:3000
   adb reverse tcp:8081 tcp:8081

   # Launch app on phone
   adb shell monkey -p com.telecalling.crm -c android.intent.category.LAUNCHER 1
   ```

### 2.3 Single-Command Production Docker Startup
For turnkey client deployment, run the unified multi-container stack:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
This launches:
- `telecalling_api` (NestJS on port 4000)
- `telecalling_web` (Next.js on port 3000)
- `telecalling_postgres` (Postgres 16 on port 5432)
- `telecalling_minio` (MinIO S3 on ports 9000 & 9001)
- `telecalling_nginx` (Reverse proxy on ports 80 & 443)
- `telecalling_backup_cron` (Automated daily 02:00 AM backup worker)

---

## 3. SOP-02: Roles, Permissions & Default Credentials

The platform features strict Role-Based Access Control (RBAC):

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@telecalling.crm` | `Password123!` | Full CRM access, user management, system configs, audit logs, compliance rules. |
| **Operations Manager** | `manager@telecalling.crm` | `Password123!` | Shift KPIs, lead rebalancing, audio scrubbing, telecaller fleet telemetry, benchmark reports. |
| **Telecaller 1** | `caller1@telecalling.crm` | `Password123!` | Mobile dialer app, own assigned leads queue, call logging, dispositions, WhatsApp triggers. |
| **Telecaller 2** | `caller2@telecalling.crm` | `Password123!` | Mobile dialer app, own assigned leads queue, call logging, dispositions, WhatsApp triggers. |

---

## 4. SOP-03: Telecaller Mobile App Operational Guide

### 4.1 First-Time Setup & Device Pairing
1. Launch the **Telecalling CRM** app on the Android smartphone.
2. Sign in using assigned credentials (e.g., `caller1@telecalling.crm` / `Password123!`).
3. **Grant Required Permissions:**
   - **Phone & Call Log:** Required for detecting call connection, duration, and end transitions.
   - **Battery Optimization:** Select "Don't Optimize" / "Allow Background Execution" to prevent aggressive OEM OS task-killers (MIUI, HyperOS, ColorOS, FuntouchOS) from killing background sync.
   - **Call Recordings Folder:** Select the device's native call recordings folder (e.g., `Recordings/Call` on Samsung, `Recordings/Call Recordings` on Realme/Oppo/OnePlus).

### 4.2 Shift Home Screen & Priority Queue
- The Home screen displays:
  - **Today's Target & Streak:** Calls completed vs daily quota.
  - **Quick Stats:** Total leads, connected calls, interested prospects, pending follow-ups.
  - **Next Contact in Queue Card:** Shows prospect name, interest category, assigned SIM, and the **Mandatory DPDP Recording Disclosure script**.
  - **Quick Actions:** `Call Now`, `Start Auto-Dial`, and `Queue (N)`.
  - **Bottom Navigation Bar '+' Button:** Instant modal to add a fresh inbound lead directly into the CRM.

### 4.3 Using the Auto-Dialer & Cockpit Deck
1. Tap **"Start Auto-Dial"** on the Shift card.
2. **Select Pacing Gap:** Choose between **3s**, **5s**, **8s**, or **10s** gap between consecutive calls. (Your choice is persisted in local SQLite).
3. **Countdown Ring:** Visual countdown ticks down to zero before dialing the next eligible prospect.
4. **Interactive Controls:**
   - **Pause / Resume:** Halts the countdown if the caller needs time to review previous notes.
   - **Skip Lead:** Moves to the next lead in queue without dialing.
   - **Dial Now:** Bypasses remaining countdown seconds to dial immediately.
   - **Stop:** Exits the auto-dialing session cleanly and returns to Home.

### 4.4 In-Call Protocol & DPDP Disclosure
1. When the call connects, read the **Mandatory Verbal Disclosure**:
   > *"Namaste [Customer Name], this call is from SolarCRM and may be recorded for quality, documentation, and training purposes."*
2. Conducting the call updates the session talk time and velocity HUD in real-time.

### 4.5 Two-Tap Post-Call Disposition
1. When the call terminates, the **Disposition Bottom Sheet** automatically appears:
   - **Interested:** Automatically advances pipeline stage to "Follow-up Scheduled" and opens calendar date-time picker.
   - **Callback Requested:** Prompts for scheduled callback window.
   - **Deal Closed / Converted:** Advances lead to "Converted".
   - **Not Interested / DND:** If prospect requests opt-out, selecting DND marks `dnd = true` and permanently removes them from all auto-dialer queues.
2. **Send WhatsApp Brochure:** Toggle the WhatsApp checkbox to instantly dispatch the official digital brochure PDF and quotation template to the customer.
3. Tap **"Save Disposition"**: Takes `<0.05ms` to commit to SQLite, enqueues mutation in outbox, and auto-advances to the next lead.

### 4.6 Offline Operation & 72-Hour Lease
- All assigned leads, contact numbers, and dispositions are cached locally in SQLite with Write-Ahead Logging (WAL).
- **If Internet drops:** The telecaller can continue calling and logging dispositions without interruption. All actions accumulate in the local Outbox.
- **When Internet recovers:** WorkManager and the in-app `SyncClient` automatically push all queued mutations to the server and pull new lead assignments.
- **72-Hour Security Lockout:** If the device remains offline for more than 72 continuous hours, the dialer locks with an amber warning badge until reconnected to ensure lead ownership data remains fresh.

---

## 5. SOP-04: Manager Web Dashboard Operational Guide

Open **`http://localhost:3000`** in any web browser and log in as `admin@telecalling.crm` or `manager@telecalling.crm`.

### 5.1 Shift Board & Real-Time KPIs
- **Top Metric Cards:**
  - **Total Leads:** Cumulative active contacts in CRM.
  - **Calls Today:** Gross call attempts logged across all telecallers.
  - **Connected Calls:** Total calls with duration > 0s (and real-time Connect Rate percentage).
  - **Avg Talk Time:** Connected call duration benchmark (seconds/call).
  - **Pending Follow-ups:** Today's callbacks requiring attention.
  - **Active Callers:** Number of telecallers logged in and active on shift.

### 5.2 Lead Management & Filtering
- Filter leads instantaneously by:
  - **Pipeline Stage:** New Lead, Contacted, Follow Up Scheduled, Converted.
  - **Lead Source:** Website Inbound, Meta Ads, Direct Referral, Google Search.
  - **Assignee:** Filter to specific telecaller queues or unassigned leads.
  - **Text Search:** Live substring matching against customer name, phone number, and city.
- **Adding a Lead:** Click **"+ Add Lead"** in the top right to register a new lead with custom notes and assign a caller.
- **Bulk CSV Import:** Click **"Import CSV"** to upload lead batches. Includes automatic E.164 phone normalization and round-robin caller assignment.

### 5.3 Bulk Reassignment & Load Balancing
1. Select one or multiple leads using table checkboxes.
2. Choose target telecaller from the **"Reassign To"** dropdown.
3. Enter a mandatory operational reason (e.g., *"Shift rebalancing"* or *"Leave coverage"*).
4. Click **"Apply Reassignment"**: Reassignment is committed in an atomic database transaction, logged to the lead's permanent audit trail, and propagated to the telecaller's offline mobile queue on next sync.

### 5.4 Lead Chronological Timeline & Audio Scrubbing
- Click any Lead row to open the **Lead Activity & Audit Drawer**:
  - View full history of calls, dispositions, remarks, and scheduled follow-ups.
  - **Audio Scrubber:** If a call recording was captured, an in-browser audio player allows the manager to stream and scrub the call recording. Audio playback uses presigned MinIO S3 streaming URLs (valid for 10 minutes) to prevent unauthorized public exposure.

### 5.5 Fleet Diagnostics & Recording Audit
- Navigate to the **"Hardware Fleet & Diagnostics"** tab:
  - View every registered telecaller device, Android version, app build, battery optimization status, and call recording folder health.
  - **Universal OEM Guidance:**
    - Samsung / Xiaomi / Vivo: Native recording active.
    - Oppo / Realme / OnePlus with Google Dialer: Advisory prompt to install **ODialer** for automatic recording without Google announcement chimes.
    - Protected Google Dialer: Flagged as `UNSUPPORTED_DEVICE` so managers know duration and dispositions are logged accurately even if Google restricts local audio file scraping.

### 5.6 Compliance & Configuration Tab
- **TRAI Calling Hours Window:** Enforces 09:00 AM to 08:00 PM IST calling bounds.
- **DND Central Registry:** View and manage numbers that opted out via WhatsApp keyword `STOP` or verbal refusal.
- **WhatsApp Template Registry:** Inspect approved Meta Cloud API message templates and variable interpolation previews.

### 5.7 Pilot Benchmark Analytics (RMDialer Comparison)
- Navigate to the **"Pilot Benchmark"** tab:
  - Compares SolarCRM performance against legacy RMDialer metrics across dials/day, recording coverage, and sync latency.
  - Live enterprise pilot metrics demonstrate:
    - **Dials/Day:** +880% velocity improvement.
    - **Recording Coverage:** 100% vs 82.1% on OEM dialers.
    - **Sync Speed:** 18.8x faster offline reconciliation.

---

## 6. SOP-05: Human Intervention & Testing Guide (Safe Simulation Mode)

### 6.1 Understanding Safe Simulation Mode
To allow software testing, end-to-end demonstrations, and quality assurance audits **without placing real cellular phone calls or disturbing real subscribers**, the project operates in **Safe Simulation Mode** by default:
- Backend: `CFG_SIMULATION_MODE="true"`
- Mobile: `cfg_simulation_mode: "true"`

### 6.2 How Safe Simulation Mode Operates
1. When a user or tester taps **"Call Now"** or starts **"Auto-Dial"**:
   - The phone does NOT emit cellular RF signals or dial carrier lines.
   - The native telephony engine pauses for 1200ms (to emulate network ring latency).
   - Generates a simulated connected call with realistic duration (25s - 75s).
   - Emits the native `callEnded` event to React Native.
   - Automatically surfaces the Two-Tap Disposition bottom sheet.
   - Enqueues the call and disposition into the offline SQLite database and syncs to backend.
2. **Benefit:** Testers can test 100+ calls, dispositions, WhatsApp dispatches, and dashboard updates in minutes with zero airtime cost and zero spam risk.

### 6.3 Switching to Live Carrier Dialing (Field Production)
When handing over to telecallers for live commercial calls:
1. In the Mobile App, navigate to **Settings / More ➔ Dialing Mode**.
2. Switch **Simulation Mode** to **"Live Carrier Calls"**.
3. The app will immediately use Android's native `Intent.ACTION_CALL` to route calls through the selected SIM card.

---

## 7. SOP-06: Infrastructure, Backups & Production Deployment

### 7.1 Multi-Container Production Topology
Deploy with standard Docker Compose:
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 7.2 Automated Database Backups
- The `backup_cron` container automatically runs [`scripts/backup-db.sh`](file:///Users/ratneshmishra/Developer/telecalling-crm/scripts/backup-db.sh) every night at 02:00 UTC.
- **Backup Location:** Persistent Docker volume `backups_data` mounted at `/backups`.
- **Format:** Gzip-compressed timestamped SQL dump (`telecalling_crm_YYYYMMDD_HHMMSS.sql.gz`).
- **Integrity Check:** Uses `gzip -t` to guarantee archive consistency before committing.
- **Retention:** Automatically prunes snapshots older than 30 days.

### 7.3 Manual On-Demand Backup
To take an immediate snapshot before upgrades or data migrations:
```bash
docker exec -it telecalling_backup_cron /usr/local/bin/backup-db.sh
```

### 7.4 Restoring Database from Backup
```bash
gunzip < /backups/telecalling_crm_TIMESTAMP.sql.gz | docker exec -i telecalling_postgres psql -U telecalling -d telecalling_crm
```

---

## 8. Troubleshooting & Frequently Asked Questions (FAQ)

### Q1: The mobile app displays "Network Error" when logging in.
- **Cause:** Android device cannot reach the API on your development host.
- **Resolution:**
  1. If testing via USB cable, run: `adb reverse tcp:4000 tcp:4000`.
  2. If testing over Wi-Fi, ensure your phone and computer are on the same Wi-Fi network, and update `EXPO_PUBLIC_API_URL` to your Mac's LAN IP (e.g. `http://192.168.1.49:4000/api`).

### Q2: Why are call recordings not matching on Oppo / Realme devices?
- **Cause:** Google Phone app (Google Dialer) is active as default dialer, which blocks third-party apps from scraping call audio.
- **Resolution:**
  1. Open Google Play Store on the device and install **ODialer** (official ColorOS/Realme dialer by ColorOS).
  2. Set ODialer as Default Phone App.
  3. Enable "Auto record calls" in ODialer settings. Recordings will save to `Recordings/Call Recordings` and match automatically.

### Q3: How do I know if an offline sync succeeded?
- In the Web Dashboard header, the green indicator shows **"Backend: Operational • Last Sync: [Timestamp]"**.
- In the Mobile App, sync status is indicated by the green **"Live"** pill in the top header. If changes are pending in the outbox, an amber pill displays the pending mutation count.

### Q4: How is customer privacy and DND respected?
- If a customer says "Do Not Call" or sends "STOP" on WhatsApp:
  - The prospect is marked `dnd = true` in PostgreSQL and synced to all mobile offline caches.
  - The Auto-Dialer strictly filters out all DND records.
  - The WhatsApp dispatch engine rejects template sends to DND numbers with an explicit DPDP compliance block.
