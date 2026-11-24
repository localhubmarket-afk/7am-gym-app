package app.sevenamgym.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import app.sevenamgym.wear.data.SupabaseWearClient
import app.sevenamgym.wear.health.HealthConnectBiometricManager
import kotlinx.coroutines.launch

/**
 * Accessible Wear OS Companion UI (Jetpack Compose for Wear OS).
 * Meets WCAG 2.2 AA & COGA: Grade 6-8 text, high-contrast dark palette, >= 48.dp touch targets.
 */
@Composable
fun BudgetGymWearApp(
    supabaseClient: SupabaseWearClient,
    healthConnectManager: HealthConnectBiometricManager
) {
    val scope = rememberCoroutineScope()
    var exerciseName by remember { mutableStateOf("Barbell Squat") }
    var currentSet by remember { mutableIntStateOf(1) }
    val totalSets = 3
    var sleepText by remember { mutableStateOf("--") }
    var stepsText by remember { mutableStateOf("--") }
    var restingHrText by remember { mutableStateOf("--") }
    var statusText by remember { mutableStateOf("Ready when you are.") }
    var isSyncing by remember { mutableStateOf(false) }

    MaterialTheme {
        Scaffold(
            timeText = { TimeText() }
        ) {
            ScalingLazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF0A0E17))
                    .padding(horizontal = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    Text(
                        text = "7AM Gym",
                        color = Color(0xFF34D399),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                item {
                    Text(
                        text = exerciseName,
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { heading() }
                    )
                }

                item {
                    Text(
                        text = "Set $currentSet of $totalSets · 135 lbs × 8",
                        color = Color(0xFFE2E8F0),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center
                    )
                }

                item {
                    Chip(
                        onClick = {
                            if (currentSet < totalSets) {
                                currentSet += 1
                                statusText = "Set saved. Take your rest."
                            } else {
                                statusText = "All sets done for $exerciseName."
                            }
                        },
                        label = {
                            Text(
                                text = "Log Set $currentSet",
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF022C22)
                            )
                        },
                        colors = ChipDefaults.primaryChipColors(
                            backgroundColor = Color(0xFF34D399)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                    )
                }

                item {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Recovery",
                            color = Color(0xFF38BDF8),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Sleep: $sleepText · Steps: $stepsText",
                            color = Color.White,
                            fontSize = 12.sp
                        )
                        Text(
                            text = "Resting HR: $restingHrText",
                            color = Color.White,
                            fontSize = 12.sp
                        )
                    }
                }

                item {
                    Button(
                        onClick = {
                            if (isSyncing) return@Button
                            scope.launch {
                                isSyncing = true
                                val result = healthConnectManager.collectAndSyncToSupabase(supabaseClient)
                                result.onSuccess { bio ->
                                    sleepText = String.format("%.1fh", bio.sleepHours)
                                    stepsText = bio.dailySteps.toString()
                                    restingHrText = bio.restingHeartRateBpm?.let { "$it bpm" } ?: "--"
                                    statusText = if (bio.sleepHours < 5.0) {
                                        "Low sleep synced. Volume trimmed 10%."
                                    } else {
                                        "Health Connect synced."
                                    }
                                }.onFailure { err ->
                                    statusText = err.message ?: "Could not sync Health Connect."
                                }
                                isSyncing = false
                            }
                        },
                        enabled = !isSyncing,
                        colors = ButtonDefaults.secondaryButtonColors(
                            backgroundColor = Color(0xFF0284C7),
                            contentColor = Color.White
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                    ) {
                        Text(
                            text = if (isSyncing) "Syncing..." else "Sync Health Connect",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                item {
                    Text(
                        text = statusText,
                        color = Color(0xFFFDE047),
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
