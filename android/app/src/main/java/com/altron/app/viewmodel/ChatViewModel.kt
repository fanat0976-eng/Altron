package com.altron.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.altron.app.model.Session
import com.altron.app.model.WsIncoming
import com.altron.app.network.ApiClient
import com.altron.app.network.WsClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

data class ChatMessage(
    val id: String,
    val role: String,
    val content: String,
    val streaming: Boolean = false,
    val timestamp: Long = System.currentTimeMillis(),
)

class ChatViewModel(
    private val getApi: () -> ApiClient,
    private val ws: WsClient,
) : ViewModel() {

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages

    private val _isStreaming = MutableStateFlow(false)
    val isStreaming: StateFlow<Boolean> = _isStreaming

    private val _agentMode = MutableStateFlow(true)
    val agentMode: StateFlow<Boolean> = _agentMode

    private val _sessionId = MutableStateFlow<String?>(null)
    val sessionId: StateFlow<String?> = _sessionId

    private val json = Json { ignoreUnknownKeys = true }

    init {
        viewModelScope.launch {
            ws.messages.collect { msg -> handleWsMessage(msg) }
        }
    }

    fun setSession(sessionId: String?) {
        _sessionId.value = sessionId
        _messages.value = emptyList()
        if (sessionId != null) loadHistory(sessionId)
    }

    fun toggleAgentMode() { _agentMode.value = !_agentMode.value }

    fun send(content: String) {
        val sid = _sessionId.value ?: return
        if (content.isBlank() || _isStreaming.value) return

        _messages.value = _messages.value + ChatMessage(
            id = "user-${System.currentTimeMillis()}",
            role = "user",
            content = content,
        )

        val type = if (_agentMode.value) "agent_chat" else "chat"
        val msg = """{"type":"$type","sessionId":"$sid","content":"${content.replace("\"", "\\\"")}"}"""
        ws.send(msg)
    }

    private fun handleWsMessage(msg: WsIncoming) {
        when (msg.type) {
            "stream_start" -> {
                _isStreaming.value = true
                _messages.value = _messages.value + ChatMessage(
                    id = "stream-${System.currentTimeMillis()}",
                    role = "assistant",
                    content = "",
                    streaming = true,
                )
            }
            "stream_chunk" -> {
                val last = _messages.value.lastOrNull()
                if (last != null && last.streaming) {
                    _messages.value = _messages.value.dropLast(1) +
                        last.copy(content = last.content + (msg.content ?: ""))
                }
            }
            "stream_end" -> {
                _isStreaming.value = false
                _messages.value = _messages.value.map {
                    if (it.streaming) it.copy(streaming = false) else it
                }
            }
            "agent_start" -> {
                _isStreaming.value = true
            }
            "agent_result" -> {
                _isStreaming.value = false
                val response = msg.response ?: return
                _messages.value = _messages.value.filter {
                    !(it.role == "system" && it.content.contains("обрабатывает"))
                } + ChatMessage(
                    id = "result-${System.currentTimeMillis()}",
                    role = "assistant",
                    content = response,
                )
            }
            "error" -> {
                _isStreaming.value = false
                _messages.value = _messages.value + ChatMessage(
                    id = "error-${System.currentTimeMillis()}",
                    role = "system",
                    content = "Ошибка: ${msg.message ?: "unknown"}",
                )
            }
        }
    }

    private fun loadHistory(sessionId: String) {
        viewModelScope.launch {
            try {
                val history = getApi().getMessages(sessionId)
                _messages.value = history.map {
                    ChatMessage(
                        id = it.id,
                        role = it.role,
                        content = it.content,
                    )
                }
            } catch (_: Exception) {}
        }
    }
}
