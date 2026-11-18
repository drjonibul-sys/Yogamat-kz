//
//  PaymentReminders.swift
//  Приложение Yogamat_kz
//

import Foundation
import UserNotifications

/// Локальное напоминание об оплате: каждую неделю в понедельник в 10:00.
enum PaymentReminders {
    static let enabledKey = "reminders.payments.enabled"

    private static let identifier = "payment-reminder.weekly"

    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
    }

    /// Включает напоминание, один раз спрашивая разрешение.
    static func enable(unpaidCount: Int) async -> Bool {
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
        await reschedule(unpaidCount: unpaidCount)
        return true
    }

    /// Выключает напоминание и снимает запланированное.
    static func disable() async {
        UserDefaults.standard.set(false, forKey: enabledKey)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        center.removeDeliveredNotifications(withIdentifiers: [identifier])
    }

    /// Пересобирает напоминание, если оно включено и разрешено.
    static func refresh(unpaidCount: Int) async {
        guard isEnabled else { return }
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let status = settings.authorizationStatus
        guard status == .authorized || status == .provisional || status == .ephemeral else { return }
        await reschedule(unpaidCount: unpaidCount)
    }

    private static func reschedule(unpaidCount: Int) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])

        // Без неоплаченных абонементов напоминание не отправляется.
        guard unpaidCount > 0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Не отмечена оплата"
        content.body = unpaidCount == 1
            ? "1 абонемент без отметки оплаты"
            : "\(unpaidCount) \(RUPlural.abonements(unpaidCount)) без отметки оплаты"
        content.sound = .default

        var components = DateComponents()
        components.weekday = 2
        components.hour = 10
        components.minute = 0

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        try? await center.add(request)
    }
}
