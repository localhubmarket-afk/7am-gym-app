import Foundation
import Security

/// Public Supabase configuration loaded from Info.plist (never hardcoded in source).
public struct WatchSupabaseConfig {
    public let projectURL: URL
    public let anonKey: String

    public static func fromBundle(_ bundle: Bundle = .main) throws -> WatchSupabaseConfig {
        guard
            let urlString = bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
            let url = URL(string: urlString),
            let key = bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
            !key.isEmpty
        else {
            throw WatchSupabaseError.missingConfiguration
        }
        return WatchSupabaseConfig(projectURL: url, anonKey: key)
    }
}

public enum WatchSupabaseError: Error, LocalizedError {
    case missingConfiguration
    case notAuthenticated
    case invalidResponse(Int, String)
    case encodingError

    public var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            return "Supabase URL or key is missing from Info.plist."
        case .notAuthenticated:
            return "Sign in on your iPhone or Watch first."
        case .invalidResponse(let code, let detail):
            return "Server returned \(code): \(detail)"
        case .encodingError:
            return "Could not prepare workout data."
        }
    }
}

public struct WatchAuthSession: Codable {
    public let accessToken: String
    public let refreshToken: String
    public let userId: String
    public let email: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case userId = "user_id"
        case email
    }
}

public struct WatchGymStateRow: Codable {
    public let id: String
    public let updatedAt: String?
    public let data: WatchGymStatePayload

    enum CodingKeys: String, CodingKey {
        case id
        case updatedAt = "updated_at"
        case data
    }
}

public struct WatchGymStatePayload: Codable {
    public let currentWeek: Int?
    public let selectedDayIndex: Int?
    public let lastUpdated: String?

    enum CodingKeys: String, CodingKey {
        case currentWeek
        case selectedDayIndex
        case lastUpdated = "last_updated"
    }
}

public struct DailyBiometricPayload: Codable {
    public let userId: String
    public let accountKey: String
    public let provider: String
    public let recordedDate: String
    public let sleepHours: Double
    public let dailySteps: Int
    public let restingHeartRate: Int?
    public let syncedAt: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case accountKey = "account_key"
        case provider
        case recordedDate = "recorded_date"
        case sleepHours = "sleep_hours"
        case dailySteps = "daily_steps"
        case restingHeartRate = "resting_heart_rate"
        case syncedAt = "synced_at"
    }
}

/// Secure watchOS Keychain helper so Supabase JWT tokens are never stored in UserDefaults.
public final class WatchKeychainSessionStore {
    private let service = "app.7amgym.watch.supabase"
    private let account = "active_session"

    public init() {}

    public func save(_ session: WatchAuthSession) throws {
        let data = try JSONEncoder().encode(session)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)

        var insert = query
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(insert as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw WatchSupabaseError.encodingError
        }
    }

    public func load() -> WatchAuthSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else {
            return nil
        }
        return try? JSONDecoder().decode(WatchAuthSession.self, from: data)
    }

    public func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

/// Native Apple Watch client for Supabase Auth, gym_state fetches, and daily_biometrics upserts.
public actor SupabaseWatchClient {
    private let config: WatchSupabaseConfig
    private let keychain: WatchKeychainSessionStore
    private let urlSession: URLSession

    public init(
        config: WatchSupabaseConfig,
        keychain: WatchKeychainSessionStore = WatchKeychainSessionStore(),
        urlSession: URLSession = .shared
    ) {
        self.config = config
        self.keychain = keychain
        self.urlSession = urlSession
    }

    public func currentSession() -> WatchAuthSession? {
        keychain.load()
    }

    /// Receives a signed-in Supabase session handed off from the paired iPhone via WCSession.
    public func storeSessionFromPhone(_ session: WatchAuthSession) throws {
        try keychain.save(session)
    }

    /// Passwordless email Magic Link / OTP sign-in request directly from the Watch.
    public func requestMagicLinkOTP(email: String) async throws {
        let endpoint = config.projectURL.appendingPathComponent("auth/v1/otp")
        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email.lowercased().trimmingCharacters(in: .whitespaces)])

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 500
            throw WatchSupabaseError.invalidResponse(code, String(data: data, encoding: .utf8) ?? "")
        }
    }

    /// Fetches the user's latest gym_state row using their authenticated JWT (RLS enforced).
    public func fetchLatestGymState() async throws -> WatchGymStateRow? {
        guard let session = keychain.load() else {
            throw WatchSupabaseError.notAuthenticated
        }
        let accountId = "user_\(session.email.lowercased())"
        var components = URLComponents(
            url: config.projectURL.appendingPathComponent("rest/v1/gym_state"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "id", value: "in.(\(session.userId),\(accountId))"),
            URLQueryItem(name: "select", value: "id,data,updated_at"),
            URLQueryItem(name: "order", value: "updated_at.desc"),
            URLQueryItem(name: "limit", value: "1")
        ]
        guard let url = components?.url else { throw WatchSupabaseError.missingConfiguration }

        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 500
            throw WatchSupabaseError.invalidResponse(code, String(data: data, encoding: .utf8) ?? "")
        }
        let rows = try JSONDecoder().decode([WatchGymStateRow].self, from: data)
        return rows.first
    }

    /// Upserts Apple HealthKit recovery metrics (sleep, steps, resting HR) to Supabase daily_biometrics.
    public func upsertDailyBiometrics(
        sleepHours: Double,
        dailySteps: Int,
        restingHeartRateBpm: Int?
    ) async throws {
        guard let session = keychain.load() else {
            throw WatchSupabaseError.notAuthenticated
        }
        let isoFormatter = ISO8601DateFormatter()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.timeZone = TimeZone(secondsFromGMT: 0)

        let payload = DailyBiometricPayload(
            userId: session.userId,
            accountKey: session.email.lowercased(),
            provider: "apple_healthkit",
            recordedDate: dateFormatter.string(from: Date()),
            sleepHours: max(0, min(24, (sleepHours * 100).rounded() / 100)),
            dailySteps: max(0, min(200_000, dailySteps)),
            restingHeartRate: restingHeartRateBpm.map { max(25, min(220, $0)) },
            syncedAt: isoFormatter.string(from: Date())
        )

        var components = URLComponents(
            url: config.projectURL.appendingPathComponent("rest/v1/daily_biometrics"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "on_conflict", value: "account_key,recorded_date")
        ]
        guard let url = components?.url else { throw WatchSupabaseError.missingConfiguration }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(payload)

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 500
            throw WatchSupabaseError.invalidResponse(code, String(data: data, encoding: .utf8) ?? "")
        }
    }
}
