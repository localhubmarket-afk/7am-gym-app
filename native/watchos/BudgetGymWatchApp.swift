import SwiftUI
import WatchKit

/// Accessible Grade 6-8 ViewModel for the Apple Watch companion app.
@MainActor
public final class WatchWorkoutViewModel: ObservableObject {
    @Published public var activeExerciseName: String = "Barbell Squat"
    @Published public var currentSetNumber: Int = 1
    @Published public var totalSets: Int = 3
    @Published public var targetWeightLbs: Int = 135
    @Published public var targetReps: Int = 8
    @Published public var sleepHoursText: String = "--"
    @Published public var dailyStepsText: String = "--"
    @Published public var restingHrText: String = "--"
    @Published public var statusMessage: String = "Ready when you are."
    @Published public var isSyncing: Bool = false

    private let healthManager: HealthKitBiometricManager
    private let supabaseClient: SupabaseWatchClient?

    public init(
        healthManager: HealthKitBiometricManager = HealthKitBiometricManager(),
        supabaseClient: SupabaseWatchClient? = nil
    ) {
        self.healthManager = healthManager
        if let client = supabaseClient {
            self.supabaseClient = client
        } else if let config = try? WatchSupabaseConfig.fromBundle() {
            self.supabaseClient = SupabaseWatchClient(config: config)
        } else {
            self.supabaseClient = nil
        }
    }

    public func logCurrentSet() {
        WKInterfaceDevice.current().play(.success)
        if currentSetNumber < totalSets {
            currentSetNumber += 1
            statusMessage = "Set saved. Take your rest."
        } else {
            statusMessage = "All sets done for \(activeExerciseName)."
        }
    }

    public func syncRecoveryBiometrics() async {
        guard let supabaseClient else {
            statusMessage = "Add Supabase config to sync."
            return
        }
        isSyncing = true
        defer { isSyncing = false }

        do {
            let snapshot = try await healthManager.collectAndSyncDailyBiometrics(using: supabaseClient)
            sleepHoursText = String(format: "%.1fh", snapshot.sleepHours)
            dailyStepsText = "\(snapshot.dailySteps)"
            restingHrText = snapshot.restingHeartRateBpm.map { "\($0) bpm" } ?? "--"
            statusMessage = snapshot.sleepHours < 5.0
                ? "Low sleep synced. Plan trimmed by 10%."
                : "Recovery synced to cloud."
            WKInterfaceDevice.current().play(.notification)
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}

/// High-contrast WCAG 2.2 AA Apple Watch Companion View (minimum 44pt buttons, sans-serif typography).
public struct WatchWorkoutHomeView: View {
    @StateObject private var vm = WatchWorkoutViewModel()

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("7AM Gym")
                    .font(.caption.weight(.bold))
                    .foregroundColor(.mint)

                Text(vm.activeExerciseName)
                    .font(.headline.weight(.bold))
                    .foregroundColor(.white)
                    .accessibilityAddTraits(.isHeader)

                Text("Set \(vm.currentSetNumber) of \(vm.totalSets) · \(vm.targetWeightLbs) lbs × \(vm.targetReps)")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.white.opacity(0.92))

                Button(action: vm.logCurrentSet) {
                    Text("Log Set \(vm.currentSetNumber)")
                        .font(.body.weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .accessibilityLabel("Log set \(vm.currentSetNumber) of \(vm.activeExerciseName)")

                Divider()

                VStack(alignment: .leading, spacing: 4) {
                    Text("Today's Recovery")
                        .font(.caption.weight(.bold))
                        .foregroundColor(.cyan)
                    Text("Sleep: \(vm.sleepHoursText) · Steps: \(vm.dailyStepsText)")
                        .font(.caption2)
                        .foregroundColor(.white)
                    Text("Resting HR: \(vm.restingHrText)")
                        .font(.caption2)
                        .foregroundColor(.white)
                }

                Button {
                    Task { await vm.syncRecoveryBiometrics() }
                } label: {
                    Text(vm.isSyncing ? "Syncing..." : "Sync HealthKit")
                        .font(.footnote.weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .tint(.cyan)
                .disabled(vm.isSyncing)

                Text(vm.statusMessage)
                    .font(.caption2)
                    .foregroundColor(.yellow)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 6)
        }
        .background(Color.black)
    }
}

@main
public struct BudgetGymWatchApp: App {
    public init() {}

    public var body: some Scene {
        WindowGroup {
            WatchWorkoutHomeView()
        }
    }
}
