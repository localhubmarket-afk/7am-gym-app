import Foundation
import HealthKit

public struct AppleHealthRecoverySnapshot: Sendable {
    public let sleepHours: Double
    public let dailySteps: Int
    public let restingHeartRateBpm: Int?
    public let capturedAt: Date
}

public enum HealthKitBiometricError: Error, LocalizedError {
    case healthDataUnavailable
    case missingSampleType

    public var errorDescription: String? {
        switch self {
        case .healthDataUnavailable:
            return "Apple Health is not available on this device."
        case .missingSampleType:
            return "Could not access HealthKit recovery metrics."
        }
    }
}

/// Reads objective recovery context (sleep duration, daily steps, resting heart rate)
/// from Apple HealthKit and stores it in Supabase for the deterministic workout engine.
public final class HealthKitBiometricManager {
    private let healthStore: HKHealthStore

    public init(healthStore: HKHealthStore = HKHealthStore()) {
        self.healthStore = healthStore
    }

    public func requestReadPermissions() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitBiometricError.healthDataUnavailable
        }
        guard
            let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis),
            let stepType = HKObjectType.quantityType(forIdentifier: .stepCount),
            let restingHrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate)
        else {
            throw HealthKitBiometricError.missingSampleType
        }

        let readTypes: Set<HKObjectType> = [sleepType, stepType, restingHrType]
        try await healthStore.requestAuthorization(toShare: [], read: readTypes)
    }

    /// Reads total asleep duration (hours) over the last 24 hours.
    public func fetchSleepDurationHours(referenceDate: Date = Date()) async throws -> Double {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            throw HealthKitBiometricError.missingSampleType
        }
        let start = Calendar.current.date(byAdding: .hour, value: -24, to: referenceDate) ?? referenceDate
        let predicate = HKQuery.predicateForSamples(withStart: start, end: referenceDate, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let categorySamples = (samples as? [HKCategorySample]) ?? []
                let asleepValues: Set<Int> = [
                    HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                    HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                    HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                    HKCategoryValueSleepAnalysis.asleepREM.rawValue
                ]
                let totalSeconds = categorySamples
                    .filter { asleepValues.contains($0.value) }
                    .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                let hours = (totalSeconds / 3600.0 * 100.0).rounded() / 100.0
                continuation.resume(returning: max(0.0, min(24.0, hours)))
            }
            healthStore.execute(query)
        }
    }

    /// Reads cumulative daily steps from midnight until now.
    public func fetchDailySteps(referenceDate: Date = Date()) async throws -> Int {
        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitBiometricError.missingSampleType
        }
        let startOfDay = Calendar.current.startOfDay(for: referenceDate)
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: referenceDate, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let count = result?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                continuation.resume(returning: max(0, Int(count.rounded())))
            }
            healthStore.execute(query)
        }
    }

    /// Reads the most recent resting heart rate (BPM) within the past 48 hours.
    public func fetchRestingHeartRateBpm(referenceDate: Date = Date()) async throws -> Int? {
        guard let restingHrType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) else {
            throw HealthKitBiometricError.missingSampleType
        }
        let start = Calendar.current.date(byAdding: .hour, value: -48, to: referenceDate) ?? referenceDate
        let predicate = HKQuery.predicateForSamples(withStart: start, end: referenceDate, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: restingHrType,
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let latest = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: nil)
                    return
                }
                let bpmUnit = HKUnit.count().unitDivided(by: .minute())
                let bpm = Int(latest.quantity.doubleValue(for: bpmUnit).rounded())
                continuation.resume(returning: bpm)
            }
            healthStore.execute(query)
        }
    }

    /// Collects sleep, steps, and resting heart rate concurrently and pushes them to Supabase.
    public func collectAndSyncDailyBiometrics(
        using supabaseClient: SupabaseWatchClient
    ) async throws -> AppleHealthRecoverySnapshot {
        try await requestReadPermissions()
        async let sleep = fetchSleepDurationHours()
        async let steps = fetchDailySteps()
        async let restingHr = fetchRestingHeartRateBpm()

        let snapshot = try await AppleHealthRecoverySnapshot(
            sleepHours: sleep,
            dailySteps: steps,
            restingHeartRateBpm: restingHr,
            capturedAt: Date()
        )

        try await supabaseClient.upsertDailyBiometrics(
            sleepHours: snapshot.sleepHours,
            dailySteps: snapshot.dailySteps,
            restingHeartRateBpm: snapshot.restingHeartRateBpm
        )
        return snapshot
    }
}
