package app.sevenamgym.wear.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

data class WearAuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String
)

data class WearBiometricPayload(
    val sleepHours: Double,
    val dailySteps: Int,
    val restingHeartRateBpm: Int?
)

data class WearGymStateSummary(
    val recordId: String,
    val currentWeek: Int,
    val selectedDayIndex: Int,
    val lastUpdated: String?
)

/**
 * EncryptedSharedPreferences token store for Wear OS so Supabase JWTs stay encrypted at rest.
 */
class WearEncryptedSessionStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "budget_gym_wear_auth_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveSession(session: WearAuthSession) {
        prefs.edit()
            .putString("access_token", session.accessToken)
            .putString("refresh_token", session.refreshToken)
            .putString("user_id", session.userId)
            .putString("email", session.email.lowercase().trim())
            .apply()
    }

    fun loadSession(): WearAuthSession? {
        val access = prefs.getString("access_token", null) ?: return null
        val refresh = prefs.getString("refresh_token", null) ?: ""
        val userId = prefs.getString("user_id", null) ?: return null
        val email = prefs.getString("email", null) ?: return null
        return WearAuthSession(access, refresh, userId, email)
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}

/**
 * Wear OS Supabase client reading public SUPABASE_URL and SUPABASE_ANON_KEY from BuildConfig.
 * Communicates directly with Supabase Auth, gym_state, and daily_biometrics tables.
 */
class SupabaseWearClient(
    private val supabaseUrl: String,
    private val supabaseAnonKey: String,
    private val sessionStore: WearEncryptedSessionStore
) {
    suspend fun requestPasswordlessOtp(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL("${supabaseUrl.trimEnd('/')}/auth/v1/otp")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Content-Type", "application/json")
            }
            val body = JSONObject().put("email", email.lowercase().trim()).toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            conn.disconnect()
            require(code in 200..299) { "Could not send sign-in link (HTTP $code)." }
        }
    }

    suspend fun fetchLatestGymState(): Result<WearGymStateSummary?> = withContext(Dispatchers.IO) {
        runCatching {
            val session = sessionStore.loadSession()
                ?: error("Sign in on your phone or watch first.")
            val accountId = "user_${session.email.lowercase()}"
            val filter = URLEncoder.encode("in.(${session.userId},$accountId)", "UTF-8")
            val endpoint = "${supabaseUrl.trimEnd('/')}/rest/v1/gym_state?id=$filter&select=id,data,updated_at&order=updated_at.desc&limit=1"

            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Authorization", "Bearer ${session.accessToken}")
            }
            val code = conn.responseCode
            val raw = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.readText().orEmpty()
            conn.disconnect()
            require(code in 200..299) { "Failed to load gym state (HTTP $code)." }

            val rows = JSONArray(raw)
            if (rows.length() == 0) return@runCatching null
            val row = rows.getJSONObject(0)
            val dataObj = row.optJSONObject("data") ?: JSONObject()
            WearGymStateSummary(
                recordId = row.optString("id"),
                currentWeek = dataObj.optInt("currentWeek", 1),
                selectedDayIndex = dataObj.optInt("selectedDayIndex", 0),
                lastUpdated = dataObj.optString("last_updated", row.optString("updated_at"))
            )
        }
    }

    suspend fun upsertDailyBiometrics(payload: WearBiometricPayload): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val session = sessionStore.loadSession()
                ?: error("Sign in on your phone or watch first.")

            val todayIso = LocalDate.now(ZoneOffset.UTC).toString()
            val clampedSleep = payload.sleepHours.coerceIn(0.0, 24.0)
            val clampedSteps = payload.dailySteps.coerceIn(0, 200_000)

            val json = JSONObject()
                .put("user_id", session.userId)
                .put("account_key", session.email.lowercase())
                .put("provider", "google_health_connect")
                .put("recorded_date", todayIso)
                .put("sleep_hours", Math.round(clampedSleep * 100.0) / 100.0)
                .put("daily_steps", clampedSteps)
                .put("synced_at", Instant.now().toString())

            if (payload.restingHeartRateBpm != null) {
                json.put("resting_heart_rate", payload.restingHeartRateBpm.coerceIn(25, 220))
            }

            val endpoint = "${supabaseUrl.trimEnd('/')}/rest/v1/daily_biometrics?on_conflict=account_key,recorded_date"
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Authorization", "Bearer ${session.accessToken}")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
            }
            conn.outputStream.use { it.write(json.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            conn.disconnect()
            require(code in 200..299) { "Failed to sync biometrics to Supabase (HTTP $code)." }
        }
    }
}
