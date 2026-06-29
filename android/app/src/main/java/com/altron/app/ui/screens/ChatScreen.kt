package com.altron.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.altron.app.ui.components.MessageBubble
import com.altron.app.ui.theme.Background
import com.altron.app.ui.theme.Border
import com.altron.app.ui.theme.Card
import com.altron.app.ui.theme.Primary
import com.altron.app.ui.theme.Success
import com.altron.app.ui.theme.TextMuted
import com.altron.app.ui.theme.TextSecondary
import com.altron.app.viewmodel.ChatViewModel

@Composable
fun ChatScreen(viewModel: ChatViewModel) {
    val messages by viewModel.messages.collectAsState()
    val isStreaming by viewModel.isStreaming.collectAsState()
    val agentMode by viewModel.agentMode.collectAsState()
    val listState = rememberLazyListState()
    var input by remember { mutableStateOf("") }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Card)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(Success, CircleShape),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Сессия: ${viewModel.sessionId.value?.take(8) ?: "..."}",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
            )
            Spacer(modifier = Modifier.weight(1f))
            Text("Agent", style = MaterialTheme.typography.labelSmall, color = TextMuted)
            Spacer(modifier = Modifier.width(4.dp))
            Switch(
                checked = agentMode,
                onCheckedChange = { viewModel.toggleAgentMode() },
                colors = SwitchDefaults.colors(checkedThumbColor = Primary),
            )
        }

        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.Bottom,
        ) {
            if (messages.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Начните диалог с Альтроном", color = TextMuted)
                    }
                }
            }
            items(messages) { msg -> MessageBubble(msg) }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Card)
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextField(
                value = input,
                onValueChange = { input = it },
                placeholder = {
                    Text(
                        if (isStreaming) "Альтрон отвечает..." else "Введите сообщение...",
                        color = TextMuted,
                    )
                },
                enabled = !isStreaming,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    cursorColor = Primary,
                ),
                modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick = {
                    viewModel.send(input.trim())
                    input = ""
                },
                enabled = input.isNotBlank() && !isStreaming,
            ) {
                Icon(
                    Icons.Default.Send,
                    "Send",
                    tint = if (input.isNotBlank() && !isStreaming) Primary else TextMuted,
                )
            }
        }
    }
}
