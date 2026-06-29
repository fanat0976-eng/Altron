package com.altron.app.network

import com.altron.app.model.WsIncoming
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class WsClient {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var ws: WebSocket? = null
    private var reconnectJob: kotlinx.coroutines.Job? = null
    private var intentionalClose = false

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected

    private val _messages = MutableSharedFlow<WsIncoming>(extraBufferCapacity = 64)
    val messages: SharedFlow<WsIncoming> = _messages

    fun connect(url: String, token: String? = null) {
        intentionalClose = false
        val wsUrl = if (token != null) "$url?token=$token" else url
        val request = Request.Builder().url(wsUrl).build()
        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _connected.value = true
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = json.decodeFromString<WsIncoming>(text)
                    scope.launch { _messages.emit(msg) }
                } catch (_: Exception) {}
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connected.value = false
                if (!intentionalClose) scheduleReconnect(url)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connected.value = false
                if (!intentionalClose) scheduleReconnect(url)
            }
        })
    }

    fun disconnect() {
        intentionalClose = true
        reconnectJob?.cancel()
        ws?.close(1000, "bye")
        ws = null
        _connected.value = false
    }

    fun send(msg: String) {
        if (_connected.value) {
            ws?.send(msg)
        }
    }

    private fun scheduleReconnect(url: String) {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(3000)
            if (!intentionalClose) connect(url)
        }
    }
}
