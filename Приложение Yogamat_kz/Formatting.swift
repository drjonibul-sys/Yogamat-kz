//
//  Formatting.swift
//  Приложение Yogamat_kz
//

import Foundation

enum RU {
    static let locale = Locale(identifier: "ru_RU")

    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = locale
        calendar.timeZone = .current
        return calendar
    }()

    private static let keyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let longDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = .current
        formatter.dateFormat = "d MMMM"
        return formatter
    }()

    private static let weekdayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = .current
        formatter.dateFormat = "EEEE"
        return formatter
    }()

    private static let shortFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = .current
        formatter.dateFormat = "dd.MM.yyyy"
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = .current
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private static let moneyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter
    }()

    /// Календарный ключ дня в местном времени: 2026-11-17.
    static func key(_ date: Date) -> String {
        keyFormatter.string(from: date)
    }

    static func date(fromKey key: String) -> Date? {
        keyFormatter.date(from: key)
    }

    static func addDays(_ days: Int, toKey key: String) -> String {
        guard let date = date(fromKey: key) else { return key }
        let next = calendar.date(byAdding: .day, value: days, to: date) ?? date
        return self.key(next)
    }

    static func daysBetween(from start: String, to end: String) -> Int {
        guard let startDate = date(fromKey: start), let endDate = date(fromKey: end) else { return 0 }
        let from = calendar.startOfDay(for: startDate)
        let to = calendar.startOfDay(for: endDate)
        return calendar.dateComponents([.day], from: from, to: to).day ?? 0
    }

    /// «17 ноября»
    static func longDay(_ key: String) -> String {
        guard let date = date(fromKey: key) else { return key }
        return longDayFormatter.string(from: date)
    }

    /// «вторник, 17 ноября»
    static func weekdayLong(_ date: Date) -> String {
        weekdayFormatter.string(from: date) + ", " + longDayFormatter.string(from: date)
    }

    /// «17.11.2026»
    static func shortDate(_ key: String) -> String {
        guard let date = date(fromKey: key) else { return key }
        return shortFormatter.string(from: date)
    }

    /// «09:41»
    static func time(_ date: Date) -> String {
        timeFormatter.string(from: date)
    }

    static func money(_ value: Double) -> String {
        let number = moneyFormatter.string(from: NSNumber(value: value)) ?? String(Int(value))
        return number + " ₸"
    }

    /// Заголовок группы в журнале: «Сегодня», «Вчера», «17 ноября».
    static func dayTitle(_ key: String) -> String {
        let today = self.key(Date())
        if key == today { return "Сегодня" }
        if key == addDays(-1, toKey: today) { return "Вчера" }
        return longDay(key)
    }

    // MARK: - Неделя и расписание

    static let weekdayShortNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

    private static let monthNameFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = .current
        formatter.dateFormat = "MMMM"
        return formatter
    }()

    /// Номер дня недели: 1 — понедельник … 7 — воскресенье.
    static func weekdayIndex(of date: Date) -> Int {
        let weekday = calendar.component(.weekday, from: date)
        return ((weekday + 5) % 7) + 1
    }

    static func startOfWeek(containing date: Date = Date()) -> Date {
        let start = calendar.startOfDay(for: date)
        return self.date(byAddingDays: -(weekdayIndex(of: start) - 1), to: start)
    }

    static func date(byAddingDays days: Int, to date: Date) -> Date {
        calendar.date(byAdding: .day, value: days, to: date) ?? date
    }

    /// Первое число месяца, в котором лежит дата.
    static func startOfMonth(containing date: Date = Date()) -> Date {
        let components = calendar.dateComponents([.year, .month], from: date)
        let first = calendar.date(
            from: DateComponents(year: components.year, month: components.month, day: 1)
        ) ?? date
        return calendar.startOfDay(for: first)
    }

    /// «Ноябрь 2026»
    static func monthTitle(_ date: Date) -> String {
        let components = calendar.dateComponents([.year, .month], from: date)
        let month = components.month ?? 1
        let year = components.year ?? 2026
        return monthNames[month - 1] + " " + String(year)
    }

    /// Дни месяца по неделям: первая ячейка — понедельник недели с 1-м числом.
    static func monthGrid(containing date: Date) -> [[Date?]] {
        let start = startOfMonth(containing: date)
        let leading = weekdayIndex(of: start) - 1
        let days = calendar.range(of: .day, in: .month, for: start)?.count ?? 30
        var cells: [Date?] = Array(repeating: nil, count: leading)
        for day in 1...days {
            cells.append(self.date(byAddingDays: day - 1, to: start))
        }
        while cells.count % 7 != 0 {
            cells.append(nil)
        }
        return stride(from: 0, to: cells.count, by: 7).map { index in
            Array(cells[index..<min(index + 7, cells.count)])
        }
    }

    static func dayNumber(_ date: Date) -> Int {
        calendar.component(.day, from: date)
    }

    /// «10–16 ноября»
    static func weekRangeLabel(start: Date) -> String {
        let end = date(byAddingDays: 6, to: start)
        let firstDay = dayNumber(start)
        let lastDay = dayNumber(end)
        let firstMonth = monthNameFormatter.string(from: start)
        let lastMonth = monthNameFormatter.string(from: end)
        if firstMonth == lastMonth { return "\(firstDay)–\(lastDay) \(lastMonth)" }
        return "\(firstDay) \(firstMonth) – \(lastDay) \(lastMonth)"
    }

    /// «09:00» из минут от полуночи.
    static func classTime(_ minutes: Int) -> String {
        String(format: "%02d:%02d", minutes / 60, minutes % 60)
    }

    static func minutes(from date: Date) -> Int {
        let components = calendar.dateComponents([.hour, .minute], from: date)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }

    // MARK: - Месяцы и доход

    static let monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ]

    static let monthShortNames = [
        "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
        "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
    ]

    static let monthDativeNames = [
        "январю", "февралю", "марту", "апрелю", "маю", "июню",
        "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"
    ]

    static func monthKey(year: Int, month: Int) -> String {
        String(format: "%04d-%02d", year, month)
    }

    static func addMonths(_ count: Int, year: Int, month: Int) -> (year: Int, month: Int) {
        let total = year * 12 + (month - 1) + count
        return (total / 12, total % 12 + 1)
    }

    /// «ноябрь» или «декабрь 2025» для месяцев другого года.
    static func monthYearLower(year: Int, month: Int) -> String {
        let name = monthNames[month - 1].lowercased()
        let currentYear = calendar.component(.year, from: Date())
        return year == currentYear ? name : "\(name) \(String(year))"
    }

    static func isValidDay(_ key: String?) -> Bool {
        guard let key, key.count == 10 else { return false }
        return date(fromKey: key) != nil
    }

    /// «₸ 412 000»
    static func moneyPrefix(_ value: Double) -> String {
        let number = moneyFormatter.string(from: NSNumber(value: value)) ?? String(Int(value))
        return "₸ " + number
    }

    /// «412K», «1,2M» — подписи осей и столбиков.
    static func shortAxis(_ value: Double) -> String {
        let magnitude = abs(value)
        if magnitude >= 1_000_000 {
            return decimalString(value / 1_000_000, maxFraction: 1) + "M"
        }
        if magnitude >= 1000 {
            return "\(Int((value / 1000).rounded()))K"
        }
        return "\(Int(value.rounded()))"
    }

    /// «₸ 3,84 млн»
    static func millionLabel(_ value: Double) -> String {
        if abs(value) >= 1_000_000 {
            return "₸ " + decimalString(value / 1_000_000, maxFraction: 2) + " млн"
        }
        return moneyPrefix(value)
    }

    private static func decimalString(_ value: Double, maxFraction: Int) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = maxFraction
        formatter.usesGroupingSeparator = false
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }
}

