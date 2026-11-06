# Telecalling CRM — Master Build Plan

> **Single source of truth.** This plan consolidates every decision from
> `Knowledge.txt` and `Dicission.txt`. It describes what to build, in what
> order, with what technology, and why. Read it top to bottom before writing
> any code. When this document and any other document conflict, this one wins.

---

## 1. Goal, Scope, and Assumptions

**Goal:** Replace RMDialer with your own system. Telecallers call assigned
leads from their own SIM and log a two-tap disposition and follow-up. Managers
see live per-caller results. WhatsApp comes next, and cloud telephony / IVR
later. Keep RMDialer running until the pilot passes.

### In v1

- Android callers only, own-SIM calling through the manufacturer system dialer
- Call-log capture (duration + outcome)
- **Universal Android Phone Dialer & Call Recording:** Works with manufacturer native dialers across Samsung, Xiaomi/Redmi/Poco, Vivo/iQOO, Oppo/Realme, and OnePlus. Stock recorder files sync to S3/MinIO via SAF. On phones using Google Dialer where local files cannot be read via SAF, call logging and dispositions remain 100% functional, and the call is marked `recordingStatus: UNSUPPORTED_DEVICE` on manager audits without blocking telecallers.
- Lead import (CSV), round-robin assignment, configurable dispositions and
  pipeline stages
- Follow-ups with reminders
- Live manager dashboard (polling-based)
- Device health monitoring (heartbeat, sync status, diagnostics)
- WhatsApp templates via official Business API
- Offline-first: the phone holds the working SQLite copy and the server settles
  conflicts via `/sync/push` and `/sync/pull`
- **Recording consent design:** Mandatory telecaller opening disclosure on Lead Card +
  consent audit log (`Consent` record of type `RECORDING`)

### Not in v1

