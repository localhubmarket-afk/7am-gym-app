package app.sevenamgym.wear.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import app.sevenamgym.wear.data.SupabaseWearClient
import app.sevenamgym.wear.data.WearBiometricPayload
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Reads objective recovery metrics (sleep duration, daily steps, resting heart rate)
 * from Google Health Connect and syncs them to Supabase for the deterministic engine.
 */
class HealthConnectBiometricManager(context: Context) {
    private val healthConnectClient: HealthConnectClient = HealthConnectClient.getOrCreate(context)

    val requiredPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class)
    )

    suspend fun hasAllPermissions(): Boolean {
        val granted = healthConnectClient.permissionController.getGrantedPermissions()
        return granted.containsAll(requiredPermissions)
    }

    /** Reads total sleep duration in hours across the last 24 hours. */
    suspend fun readSleepDurationHours(now: Instant = Instant.now()): Double {
        val start = now.minus(Duration.ofHours(24))
        val response = healthConnectClient.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, now)
            )
        )
        val totalMinutes = response.records.sumOf { session ->
            Duration.between(session.startTime, session.endTime).toMinutes().coerceAtLeast(0L)
        }
        return ((totalMinutes / 60.0) * 100.0).toLong() / 100.0
    }

    /** Reads aggregated daily step count from local midnight until now. */
    suspend fun readDailySteps(now: Instant = Instant.now()): Int {
        val startOfDay = LocalDate.now(ZoneId.systemDefault())
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
        val aggregate = healthConnectClient.aggregate(
            AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
            )
        )
        return (aggregate[StepsRecord.COUNT_TOTAL] ?: 0L).toInt().coerceAtLeast(0)
    }

    /** Reads the latest resting heart rate (BPM) over the last 48 hours. */
    suspend fun readRestingHeartRateBpm(now: Instant = Instant.now()): Int? {
        val start = now.minus(Duration.ofHours(48))
        val response = healthConnectClient.readRecords(
            ReadRecordsRequest(
                recordType = RestingHeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, now)
            )
        )
        val latest = response.records.maxByOrNull { it.time } ?: return null
        return latest.beatsPerMinute.toInt().coerceIn(25, 220)
    }

    /** Collects sleep, steps, and resting heart rate and pushes them to Supabase. */
    suspend fun collectAndSyncToSupabase(supabaseClient: SupabaseWearClient): Result<WearBiometricPayload> {
        return runCatching {
            require(hasAllPermissions()) {
                "Allow Health Connect access for sleep, steps, and resting heart rate first."
            }
            val payload = WearBiometricPayload(
                sleepHours = readSleepDurationHours(),
                dailySteps = readDailySteps(),
                restingHeartRateBpm = readRestingHeartRateBpm()
            )
            supabaseClient.upsertDailyBiometrics(payload).getOrThrow()
            payload
        }
    }
}
