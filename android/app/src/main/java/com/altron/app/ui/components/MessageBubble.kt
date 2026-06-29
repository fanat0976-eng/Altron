package com.altron.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.altron.app.ui.theme.Card
import com.altron.app.ui.theme.Error
import com.altron.app.ui.theme.Primary
import com.altron.app.ui.theme.TextMuted
import com.altron.app.ui.theme.TextSecondary
import com.altron.app.viewmodel.ChatMessage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MessageBubble(message: ChatMessage) {
    val isUser = message.role == "user"
    val isSystem = message.role == "system"
    val isError = message.content.startsWith("Ошибка:")

    val bgColor = when {
        isError -> Error.copy(alpha = 0.1f)
        isUser -> Primary.copy(alpha = 0.2f)
        isSystem -> Card
        else -> Card
    }

    val textColor = when {
        isError -> Error
        isSystem -> TextMuted
        else -> MaterialTheme.colorScheme.onSurface
    }

    val alignment = if (isUser) "Вы" else if (isSystem) "Система" else "Альтрон"

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Text(
            text = alignment,
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(if (isUser) 0.85f else 1f)
                .clip(RoundedCornerShape(12.dp))
                .background(bgColor)
                .padding(12.dp)
        ) {
            Column {
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyLarge,
                    color = textColor,
                )
                if (message.content.isNotEmpty()) {
                    Text(
                        text = formatTime(message.timestamp),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
    }
}

private fun formatTime(ts: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(ts))
}
