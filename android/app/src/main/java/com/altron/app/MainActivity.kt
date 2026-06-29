package com.altron.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.altron.app.ui.screens.ChatScreen
import com.altron.app.ui.screens.ConnectScreen
import com.altron.app.ui.screens.SessionsScreen
import com.altron.app.ui.theme.AltronTheme
import com.altron.app.ui.theme.Background
import com.altron.app.ui.theme.Error
import com.altron.app.ui.theme.Primary
import com.altron.app.ui.theme.Success
import com.altron.app.ui.theme.TextMuted
import com.altron.app.viewmodel.ChatViewModel
import com.altron.app.viewmodel.ConnectionViewModel
import com.altron.app.viewmodel.SessionsViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AltronTheme {
                val connVm: ConnectionViewModel = viewModel()
                val status by connVm.status.collectAsState()

                if (status is ConnectionViewModel.ConnectionStatus.Connected) {
                    val sessionsVm = SessionsViewModel { connVm.api }
                    val chatVm = ChatViewModel({ connVm.api }, connVm.ws)
                    val drawerState = rememberDrawerState(DrawerValue.Closed)
                    val scope = rememberCoroutineScope()

                    LaunchedEffect(Unit) { sessionsVm.load() }

                    ModalNavigationDrawer(
                        drawerState = drawerState,
                        drawerContent = {
                            SessionsScreen(
                                viewModel = sessionsVm,
                                onSessionSelected = { id ->
                                    chatVm.setSession(id)
                                    scope.launch { drawerState.close() }
                                },
                            )
                        },
                    ) {
                        Scaffold(
                            topBar = {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Background)
                                        .padding(horizontal = 16.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        text = "⚡",
                                        style = MaterialTheme.typography.headlineMedium,
                                    )
                                    Text(
                                        text = "Альтрон",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(start = 8.dp),
                                    )
                                    Box(modifier = Modifier.weight(1f))
                                    val isConnected by connVm.ws.connected.collectAsState()
                                    Text(
                                        text = if (isConnected) "●" else "○",
                                        color = if (isConnected) Success else Error,
                                        style = MaterialTheme.typography.titleLarge,
                                    )
                                    Text(
                                        text = if (isConnected) "Подключён" else "Отключён",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextMuted,
                                        modifier = Modifier.padding(start = 4.dp),
                                    )
                                }
                            },
                            containerColor = Background,
                        ) { padding ->
                            Column(modifier = Modifier.padding(padding)) {
                                ChatScreen(chatVm)
                            }
                        }
                    }
                } else {
                    ConnectScreen(
                        viewModel = connVm,
                        onConnected = {},
                    )
                }
            }
        }
    }
}
