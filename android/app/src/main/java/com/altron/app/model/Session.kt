package com.altron.app.model

import kotlinx.serialization.Serializable

@Serializable
data class Session(
    val id: String,
    val name: String,
    val model: String,
    val systemPrompt: String? = null,
    val createdAt: String,
    val updatedAt: String,
)
