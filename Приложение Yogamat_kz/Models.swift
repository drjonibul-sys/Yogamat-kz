//
//  Models.swift
//  Приложение Yogamat_kz
//

import Foundation

struct Client: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var phone: String = ""
    var note: String = ""
    var since: String = RU.key(Date())
}

struct Subscription: Identifiable, Codable, Hashable {
    var id = UUID()
    var clientID: UUID
    var tariffName: String
    var purchaseDate: String
    var expiryDate: String
    var visitsTotal: Int
    var visitsLeft: Int
    var price: Double
    var paid: Bool = false
    var paidDate: String?
}

struct Visit: Identifiable, Codable, Hashable {
    var id = UUID()
    var clientID: UUID
    var subscriptionID: UUID
    var date: String
    var classID: UUID?
    var createdAt: Date = Date()
}

struct Transfer: Identifiable, Codable, Hashable {
    var id = UUID()
    var clientID: UUID
    var subscriptionID: UUID
    var days: Int
    var date: String
    var note: String = ""
}

enum ClassType: String, Codable, CaseIterable {
    case yoga
    case pilates

    var title: String {
        self == .yoga ? "Йога" : "Пилатес"
    }
}

enum StaffRole: String, Codable, CaseIterable {
    case admin
    case trainer

    var title: String {
        switch self {
        case .admin: return "Администратор"
        case .trainer: return "Тренер"
        }
    }
}

struct StaffUser: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var role: StaffRole
    var isActive: Bool = true
}

struct StudioClass: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var type: ClassType = .yoga
    var level: String = "Лёгкий"
    var durationMin: Int = 60
    var capacity: Int = 12
    var trainer: String = ""
    var trainerIDs: [UUID]?
    var hall: String = ""
    /// Дни недели: 1 — понедельник … 7 — воскресенье.
    var weekdays: Set<Int> = []
    /// Время начала в минутах от полуночи.
    var startMinutes: Int = 9 * 60
    var equipment: String = ""
    var details: String = ""
    var active: Bool = true

    var weekdaysLabel: String {
        if weekdays.isEmpty { return "Расписание не задано" }
        return weekdays.sorted().map { RU.weekdayShortNames[$0 - 1] }.joined(separator: ", ")
    }

    var timeLabel: String { RU.classTime(startMinutes) }
}

struct Tariff: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var visitsCount: Int
    var durationDays: Int
    var price: Double
}

struct RentSettings: Codable, Hashable {
    var monthlyAmount: Double
    var startYear: Int
    var startMonth: Int
}

struct RentPeriod: Identifiable, Codable, Hashable {
    var id = UUID()
    var year: Int
    var month: Int
    var paid: Bool = false
    var paidDate: String?
}

struct StudioSnapshot: Codable {
    var clients: [Client] = []
    var subscriptions: [Subscription] = []
    var visits: [Visit] = []
    var transfers: [Transfer] = []
    var studioName: String = "Студия Yogamat.kz"
    var classes: [StudioClass]?
    var tariffs: [Tariff]?
    var rentSettings: RentSettings?
    var rentPeriods: [RentPeriod]?
    var staff: [StaffUser]?
    var favoriteAsanas: [String]?
}

enum SubscriptionStatus {
    case active
    case finished
    case expired

    var title: String {
        switch self {
        case .active: return "активен"
        case .finished: return "занятия закончились"
        case .expired: return "срок истёк"
        }
    }
}

struct EndingSoonItem: Identifiable {
    let client: Client
    let subscription: Subscription
    let reason: String
    let daysLeft: Int

    var id: UUID { subscription.id }
}

struct BackupFile: Identifiable, Hashable {
    let url: URL
    let date: Date
    let size: Int

    var id: String { url.lastPathComponent }
}

struct RepeatBookingResult {
    let created: Int
    let skipped: Int
}
