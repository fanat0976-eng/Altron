package com.altron.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.altron.app.ui.theme.Background
import com.altron.app.ui.theme.Border
import com.altron.app.ui.theme.Card
import com.altron.app.ui.theme.Hover
import com.altron.app.ui.theme.Primary
import com.altron.app.ui.theme.TextMuted
import com.altron.app.ui.theme.TextSecondary
import com.altron.app.viewmodel.SessionsViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SessionsScreen(
    viewModel: SessionsViewModel,
    onSessionSelected: (String) -> Unit,
) {
    val sessions by viewModel.sessions.collectAsState()
    val activeId by viewModel.activeSessionId.collectAsState()
    var newName by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    Column(
        modifier = Modifier
            .background(Background)
            .padding(16.dp)
    ) {
        Text(
            text = "Сессии",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = TextSecondary,
            modifier = Modifier.padding(bottom = 12.dp),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = newName,
                onValueChange = { newName = it },
                placeholder = { Text("Название...", color = TextMuted) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(
                    onDone = {
                        if (newName.isNotBlank()) {
                            viewModel.create(newName.trim())
                            newName = ""
                            focusManager.clearFocus()
                        }
                    },
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = Border,
                    cursorColor = Primary,
                ),
                modifier = Modifier.weight(1f),
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(onClick = {
                if (newName.isNotBlank()) {
                    viewModel.create(newName.trim())
                    newName = ""
                    focusManager.clearFocus()
                }
            }) {
                Icon(Icons.Default.Add, "Create", tint = Primary)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn {
            items(sessions) { session ->
                val isActive = session.id == activeId
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickable {
                            viewModel.select(session.id)
                            onSessionSelected(session.id)
                        },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isActive) Hover else Card,
                    ),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = session.name,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = "${session.model} · ${formatDate(session.updatedAt)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextMuted,
                            )
                        }
                        IconButton(onClick = { viewModel.delete(session.id) }) {
                            Icon(Icons.Default.Close, "Delete", tint = TextMuted)
                        }
                    }
                }
            }
        }

        if (sessions.isEmpty()) {
            Text(
                text = "Нет сессий",
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted,
                modifier = Modifier.padding(top = 24.dp),
            )
        }
    }
}

private fun formatDate(iso: String): String {
    return try {
        val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(iso)
        val diff = System.currentTimeMillis() - (date?.time ?: 0)
        when {
            diff < 3600000 -> "${diff / 60000}м назад"
            diff < 86400000 -> "${diff / 3600000}ч назад"
            else -> SimpleDateFormat("d MMM", Locale("ru")).format(date ?: Date())
        }
    } catch (_: Exception) { iso }
}
