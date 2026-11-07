package com.telecalling.crm.telephony

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.CallLog
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class TelephonyEngineModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React application context is null")

    private val dbHelper: CallLogDatabaseHelper by lazy {
        CallLogDatabaseHelper.getInstance(context)
    }

    private val httpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private val coroutineScope = CoroutineScope(Dispatchers.IO)
    private var lastObservedCallState = TelephonyManager.CALL_STATE_IDLE
    private var isListenerRegistered = false

    override fun definition() = ModuleDefinition {
        Name("telephony-engine")

        Events("callEnded", "syncStatus", "permissionChanged")

        OnCreate {
            registerCallStateListener()
            schedulePeriodicWorkManagerSync()
        }

        OnDestroy {
            unregisterCallStateListener()
        }

        AsyncFunction("setAuth") { apiBase: String, accessToken: String, refreshToken: String ->
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("api_base", apiBase.trimEnd('/'))
                .putString("access_token", accessToken)
                .putString("refresh_token", refreshToken)
                .apply()
        }

        AsyncFunction("clearAuth") {
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            prefs.edit().clear().apply()
        }

        AsyncFunction("getAccessToken") {
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            prefs.getString("access_token", null)
        }

        AsyncFunction("getSetupStatus") {
            val callPhoneGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.CALL_PHONE
            ) == PackageManager.PERMISSION_GRANTED

            val readPhoneStateGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_PHONE_STATE
            ) == PackageManager.PERMISSION_GRANTED

            val readCallLogGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED

            val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val batteryOptimizationsIgnored = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false
            } else {
                true
            }

            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            val recorderFolderUri = prefs.getString("recorder_folder_uri", null)

            mapOf(
                "callPhoneGranted" to callPhoneGranted,
                "readPhoneStateGranted" to readPhoneStateGranted,
                "readCallLogGranted" to readCallLogGranted,
                "batteryOptimizationsIgnored" to batteryOptimizationsIgnored,
                "recorderFolderGranted" to (recorderFolderUri != null),
                "recorderFolderUri" to recorderFolderUri
            )
        }

        AsyncFunction("listSims") {
            val sims = mutableListOf<Map<String, Any>>()
            val permission = ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_PHONE_STATE
            )
            if (permission == PackageManager.PERMISSION_GRANTED) {
                val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                val subList: List<SubscriptionInfo>? = subscriptionManager?.activeSubscriptionInfoList
                if (subList != null) {
                    for (info in subList) {
                        sims.add(
                            mapOf(
                                "slotIndex" to info.simSlotIndex,
                                "displayName" to (info.displayName?.toString() ?: "SIM ${info.simSlotIndex + 1}"),
                                "carrierName" to (info.carrierName?.toString() ?: ""),
                                "subscriptionId" to info.subscriptionId,
                                "countryIso" to (info.countryIso ?: "in")
                            )
                        )
                    }
                }
            }
            sims
        }

        AsyncFunction("simulateCall") { leadId: String, number: String, durationSec: Int, outcome: String, simSlot: Int ->
            simulateCallInternal(leadId, number, durationSec, outcome, simSlot)
        }

        AsyncFunction("dial") { leadId: String, number: String, simSlot: Int ->
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            val isSimulation = prefs.getString("cfg_simulation_mode", "true") == "true"

            // SAFE MODE: Do not make actual cellular calls if simulation mode is active or number is a test pattern
            if (isSimulation || number.contains("test") || number.startsWith("+91000") || number.startsWith("000")) {
                coroutineScope.launch {
                    delay(1200) // Brief realistic dialing simulation
                    val durationSec = (25..75).random()
                    simulateCallInternal(leadId, number, durationSec, "CONNECTED", simSlot)
                }
                return@AsyncFunction mapOf("status" to "SIMULATED", "number" to number)
            }

            val hasCallPermission = ContextCompat.checkSelfPermission(
                context, Manifest.permission.CALL_PHONE
            ) == PackageManager.PERMISSION_GRANTED

            val action = if (hasCallPermission) Intent.ACTION_CALL else Intent.ACTION_DIAL

            val intent = Intent(action).apply {
                data = Uri.parse("tel:$number")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK

                // Store active dialing context
                prefs.edit()
                    .putString("active_dial_lead_id", leadId)
                    .putString("active_dial_number", number)
                    .putInt("active_dial_sim_slot", simSlot)
                    .putLong("active_dial_timestamp", System.currentTimeMillis())
                    .apply()

                // Route to chosen SIM
                val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                if (telecomManager != null && ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        val accounts = telecomManager.callCapablePhoneAccounts
                        if (accounts.isNotEmpty()) {
                            val accountHandle = accounts.getOrNull(simSlot) ?: accounts[0]
                            putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, accountHandle)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
            try {
                context.startActivity(intent)
            } catch (e: Exception) {
                // If ACTION_CALL throws SecurityException, fallback to ACTION_DIAL
                val fallbackIntent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:$number")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(fallbackIntent)
            }
        }

        AsyncFunction("listPendingDispositions") {
            dbHelper.listPendingDispositions()
        }

        AsyncFunction("syncLeadLookup") { leads: List<Map<String, String>> ->
            dbHelper.syncLeadLookup(leads)
            mapOf("syncedCount" to leads.size)
        }

        AsyncFunction("saveDisposition") { callId: String, dispositionId: String, remark: String?, followUpAt: String? ->
            val updated = dbHelper.updateDisposition(callId, dispositionId, remark, followUpAt)
            val payload = JSONObject().apply {
                put("callId", callId)
                put("dispositionId", dispositionId)
                put("remark", remark ?: "")
                put("followUpAt", followUpAt ?: "")
            }
            dbHelper.enqueueMutation("DISPOSITION_SAVED", payload.toString())

            // Attempt async background sync flush and schedule WorkManager
            triggerWorkManagerSync()
            coroutineScope.launch {
                flushOutboxToServer()
            }
            mapOf("success" to updated)
        }

        AsyncFunction("syncNow") {
            triggerWorkManagerSync()
            val pendingBefore = dbHelper.getPendingMutations().size
            flushOutboxToServer()
            val pendingAfter = dbHelper.getPendingMutations().size
            mapOf(
                "pendingCount" to pendingAfter,
                "syncedCount" to (pendingBefore - pendingAfter)
            )
        }

        AsyncFunction("setConfig") { config: Map<String, Any> ->
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            config.forEach { (key, value) ->
                editor.putString("cfg_$key", value.toString())
            }
            editor.apply()
        }

        AsyncFunction("setRecorderFolder") { uriString: String ->
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("recorder_folder_uri", uriString).apply()
        }

        /**
         * Task 3: SAF multi-OEM directory scanning and matching
         * Matches audio files against calls with missing recordings within +/- 60s
         */
        AsyncFunction("scanRecordings") {
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            val folderUriStr = prefs.getString("recorder_folder_uri", null)
            if (folderUriStr == null) {
                return@AsyncFunction mapOf("matchedCount" to 0, "status" to "NO_FOLDER_CONFIGURED")
            }

            var matchedCount = 0
            var totalFiles = 0

            try {
                val folderUri = Uri.parse(folderUriStr)
                val rootDir = DocumentFile.fromTreeUri(context, folderUri)
                if (rootDir != null && rootDir.isDirectory) {
                    val files = rootDir.listFiles()
                    val audioFiles = files.filter { file ->
                        val name = file.name?.lowercase() ?: ""
                        name.endsWith(".m4a") || name.endsWith(".amr") || name.endsWith(".mp3") ||
                                name.endsWith(".wav") || name.endsWith(".aac")
                    }
                    totalFiles = audioFiles.size

                    val pendingCalls = dbHelper.getRecentCallsNeedingRecording()

                    for (call in pendingCalls) {
                        val callId = call["callId"] as String
                        val endedAt = call["endedAt"] as Long
                        val rawNumber = (call["numberE164"] as? String) ?: ""
                        val cleanDigits = rawNumber.filter { it.isDigit() }.takeLast(10)

                        // Find matching audio file within +/- 60s or phone number substring
                        val match = audioFiles.find { file ->
                            val modifiedTime = file.lastModified()
                            val timeDiff = abs(modifiedTime - endedAt)
                            val name = file.name ?: ""

                            val timeMatched = timeDiff <= 65000L
                            val nameMatched = cleanDigits.isNotEmpty() && name.contains(cleanDigits)

                            timeMatched || nameMatched
                        }

                        if (match != null) {
                            dbHelper.updateRecording(callId, match.uri.toString(), "MATCHED")
                            val payload = JSONObject().apply {
                                put("callId", callId)
                                put("recordingUri", match.uri.toString())
                                put("recordingStatus", "MATCHED")
                            }
                            dbHelper.enqueueMutation("RECORDING_MATCHED", payload.toString())
                            matchedCount++
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            mapOf(
                "matchedCount" to matchedCount,
                "totalFilesFound" to totalFiles
            )
        }

        /**
         * Task 3: Reconciliation
         * Periodic scan for missed calls when app was killed
         */
        AsyncFunction("reconcileCallLog") { sinceTimestampMs: Long ->
            val reconciled = reconcileCallsSince(sinceTimestampMs)
            mapOf(
                "reconciledCount" to reconciled.size,
                "calls" to reconciled
            )
        }

        AsyncFunction("getCallHistory") { limit: Int ->
            dbHelper.getRecentCalls(if (limit > 0) limit else 50)
        }

        AsyncFunction("getDiagnostics") {
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            val pendingMutations = dbHelper.getPendingMutations().size
            val unsyncedCalls = dbHelper.getUnsyncedCalls().size
            mapOf(
                "status" to "OK",
                "recorderFolderConfigured" to (prefs.getString("recorder_folder_uri", null) != null),
                "apiConfigured" to (prefs.getString("api_base", null) != null),
                "pendingMutations" to pendingMutations,
                "unsyncedCalls" to unsyncedCalls
            )
        }

        AsyncFunction("getDeviceDetails") {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            val defaultDialer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                telecomManager?.defaultDialerPackage ?: "unknown"
            } else {
                "unknown"
            }

            val manufacturer = Build.MANUFACTURER.lowercase()
            val isGoogleDialer = defaultDialer == "com.google.android.dialer"

            val recommendedFolder = when {
                manufacturer.contains("samsung") -> "Recordings/Call"
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") -> "MIUI/sound_recorder/call_rec"
                manufacturer.contains("vivo") || manufacturer.contains("iqoo") -> "Record/Call"
                manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus") -> "Recordings/Call Recordings"
                else -> "Recordings/Call"
            }

            val guidanceMessage = when {
                isGoogleDialer && (manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus")) ->
                    "Google Dialer detected on Oppo/OnePlus. Please install ODialer for auto-recording support."
                isGoogleDialer ->
                    "Google Dialer active. In-app call duration and dispositions will sync accurately, but local audio files are protected by Google. Marked as UNSUPPORTED_DEVICE on dashboard."
                else ->
                    "Native OEM dialer active. Ensure 'Auto record calls' is enabled in Phone Settings."
            }

            mapOf(
                "manufacturer" to Build.MANUFACTURER,
                "brand" to Build.BRAND,
                "model" to Build.MODEL,
                "androidVersion" to Build.VERSION.RELEASE,
                "sdkInt" to Build.VERSION.SDK_INT,
                "defaultDialerPackage" to defaultDialer,
                "isGoogleDialer" to isGoogleDialer,
                "recommendedFolder" to recommendedFolder,
                "guidanceMessage" to guidanceMessage,
                "isRecordingSupported" to !isGoogleDialer
            )
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TELEPHONY STATE LISTENER & BOUNDED-RETRY CAPTURE
    // ─────────────────────────────────────────────────────────────────────────────

    private fun registerCallStateListener() {
        if (isListenerRegistered) return
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                telephonyManager.registerTelephonyCallback(
                    context.mainExecutor,
                    object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                        override fun onCallStateChanged(state: Int) {
                            handleCallStateTransition(state)
                        }
                    }
                )
            } else {
                @Suppress("DEPRECATION")
                telephonyManager.listen(object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        handleCallStateTransition(state)
                    }
                }, PhoneStateListener.LISTEN_CALL_STATE)
            }
            isListenerRegistered = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun unregisterCallStateListener() {
        isListenerRegistered = false
    }

    private fun handleCallStateTransition(newState: Int) {
        val prevState = lastObservedCallState
        lastObservedCallState = newState

        // Detect transition to IDLE from OFFHOOK or RINGING (call ended or missed)
        if (newState == TelephonyManager.CALL_STATE_IDLE &&
            (prevState == TelephonyManager.CALL_STATE_OFFHOOK || prevState == TelephonyManager.CALL_STATE_RINGING)) {

            coroutineScope.launch {
                captureLatestCallWithRetry()
            }
        }
    }

    /**
     * Task 3: Bounded retries reading CallLog.Calls.
     * Retries: 500ms, 1000ms, 2000ms
     */
    private suspend fun captureLatestCallWithRetry() {
        val delays = listOf(500L, 1000L, 2000L)
        var capturedCall: Map<String, Any>? = null

        for (delayMs in delays) {
            delay(delayMs)
            capturedCall = queryLatestCallLogEntry()
            if (capturedCall != null) break
        }

        if (capturedCall != null) {
            val callId = capturedCall["callId"] as String
            val dedupeKey = capturedCall["dedupeKey"] as String
            val deviceId = getDeviceId()
            val rawLeadId = capturedCall["leadId"] as? String
            val numberE164 = capturedCall["numberE164"] as String
            val startedAt = capturedCall["startedAt"] as Long
            val endedAt = capturedCall["endedAt"] as Long
            val durationSec = capturedCall["durationSec"] as Int
            val outcome = capturedCall["outcome"] as String
            val sim = capturedCall["sim"] as String

            // ─────────────────────────────────────────────────────────────
            // 3-TIER LEAD-CENTRIC CALL FILTERING PIPELINE
            // ─────────────────────────────────────────────────────────────
            // Tier 1: Known leadId supplied by CRM dial
            var resolvedLeadId = if (!rawLeadId.isNullOrBlank()) rawLeadId else null
            var resolvedLeadName: String? = null

            // Tier 2: Match against registered CRM leads
            if (resolvedLeadId == null) {
                val matched = dbHelper.findLeadByNumber(numberE164)
                if (matched != null) {
                    resolvedLeadId = matched["leadId"]
                    resolvedLeadName = matched["leadName"]
                }
            }

            // Tier 3: Unknown / Personal Call
            val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
            val logUnknownCalls = prefs.getString("cfg_log_unknown_calls", "false") == "true"

            if (resolvedLeadId == null && !logUnknownCalls) {
                // PRIVACY GUARANTEE: Non-CRM numbers are strictly ignored.
                // Do NOT insert into SQLite, do NOT enqueue outbox mutation, do NOT scan audio recordings.
                val eventPayload = mapOf(
                    "numberE164" to numberE164,
                    "isUnknown" to true
                )
                sendEvent("unknownCallIgnored", eventPayload)
                return
            }

            val leadId = resolvedLeadId

            // 1. Persist to native SQLite (Task 4)
            val inserted = dbHelper.insertCall(
                id = callId,
                dedupeKey = dedupeKey,
                deviceId = deviceId,
                leadId = leadId,
                numberE164 = numberE164,
                startedAt = startedAt,
                endedAt = endedAt,
                durationSec = durationSec,
                outcome = outcome,
                direction = "OUTBOUND",
                sim = sim,
                origin = "ENGINE",
                recordingStatus = if (durationSec < 10 || outcome != "CONNECTED") "NOT_APPLICABLE" else "PENDING"
            )

            if (inserted) {
                // 2. Enqueue mutation
                val mutationPayload = JSONObject().apply {
                    put("id", callId)
                    put("dedupeKey", dedupeKey)
                    put("deviceId", deviceId)
                    put("leadId", leadId ?: "")
                    put("numberE164", numberE164)
                    put("startedAt", formatIso(startedAt))
                    put("endedAt", formatIso(endedAt))
                    put("durationSec", durationSec)
                    put("outcome", outcome)
                    put("direction", "OUTBOUND")
                    put("sim", sim)
                    put("channel", "SIM")
                    put("origin", "ENGINE")
                }
                dbHelper.enqueueMutation("CALL_CAPTURED", mutationPayload.toString())

                // 2b. Automated Missed Call Follow-Up Task for matched leads
                if (outcome == "MISSED" && leadId != null) {
                    val followUpPayload = JSONObject().apply {
                        put("leadId", leadId)
                        put("dueAt", formatIso(System.currentTimeMillis() + 15 * 60 * 1000L))
                        put("note", "Automated: Inbound missed call callback required from ${resolvedLeadName ?: numberE164}")
                    }
                    dbHelper.enqueueMutation("FOLLOWUP_CREATED", followUpPayload.toString())
                }

                // 3. Emit event to React Native
                val eventPayload = mapOf(
                    "callId" to callId,
                    "leadId" to (leadId ?: ""),
                    "leadName" to (resolvedLeadName ?: ""),
                    "numberE164" to numberE164,
                    "durationSec" to durationSec,
                    "outcome" to outcome,
                    "sim" to sim,
                    "dedupeKey" to dedupeKey,
                    "startedAt" to formatIso(startedAt),
                    "endedAt" to formatIso(endedAt)
                )
                sendEvent("callEnded", eventPayload)

                // 4. Trigger background sync
                flushOutboxToServer()
            }
        }
    }

    private fun queryLatestCallLogEntry(): Map<String, Any>? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            return null
        }

        val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
        val activeLeadId = prefs.getString("active_dial_lead_id", null)
        val activeSimSlot = prefs.getInt("active_dial_sim_slot", 0)
        val deviceId = getDeviceId()

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.TYPE
        )

        // Query calls in the last 2 minutes
        val minTime = System.currentTimeMillis() - 120_000L
        val cursor: Cursor? = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            "${CallLog.Calls.DATE} >= ?",
            arrayOf(minTime.toString()),
            "${CallLog.Calls.DATE} DESC LIMIT 1"
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val callLogId = it.getString(it.getColumnIndexOrThrow(CallLog.Calls._ID))
                val rawNumber = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER)) ?: ""
                val startedAt = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE))
                val durationSec = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.DURATION))
                val type = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE))

                val endedAt = startedAt + (durationSec * 1000L)
                val numberE164 = normalizePhone(rawNumber)

                // Compute dedupe key: hash(deviceId + callLogId + startedAt + numberE164)
                val dedupeKey = computeDedupeKey(deviceId, callLogId, startedAt, numberE164)

                val outcome = when {
                    durationSec > 0 -> "CONNECTED"
                    type == CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                    type == CallLog.Calls.MISSED_TYPE -> "MISSED"
                    else -> "NOT_CONNECTED"
                }

                val callId = "call_${System.currentTimeMillis()}_${(100..999).random()}"

                return mapOf(
                    "callId" to callId,
                    "dedupeKey" to dedupeKey,
                    "callLogId" to callLogId,
                    "leadId" to (activeLeadId ?: ""),
                    "numberE164" to numberE164,
                    "startedAt" to startedAt,
                    "endedAt" to endedAt,
                    "durationSec" to durationSec,
                    "outcome" to outcome,
                    "sim" to "SIM${activeSimSlot + 1}"
                )
            }
        }
        return null
    }

    /**
     * Reconciliation scan for calls missed while app was dead
     */
    private fun reconcileCallsSince(sinceTimestampMs: Long): List<Map<String, Any>> {
        val reconciledList = mutableListOf<Map<String, Any>>()
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            return reconciledList
        }

        val deviceId = getDeviceId()
        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.TYPE
        )

        val cursor: Cursor? = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            "${CallLog.Calls.DATE} >= ?",
            arrayOf(sinceTimestampMs.toString()),
            "${CallLog.Calls.DATE} ASC"
        )

        cursor?.use {
            while (it.moveToNext()) {
                val callLogId = it.getString(it.getColumnIndexOrThrow(CallLog.Calls._ID))
                val rawNumber = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER)) ?: ""
                val startedAt = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE))
                val durationSec = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.DURATION))
                val type = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE))

                val endedAt = startedAt + (durationSec * 1000L)
                val numberE164 = normalizePhone(rawNumber)
                val dedupeKey = computeDedupeKey(deviceId, callLogId, startedAt, numberE164)

                // Check if already captured in local SQLite
                if (!dbHelper.hasDedupeKey(dedupeKey)) {
                    // 3-TIER PRIVACY FILTERING FOR RECONCILIATION:
                    // Only reconcile calls that belong to registered CRM leads!
                    val matched = dbHelper.findLeadByNumber(numberE164)
                    val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
                    val logUnknownCalls = prefs.getString("cfg_log_unknown_calls", "false") == "true"

                    if (matched == null && !logUnknownCalls) {
                        // Skip personal calls completely!
                        continue
                    }
                    val leadId = matched?.get("leadId")
                    val leadName = matched?.get("leadName")

                    val outcome = when {
                        durationSec > 0 -> "CONNECTED"
                        type == CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        type == CallLog.Calls.MISSED_TYPE -> "MISSED"
                        else -> "NOT_CONNECTED"
                    }
                    val callId = "reconcile_${System.currentTimeMillis()}_${callLogId}"

                    dbHelper.insertCall(
                        id = callId,
                        dedupeKey = dedupeKey,
                        deviceId = deviceId,
                        leadId = leadId,
                        numberE164 = numberE164,
                        startedAt = startedAt,
                        endedAt = endedAt,
                        durationSec = durationSec,
                        outcome = outcome,
                        direction = "OUTBOUND",
                        sim = "SIM1",
                        origin = "RECONCILE",
                        recordingStatus = if (durationSec < 10 || outcome != "CONNECTED") "NOT_APPLICABLE" else "PENDING"
                    )

                    val mutationPayload = JSONObject().apply {
                        put("id", callId)
                        put("dedupeKey", dedupeKey)
                        put("deviceId", deviceId)
                        put("leadId", leadId ?: "")
                        put("numberE164", numberE164)
                        put("startedAt", formatIso(startedAt))
                        put("endedAt", formatIso(endedAt))
                        put("durationSec", durationSec)
                        put("outcome", outcome)
                        put("direction", "OUTBOUND")
                        put("sim", "SIM1")
                        put("channel", "SIM")
                        put("origin", "RECONCILE")
                    }
                    dbHelper.enqueueMutation("CALL_CAPTURED", mutationPayload.toString())

                    reconciledList.add(mapOf(
                        "id" to callId,
                        "dedupeKey" to dedupeKey,
                        "numberE164" to numberE164,
                        "startedAt" to formatIso(startedAt),
                        "endedAt" to formatIso(endedAt),
                        "durationSec" to durationSec,
                        "outcome" to outcome,
                        "origin" to "RECONCILE"
                    ))
                }
            }
        }

        // Post reconcile batch directly to backend if network available
        if (reconciledList.isNotEmpty()) {
            coroutineScope.launch {
                sendReconcileBatchToServer(reconciledList)
            }
        }

        return reconciledList
    }

    private fun sendReconcileBatchToServer(reconciledCalls: List<Map<String, Any>>) {
        val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
        val apiBase = prefs.getString("api_base", null) ?: return
        val accessToken = prefs.getString("access_token", null) ?: return

        try {
            val jsonCalls = JSONArray()
            for (call in reconciledCalls) {
                jsonCalls.put(JSONObject(call))
            }
            val bodyObj = JSONObject().apply {
                put("calls", jsonCalls)
            }

            val request = Request.Builder()
                .url("$apiBase/calls/reconcile")
                .header("Authorization", "Bearer $accessToken")
                .header("Content-Type", "application/json")
                .post(bodyObj.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = httpClient.newCall(request).execute()
            if (response.isSuccessful) {
                for (call in reconciledCalls) {
                    val id = call["id"] as? String
                    if (id != null) dbHelper.markCallSynced(id)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Flush outbox mutations and calls to server
     */
    private fun flushOutboxToServer() {
        val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
        val apiBase = prefs.getString("api_base", null) ?: return
        val accessToken = prefs.getString("access_token", null) ?: return

        val mutations = dbHelper.getPendingMutations()
        if (mutations.isEmpty()) return

        for (mut in mutations) {
            val mutId = mut["id"] as String
            val mutType = mut["mutationType"] as String
            val payloadStr = mut["payloadJson"] as String

            try {
                val endpoint = when (mutType) {
                    "CALL_CAPTURED" -> "$apiBase/calls"
                    "DISPOSITION_SAVED" -> {
                        val payload = JSONObject(payloadStr)
                        val callId = payload.getString("callId")
                        "$apiBase/calls/$callId/disposition"
                    }
                    else -> "$apiBase/sync/push"
                }

                val requestBody = when (mutType) {
                    "CALL_CAPTURED" -> {
                        val callJson = JSONObject(payloadStr)
                        JSONObject().apply {
                            put("calls", JSONArray().put(callJson))
                        }.toString()
                    }
                    else -> payloadStr
                }

                val request = Request.Builder()
                    .url(endpoint)
                    .header("Authorization", "Bearer $accessToken")
                    .header("Content-Type", "application/json")
                    .post(requestBody.toRequestBody("application/json".toMediaType()))
                    .build()

                val res = httpClient.newCall(request).execute()
                if (res.isSuccessful || res.code == 409) {
                    // Mark synced (409 indicates already captured idempotently)
                    dbHelper.markMutationSynced(mutId)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                break // Stop batch if offline
            }
        }

        val remaining = dbHelper.getPendingMutations().size
        sendEvent("syncStatus", mapOf(
            "pendingCount" to remaining,
            "lastSyncAt" to formatIso(System.currentTimeMillis())
        ))
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    private fun computeDedupeKey(deviceId: String, callLogId: String, startedAt: Long, numberE164: String): String {
        val raw = "$deviceId:$callLogId:$startedAt:$numberE164"
        val bytes = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun normalizePhone(raw: String): String {
        val clean = raw.replace(Regex("[^0+0-9]"), "")
        return when {
            clean.startsWith("+") -> clean
            clean.length == 10 -> "+91$clean"
            clean.length == 11 && clean.startsWith("0") -> "+91${clean.substring(1)}"
            clean.length == 12 && clean.startsWith("91") -> "+$clean"
            else -> if (clean.startsWith("+")) clean else "+$clean"
        }
    }

    private fun getDeviceId(): String {
        val prefs = context.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
        var id = prefs.getString("device_id", null)
        if (id == null) {
            id = "device_${Build.MANUFACTURER}_${Build.MODEL}_${(1000..9999).random()}".replace(" ", "_")
            prefs.edit().putString("device_id", id).apply()
        }
        return id
    }

    private fun formatIso(epochMs: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(epochMs))
    }

    private fun schedulePeriodicWorkManagerSync() {
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "TelecallingSyncWork",
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun triggerWorkManagerSync() {
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "TelecallingOneTimeSync",
                ExistingWorkPolicy.REPLACE,
                syncRequest
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun simulateCallInternal(
        leadId: String,
        number: String,
        durationSec: Int,
        outcome: String,
        simSlot: Int
    ): Map<String, Any> {
        val cleanNumber = normalizePhone(number)
        val callId = "sim_${System.currentTimeMillis()}_${(100..999).random()}"
        val deviceId = getDeviceId()
        val startedAt = System.currentTimeMillis() - (durationSec * 1000L)
        val endedAt = System.currentTimeMillis()
        val callLogId = "sim_log_${System.currentTimeMillis()}"
        val dedupeKey = computeDedupeKey(deviceId, callLogId, startedAt, cleanNumber)

        val inserted = dbHelper.insertCall(
            id = callId,
            dedupeKey = dedupeKey,
            deviceId = deviceId,
            leadId = leadId.ifEmpty { null },
            numberE164 = cleanNumber,
            startedAt = startedAt,
            endedAt = endedAt,
            durationSec = durationSec,
            outcome = outcome,
            direction = "OUTBOUND",
            sim = "SIM${simSlot + 1}",
            origin = "SIMULATION",
            recordingStatus = if (durationSec < 10 || outcome != "CONNECTED") "NOT_APPLICABLE" else "PENDING"
        )

        if (inserted) {
            val mutationPayload = JSONObject().apply {
                put("id", callId)
                put("dedupeKey", dedupeKey)
                put("deviceId", deviceId)
                put("leadId", leadId)
                put("numberE164", cleanNumber)
                put("startedAt", formatIso(startedAt))
                put("endedAt", formatIso(endedAt))
                put("durationSec", durationSec)
                put("outcome", outcome)
                put("direction", "OUTBOUND")
                put("sim", "SIM${simSlot + 1}")
                put("channel", "SIM")
                put("origin", "SIMULATION")
            }
            dbHelper.enqueueMutation("CALL_CAPTURED", mutationPayload.toString())

            sendEvent("callEnded", mapOf(
                "callId" to callId,
                "leadId" to leadId,
                "numberE164" to cleanNumber,
                "durationSec" to durationSec,
                "outcome" to outcome,
                "sim" to "SIM${simSlot + 1}",
                "dedupeKey" to dedupeKey,
                "startedAt" to formatIso(startedAt),
                "endedAt" to formatIso(endedAt)
            ))

            triggerWorkManagerSync()
            coroutineScope.launch {
                flushOutboxToServer()
            }
        }

        return mapOf(
            "success" to inserted,
            "callId" to callId,
            "dedupeKey" to dedupeKey,
            "durationSec" to durationSec,
            "outcome" to outcome,
            "sim" to "SIM${simSlot + 1}"
        )
    }
}
