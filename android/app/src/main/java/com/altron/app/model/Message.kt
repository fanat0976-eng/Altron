package com.altron.app.model

import kotlinx.serialization.Serializable

@Serializable
data class Message(
    val id: String,
    val sessionId: String,
    val role: String,
    val content: String,
    val createdAt: String,
)