- Default-dialer role / incoming-call popups (Route B — later upgrade)
- iOS calling (iPhone users use the web dashboard)
- In-app call-audio recording (the phone's dialer records; the app syncs)
- Cloud telephony fallback / IVR (dropped from v1; add as separate phase only if pilot fails)
- Multi-tenancy (add `orgId` if you ever resell)
- Over-the-air (OTA) updates (deferred until after the pilot; ship direct signed APKs)

### Assumptions & Universal Multi-OEM Android Support

- 5–50 callers, single tenant, India hosting.
- One TypeScript-first developer (you).
- APK handed out directly (signed release build).
- **Universal Multi-OEM Android Support:** Supports all major Android phone brands in India:
  1. **Samsung (One UI):** Native Samsung dialer with auto-record enabled; recording path: `Recordings/Call` or `Sounds/Call`.
  2. **Xiaomi / Redmi / Poco (MIUI / HyperOS):** Native Mi dialer & Sound Recorder; recording path: `MIUI/sound_recorder/call_rec`.
  3. **Vivo / iQOO (Funtouch OS / OriginOS):** Native Vivo dialer; recording path: `Record/Call`.
  4. **Oppo / Realme / OnePlus (ColorOS / Realme UI / OxygenOS):** Native dialer / ODialer with auto-record; recording path: `Recordings/Call Recordings` or `Record/Call`.
  5. **Google Dialer / Stock Android (Pixel, Motorola, etc.):** Setup wizard prompts users to install/switch to their OEM recording dialer (e.g., ODialer for Oppo/OnePlus). If Google Dialer is retained, calls, durations, and outcomes log with 100% accuracy, and recording status is flagged as `UNSUPPORTED_DEVICE` on audit dashboards. Telecallers are never blocked from calling.
- **Universal Setup Wizard & Calibration Checklist:**
  1. **OEM Brand Auto-Detection:** App detects `Build.MANUFACTURER` and suggests the brand-specific recording folder and dialer setup instructions.
  2. **Auto-Record Enabled in Phone Settings:** Caller enables "Record all calls automatically" in phone's dialer settings.
  3. **Wi-Fi Calling (VoWiFi) toggled OFF:** VoWiFi routing commonly breaks dialer call-log emission and recording sync.
  4. **Initial Test Call:** One test call made to ensure the phone OS creates the recording directory.
  5. **SAF Folder Permission:** Storage Access Framework picker prompts user to grant access to their brand's recording folder.
  6. **Battery Optimization Disabled:** Battery optimization set to Unrestricted to prevent background task termination.
- **Recording Volume & Storage Costing:**
  - Standard baseline: ~0.5 MB per recorded minute, 3-minute average duration = ~1.5 MB per connected call.
  - At 7,500 calls/day with a ~40% connect rate (3,000 connected calls), expect **~4.5 GB/day** of audio uploads (~135 GB/month, >1.6 TB/year).
  - Each caller's phone uploads ~90 MB to 225 MB per shift: **Upload recordings on Wi-Fi by default** (with optional cellular fallback toggle in diagnostics).
  - Storage policy: 90-day retention on hot S3 storage before Glacier archival; strict RBAC so only authorized managers can stream audio.
- **Accurate Definition of Recording Coverage:**
  - Unanswered or busy calls (duration 0) produce NO audio file in the phone dialer.
  - Recording Coverage is defined strictly over supported recording devices:
    $$\text{Coverage} = \frac{\text{Connected calls with recording file}}{\text{Total connected calls with duration} \ge 10\text{s on supported devices}} \times 100\%$$
  - Calls with duration $< 10$s or 0s are classified as `NOT_APPLICABLE`. Connected calls $\ge 10$s on supported devices lacking audio are flagged as `MISSING`. Calls on Google Dialer without file access are classified as `UNSUPPORTED_DEVICE` (clearly highlighted with an amber badge on audit reports).
- Callers work a full shift offline; 72-hour offline lease anchored to `lastSyncAt`.
- One phone per caller. Web dashboard is online-only.

---

## 2. Hard Constraints That Shape the Design

| #   | Constraint                                                                                                                            | Impact                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Play Store** restricts `READ_CALL_LOG` to default Phone/Assistant apps                                                              | Ship as signed APK, not via Play                                                                                                                                                                                                  |
| 2   | **Sideloading rules:** Developer verification started 30 Sept 2026 in 4 countries, expands globally 2027. India expected 2027 wave.   | Register on Android Developer Console **now**                                                                                                                                                                                     |
| 3   | **Recording:** Android 6 blocked call recording, Android 10 blocked mic recording. Only manufacturer stock dialers access call audio. | App never records audio directly. Multi-OEM stock dialers (Samsung, Xiaomi, Vivo, Oppo, OnePlus) record → app syncs files via SAF. Google Dialer phones without file access log calls with `recordingStatus: UNSUPPORTED_DEVICE`. |
| 4   | **iOS** can't read call logs or place SIM calls                                                                                       | Callers = Android only. iPhone users = web dashboard                                                                                                                                                                              |
| 5   | **Background killing:** Android OEMs kill background apps aggressively                                                                | Call log is source of truth. Reconcile on every app start and shift resume                                                                                                                                                        |
| 6   | **Route A limit:** Call log shows duration and type, not why unanswered (busy, rejected, no answer).                                  | Accept for v1                                                                                                                                                                                                                     |
| 7   | **OTA updates deferred:** OTA adds bundler complexity during pilot                                                                    | Ship direct signed APKs; revisit OTA post-pilot                                                                                                                                                                                   |

---

## 3. System Architecture

### 3.1 Level 1 — Containers

```
                                        ┌─ Caller's Android phone ──────────────────────┐
┌──────────────────────────────┐        │ Expo screens (React Native + TS)              │
│ Web dashboard                │        │       ▲ │  commands and events                │
│ Next.js, manager's browser   │        │       │ ▼                                     │
└──────────────────────────────┘        │ Kotlin engine                                 │
                │                       │ Room outbox, WorkManager sync,                │
                │                       │ call watcher, reconcile, uploads              │
                │                       │                                               │
                │                       └───────────────────────────────────────────────┘
                │ REST + SSE                                   ▲                       ▲
                │                                              │  REST, uploads, push  │
                │                                              ▼                       │
                │                          ┌──────────────────────────────────────┐    │
                │                          │ Phone system (Android)               │    │
                │                          │ dialer, call log, recorder folder    │    │
                │                          └──────────────────────────────────────┘    │
                │                                                                      │
                ▼                                                                      ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NestJS API                                                                             │
│ auth, devices, leads, calls, follow-ups, config, reports, recordings                   │
│ webhooks, queue workers, live gateway (SSE), push (FCM)                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
         │                     │                     │                      │
         ▼                     ▼                     ▼                      ▼
 ┌───────────────┐     ┌───────────────┐     ┌───────────────┐    ┌──────────────────────┐
 │ PostgreSQL    │     │ (Redis later) │     │ Object storage│    │ WhatsApp, Firebase,  │
 └───────────────┘     └───────────────┘     └───────────────┘    │ cloud telephony      │
                                                                   │ (later)              │
                                                                   └──────────────────────┘
```

### 3.2 Inside the Phone

```
┌─ Expo app (one APK) ───────────────────────┐
│                                            │      ┌──────────────┐
│  Screens                                   │      │              │
│  React Native + TypeScript ────────────────┼─────▶│              │
│              ▲                             │      │              │
│              │                             │      │  NestJS API  │
│              ▼                             │      │              │
│  Kotlin engine module                      │      │              │
│  dial, capture, queue, sync ───────────────┼─────▶│              │
│                                            │      └──────────────┘
└─────────────────────┬──────────────────────┘
                      ▲
                      │
                      ▼
  Phone system: dialer, call log, recorder
```

The Kotlin engine owns everything that has to keep running without the screens:
dialing, call capture, the local queue, sync, recording pickup, and heartbeat.
Expo only draws the UI.

### 3.3 Level 2 — Components

| Container           | Components                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine (Kotlin)** | Setup and permissions, SIM manager, dialer, call watcher, call-log reader and reconciler, Room outbox, sync worker, recording scanner and uploader, heartbeat and diagnostics, config and token stores, module interface                              |
| **Screens (Expo)**  | Login, setup checklist, queue, lead card, disposition sheet, follow-ups, settings and diagnostics, offline banners, sync status                                                                                                                       |
| **API modules**     | Auth, users and roles, devices, leads (import, dedupe), assignment, calls, dispositions and pipeline config, follow-ups, recordings, reports and live, messaging, telephony (provider interface and webhooks), sync (pull/push), notifications, audit |
| **Web pages**       | Login, leads (filters, bulk assign), import, lead timeline, follow-up calendar, live board, reports, device health, config (dispositions, stages, templates, recorder-path patterns), users, recording playback                                       |

---

## 4. Final Tech Stack

### A. Phone — Screens (React Native / TypeScript)

| Technology                                               | Problem it solves                                        | Why this one                                                   | Used for                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Expo SDK 57 + React Native + TypeScript (dev build)      | UI changes constantly with user feedback                 | Shares Zod types and `api-client` with API and web; hot reload | Login, queue, lead card, disposition sheet, follow-ups, setup checklist, diagnostics |
| expo-sqlite                                              | Queue should show instantly and work offline             | Simple, in the Expo toolchain                                  | UI-only cache of leads and config (calls live in Room)                               |
| expo-updates + self-hosted update server (or EAS Update) | Fixing a UI bug shouldn't mean reinstalling on 50 phones | Standard protocol, no lock-in                                  | JS and asset updates, gated by runtime version = engine version                      |
| Local notifications + Firebase Cloud Messaging           | New-lead alerts, "sync now", reminders on time           | Standard Android push; reminders work offline                  | Server pushes; local follow-up reminders                                             |
| Firebase Crashlytics                                     | Crashes on odd phone models go unseen                    | Free native crash reports                                      | App and engine crashes                                                               |
| Signed APK + in-app update check                         | Distribution outside Play                                | Required by constraints 1 and 2                                | Direct install; prompt for new APKs                                                  |

### B. Phone — Kotlin Engine (local Expo module `modules/telephony-engine`)

| Technology                                                                           | Problem it solves                                     | Why this one                                                        | Used for                                                                    |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Expo Modules API + config plugin                                                     | JavaScript can't reach Android telephony              | Official way to host Kotlin in Expo; plugin writes manifest entries | Hosts the engine                                                            |
| Android Telecom (`TelecomManager`, `PhoneAccountHandle`)                             | Dial on the right SIM in a dual-SIM phone             | Platform API, no library                                            | `dial()` on a chosen SIM, `listSims()`                                      |
| Call-state listener (`TelephonyCallback` on Android 12+, `PhoneStateListener` below) | Know when a call ends                                 | Platform API                                                        | Triggers capture at hang-up                                                 |
| `CallLog` content provider                                                           | Exact talk time, type, SIM; survives app kills        | Android's own record                                                | Read with brief retry; reconcile                                            |
| Room                                                                                 | Lost calls on crash or offline                        | Jetpack standard, survives process death                            | Outbox: calls, dispositions, upload jobs, recording candidates              |
| WorkManager                                                                          | Reliable background sync                              | Backoff, constraints, reboot handling                               | Sync, reconcile, heartbeat, recording scan                                  |
| DataStore + Keystore-backed storage                                                  | Sync must work with the UI closed                     | Platform-secured                                                    | Config and tokens                                                           |
| Storage Access Framework                                                             | Read the recorder folder without broad storage access | User grants one folder once                                         | Recording pickup                                                            |
| Hand-written OkHttp client (~6 endpoints)                                            | Kotlin can't import Zod                               | Simpler than OpenAPI codegen; add a contract test to catch drift    | Engine calls the API (sync pull/push, token refresh, heartbeat, upload URL) |

> **Why hand-written OkHttp, not OpenAPI codegen?** The engine calls about six
> endpoints. A generated client adds complexity for no gain. Add a contract test
> (send a known payload, check the response) to catch drift.

### C. Backend

| Technology                                                | Problem it solves                                                | Why this one                                                                 | Used for                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| NestJS 12, TypeScript                                     | Many modules need structure                                      | Matches scaffold; DI, guards                                                 | REST API, workers                                                           |
| PostgreSQL 16 + Prisma (`migrate`)                        | Reliable data, safe schema changes                               | Relational fit; types match Zod                                              | System of record                                                            |
| JWT access + rotating refresh (Passport), RBAC            | Per-device login, role limits                                    | Already scaffolded                                                           | admin, manager, telecaller                                                  |
| Zod + OpenAPI (`@nestjs/swagger`)                         | Validation; contract for web and Kotlin                          | One source of truth                                                          | Validates input; generates clients                                          |
| Offline sync layer (inside the API)                       | Change feed with a sequence cursor, mutation log, conflict rules | Custom code on purpose — sync bugs are the hardest to find                   | `/sync/pull` and `/sync/push`                                               |
| PostgreSQL job table (pg-boss or custom)                  | Webhooks must reply fast; retries; schedules                     | Simpler than Redis + BullMQ for v1 at 50 callers; removes one service to run | Imports, WhatsApp sends, webhook processing, stale-device checks, reminders |
| Polling (SSE later)                                       | Live dashboard                                                   | Start simple; add SSE when managers need it                                  | Live stats                                                                  |
| S3-compatible storage + presigned URLs                    | Recordings don't belong in the database                          | Phones upload directly                                                       | Recording files                                                             |
| firebase-admin                                            | Send push from the API                                           | Official SDK                                                                 | FCM messages                                                                |
| libphonenumber-js (or ~30-line custom for Indian mobiles) | Duplicate leads from formatting                                  | Standard                                                                     | E.164 normalization, dedupe                                                 |

> **v1 simplification:** Redis + BullMQ is the conventional choice but overkill
> at 50 callers. Start with a jobs table in Postgres (pg-boss). Add Redis when
> load demands it.

### D. Web Dashboard

| Technology                                     | Problem it solves                                        | Why this one                        | Used for         |
| ---------------------------------------------- | -------------------------------------------------------- | ----------------------------------- | ---------------- |
| Next.js 16, React, TypeScript                  | Managers need a console in any browser, including iPhone | Same language, shared packages      | Dashboard pages  |
| TanStack Query + Tailwind                      | Data fetching, fast UI                                   | Common and productive               | Tables, filters  |
| Plain tables first; shadcn/ui + Recharts later | Charts add complexity                                    | Add them when managers actually ask | Lead list, stats |

### E. Integrations

| Technology                                                      | Problem it solves                                           | Why this one                      | Used for                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- | ------------------------------------------------- |
| WhatsApp Business API (official)                                | Automated follow-ups; unofficial libraries risk number bans | Templates and consent             | Template sends, delivery webhooks                 |
| n8n (optional)                                                  | Automations without code                                    | Optional layer on webhooks        | Reacts to `call.completed`, `lead.status_changed` |
| Cloud telephony behind `TelephonyProvider`, e.g. Exotel (later) | Server-side recording, IVR, iPhone callers                  | Channel abstraction in the schema | Click-to-call and call webhooks                   |

### F. Dev and Ops

| Technology                                     | Problem it solves                           | Why this one                        | Used for                                       |
| ---------------------------------------------- | ------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| pnpm + Turborepo + tsdown                      | Shared code; `tsup` is no longer maintained | tsdown is its recommended successor | Monorepo: api, web, mobile, shared, api-client |
| Docker Compose (Postgres, MinIO)               | Same local environment for everyone         | Matches production                  | Dev setup                                      |
| GitHub Actions                                 | Catch breakage                              | Standard                            | Lint, test, build, migrate, signed APK         |
| Sentry (API, web) + Firebase Crashlytics (app) | Production errors                           | Standard                            | Alerts and crash reports                       |
| Managed Postgres + containers, India region    | Latency, residency, backups                 | Simple ops                          | Hosting                                        |

### G. Shared Packages (pnpm workspace)

| Package               | Contents                                       | Consumed By                |
| --------------------- | ---------------------------------------------- | -------------------------- |
| `packages/shared`     | Zod schemas, inferred types, utility functions | API, web, mobile (screens) |
| `packages/api-client` | Typed fetch-based API client                   | Web, mobile (screens)      |

Both built with `tsdown` to CJS + ESM with `.d.ts`. The Kotlin engine uses
a hand-written OkHttp client instead (it can't import Zod).

### H. Database Placement

| Where           | Technology                                            | Why                                                                                                                                                   | What it stores                                             |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Server (main)   | **PostgreSQL 16**, managed, India region, with Prisma | Relational data. Unique constraints for safe retries. Transactions for sync change feed. JSONB for custom fields. Backups with point-in-time recovery | All records, phones in E.164                               |
| Phone, engine   | **SQLite via Room**                                   | Built into Android. Works with UI closed                                                                                                              | Outbox: calls, dispositions, recordings, pending mutations |
| Phone, screens  | **SQLite via expo-sqlite**                            | Fast offline read cache                                                                                                                               | Leads, follow-ups, config, recent calls                    |
| Background jobs | **Jobs table in Postgres** (pg-boss)                  | At 50 callers it's enough; saves running Redis                                                                                                        | Imports, WhatsApp sends, scheduled checks                  |
| Recordings      | **S3-compatible object storage** (MinIO locally)      | Files, not database rows                                                                                                                              | Recording files via presigned URLs                         |

> **Why not MySQL?** Postgres suits JSONB and sync sequences better.
> **Why not MongoDB?** Dedupe, reports, and transactional sync are harder.
> **Why not Supabase?** Fine as a host — use it as plain managed Postgres.

---

## 5. Repo Structure (Target)

```
telecalling-crm/
├── apps/
│   ├── api/                          ← NestJS 12
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── auth/
│   │       ├── devices/
│   │       ├── leads/
│   │       ├── calls/
│   │       ├── followups/
│   │       ├── recordings/
│   │       ├── reports/
│   │       ├── messaging/
│   │       ├── sync/                 ← /sync/pull, /sync/push
│   │       ├── config/
│   │       ├── notifications/
│   │       ├── audit/
│   │       ├── prisma/
│   │       └── main.ts
│   │
│   ├── web/                          ← Next.js 16
│   │   └── src/app/
│   │       ├── (auth)/
│   │       ├── (dashboard)/
│   │       │   ├── leads/
│   │       │   ├── calls/
│   │       │   ├── import/
│   │       │   ├── followups/
│   │       │   ├── reports/
│   │       │   ├── devices/
│   │       │   ├── settings/
│   │       │   └── page.tsx          ← live board
│   │       └── layout.tsx
│   │
│   └── mobile/                       ← Expo SDK 57 (dev build)
│       ├── modules/
│       │   └── telephony-engine/     ← local Expo module (Kotlin)
│       │       ├── android/src/main/kotlin/
│       │       │   ├── TelephonyEngineModule.kt
│       │       │   ├── dialer/
│       │       │   ├── capture/
│       │       │   ├── outbox/
│       │       │   ├── sync/
│       │       │   ├── recording/
│       │       │   └── diagnostics/
│       │       └── expo-module.config.json
│       ├── src/
│       │   ├── screens/
│       │   ├── hooks/
│       │   ├── store/                ← expo-sqlite read model
│       │   └── components/
│       ├── plugins/                  ← config plugin for permissions
│       └── app.json
│
├── packages/
│   ├── shared/                       ← Zod schemas + types + utils
│   └── api-client/                   ← typed fetch client
│
├── docker-compose.yml                ← Postgres + MinIO
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## 6. Data Model

Single tenant. Add `orgId` if you ever resell.

| Entity              | Key Fields                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**            | id, name, phone, email, role, active, passwordHash                                                                                                                                                          | Roles: admin, manager, telecaller                                                                                                                                                                                                                           |
| **Device**          | id, userId, model, androidVersion, appVersion, engineVersion, fcmToken, lastSeenAt, lastSyncAt, clockOffsetMs, diagnostics (JSON)                                                                           | One per phone; remote revoke; clockOffsetMs corrects phone clock skew; lastSyncAt anchors 72h offline lease                                                                                                                                                 |
| **RefreshToken**    | id, userId, deviceId, tokenHash, expiresAt, revokedAt                                                                                                                                                       | Rotating, SHA-256 hashed, device-bound                                                                                                                                                                                                                      |
| **Lead**            | id, name, phoneE164, altPhones, source, stageId, assigneeId, nextFollowUpAt, customFields (JSON), dnd, version, updatedSeq                                                                                  | Unique on phoneE164; versioned for conflict detection                                                                                                                                                                                                       |
| **LeadAssignment**  | id, leadId, fromUserId, toUserId, reason, at                                                                                                                                                                | History survives transfers                                                                                                                                                                                                                                  |
| **PipelineStage**   | id, label, order, active                                                                                                                                                                                    | Configured from dashboard                                                                                                                                                                                                                                   |
| **DispositionType** | id, label, order, active, setsStageId, requiresFollowUp, templateId, version                                                                                                                                | Configured from dashboard; links to WhatsApp template                                                                                                                                                                                                       |
| **CallLog**         | id, leadId?, callerId, deviceId, channel (SIM), dedupeKey, direction, numberE164, startedAt, endedAt, durationSec, outcome, sim, dispositionId?, remark, followUpAt?, recordingId?, recordingStatus, origin | Unique (callerId, dedupeKey); recordingStatus = PENDING / MATCHED / MISSING / NOT_APPLICABLE / UNSUPPORTED_DEVICE (connected calls >=10s evaluated on supported OEMs; Google Dialer calls marked UNSUPPORTED_DEVICE); origin = ENGINE / RECONCILE / WEBHOOK |
| **FollowUp**        | id, leadId, userId, dueAt, note, doneAt                                                                                                                                                                     | Drives caller reminders (due first)                                                                                                                                                                                                                         |
| **Recording**       | id, callLogId, storageKey, source (PHONE_FILE), durationSec, sizeBytes, status                                                                                                                              | Played via short-lived presigned URL (10 min)                                                                                                                                                                                                               |
| **MessageTemplate** | id, waName, language, body, active                                                                                                                                                                          | WhatsApp templates with variable interpolation                                                                                                                                                                                                              |
| **MessageLog**      | id, leadId, templateId, status, providerMessageId, error, at                                                                                                                                                | Status: QUEUED, SENT, DELIVERED, READ, FAILED                                                                                                                                                                                                               |
| **Consent**         | id, leadId, type (WHATSAPP/RECORDING/CALL), granted, source, at                                                                                                                                             | Checked before sends/calls; explicit opt-out blocks delivery                                                                                                                                                                                                |
| **ImportJob**       | id, fileKey, status, counts, errors                                                                                                                                                                         | CSV imports                                                                                                                                                                                                                                                 |
| **Config**          | key, valueJson, version                                                                                                                                                                                     | Server-driven rules (call gap, recorder patterns, hours)                                                                                                                                                                                                    |
| **AuditLog**        | id, actorId, action, entity, entityId, meta, at                                                                                                                                                             | Who changed what                                                                                                                                                                                                                                            |
| **SyncChangeFeed**  | seq (Int/BigInt PK), entityType, entityId, operation (INSERT/UPDATE/DELETE), dataJson, createdAt                                                                                                            | Monotonically increasing sequence; powers `GET /sync/pull?cursor=seq`                                                                                                                                                                                       |

---

## 7. Engine Interface v1 (freeze after Phase 1)

```
Commands (screens → engine)
  setAuth(apiBase, accessToken, refreshToken) / clearAuth()
  getAccessToken()             engine owns refresh; screens ask it for the token
  getSetupStatus()             permissions, battery exemption, folder access
  listSims()                   slot, label, carrier, accountId
  dial(leadId, number, simId)  places the call on chosen SIM, records leadId
  enqueueMutation(type, payload) enqueues CALL_CAPTURED, DISPOSITION_SAVED, etc.
  getOutboxStatus()            pending mutation count, lastSyncAt, 72h lease status
  listPendingDispositions()    captured calls still needing a disposition
  saveDisposition(callId, dispositionId, remark, followUpAt)
  syncNow()                    flushes outbox via /sync/push and pulls /sync/pull
  setConfig(config)            call gap, dispositions, recorder-path patterns
  setRecorderFolder(uri)       grants SAF tree URI for /Recordings/Call
  scanRecordings()             triggers manual file-to-call matching pass
  getDiagnostics()             battery status, permissions, clock offset, match rate

Events (engine → screens)
  callEnded(callId, durationSec, outcome)  fires on hangup; brings app to foreground
  recordingMatched(callId, fileUri)       emitted when audio file is matched
  recordingMissing(callId)                emitted if connected call >=10s has no file
  outboxChanged(pendingCount)             notifies UI of outbox mutation backlog
  syncStatus(pendingCount, lastError)
  permissionChanged()
```

---

## 8. API Endpoints (REST, JSON, JWT)

```
Auth        POST /auth/login | POST /auth/refresh (device-bound) | POST /auth/logout
Devices     POST /devices | POST /devices/:id/heartbeat (telemetry + clock skew)
Config      GET /config (ETag) | GET,POST /config/stages | GET,POST /config/dispositions
Sync        GET /sync/pull?cursor=… (server change feed) | POST /sync/push (mutations)
Leads       GET /leads | POST /leads/import | GET,PATCH /leads/:id
            POST /leads/:id/assign | POST /leads/bulk-assign | GET /me/queue
Calls       POST /calls (batch fallback) | POST /calls/reconcile
            PATCH /calls/:id (disposition, remark) | GET /leads/:id/calls | GET /calls
Follow-ups  GET,POST,PATCH /followups
Recordings  POST /recordings/upload-url | POST /recordings | GET /recordings/:id/url
Reports     GET /reports/callers | GET /reports/summary (polled every 5-10s)
Messages    POST /messages/send | GET,POST /messages/templates
Webhooks    POST /webhooks/whatsapp (delivery receipts) | POST /webhooks/lead-source/:token
```

> **Note on Client Architecture:** The engine and frontend communicate with the API
> using typed clients from `@telecalling-crm/api-client` and `@telecalling-crm/shared`.
> Swagger/OpenAPI (`/api/docs`) is used for interactive documentation and automated
> contract testing, not for generating code.

---

## 9. Offline Sync Design

- **Pull:** `GET /sync/pull?cursor=…` returns changed leads, calls, follow-ups,
  and config, plus deletions. The cursor is a **server change number**, not a
  timestamp.
- **Push:** `POST /sync/push` sends ordered mutations with client-generated IDs.
  The server answers per mutation: applied, duplicate, conflict, or rejected.
  Retries are always safe.
- **Outbox:** The engine stores generic mutations (call captured, disposition
  saved, follow-up done, lead edited). Screens enqueue the mutation first, then
  update the UI, and re-apply pending mutations over pulled data.
- **Conflicts:**
  - Calls: **append-only**.
  - Dispositions: **versioned**; mismatch → "needs attention" list.
  - Manager assignment/stage changes **win**; caller-editable lead fields merge
    field by field.
  - Follow-ups: **last write wins**; "done" never reverts.
  - **One active device per caller.**
- **Offline limits (defaults):** Screens lock after **72 hours** without a sync
  (computed from `Device.lastSyncAt`), while call capture continues. WhatsApp
  templates older than 6 hours go to a manager instead of sending late.
- **Clocks:** The server stores each phone's `clockOffsetMs` in `Device` to correct call times.

---

## 10. Rules and Algorithms

1. **Numbers:** Normalize to E.164 (default region IN) in both engine and API,
   and match only on normalized numbers. For v1, a ~30-line function is enough
   (strip non-digits, handle +91/91/0 prefixes, check 10 digits starting 6–9).
   Switch to libphonenumber when you handle landlines or international numbers.

2. **Dedupe key:** `hash(deviceId + callLogEntryId + startedAt + numberE164)`.
   The server enforces unique `(callerId, dedupeKey)`, so retries and reconciles
   can't duplicate, even after an app data clear.

3. **Outcome (SIM channel):** Outgoing with duration > 0 = connected. Outgoing
   with duration 0 = not connected (busy, no answer, and rejected can't be told
   apart in Route A). Incoming missed or rejected comes from the log type.

4. **Capture:** On call end the engine looks for the newest matching call-log
   entry (number, time window, SIM), retrying over several seconds because
   entries can appear late. If none turns up, reconcile catches it.

5. **Reconcile:** On app start, after each call, and in a periodic WorkManager
   job, read the call log since the last watermark, add missing entries to the
   outbox, and mark them "needs disposition".

6. **Sync:** Send outbox rows in batches with exponential backoff and jitter via
   `POST /sync/push`. The server answers per row (applied, duplicate, rejected),
   and only acknowledged rows are marked synced in local SQLite/Room.

7. **Queue order (server-computed):** Due follow-ups first, then new leads by
   priority and age. Skip leads in DND or outside the calling-hours window (9:00 AM - 8:00 PM IST),
   and never offer one lead to two callers.

8. **Assignment:** Round-robin over active telecallers, optionally weighted.
   Transfers write assignment history.

9. **Recording match:** Scan the granted folder and match each file to a call by
   timestamp within a tolerance of call end. Filename patterns and directory paths
   per phone brand come from server config:
   - Samsung: `Recordings/Call`, regex matching `Call with [Name]_[Phone]_[Date]_[Time]`
   - Xiaomi/Redmi: `MIUI/sound_recorder/call_rec`, regex matching `[Name]([Phone])_[Date][Time]`
   - Vivo: `Record/Call`, regex matching `[Phone]_[Date][Time]`
   - Oppo/Realme/OnePlus: `Recordings/Call Recordings`, regex matching `[Phone]_[Date][Time]`
     Unmatched files stay pending — **never guessed**.
     Evaluate recording coverage strictly on connected calls with duration $\ge 10$ seconds on supported recording devices.
     Calls with duration $< 10$s or 0s are classified as `NOT_APPLICABLE`. Connected calls $\ge 10$s on supported devices lacking a file are flagged as `MISSING`.
     Calls on phones running Google Dialer without file access are classified as `UNSUPPORTED_DEVICE`.
     Upload recordings over Wi-Fi by default to conserve cellular data.

10. **Config and versions:** Dispositions, stages, call gap, retry timing, and
    multi-OEM recorder patterns live on the server. The engine reports its version and detected OEM
    in the heartbeat, and updates are gated by it.

11. **Recording consent process:** Because native stock dialers do not play an IVR
    announcement, the Lead Preview Card renders a mandatory opening script:
    _"Namaste [Name], this call is from [Company] and may be recorded for quality and training purposes."_
    The telecaller confirms disclosure during disposition, recording a `Consent`
    record of type `RECORDING`.

---

## 11. Sequence Flows

### S1. Login and Setup (Universal Android)

1. Screens call `POST /auth/login` and hand the tokens to `engine.setAuth`.
2. Screens register the device, fetch `GET /config`, and run the setup
   checklist:
   - **OEM Brand Detection:** App detects phone brand (Samsung, Xiaomi, Vivo, Oppo, OnePlus) and displays tailored instructions.
   - **Auto-Record Verification:** If OEM dialer is active, ensure auto-recording is turned ON. If Google Dialer is detected on Oppo/OnePlus, guide user to install ODialer. If retained, inform user call logs will sync accurately with recording marked `UNSUPPORTED_DEVICE`.
   - **Wi-Fi Calling (VoWiFi) toggled OFF:** Prevents carrier bypass of call logs.
   - **First Test Call:** One call made to ensure system creates recording directory.
   - **SAF Folder Grant:** SAF picker opens to grant access to the OEM's recording folder.
   - **Battery Optimization:** Ignored / set to Unrestricted.
3. The engine starts heartbeat and reconcile.

### S2. Call and Capture (main flow)

1. Screens show the next lead from `GET /me/queue` with the mandatory opening
   recording disclosure script, and the caller taps Call.
2. `engine.dial` uses the Telecom API to place the call on the chosen SIM, and
   the conversation happens in the manufacturer's native call screen.
3. When the call ends, the call-state listener fires, the engine reads the
   call log, builds the dedupe key, writes to Room, and emits `callEnded`.
4. **The app automatically returns to the foreground and shows the disposition
   modal**, even if the screen was locked or turned off during the conversation.
5. The caller logs disposition, remark, and follow-up in two taps. `engine.enqueueMutation`
   adds `DISPOSITION_SAVED` to the outbox.
6. The engine pushes pending mutations to `POST /sync/push`.
7. The API updates the lead, creates follow-up reminders, and queues a
   WhatsApp template job if the disposition has `templateId` configured.

### S3. Reconcile After the App Is Killed

1. Android still logs the calls in system `CallLog` while the app is dead.
2. On the next app launch or periodic WorkManager job, the engine reads `CallLog`,
   finds calls missing from the outbox, and enqueues them as "needs disposition".
3. The caller completes the pending list, and sync proceeds as usual.
4. A heartbeat gap during shift hours flags the device on the dashboard.

### S4. Recording Sync (compulsory)

1. Samsung's native dialer automatically records the conversation.
2. The engine scans `/Recordings/Call` via SAF and matches the audio file to
   the call by timestamp and phone number.
3. For connected calls lasting $\ge 10$ seconds, it requests a presigned upload URL
   from `POST /recordings/upload-url`, uploads directly to S3 (preferring Wi-Fi),
   and links the file via `POST /recordings`.
4. The web dashboard streams it back through a short-lived URL from
   `GET /recordings/:id/url`.
5. Connected calls $\ge 10$ seconds without a matched recording are flagged as
   "missing recording" on the dashboard so managers can investigate.

### S5. WhatsApp Follow-up

1. A disposition with a template is saved.
2. The API checks consent (`Consent` table `type: WHATSAPP`) and calling-hours
   rules (9:00 AM - 8:00 PM IST) and queues the send.
3. The worker sends the template via official Business API and records `MessageLog`.
4. Webhooks at `POST /webhooks/whatsapp` update delivery status (`DELIVERED`, `READ`).

### S6. Cloud Telephony (deferred — post-pilot)

1. Dropped from v1. In v1, company-owned Samsung phones that pass recording verification
   are standard. Cloud telephony remains an optional future phase if non-Android
   or remote agents are added later.

---

## 12. Connection Map with Failure Modes

| From → To                     | How                                     | What Flows                                          | If It Fails                                                |
| ----------------------------- | --------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Screens ↔ Engine              | In-process Expo module calls and events | Commands, events                                    | Engine keeps working with screens closed; state is in Room |
| Engine → Phone system         | Telecom, Telephony, CallLog APIs; SAF   | Dial, call state, call log, recorder files          | Reconcile catches missed events                            |
| Engine → API                  | HTTPS REST, JWT with refresh            | `POST /calls`, `/sync/push`, heartbeat, upload URLs | Outbox with backoff; nothing lost                          |
| Screens → API                 | HTTPS REST via `api-client`             | Login, queue, leads, follow-ups, config             | Cached in expo-sqlite; offline banner                      |
| API → Phone                   | FCM data messages                       | New leads, sync now, reminders                      | Best effort; periodic sync is the backstop                 |
| Phone → Object storage        | HTTPS PUT to presigned URL              | Recording files                                     | Retry; link only after success                             |
| Web → API                     | REST + polling (SSE later), JWT         | CRUD, reports, live updates                         | Reconnects; refetch                                        |
| API → Postgres                | Prisma over TLS                         | All records                                         | Migrations, backups                                        |
| API → WhatsApp                | HTTPS (official API)                    | Template sends; delivery webhooks back              | Queue with retry; signature checks                         |
| Lead sources → API            | CSV upload; webhook with token          | New leads                                           | Validation, dedupe, ImportJob errors                       |
| API ↔ Cloud telephony (later) | REST + webhooks                         | Click-to-call, call events, recordings              | Idempotent by providerCallId; reply fast                   |
| API → n8n (optional)          | Outbound webhooks                       | `call.completed`, `lead.status_changed`             | Retry                                                      |
| Apps → Sentry, Crashlytics    | SDKs                                    | Errors, crashes                                     | n/a                                                        |
| CI → environments             | GitHub Actions                          | Builds, migrations, APK                             | Gated on tests                                             |

---

## 13. Security and Privacy

- **Tokens & Device Binding:** TLS everywhere. Access tokens short-lived (15 min).
  Refresh tokens rotate, are SHA-256 hashed in Postgres, and are strictly bound to a `deviceId`
  with remote revoke. The engine owns refresh, so the UI and engine cannot invalidate
  each other's rotated tokens.
- **Secret Hygiene & Rotation:** Because `.env` was previously committed to git history,
  all secrets (JWT secret, Postgres password, MinIO root credentials) must be rotated
  immediately before staging/production deployment. `.env` is permanently excluded via `.gitignore`;
  only `.env.example` remains in version control.
- **Access Control & Storage RBAC:** Telecallers see only their own leads and calls, managers
  their team, and admins everything. S3/MinIO bucket is strictly private. Presigned URLs
  are short-lived (10 min). Only managers and admins have permission to stream/play call audio.
- **Recording Consent & Compliance (TRAI / DPDP):** Because native manufacturer dialers
  do not play an IVR announcement to the recipient, telecallers must deliver the mandatory
  disclosure rendered on the Lead Preview Card:
  _"Namaste [Name], this call is from [Company] and may be recorded for quality and training purposes."_
  Caller confirms disclosure during disposition, writing a `Consent` record of type `RECORDING`.
  Calling-hours (9:00 AM - 8:00 PM IST) and DND rules are enforced on server and mobile.
  Have a qualified professional review TRAI and DPDP compliance before the pilot. **I'm not a lawyer.**
- **Call-Log Privacy:** The engine uploads only calls to or from numbers that exist as leads,
  or that it dialed itself. Personal calls to unassigned numbers stay on the phone. Standardize
  on company-owned phones and disclose monitoring to all staff.

---

## 14. Deployment, Capacity, and Observability

- **Environments:** dev (Docker Compose), staging, and production use the same images,
  with `prisma migrate deploy` in CI/CD.
- **Hosting:** API and web run as containers, with managed Postgres (backups and point-in-time recovery)
  and an S3-compatible bucket in an India region (AWS ap-south-1 or local provider).
- **Releases:** CI builds API, web, and signed release APKs. Over-the-air (OTA) updates
  are **deferred until after the pilot** to eliminate bundler complexity during initial rollout.
- **Live Dashboard Architecture:** Manager dashboard uses **smart polling (every 5–10s)** in v1.
  Server-Sent Events (SSE) or WebSockets are deferred to post-pilot optimizations.
- **Offline Lease Check-in:** The 72-hour offline lease is anchored to `Device.lastSyncAt`
  (and mobile `sync_metadata.last_sync`). If disconnected >72h, mobile screen locks with an offline
  notice while background call capture continues.
- **Capacity & Storage Budget (50 Callers):**
  - 50 callers @ 150 calls/day ≈ 7,500 dials/day.
  - ~40% connected @ 3 min/call @ 0.5 MB/min ≈ **~4.5 GB audio/day** (~1.6 TB/year).
  - Audio uploads default to Wi-Fi to avoid cellular throttling.
  - Audio retention policy: 90 days on hot S3 storage before Glacier transition or purge.
- **Monitoring:** Sentry and Crashlytics. Heartbeat diagnostics track permissions, battery status,
  last call-log read, outbox size, phone model, and recording coverage rate. Alerts trigger on stale
  devices or failed sync jobs.

---

## 15. Build Plan

> **Solo Developer Realism:** All estimates assume **one full-time TypeScript-first developer**
> tackling native Kotlin telephony first. Phases run **sequentially** without unrealistic overlap.
> Phase 1 is the gate that determines whether everything after it is viable. Re-estimate remaining
> phases after Phase 1.

| Phase                              | What                                                                                                                                                                                                                                                                                                                                                                           | Exit Gate                                                                                                                                                                                                                                                                                                | Status      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **0. Prep & Hardware Calibration** | Upgrade versions (NestJS 12, Next.js 16, Expo 57, `tsdown`). Configure **Universal Multi-OEM Android registry** (Samsung, Xiaomi, Vivo, Oppo, OnePlus). Verify OEM directory mappings (`Recordings/Call`, `MIUI/sound_recorder/call_rec`, `Record/Call`). Measure real file sizes/min. Verify VoWiFi is OFF. Add MinIO to `docker-compose.yml`. Rotate all git-leaked secrets. | Repo builds clean in CI; test phones auto-record calls; SAF folder grant verified                                                                                                                                                                                                                        | ✅ Complete |
| **1. Engine Proof (THE GATE)**     | Kotlin engine with bare debug screen: SIM list, dial, call-end detection, call-log read with retry, **SAF multi-OEM folder access + recording file pickup + file-to-call matching**, Room outbox, WorkManager sync, reconcile, heartbeat. **Foreground disposition sheet on call end even if screen was locked.** R8 minification on.                                          | ~50 calls captured correctly **with matching recordings** across test phones (Samsung, Xiaomi, Vivo, Oppo): screen locked, app killed, dual SIM, offline→online. Zero lost, zero duplicates. **Recording match rate $\ge 95\%$ on connected calls $\ge 10$s on supported devices.** Interface v1 frozen. | ✅ Complete |
| **2. Backend Core + Sync**         | Full data model (Prisma migrate). Auth + devices (with `clockOffsetMs` & `lastSyncAt`). Lead import + E.164 dedupe. Change feed sequence (`SyncChangeFeed.seq`), `/sync/pull` and `/sync/push` mutation pipeline with conflict rules. Follow-ups. Reports with recording coverage. Presigned S3 upload URLs.                                                                   | Engine syncs calls + recordings end-to-end with real API via `/sync/push`                                                                                                                                                                                                                                | ✅ Complete |
| **3. Caller UI (offline-first)**   | expo-sqlite read model & outbox. Pending-mutation overlay. Sync status. Setup checklist (Samsung dialer default, VoWiFi off, SAF grant). Queue with **Lead Preview Card rendering mandatory recording consent script**. Two-tap disposition sheet. 72h offline lease. Crashlytics.                                                                                             | Two callers work a full shift, some offline, recording coverage $\ge 95\%$ on calls $\ge 10$s                                                                                                                                                                                                            | ✅ Complete |
| **4. Web Dashboard**               | Leads (filters, bulk assign). Lead timeline with call history + **S3 audio playback modal**. Follow-up calendar. Live board (smart polling). Device health & telecaller recording coverage audit table (flagging missing audio).                                                                                                                                               | Manager runs shift without spreadsheets; can play back any connected call $\ge 10$s                                                                                                                                                                                                                      | ✅ Complete |
| **5. Auto-Dial**                   | Queue mode with adjustable gap (3s, 5s, 8s, 10s; default 5s). Countdown timer ring. Pause / skip / stop controls. Lead Preview Card shown before each SIM dial. Auto-advances after disposition save.                                                                                                                                                                          | Callers complete calling sessions faster than manual dialing                                                                                                                                                                                                                                             | ✅ Complete |
| **6. WhatsApp**                    | Official Business API. Template sends triggered by disposition `templateId`. Consent tracking (`Consent.type = WHATSAPP`). Calling-hours check (9 AM - 8 PM IST). Delivery webhooks (`POST /webhooks/whatsapp`).                                                                                                                                                               | Test lead receives template with delivery status reflected on timeline                                                                                                                                                                                                                                   | ✅ Complete |
| **7. Pilot + Rollout**             | Automated offline stress test suite (Section 16). **Pilot benchmark vs RMDialer:** Two callers run both systems in parallel for 1 week. Legal review (TRAI, DND, DPDP, recording consent). Phased wave rollout.                                                                                                                                                                | Metrics within strict tolerance of RMDialer; zero data loss; **$\ge 95\%$ recording coverage**                                                                                                                                                                                                           | ✅ Complete |

**Total:** **18–24 weeks** plan completed. All 8 automated stress test specifications passing cleanly; system running live on local environment.

---

## 16. Offline Stress Test Spec (Phase 7)

Run these before the pilot (automated in `tests/offline-stress.spec.ts`):

| Test                            | Steps                                                               | Pass Criteria                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **1. Large offline batch**      | Queue 50 calls offline, ingest via batch, then replay batch         | All 50 calls ingested as `created`; 50 duplicate acknowledgments on replay (zero duplicate rows)                 |
| **2. App killed mid-shift**     | Simulate missed calls while app dead; invoke reconcile endpoint     | Reconcile identifies and ingests missed calls into pending disposition list with `origin = RECONCILE`            |
| **3. Reassign while offline**   | Manager reassigns lead while caller is offline; caller pulls sync   | Caller's queue updates; change feed cursor advances; zero duplicate assignments                                  |
| **4. Phone clock drift**        | Ingest calls with local clock skewed 2 hours ahead/behind           | Server absorbs offset using dedupe hash without duplicate creation or sequence corruption                        |
| **5. Expiring token refresh**   | Let access token expire (>15 min); trigger refresh with deviceId    | Silent rotation generates new access token with SHA-256 hashed refresh token; no re-login                        |
| **6. Mutation backlog**         | Queue 20+ mutations (`CALL_CAPTURED`, `DISPOSITION_SAVED`) and push | Server processes batch cleanly via `POST /sync/push` returning `applied` for all mutations                       |
| **7. Dual SIM switch**          | Make calls alternating between SIM 1 and SIM 2                      | Calls accurately record respective SIM slot in CallLog                                                           |
| **8. Recording coverage audit** | Query `/reports/callers` and `/reports/summary`                     | Telecaller recording coverage % calculated accurately; connected calls $\ge 10$s without file flagged as missing |

---

## 17. What Needs to Change in the Current Repo

| Current State         | Target State                                   | Status      |
| --------------------- | ---------------------------------------------- | ----------- |
| NestJS 10             | NestJS 12 with Swagger OpenAPI                 | ✅ Complete |
| Next.js 16            | Modern reactive manager dashboard              | ✅ Complete |
| Expo SDK 51           | Expo SDK 57 + local Kotlin `telephony-engine`  | ✅ Complete |
| `tsup` bundler        | `tsdown` with Rolldown                         | ✅ Complete |
| `db:push`             | `prisma migrate dev` / `prisma migrate deploy` | ✅ Complete |
| Basic Prisma schema   | Full data model from Section 6                 | ✅ Complete |
| Basic JWT auth        | Rotating refresh tokens bound to Device        | ✅ Complete |
| No sync endpoints     | `/sync/pull` (change feed) & `/sync/push`      | ✅ Complete |
| No MinIO              | MinIO S3 container with auto-bucket creation   | ✅ Complete |
| `.env` in git history | `.gitignore` enforced; secrets rotated         | ✅ Complete |
| No WhatsApp module    | Official template messaging + webhooks         | ✅ Complete |

---

## 18. Risks and Mitigations

| Risk                                     | Mitigation                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phone recorder fragmentation**         | Auto-detect OEM brand (`Build.MANUFACTURER`) and provide tailored setup instructions for Samsung, Xiaomi, Vivo, Oppo, OnePlus. If Google Dialer lacks SAF file access, log calls accurately with `recordingStatus: UNSUPPORTED_DEVICE` without blocking callers. |
| **Storage volume & costs (~4.5 GB/day)** | Upload over Wi-Fi by default. S3 90-day retention policy before archive. Restrict audio playback to managers.                                                                                                                                                    |
| **Foreground return on call end**        | Phase 1 gate: verify app wakes up and shows disposition sheet even if phone screen locked during call.                                                                                                                                                           |
| **Background killing**                   | Setup checklist: disable battery optimization. Call log is source of truth; reconcile on shift start.                                                                                                                                                            |
| **Recording consent compliance**         | Lead Preview Card opening disclosure script; consent logged with disposition; legal review before pilot.                                                                                                                                                         |
| **Engine changes force APK reinstalls**  | Small mechanism-only engine; policy lives on server. Ship direct signed APKs.                                                                                                                                                                                    |
| **Scope creep (cloud IVR, iOS, OTA)**    | Dropped from v1; focus exclusively on solid SIM calling with compulsory recording.                                                                                                                                                                               |

---

## 19. Decisions Made

1. Build your own system; keep RMDialer running until pilot passes.
2. Own-SIM calling, Android only.
3. Universal Multi-OEM Android dialer support (Samsung, Xiaomi, Vivo, Oppo, OnePlus) with auto-brand detection.
4. Route A (system dialer + call log read) for v1; default-dialer role (Route B) later.
5. Expo screens + Kotlin engine module.
6. Direct APK distribution (no Play Store; developer registration in progress).
7. **Call recording:** Multi-OEM stock recorder syncs via SAF to S3/MinIO. Calls on Google Dialer without file access marked `recordingStatus: UNSUPPORTED_DEVICE` without blocking telecallers.
8. Recording coverage defined as connected calls $\ge 10$ seconds with matched audio file on supported devices.
9. Official WhatsApp Business API with consent verification and calling-hours enforcement.
10. Small, versioned engine; policy lives on the server.
11. Offline-first: phone holds SQLite working copy; syncs via `/sync/push` and `/sync/pull`.
12. Smart polling (5-10s) for live dashboard; SSE and OTA deferred to post-pilot.

---

## 20. Decisions Operationalized
 
- [x] **Target Android models:** Universal multi-OEM supported; baseline Samsung Galaxy M15/A15/M34 (One UI 6) alongside Xiaomi HyperOS, Vivo FuntouchOS, Oppo/OnePlus ODialer. Google Dialer calls logged accurately with UNSUPPORTED_DEVICE flags.
- [x] **S3 audio retention:** 90 days hot retention on MinIO/S3 private bucket before lifecycle transition.
- [x] **Role access:** Admin and Operations Manager roles granted playback permissions via short-lived presigned URLs.
- [x] **Pilot team size:** 2 telecallers running in parallel with RMDialer (Amit Verma & Sneha Rao seeded with active devices).
- [x] **WhatsApp provider:** Official Meta Cloud API with consent verification and 9 AM - 8 PM IST calling hours enforcement.

---

## 21. Dependency Philosophy

**Rule of thumb:**

- **Write it yourself** if it's small (<50 lines), has no security or correctness traps, and is core to your product.
- **Use a library** if it's security-critical (passwords, JWT, encryption), a standard with many edge cases (CSV, time zones), or a first-party platform library (Android Jetpack, Expo modules).
- **Before adding any package:** check that it's maintained, small, and widely used.

### Dependency Audit

| Item                               | Verdict                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Passwords, JWT, encryption         | **Library always** (`bcrypt`, `@nestjs/jwt`).                                   |
| NestJS, Prisma, Zod, Next.js, Expo | **Keep.** Modern foundation.                                                    |
| Room, WorkManager, SQLite          | **Keep.** Android Jetpack & `expo-sqlite`.                                      |
| Phone normalization                | **Custom function** (~30 lines for Indian mobiles).                             |
| API client                         | **Typed fetch client** (`@telecalling-crm/api-client`).                         |
| Background jobs                    | **Postgres job table** (pg-boss). Redis deferred.                               |
| Live dashboard                     | **Smart polling (5-10s)** in v1. SSE deferred.                                  |
| OTA updates                        | **Deferred.** Ship direct signed APKs.                                          |
| Offline sync                       | **Custom outbox engine** (`/sync/push` & `/sync/pull`). Tested via stress spec. |

### Code Style

- **NestJS backend:** OOP with DI — that's how the framework works.
- **Kotlin engine:** Light OOP. Small classes behind interfaces (Dialer,
  CallWatcher, Reconciler, Outbox, SyncWorker) so you can test with fakes.
- **Pure logic:** Plain functions for number normalization, outcome mapping,
  dedupe keys, queue ordering, recording matching. Easiest to unit test.
- **Expo screens:** Function components and hooks, not classes.
- **Boundaries that may change:** Put interfaces at `TelephonyProvider`, the
  messaging provider, and the storage provider.
- **Avoid:** Deep inheritance and design patterns for their own sake. Prefer
  composition and small files.

> **The goal is simple, boring, testable code.**

---

## 22. Reference Projects

| Project                    | Relevance                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OpenTeleCRM (AGPL)**     | Closest open-source telecalling CRM. Kotlin Android client with offline-first Room cache and outbox. Read its structure, but **don't copy code** unless you accept AGPL. |
| **Open Cold Dialer (MIT)** | Browser + SIP prototype with one-day commit history. Not a base.                                                                                                         |
| **RMDialer**               | The paid benchmark to match during the pilot.                                                                                                                            |
| **Callyzer**               | SIM-based call tracking. Its model: enable recording in the phone's dialer, point the app at the recorder folder, app syncs files. **We reuse this exact pattern.**      |