enum RUPlural {
    static func classes(_ count: Int) -> String {
        word(count, one: "занятие", few: "занятия", many: "занятий")
    }

    static func days(_ count: Int) -> String {
        word(count, one: "день", few: "дня", many: "дней")
    }

    static func clients(_ count: Int) -> String {
        word(count, one: "клиент", few: "клиента", many: "клиентов")
    }

    static func abonements(_ count: Int) -> String {
        word(count, one: "абонемент", few: "абонемента", many: "абонементов")
    }

    static func visits(_ count: Int) -> String {
        word(count, one: "визит", few: "визита", many: "визитов")
    }

    static func transfers(_ count: Int) -> String {
        word(count, one: "перенос", few: "переноса", many: "переносов")
    }

    static func directions(_ count: Int) -> String {
        word(count, one: "направление", few: "направления", many: "направлений")
    }

    static func weeks(_ count: Int) -> String {
        word(count, one: "неделя", few: "недели", many: "недель")
    }

    private static func word(_ count: Int, one: String, few: String, many: String) -> String {
        let mod10 = abs(count) % 10
        let mod100 = abs(count) % 100
        if mod10 == 1 && mod100 != 11 { return one }
        if (2...4).contains(mod10) && !(12...14).contains(mod100) { return few }
        return many
    }
}
