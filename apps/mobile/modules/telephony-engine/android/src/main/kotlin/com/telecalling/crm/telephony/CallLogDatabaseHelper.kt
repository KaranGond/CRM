package com.telecalling.crm.telephony

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * Native SQLite helper for zero-loss offline call capture and outbox mutations.
 * Survives process death and aggressive OEM background app killing (MIUI/HyperOS, FuntouchOS, ColorOS).
 */
class CallLogDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "telephony_engine_native.db"
        const val DATABASE_VERSION = 1

        const val TABLE_CALLS = "native_calls"
        const val TABLE_OUTBOX = "native_outbox_mutations"

        @Volatile
        private var instance: CallLogDatabaseHelper? = null

        fun getInstance(context: Context): CallLogDatabaseHelper {
            return instance ?: synchronized(this) {
                instance ?: CallLogDatabaseHelper(context.applicationContext).also { instance = it }
            }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS $TABLE_CALLS (
                id TEXT PRIMARY KEY,
                dedupe_key TEXT UNIQUE,
                device_id TEXT,
                lead_id TEXT,
                number_e164 TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                ended_at INTEGER NOT NULL,
                duration_sec INTEGER NOT NULL,
                outcome TEXT NOT NULL,
                direction TEXT DEFAULT 'OUTBOUND',
                sim TEXT DEFAULT 'SIM1',
                origin TEXT DEFAULT 'ENGINE',
                disposition_id TEXT,
                remark TEXT,
                follow_up_at TEXT,
                recording_uri TEXT,
                recording_status TEXT DEFAULT 'PENDING',
                sync_status TEXT DEFAULT 'PENDING',
                created_at INTEGER NOT NULL
            );
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS $TABLE_OUTBOX (
                id TEXT PRIMARY KEY,
                mutation_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                retry_count INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );
        """.trimIndent())

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_calls_dedupe ON $TABLE_CALLS (dedupe_key);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_calls_sync_status ON $TABLE_CALLS (sync_status);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_outbox_status ON $TABLE_OUTBOX (status);")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Migration logic for future schema changes
    }

    /**
     * Insert captured or reconciled call into native SQLite.
     * Thread-safe and atomic.
     */
    fun insertCall(
        id: String,
        dedupeKey: String,
        deviceId: String,
        leadId: String?,
        numberE164: String,
        startedAt: Long,
        endedAt: Long,
        durationSec: Int,
        outcome: String,
        direction: String = "OUTBOUND",
        sim: String = "SIM1",
        origin: String = "ENGINE",
        recordingStatus: String = "PENDING"
    ): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("id", id)
            put("dedupe_key", dedupeKey)
            put("device_id", deviceId)
            put("lead_id", leadId)
            put("number_e164", numberE164)
            put("started_at", startedAt)
            put("ended_at", endedAt)
            put("duration_sec", durationSec)
            put("outcome", outcome)
            put("direction", direction)
            put("sim", sim)
            put("origin", origin)
            put("recording_status", recordingStatus)
            put("sync_status", "PENDING")
            put("created_at", System.currentTimeMillis())
        }

        val rowId = db.insertWithOnConflict(TABLE_CALLS, null, values, SQLiteDatabase.CONFLICT_IGNORE)
        return rowId != -1L
    }

    /**
     * Check if a dedupe key already exists in native SQLite.
     */
    fun hasDedupeKey(dedupeKey: String): Boolean {
        val db = readableDatabase
        db.rawQuery("SELECT 1 FROM $TABLE_CALLS WHERE dedupe_key = ? LIMIT 1", arrayOf(dedupeKey)).use { cursor ->
            return cursor.moveToFirst()
        }
    }

    /**
     * Update call disposition and remark in local database.
     */
    fun updateDisposition(callId: String, dispositionId: String, remark: String?, followUpAt: String?): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("disposition_id", dispositionId)
            put("remark", remark)
            put("follow_up_at", followUpAt)
            put("sync_status", "PENDING")
        }
        val affected = db.update(TABLE_CALLS, values, "id = ? OR dedupe_key = ?", arrayOf(callId, callId))
        return affected > 0
    }

    /**
     * Update call recording status and URI
     */
    fun updateRecording(callId: String, recordingUri: String, status: String): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("recording_uri", recordingUri)
            put("recording_status", status)
        }
        val affected = db.update(TABLE_CALLS, values, "id = ?", arrayOf(callId))
        return affected > 0
    }

    /**
     * Enqueue mutation into native outbox.
     */
    fun enqueueMutation(mutationType: String, payloadJson: String): String {
        val id = "mut_nat_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val db = writableDatabase
        val values = ContentValues().apply {
            put("id", id)
            put("mutation_type", mutationType)
            put("payload_json", payloadJson)
            put("status", "PENDING")
            put("retry_count", 0)
            put("created_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict(TABLE_OUTBOX, null, values, SQLiteDatabase.CONFLICT_REPLACE)
        return id
    }

    /**
     * Get all pending mutations for synchronization.
     */
    fun getPendingMutations(): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        db.rawQuery("SELECT * FROM $TABLE_OUTBOX WHERE status = 'PENDING' ORDER BY created_at ASC", null).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(mapOf(
                    "id" to cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    "mutationType" to cursor.getString(cursor.getColumnIndexOrThrow("mutation_type")),
                    "payloadJson" to cursor.getString(cursor.getColumnIndexOrThrow("payload_json")),
                    "status" to cursor.getString(cursor.getColumnIndexOrThrow("status")),
                    "retryCount" to cursor.getInt(cursor.getColumnIndexOrThrow("retry_count")),
                    "createdAt" to cursor.getLong(cursor.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
        return results
    }

    /**
     * Mark an outbox mutation as synced.
     */
    fun markMutationSynced(mutationId: String) {
        val db = writableDatabase
        db.delete(TABLE_OUTBOX, "id = ?", arrayOf(mutationId))
    }

    /**
     * List unconcluded calls requiring disposition (pending sheet).
     */
    fun listPendingDispositions(): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        db.rawQuery(
            "SELECT * FROM $TABLE_CALLS WHERE disposition_id IS NULL ORDER BY ended_at DESC LIMIT 50",
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(mapOf(
                    "callId" to cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    "leadId" to (cursor.getString(cursor.getColumnIndexOrThrow("lead_id")) ?: ""),
                    "numberE164" to cursor.getString(cursor.getColumnIndexOrThrow("number_e164")),
                    "startedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("started_at")),
                    "endedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("ended_at")),
                    "durationSec" to cursor.getInt(cursor.getColumnIndexOrThrow("duration_sec")),
                    "outcome" to cursor.getString(cursor.getColumnIndexOrThrow("outcome")),
                    "sim" to cursor.getString(cursor.getColumnIndexOrThrow("sim")),
                    "dedupeKey" to cursor.getString(cursor.getColumnIndexOrThrow("dedupe_key"))
                ))
            }
        }
        return results
    }

    /**
     * Find recent calls needing recording matching.
     */
    fun getRecentCallsNeedingRecording(): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        db.rawQuery(
            """
            SELECT * FROM $TABLE_CALLS 
            WHERE recording_uri IS NULL 
              AND duration_sec >= 10 
              AND outcome = 'CONNECTED' 
            ORDER BY ended_at DESC LIMIT 20
            """.trimIndent(),
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(mapOf(
                    "callId" to cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    "numberE164" to cursor.getString(cursor.getColumnIndexOrThrow("number_e164")),
                    "startedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("started_at")),
                    "endedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("ended_at")),
                    "durationSec" to cursor.getInt(cursor.getColumnIndexOrThrow("duration_sec"))
                ))
            }
        }
        return results
    }

    /**
     * List all calls with pending sync status.
     */
    fun getUnsyncedCalls(): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        db.rawQuery("SELECT * FROM $TABLE_CALLS WHERE sync_status = 'PENDING' ORDER BY started_at ASC LIMIT 100", null).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(mapOf(
                    "id" to cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    "dedupeKey" to cursor.getString(cursor.getColumnIndexOrThrow("dedupe_key")),
                    "deviceId" to (cursor.getString(cursor.getColumnIndexOrThrow("device_id")) ?: ""),
                    "leadId" to (cursor.getString(cursor.getColumnIndexOrThrow("lead_id")) ?: ""),
                    "numberE164" to cursor.getString(cursor.getColumnIndexOrThrow("number_e164")),
                    "startedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("started_at")),
                    "endedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("ended_at")),
                    "durationSec" to cursor.getInt(cursor.getColumnIndexOrThrow("duration_sec")),
                    "outcome" to cursor.getString(cursor.getColumnIndexOrThrow("outcome")),
                    "sim" to (cursor.getString(cursor.getColumnIndexOrThrow("sim")) ?: "SIM1"),
                    "direction" to cursor.getString(cursor.getColumnIndexOrThrow("direction")),
                    "origin" to cursor.getString(cursor.getColumnIndexOrThrow("origin")),
                    "dispositionId" to (cursor.getString(cursor.getColumnIndexOrThrow("disposition_id")) ?: ""),
                    "remark" to (cursor.getString(cursor.getColumnIndexOrThrow("remark")) ?: ""),
                    "followUpAt" to (cursor.getString(cursor.getColumnIndexOrThrow("follow_up_at")) ?: ""),
                    "recordingStatus" to cursor.getString(cursor.getColumnIndexOrThrow("recording_status"))
                ))
            }
        }
        return results
    }

    /**
     * Mark call as synced with server.
     */
    fun markCallSynced(callId: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("sync_status", "SYNCED")
        }
        db.update(TABLE_CALLS, values, "id = ?", arrayOf(callId))
    }

    /**
     * Get all recent captured calls with dispositions and recording metadata.
     */
    fun getRecentCalls(limit: Int = 100): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        db.rawQuery("SELECT * FROM $TABLE_CALLS ORDER BY started_at DESC LIMIT ?", arrayOf(limit.toString())).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(mapOf(
                    "id" to cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    "dedupeKey" to cursor.getString(cursor.getColumnIndexOrThrow("dedupe_key")),
                    "deviceId" to (cursor.getString(cursor.getColumnIndexOrThrow("device_id")) ?: ""),
                    "leadId" to (cursor.getString(cursor.getColumnIndexOrThrow("lead_id")) ?: ""),
                    "numberE164" to cursor.getString(cursor.getColumnIndexOrThrow("number_e164")),
                    "startedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("started_at")),
                    "endedAt" to cursor.getLong(cursor.getColumnIndexOrThrow("ended_at")),
                    "durationSec" to cursor.getInt(cursor.getColumnIndexOrThrow("duration_sec")),
                    "outcome" to cursor.getString(cursor.getColumnIndexOrThrow("outcome")),
                    "sim" to (cursor.getString(cursor.getColumnIndexOrThrow("sim")) ?: "SIM1"),
                    "direction" to (cursor.getString(cursor.getColumnIndexOrThrow("direction")) ?: "OUTBOUND"),
                    "origin" to (cursor.getString(cursor.getColumnIndexOrThrow("origin")) ?: "ENGINE"),
                    "dispositionId" to (cursor.getString(cursor.getColumnIndexOrThrow("disposition_id")) ?: ""),
                    "remark" to (cursor.getString(cursor.getColumnIndexOrThrow("remark")) ?: ""),
                    "followUpAt" to (cursor.getString(cursor.getColumnIndexOrThrow("follow_up_at")) ?: ""),
                    "recordingUri" to (cursor.getString(cursor.getColumnIndexOrThrow("recording_uri")) ?: ""),
                    "recordingStatus" to (cursor.getString(cursor.getColumnIndexOrThrow("recording_status")) ?: "PENDING"),
                    "syncStatus" to (cursor.getString(cursor.getColumnIndexOrThrow("sync_status")) ?: "PENDING")
                ))
            }
        }
        return results
    }
}
