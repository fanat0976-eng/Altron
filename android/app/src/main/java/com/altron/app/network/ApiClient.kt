package com.altron.app.network

import com.altron.app.model.Message
import com.altron.app.model.Session
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiClient(private var baseUrl: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    fun updateUrl(url: String) { baseUrl = url }

    suspend fun health(): ServerHealth = get("/health")

    suspend fun listSessions(): List<Session> = get("/api/sessions")

    suspend fun createSession(name: String, model: String? = null): Session =
        post("/api/sessions", """{"name":"${name.replace("\"", "\\\"")}","model":"${model ?: "qwen2.5:7b"}"}""")

    suspend fun deleteSession(id: String): Unit = delete("/api/sessions/$id")

    suspend fun getMessages(sessionId: String): List<Message> = get("/api/sessions/$sessionId/messages")

    suspend fun getModels(): ModelsResponse = get("/api/models")

    suspend fun getTools(): List<ToolDef> = get("/api/tools")

    private suspend inline fun <reified T> get(path: String): T = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("http://$baseUrl$path").get().build()
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
        json.decodeFromString<T>(response.body!!.string())
    }

    private suspend inline fun <reified T> post(path: String, body: String): T = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("http://$baseUrl$path")
            .post(body.toRequestBody(mediaType))
            .build()
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
        json.decodeFromString<T>(response.body!!.string())
    }

    private suspend fun delete(path: String): Unit = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("http://$baseUrl$path").delete().build()
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
    }

    @Serializable
    data class ServerHealth(val status: String, val version: String, val uptime: Double)

    @Serializable
    data class ModelsResponse(val ollama: List<String>)

    @Serializable
    data class ToolDef(val name: String, val description: String)
}
