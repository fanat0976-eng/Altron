package com.altron.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.altron.app.model.Session
import com.altron.app.network.ApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class SessionsViewModel(private val getApi: () -> ApiClient) : ViewModel() {
    private val _sessions = MutableStateFlow<List<Session>>(emptyList())
    val sessions: StateFlow<List<Session>> = _sessions

    private val _activeSessionId = MutableStateFlow<String?>(null)
    val activeSessionId: StateFlow<String?> = _activeSessionId

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _sessions.value = getApi().listSessions()
            } catch (_: Exception) {}
            _loading.value = false
        }
    }

    fun select(id: String?) { _activeSessionId.value = id }

    fun create(name: String, onCreated: (String) -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = getApi().createSession(name)
                _sessions.value = listOf(session) + _sessions.value
                _activeSessionId.value = session.id
                onCreated(session.id)
            } catch (_: Exception) {}
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            try {
                getApi().deleteSession(id)
                _sessions.value = _sessions.value.filter { it.id != id }
                if (_activeSessionId.value == id) _activeSessionId.value = null
            } catch (_: Exception) {}
        }
    }
}
