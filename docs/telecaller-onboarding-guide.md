# Telecalling CRM — Telecaller Multi-OEM Calibration & Onboarding Guide

Welcome to the Telecalling CRM onboarding guide. This operational runbook provides step-by-step setup instructions for your company-provided Android handset to ensure **100% call recording synchronization**, **uninterrupted background telephony capture**, and **regulatory compliance**.

---

## 1. Quick Installation (Sideloading the APK)

1. Open Chrome or your mobile browser on your Android device.
2. Navigate to your company's CRM dashboard URL: `https://<your-crm-domain>/download` (or tap the direct download link).
3. Download `telecalling-crm.apk` (Size: ~76 MB).
4. When prompted by Android with *"For your security, your phone is not allowed to install unknown apps from this source"*:
   - Tap **Settings**.
   - Toggle **Allow from this source** to ON.
   - Tap **Install**.

---

## 2. Multi-OEM Handset Calibration

To prevent Android from terminating the background call watcher and to ensure audio recordings sync automatically to MinIO/S3, complete the steps for your specific phone manufacturer below:

### A. Samsung Galaxy (One UI 5 / 6 / 7)
*Models: Galaxy M15 5G, A15 5G, M34 5G, F54 5G*

1. **Enable Native Auto-Call Recording:**
   - Open the native Samsung **Phone** app (green handset icon).
   - Tap the three dots (⋮) in the top-right corner ➔ **Settings**.
   - Tap **Record calls**.
   - Toggle **Auto record calls** to **ON**, and select **All numbers**.
2. **Grant Storage Access Framework (SAF) Folder Access:**
   - Launch Telecalling CRM.
   - In the Setup Checklist, tap **Grant Audio Folder Access**.
   - Navigate to **Internal Storage ➔ Recordings ➔ Call** (or **Sounds ➔ Call**).
   - Tap **Use this folder** at the bottom of the screen, then tap **Allow**.
3. **Disable Battery Optimization:**
   - Go to phone **Settings ➔ Apps ➔ Telecalling CRM ➔ Battery**.
   - Change selection from *Optimized* to **Unrestricted**.
4. **Disable Wi-Fi Calling (VoWiFi):**
   - Go to phone **Settings ➔ Connections ➔ Wi-Fi Calling** ➔ Toggle **OFF** (prevents carrier VoWiFi audio recording lockouts).

---

### B. Xiaomi / Redmi / Poco (HyperOS / MIUI 14)
*Models: Redmi 12 5G, Redmi Note 13, Poco M6 Pro*

1. **Enable Stock Call Recording:**
   - Open native **Phone** app ➔ Tap gear icon (Settings) in the top-right.
   - Select **Call recording** ➔ Toggle **Record calls automatically** to **ON**.
2. **Grant SAF Audio Folder Access:**
   - In Telecalling CRM Setup Checklist, tap **Grant Audio Folder Access**.
   - Select **Internal Storage ➔ MIUI ➔ sound_recorder ➔ call_rec**.
   - Tap **Use this folder** ➔ **Allow**.
3. **Enable Autostart & Background Execution:**
   - Long-press Telecalling CRM app icon ➔ Tap **App info** (ℹ️).
   - Toggle **Autostart** to **ON**.
   - Tap **Battery saver** ➔ Select **No restrictions**.
   - Tap **Other permissions** ➔ Grant **Display pop-up windows while running in the background**.

---

### C. Vivo / iQOO (Funtouch OS 13 / 14)
*Models: Vivo T2x 5G, Vivo Y200, iQOO Z7x*

1. **Enable Native Recording:**
   - Open native **Phone** app ➔ Tap three dots (⋮) ➔ **Call settings**.
   - Tap **Call recording** ➔ Select **Record all calls automatically**.
2. **Grant SAF Audio Folder Access:**
   - In Telecalling CRM Setup Checklist, select **Internal Storage ➔ Record ➔ Call**.
   - Tap **Use this folder** ➔ **Allow**.
3. **Allow High Background Power Usage:**
   - Go to phone **Settings ➔ Battery ➔ Background power consumption management**.
   - Find **Telecalling CRM** ➔ Select **Allow high background power usage**.

---

### D. Realme / Oppo / OnePlus (ColorOS 13 / 14 / OxygenOS)
*Models: Realme 12x 5G, Realme Narzo 60, Oppo A79, OnePlus Nord CE 3*

1. **Enable Native ODialer / System Recording:**
   - Open **Phone** app ➔ Settings ➔ **Call recording**.
   - Toggle **Record all calls** to **ON**.
2. **Grant SAF Audio Folder Access:**
   - In Telecalling CRM Setup Checklist, choose **Internal Storage ➔ Music ➔ Recordings ➔ Call Recordings** (or **Recordings ➔ Call**).
   - Tap **Use this folder** ➔ **Allow**.
3. **Lock App in Recent Tasks:**
   - Open Android Recent Apps view.
   - Tap the three dots above Telecalling CRM ➔ Tap **Lock** (prevents swipe-away kill).

---

## 3. Daily Telecaller Shift Workflow

### Step 1: Login & Shift Start
- Open Telecalling CRM.
- Login with your assigned telecaller credentials (e.g. `amit@telecalling.crm`).
- Verify the status badge in the top right shows **"• Live"** (green).

### Step 2: Queue Calling (Manual or Auto-Dial)
- **Manual Mode:** Tap **"Call Now"** on the Next Contact in Shift Queue.
- **Auto-Dial Mode:** Tap **"Start Auto-Dial"** to activate the hands-free queue pacing (3s, 5s, 8s, 10s gap).

### Step 3: Mandatory Regulatory Disclosure
- Deliver the mandatory opening statement displayed on your screen before discussing solar sizing:
  > *"Namaste [Customer Name], this call is from SolarCRM and may be recorded for quality, documentation, and training purposes."*

### Step 4: Two-Tap Disposition & Automated WhatsApp Follow-up
- Upon call disconnect, the Post-Call Disposition Sheet appears automatically.
- Tap the **Call Outcome** (`Connected`, `Not Picked`, `Busy`, `Switched Off`).
- Tap the **Business Disposition** (`Interested`, `Follow-up Required`, `Meeting Scheduled`, `Quotation Sent`).
- Ensure the **"Send WhatsApp follow-up template after saving"** checkbox is checked.
- Tap **Save & Next ➔** to instantly log the call, queue the branded WhatsApp template, and advance to your next prospect.

---

## 4. Troubleshooting & Offline Support

- **No Internet Connection?** No problem! The app is 100% offline-first. All calls, notes, and dispositions are stored securely in local SQLite and will automatically sync once cellular or Wi-Fi connectivity returns.
- **72-Hour Offline Limit:** If you remain disconnected for more than 72 hours, the screen will lock with an offline renewal notice to protect lead assignments. Reconnect to Wi-Fi or cellular data to renew your lease.
- **Need Technical Help?** Reach out to your Operations Manager via the web supervisor portal.

