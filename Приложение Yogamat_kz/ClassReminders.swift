//
//  ClassReminders.swift
//  Приложение Yogamat_kz
//

import Foundation
import UserNotifications

/// Локальные напоминания о занятиях: за 30 минут, без сервера.
enum ClassReminders {
    static let enabledKey = "reminders.classes.enabled"

    private static let prefix = "class-reminder."
    private static let leadMinutes = 30

    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
    }

    /// Включает напоминания, один раз спрашивая разрешение.
    static func enable(classes: [StudioClass]) async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()

        let granted: Bool
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            granted = true
        case .denied:
            granted = false
        default:
            do {
                granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                granted = false
            }
        }

        guard granted else { return false }
        UserDefaults.standard.set(true, forKey: enabledKey)
        await reschedule(classes: classes)
        return true
    }

    /// Выключает напоминания и снимает все запланированные.
    static func disable() async {
        UserDefaults.standard.set(false, forKey: enabledKey)
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let identifiers = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
        if !identifiers.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: identifiers)
            center.removeDeliveredNotifications(withIdentifiers: identifiers)
        }
    }

    /// Пересобирает расписание напоминаний, если они включены и разрешены.
    static func refresh(classes: [StudioClass]) async {
        guard isEnabled else { return }
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let status = settings.authorizationStatus
        guard status == .authorized || status == .provisional || status == .ephemeral else { return }
        await reschedule(classes: classes)
    }

    private static func reschedule(classes: [StudioClass]) async {
        let center = UNUserNotificationCenter.current()

        let pending = await center.pendingNotificationRequests()
        let previous = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
        if !previous.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: previous)
        }

        let calendar = RU.calendar
        let now = Date()
        let today = calendar.startOfDay(for: now)

        for offset in 0..<8 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
            let weekday = RU.weekdayIndex(of: day)

            for item in classes where item.active && item.weekdays.contains(weekday) {
                guard let start = calendar.date(byAdding: .minute, value: item.startMinutes, to: day) else {
                    continue
                }
                let fireDate = start.addingTimeInterval(-TimeInterval(leadMinutes * 60))
                guard fireDate > now else { continue }

                let content = UNMutableNotificationContent()
                content.title = item.name
                var body = "Через 30 минут · \(item.timeLabel)"
                if !item.hall.isEmpty { body += " · \(item.hall)" }
                content.body = body
                content.sound = .default

                let trigger = UNCalendarNotificationTrigger(
                    dateMatching: calendar.dateComponents(
                        [.year, .month, .day, .hour, .minute],
                        from: fireDate
                    ),
                    repeats: false
                )
                let identifier = "\(prefix)\(item.id.uuidString)-\(RU.key(day))"
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
                try? await center.add(request)
            }
        }
    }
}
