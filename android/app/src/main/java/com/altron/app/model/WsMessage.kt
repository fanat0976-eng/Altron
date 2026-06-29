package com.altron.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class WsIncoming(
    val type: String,
    val clientId: String? = null,
    val sessionId: String? = null,
    val content: String? = null,
    val done: Boolean? = null,
    val provider: String? = null,
    val model: String? = null,
    val response: String? = null,
    val message: String? = null,
    val session: Session? = null,
    val steps: List<JsonElement>? = null,
)

@Serializable
data class WsOutgoing(
    val type: String,
    val sessionId: String? = null,
    val content: String? = null,
    val model: String? = null,
    val provider: String? = null,
)
