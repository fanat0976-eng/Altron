package com.altron.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.altron.app.network.ApiClient
import com.altron.app.network.WsClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ConnectionViewModel : ViewModel() {
    private var apiClient: ApiClient? = null
    private val wsClient = WsClient()

    val api: ApiClient get() = apiClient ?: throw IllegalStateException("Not connected")
    val ws: WsClient get() = wsClient

    private val _serverUrl = MutableStateFlow("")
    val serverUrl: StateFlow<String> = _serverUrl

    private val _status = MutableStateFlow<ConnectionStatus>(ConnectionStatus.Disconnected)
    val status: StateFlow<ConnectionStatus> = _status

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    init {
        viewModelScope.launch {
            wsClient.connected.collect { connected ->
                _status.value = if (connected) ConnectionStatus.Connected else ConnectionStatus.Disconnected
            }
        }
    }

    fun connect(url: String) {
        _serverUrl.value = url
        _status.value = ConnectionStatus.Connecting
        viewModelScope.launch {
            try {
                val client = ApiClient(url)
                client.health()
                apiClient = client
                wsClient.connect("ws://$url/ws")
            } catch (e: Exception) {
                _status.value = ConnectionStatus.Disconnected
                _error.value = e.message ?: "Connection failed"
            }
        }
    }

    fun disconnect() {
        wsClient.disconnect()
        apiClient = null
        _status.value = ConnectionStatus.Disconnected
    }

    fun clearError() { _error.value = null }

    sealed class ConnectionStatus {
        data object Disconnected : ConnectionStatus()
        data object Connecting : ConnectionStatus()
        data object Connected : ConnectionStatus()
    }
}
