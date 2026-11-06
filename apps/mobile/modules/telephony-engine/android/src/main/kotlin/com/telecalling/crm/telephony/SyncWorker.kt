package com.telecalling.crm.telephony

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Android Jetpack WorkManager worker for durable background synchronization.
 * Survives process death, device reboots, and aggressive OEM background kills.
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val dbHelper by lazy {
        CallLogDatabaseHelper.getInstance(applicationContext)
    }

    private val httpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    override suspend fun doWork(): Result {
        return try {
            val pendingCount = flushOutbox()
            if (pendingCount > 0) {
                // If there are still pending mutations due to network failure, retry with exponential backoff
                Result.retry()
            } else {
                Result.success()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }

    private fun flushOutbox(): Int {
        val prefs = applicationContext.getSharedPreferences("telephony_engine_prefs", Context.MODE_PRIVATE)
        val apiBase = prefs.getString("api_base", null) ?: return 0
        val accessToken = prefs.getString("access_token", null) ?: return 0

        val mutations = dbHelper.getPendingMutations()
        if (mutations.isEmpty()) return 0

        var remaining = mutations.size

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
                    dbHelper.markMutationSynced(mutId)
                    remaining--
                }
            } catch (e: Exception) {
                e.printStackTrace()
                break // Stop batch if network unavailable
            }
        }
        return remaining
    }
}

