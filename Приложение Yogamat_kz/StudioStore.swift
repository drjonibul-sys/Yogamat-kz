//
//  StudioStore.swift
//  Приложение Yogamat_kz
//

import Foundation
import Observation

struct StoreError: LocalizedError {
    let message: String

    var errorDescription: String? { message }

    init(_ message: String) {
        self.message = message
    }
}

@Observable
final class StudioStore {
    private(set) var clients: [Client] = []
    private(set) var subscriptions: [Subscription] = []
    private(set) var visits: [Visit] = []
    private(set) var transfers: [Transfer] = []
    private(set) var classes: [StudioClass] = []
    private(set) var tariffs: [Tariff] = []
    private(set) var rentSettings: RentSettings?
    private(set) var rentPeriods: [RentPeriod] = []
    private(set) var staff: [StaffUser] = []
    private(set) var favoriteAsanaIDs: Set<String> = []
    private(set) var currentUserID: UUID?
    private(set) var saveError: String?

    var studioName: String = "Студия Yogamat.kz"

    private let persistenceEnabled: Bool

    static let sessionKey = "session.userID"

    init(persistenceEnabled: Bool = true) {
        self.persistenceEnabled = persistenceEnabled
        if persistenceEnabled {
            if !load() {
                classes = Self.defaultClasses()
                persist()
            }
            restoreSession()
        }
    }

    // MARK: - Доступ и сотрудники

    var currentUser: StaffUser? {
        guard let currentUserID else { return nil }
        return staff.first { $0.id == currentUserID && $0.isActive }
    }

    var isAdmin: Bool { currentUser?.role == .admin }

    var trainers: [StaffUser] {
        staff.filter { $0.role == .trainer && $0.isActive }
    }

    func staffUser(_ id: UUID) -> StaffUser? {
        staff.first { $0.id == id }
    }

    /// Имена тренеров, назначенных на занятие.
    func trainerNames(for item: StudioClass) -> String {
        let ids = item.trainerIDs ?? []
        let names = staff
            .filter { ids.contains($0.id) }
            .map(\.name)
        return names.isEmpty ? item.trainer : names.joined(separator: ", ")
    }

    static func isValidPIN(_ pin: String) -> Bool {
        (4...8).contains(pin.count)
            && pin.unicodeScalars.allSatisfy { CharacterSet.decimalDigits.contains($0) }
    }

    static func makeRecoveryCode() -> String {
        let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        let characters = (0..<8).map { _ in alphabet.randomElement()! }
        return String(characters[0..<4]) + "-" + String(characters[4..<8])
    }

    @discardableResult
    func setupAdmin(name: String, pin: String, recoveryCode: String) throws -> StaffUser {
        guard staff.isEmpty else { throw StoreError("Аккаунт администратора уже создан") }
        guard Self.isValidPIN(pin) else { throw StoreError("PIN — от 4 до 8 цифр") }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let user = StaffUser(name: trimmed.isEmpty ? "Администратор" : trimmed, role: .admin)
        staff = [user]
        storePIN(pin, for: user.id)
        storeRecoveryCode(recoveryCode)
        startSession(for: user.id)
        persist()
        return user
    }

    func addTrainer(name: String, pin: String) throws {
        guard Self.isValidPIN(pin) else { throw StoreError("PIN — от 4 до 8 цифр") }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError("Введите имя тренера") }
        let user = StaffUser(name: trimmed, role: .trainer)
        staff.append(user)
        storePIN(pin, for: user.id)
        persist()
    }

    func updateStaffName(_ id: UUID, name: String) throws {
        guard let index = staff.firstIndex(where: { $0.id == id }) else {
            throw StoreError("Сотрудник не найден")
        }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError("Введите имя") }
        staff[index].name = trimmed
        persist()
    }

    func setPIN(userID: UUID, newPin: String) throws {
        guard staff.contains(where: { $0.id == userID }) else {
            throw StoreError("Сотрудник не найден")
        }
        guard Self.isValidPIN(newPin) else { throw StoreError("PIN — от 4 до 8 цифр") }
        storePIN(newPin, for: userID)
        clearAttempts(userID)
    }

    func changePIN(userID: UUID, currentPin: String, newPin: String) throws {
        guard let record = PinVault.value(account: "pin.\(userID.uuidString)") else {
            throw StoreError("PIN не найден — восстановите доступ по коду")
        }
        guard pinMatches(currentPin, record: record) else {
            throw StoreError("Текущий PIN неверный")
        }
        guard Self.isValidPIN(newPin) else { throw StoreError("PIN — от 4 до 8 цифр") }
        storePIN(newPin, for: userID)
    }

    func setStaffActive(_ id: UUID, active: Bool) {
        guard let index = staff.firstIndex(where: { $0.id == id }) else { return }
        guard staff[index].role != .admin else { return }
        staff[index].isActive = active
        if !active, currentUserID == id {
            logOut()
        }
        persist()
    }

    func deleteStaff(_ id: UUID) {
        guard let user = staff.first(where: { $0.id == id }), user.role != .admin else { return }
        staff.removeAll { $0.id == id }
        PinVault.remove(account: "pin.\(id.uuidString)")
        for index in classes.indices {
            classes[index].trainerIDs?.removeAll { $0 == id }
        }
        if currentUserID == id {
            logOut()
        }
        persist()
    }

    func logIn(userID: UUID, pin: String) throws {
        let locked = lockRemainingSeconds(userID: userID)
        if locked > 0 {
            throw StoreError("Слишком много попыток. Вход заблокирован ещё на \(locked) с.")
        }
        guard let user = staff.first(where: { $0.id == userID }), user.isActive else {
            throw StoreError("Пользователь не найден или отключён")
        }
        guard let record = PinVault.value(account: "pin.\(userID.uuidString)") else {
            throw StoreError("PIN не найден — восстановите доступ по коду")
        }
        guard pinMatches(pin, record: record) else {
            registerFailedAttempt(userID)
            let remaining = lockRemainingSeconds(userID: userID)
            if remaining > 0 {
                throw StoreError("Слишком много попыток. Вход заблокирован на 30 секунд.")
            }
            let attempts = UserDefaults.standard.integer(forKey: attemptsKey(userID))
            throw StoreError("Неверный PIN. Осталось попыток: \(max(0, 5 - attempts)).")
        }
        clearAttempts(userID)
        startSession(for: userID)
    }

    func resetPIN(userID: UUID, code: String, newPin: String) throws {
        guard verifyRecoveryCode(code) else {
            throw StoreError("Код восстановления не подходит")
        }
        guard Self.isValidPIN(newPin) else { throw StoreError("PIN — от 4 до 8 цифр") }
        guard staff.contains(where: { $0.id == userID }) else {
            throw StoreError("Пользователь не найден")
        }
        storePIN(newPin, for: userID)
        clearAttempts(userID)
    }

    func logOut() {
        currentUserID = nil
        UserDefaults.standard.removeObject(forKey: Self.sessionKey)
    }

    func lockRemainingSeconds(userID: UUID) -> Int {
        let until = UserDefaults.standard.double(forKey: lockKey(userID))
        let seconds = until - Date().timeIntervalSince1970
        return seconds > 0 ? Int(seconds.rounded(.up)) : 0
    }

    private func startSession(for userID: UUID) {
        currentUserID = userID
        UserDefaults.standard.set(userID.uuidString, forKey: Self.sessionKey)
    }

    private func restoreSession() {
        guard let raw = UserDefaults.standard.string(forKey: Self.sessionKey),
              let id = UUID(uuidString: raw),
              staff.contains(where: { $0.id == id && $0.isActive }) else { return }
        currentUserID = id
    }

    private func pinMatches(_ pin: String, record: String) -> Bool {
        let parts = record.split(separator: ":", maxSplits: 1)
        guard parts.count == 2 else { return false }
        return PinVault.hash(pin, salt: String(parts[0])) == String(parts[1])
    }

    private func storePIN(_ pin: String, for userID: UUID) {
        let salt = PinVault.makeSalt()
        let hash = PinVault.hash(pin, salt: salt)
        PinVault.set("\(salt):\(hash)", account: "pin.\(userID.uuidString)")
    }

    private func storeRecoveryCode(_ code: String) {
        let salt = PinVault.makeSalt()
        let hash = PinVault.hash(normalizedCode(code), salt: salt)
        PinVault.set("\(salt):\(hash)", account: "recovery.code")
    }

    private func verifyRecoveryCode(_ code: String) -> Bool {
        guard let record = PinVault.value(account: "recovery.code") else { return false }
        let parts = record.split(separator: ":", maxSplits: 1)
        guard parts.count == 2 else { return false }
        return PinVault.hash(normalizedCode(code), salt: String(parts[0])) == String(parts[1])
    }

    private func normalizedCode(_ code: String) -> String {
        code.uppercased().filter { !$0.isWhitespace && $0 != "-" }
    }

    private func attemptsKey(_ id: UUID) -> String {
        "auth.attempts.\(id.uuidString)"
    }

    private func lockKey(_ id: UUID) -> String {
        "auth.lockUntil.\(id.uuidString)"
    }

    private func registerFailedAttempt(_ userID: UUID) {
        let attempts = UserDefaults.standard.integer(forKey: attemptsKey(userID)) + 1
        if attempts >= 5 {
            UserDefaults.standard.set(0, forKey: attemptsKey(userID))
            UserDefaults.standard.set(
                Date().addingTimeInterval(30).timeIntervalSince1970,
                forKey: lockKey(userID)
            )
        } else {
            UserDefaults.standard.set(attempts, forKey: attemptsKey(userID))
        }
    }

    private func clearAttempts(_ userID: UUID) {
        UserDefaults.standard.removeObject(forKey: attemptsKey(userID))
        UserDefaults.standard.removeObject(forKey: lockKey(userID))
    }

    // MARK: - Справочник асан

    func toggleFavoriteAsana(_ id: String) {
        if favoriteAsanaIDs.contains(id) {
            favoriteAsanaIDs.remove(id)
        } else {
            favoriteAsanaIDs.insert(id)
        }
        persist()
    }

    // MARK: - Клиенты

    func client(_ id: UUID) -> Client? {
        clients.first { $0.id == id }
    }

    func addClient(name: String, phone: String, note: String, since: String) throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw StoreError("Введите имя клиента") }
        clients.append(
            Client(
                name: trimmedName,
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                note: note.trimmingCharacters(in: .whitespacesAndNewlines),
                since: since
            )
        )
        persist()
    }

    func updateClient(id: UUID, name: String, phone: String, note: String, since: String) throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw StoreError("Введите имя клиента") }
        guard let index = clients.firstIndex(where: { $0.id == id }) else {
            throw StoreError("Клиент не найден")
        }
        clients[index].name = trimmedName
        clients[index].phone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        clients[index].note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        clients[index].since = since
        persist()
    }

    /// Создаёт нового клиента вместе с его абонементом за один шаг.
    @discardableResult
    func addQuickSale(
        name: String,
        phone: String,
        tariffName: String,
        purchaseDate: String,
        expiryDate: String,
        visitsTotal: Int,
        price: Double,
        paid: Bool,
        paidDate: String?
    ) throws -> Client {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw StoreError("Введите имя клиента") }
        let trimmedTariff = tariffName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTariff.isEmpty else { throw StoreError("Выберите тариф") }

        let client = Client(
            name: trimmedName,
            phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
            note: "",
            since: RU.key(Date())
        )
        clients.append(client)

        do {
            try addSubscription(
                clientID: client.id,
                tariffName: trimmedTariff,
                purchaseDate: purchaseDate,
                expiryDate: expiryDate,
                visitsTotal: visitsTotal,
                price: price,
                paid: paid,
                paidDate: paid ? paidDate : nil
            )
        } catch {
            clients.removeAll { $0.id == client.id }
            persist()
            throw error
        }
        return client
    }

    /// Удаляет клиента вместе с его абонементами, визитами и переносами.
    func deleteClient(_ id: UUID) throws {        guard isAdmin else {
            throw StoreError("Удалять клиентов может только администратор")
        }
        guard clients.contains(where: { $0.id == id }) else {
            throw StoreError("Клиент не найден")
        }
        if persistenceEnabled {
            do {
                try createBackup()
            } catch {
                throw StoreError("Не удалось создать резервную копию перед удалением: \(error.localizedDescription)")
            }
        }
        clients.removeAll { $0.id == id }
        subscriptions.removeAll { $0.clientID == id }
        visits.removeAll { $0.clientID == id }
        transfers.removeAll { $0.clientID == id }
        persist()
    }

    // MARK: - Абонементы

    func subscription(_ id: UUID) -> Subscription? {
        subscriptions.first { $0.id == id }
    }

    func subscriptions(of clientID: UUID) -> [Subscription] {
        subscriptions
            .filter { $0.clientID == clientID }
            .sorted { $0.purchaseDate > $1.purchaseDate }
    }

    func status(of subscription: Subscription) -> SubscriptionStatus {
        if subscription.visitsLeft <= 0 { return .finished }
        if subscription.expiryDate < RU.key(Date()) { return .expired }
        return .active
    }

    /// Ближайший по сроку действующий абонемент — с него списывается занятие.
    func activeSubscription(for clientID: UUID) -> Subscription? {
        subscriptions(of: clientID)
            .filter { status(of: $0) == .active }
            .min { $0.expiryDate < $1.expiryDate }
    }

    var clientsWithActiveSubscription: [Client] {
        clients
            .filter { activeSubscription(for: $0.id) != nil }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    func addSubscription(
        clientID: UUID,
        tariffName: String,
        purchaseDate: String,
        expiryDate: String,
        visitsTotal: Int,
        price: Double,
        paid: Bool,
        paidDate: String?
    ) throws {
        let trimmedName = tariffName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw StoreError("Введите название тарифа") }
        guard expiryDate >= purchaseDate else {
            throw StoreError("Срок действия раньше даты покупки")
        }
        guard visitsTotal >= 1 else { throw StoreError("Занятий должно быть не меньше одного") }
        guard price >= 0 else { throw StoreError("Укажите цену — ноль или больше") }
        if paid && paidDate == nil { throw StoreError("Укажите дату оплаты") }

        subscriptions.append(
            Subscription(
                clientID: clientID,
                tariffName: trimmedName,
                purchaseDate: purchaseDate,
                expiryDate: expiryDate,
                visitsTotal: visitsTotal,
                visitsLeft: visitsTotal,
                price: price,
                paid: paid,
                paidDate: paid ? paidDate : nil
            )
        )
        persist()
    }

    func setPaid(_ subscriptionID: UUID, paid: Bool) {
        guard let index = subscriptions.firstIndex(where: { $0.id == subscriptionID }) else { return }
        subscriptions[index].paid = paid
        subscriptions[index].paidDate = paid ? RU.key(Date()) : nil
        persist()
    }

    /// Фактическая дата оплаты, выбранная вручную.
    func setPaidDate(_ subscriptionID: UUID, date: String) {
        guard let index = subscriptions.firstIndex(where: { $0.id == subscriptionID }) else { return }
        subscriptions[index].paid = true
        subscriptions[index].paidDate = date
        persist()
    }

    // MARK: - Визиты

    func visits(of clientID: UUID) -> [Visit] {
        visits
            .filter { $0.clientID == clientID }
            .sorted { $0.date > $1.date || ($0.date == $1.date && $0.createdAt > $1.createdAt) }
    }

    var todayVisits: [Visit] {
        let today = RU.key(Date())
        return visits
            .filter { $0.date == today }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func markVisit(clientID: UUID, date: String, classID: UUID? = nil) throws {
        guard let subscription = activeSubscription(for: clientID) else {
            throw StoreError("У клиента нет активного абонемента")
        }
        guard !visits.contains(where: { $0.clientID == clientID && $0.date == date }) else {
            throw StoreError("Посещение в этот день уже отмечено")
        }
        guard let index = subscriptions.firstIndex(where: { $0.id == subscription.id }) else {
            throw StoreError("Абонемент не найден")
        }
        subscriptions[index].visitsLeft = max(0, subscriptions[index].visitsLeft - 1)
        visits.append(
            Visit(
                clientID: clientID,
                subscriptionID: subscription.id,
                date: date,
                classID: classID,
                createdAt: Date()
            )
        )
        persist()
    }

    // MARK: - Классы

    func studioClass(_ id: UUID) -> StudioClass? {
        classes.first { $0.id == id }
    }

    var orderedClasses: [StudioClass] {
        classes.sorted { first, second in
            if first.type != second.type { return first.type == .yoga }
            return first.name.localizedStandardCompare(second.name) == .orderedAscending
        }
    }

    func classes(onWeekday weekday: Int) -> [StudioClass] {
        classes
            .filter { $0.active && $0.weekdays.contains(weekday) }
            .sorted { $0.startMinutes < $1.startMinutes }
    }

    func classes(on key: String) -> [StudioClass] {
        guard let date = RU.date(fromKey: key) else { return [] }
        return classes(onWeekday: RU.weekdayIndex(of: date))
    }

    func bookedCount(forClass id: UUID, on key: String) -> Int {
        visits.filter { $0.classID == id && $0.date == key }.count
    }

    /// Запись клиента на занятие: проверяет места и отмечает визит с классом.
    func bookVisit(clientID: UUID, classID: UUID, date: String) throws {
        guard let item = studioClass(classID), item.active else {
            throw StoreError("Занятие не найдено или не проводится")
        }
        guard !visits.contains(where: { $0.clientID == clientID && $0.date == date }) else {
            throw StoreError("Клиент уже записан в этот день")
        }
        guard bookedCount(forClass: classID, on: date) < item.capacity else {
            throw StoreError("В группе нет свободных мест")
        }
        try markVisit(clientID: clientID, date: date, classID: classID)
    }

    /// Записанные на занятие в порядке записи.
    func bookedVisits(classID: UUID, date: String) -> [Visit] {
        visits
            .filter { $0.classID == classID && $0.date == date }
            .sorted { $0.createdAt < $1.createdAt }
    }

    /// Записывает клиента на все занятия этого направления в те же дни недели на срок в неделях.
    func repeatBooking(
        clientID: UUID,
        classID: UUID,
        from dateKey: String,
        weeks: Int
    ) throws -> RepeatBookingResult {
        guard let item = studioClass(classID), item.active else {
            throw StoreError("Занятие не найдено или не проводится")
        }
        guard (1...12).contains(weeks) else {
            throw StoreError("Укажите от 1 до 12 недель")
        }
        guard let subscription = activeSubscription(for: clientID),
              let subscriptionIndex = subscriptions.firstIndex(where: { $0.id == subscription.id }) else {
            throw StoreError("У клиента нет активного абонемента")
        }
        guard let startDate = RU.date(fromKey: dateKey) else {
            throw StoreError("Укажите корректную дату")
        }

        let calendar = RU.calendar
        var created = 0
        var skipped = 0

        for offset in 0..<(weeks * 7) {
            guard let date = calendar.date(byAdding: .day, value: offset, to: startDate) else { continue }
            guard item.weekdays.contains(RU.weekdayIndex(of: date)) else { continue }

            let dayKey = RU.key(date)

            if visits.contains(where: { $0.clientID == clientID && $0.date == dayKey }) {
                skipped += 1
                continue
            }
            let booked = visits.filter { $0.classID == classID && $0.date == dayKey }.count
            if booked >= item.capacity {
                skipped += 1
                continue
            }
            guard subscriptions[subscriptionIndex].visitsLeft > 0 else {
                skipped += 1
                continue
            }

            subscriptions[subscriptionIndex].visitsLeft -= 1
            visits.append(
                Visit(
                    clientID: clientID,
                    subscriptionID: subscriptions[subscriptionIndex].id,
                    date: dayKey,
                    classID: classID,
                    createdAt: Date()
                )
            )
            created += 1
        }

        persist()
        return RepeatBookingResult(created: created, skipped: skipped)
    }

    /// Отменяет запись: визит удаляется, занятие возвращается на тот же абонемент.
    func cancelBooking(_ visitID: UUID) throws {        guard let index = visits.firstIndex(where: { $0.id == visitID }) else {
            throw StoreError("Запись не найдена")
        }
        let visit = visits[index]
        if let subscriptionIndex = subscriptions.firstIndex(where: { $0.id == visit.subscriptionID }) {
            subscriptions[subscriptionIndex].visitsLeft = min(
                subscriptions[subscriptionIndex].visitsTotal,
                subscriptions[subscriptionIndex].visitsLeft + 1
            )
        }
        visits.remove(at: index)
        persist()
    }

    func saveClass(_ value: StudioClass) throws {
        var normalized = value
        normalized.name = value.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.name.isEmpty else { throw StoreError("Введите название занятия") }
        guard normalized.durationMin >= 15 else { throw StoreError("Длительность — не меньше 15 минут") }
        guard normalized.capacity >= 1 else { throw StoreError("Мест в группе — не меньше одного") }
        normalized.trainer = value.trainer.trimmingCharacters(in: .whitespacesAndNewlines)
        normalized.hall = value.hall.trimmingCharacters(in: .whitespacesAndNewlines)
        normalized.equipment = value.equipment.trimmingCharacters(in: .whitespacesAndNewlines)
        normalized.details = value.details.trimmingCharacters(in: .whitespacesAndNewlines)
        if let index = classes.firstIndex(where: { $0.id == normalized.id }) {
            classes[index] = normalized
        } else {
            classes.append(normalized)
        }
        persist()
    }

    func deleteClass(_ id: UUID) {
        classes.removeAll { $0.id == id }
        for index in visits.indices where visits[index].classID == id {
            visits[index].classID = nil
        }
        persist()
    }

    /// 16 направлений студии по умолчанию: 10 йоги и 6 пилатеса.
    static func defaultClasses() -> [StudioClass] {
        [
            StudioClass(
                name: "Хатха-йога", type: .yoga, level: "Лёгкий", durationMin: 60, capacity: 12,
                trainer: "Анна Ким", hall: "зал №1", weekdays: [1, 3, 5], startMinutes: 9 * 60,
                equipment: "Коврик, блоки, ремень",
                details: "Классическая практика асан, дыхания и расслабления в спокойном темпе. Баланс силы и гибкости."
            ),
            StudioClass(
                name: "Йога для начинающих", type: .yoga, level: "Лёгкий", durationMin: 60, capacity: 12,
                trainer: "Анна Ким", hall: "зал №1", weekdays: [2, 4], startMinutes: 9 * 60,
                equipment: "Коврик, блоки",
                details: "Базовые асаны, выравнивание и дыхание. Подходит для первого знакомства с йогой."
            ),
            StudioClass(
                name: "Виньяса-флоу", type: .yoga, level: "Средний", durationMin: 75, capacity: 12,
                trainer: "Анна Ким", hall: "зал №1", weekdays: [1, 3], startMinutes: 18 * 60,
                equipment: "Коврик",
                details: "Динамичная последовательность асан, связанных с дыханием. Развивает выносливость и координацию."
            ),
            StudioClass(
                name: "Аштанга-виньяса", type: .yoga, level: "Продвинутый", durationMin: 90, capacity: 10,
                trainer: "Дмитрий Ли", hall: "зал №1", weekdays: [2, 4], startMinutes: 7 * 60,
                equipment: "Коврик",
                details: "Строгая последовательность поз в быстром темпе. Требует подготовки и регулярной практики."
            ),
            StudioClass(
                name: "Йога Айенгара", type: .yoga, level: "Средний", durationMin: 75, capacity: 10,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [6], startMinutes: 10 * 60,
                equipment: "Коврик, блоки, ремни, болстеры",
                details: "Точное выравнивание и длительное удержание поз с использованием опор."
            ),
            StudioClass(
                name: "Инь-йога", type: .yoga, level: "Лёгкий", durationMin: 75, capacity: 12,
                trainer: "Дмитрий Ли", hall: "зал №2", weekdays: [2, 4], startMinutes: 20 * 60,
                equipment: "Коврик, болстеры, одеяла",
                details: "Долгие пассивные позы для глубокого расслабления соединительных тканей."
            ),
            StudioClass(
                name: "Кундалини-йога", type: .yoga, level: "Средний", durationMin: 75, capacity: 14,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [3], startMinutes: 20 * 60,
                equipment: "Коврик, плед",
                details: "Крия, дыхательные техники, мантры и медитация."
            ),
            StudioClass(
                name: "Йога для спины и осанки", type: .yoga, level: "Лёгкий", durationMin: 60, capacity: 12,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [1, 5], startMinutes: 12 * 60,
                equipment: "Коврик, блоки, ремни",
                details: "Оздоровительная практика для позвоночника, снятия напряжения в шее и пояснице."
            ),
            StudioClass(
                name: "Пренатальная йога", type: .yoga, level: "Лёгкий", durationMin: 60, capacity: 8,
                trainer: "Анна Ким", hall: "зал №2", weekdays: [6], startMinutes: 12 * 60,
                equipment: "Коврик, болстеры, блоки",
                details: "Мягкая практика для беременных: дыхание, подвижность таза, расслабление."
            ),
            StudioClass(
                name: "Йога-нидра", type: .yoga, level: "Лёгкий", durationMin: 45, capacity: 15,
                trainer: "Дмитрий Ли", hall: "зал №1", weekdays: [7], startMinutes: 19 * 60,
                equipment: "Коврик, плед, болстер",
                details: "Глубокая релаксация в положении лёжа под голос ведущего."
            ),
            StudioClass(
                name: "Мат-пилатес", type: .pilates, level: "Средний", durationMin: 55, capacity: 12,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [1, 3], startMinutes: 19 * 60,
                equipment: "Коврик",
                details: "Упражнения на коврике для мышц кора, осанки и контроля дыхания."
            ),
            StudioClass(
                name: "Пилатес для начинающих", type: .pilates, level: "Лёгкий", durationMin: 55, capacity: 12,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [2, 4], startMinutes: 11 * 60 + 30,
                equipment: "Коврик, мяч",
                details: "Основные принципы пилатеса, базовые упражнения и техника безопасного выполнения."
            ),
            StudioClass(
                name: "Пилатес на реформере", type: .pilates, level: "Средний", durationMin: 55, capacity: 6,
                trainer: "Ольга Пак", hall: "зал №3", weekdays: [3, 6], startMinutes: 9 * 60,
                equipment: "Реформер",
                details: "Тренировка на реформере с пружинным сопротивлением. Малые группы."
            ),
            StudioClass(
                name: "Пилатес с малым оборудованием", type: .pilates, level: "Средний", durationMin: 55, capacity: 10,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [5], startMinutes: 19 * 60,
                equipment: "Мячи, кольца, ленты, ролики",
                details: "Разнообразная нагрузка с фитболом, кольцом, эспандерами и роликами."
            ),
            StudioClass(
                name: "Пилатес для спины и кора", type: .pilates, level: "Лёгкий", durationMin: 55, capacity: 10,
                trainer: "Ольга Пак", hall: "зал №2", weekdays: [2], startMinutes: 18 * 60,
                equipment: "Коврик, ролик",
                details: "Укрепление глубоких мышц спины и живота, профилактика болей в пояснице."
            ),
            StudioClass(
                name: "Пренатальный и постнатальный пилатес", type: .pilates, level: "Лёгкий", durationMin: 55, capacity: 8,
                trainer: "Анна Ким", hall: "зал №2", weekdays: [7], startMinutes: 11 * 60 + 30,
                equipment: "Коврик, мяч",
                details: "Безопасные упражнения во время беременности и для восстановления после родов."
            )
        ]
    }

    // MARK: - Переносы

    func transfers(of clientID: UUID) -> [Transfer] {
        transfers
            .filter { $0.clientID == clientID }
            .sorted { $0.date > $1.date }
    }

    func addTransfer(subscriptionID: UUID, days: Int, date: String, note: String) throws {
        guard days >= 1 else { throw StoreError("Укажите число дней — от одного") }
        guard let index = subscriptions.firstIndex(where: { $0.id == subscriptionID }) else {
            throw StoreError("Абонемент не найден")
        }
        let newExpiry = RU.addDays(days, toKey: subscriptions[index].expiryDate)
        guard newExpiry > subscriptions[index].expiryDate else {
            throw StoreError("Не удалось продлить срок абонемента")
        }
        subscriptions[index].expiryDate = newExpiry
        transfers.append(
            Transfer(
                clientID: subscriptions[index].clientID,
                subscriptionID: subscriptionID,
                days: days,
                date: date,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        )
        persist()
    }

    // MARK: - Аренда

    private var currentYear: Int { RU.calendar.component(.year, from: Date()) }
    private var currentMonth: Int { RU.calendar.component(.month, from: Date()) }

    private func index(year: Int, month: Int) -> Int {
        year * 12 + month - 1
    }

    private func index(of period: RentPeriod) -> Int {
        index(year: period.year, month: period.month)
    }

    private var currentIndex: Int {
        index(year: currentYear, month: currentMonth)
    }

    var rentPeriodsAscending: [RentPeriod] {
        rentPeriods.sorted { ($0.year, $0.month) < ($1.year, $1.month) }
    }

    var currentRentPeriod: RentPeriod? {
        rentPeriods.first { $0.year == currentYear && $0.month == currentMonth }
    }

    /// Неоплаченные периоды, месяц которых уже наступил.
    var unpaidRentPeriods: [RentPeriod] {
        rentPeriods
            .filter { !$0.paid && index(of: $0) <= currentIndex }
            .sorted { ($0.year, $0.month) < ($1.year, $1.month) }
    }

    var missedRentPeriods: [RentPeriod] {
        rentPeriods
            .filter { !$0.paid && index(of: $0) < currentIndex }
            .sorted { ($0.year, $0.month) < ($1.year, $1.month) }
    }

    var pastAndCurrentRentPeriods: [RentPeriod] {
        Array(rentPeriodsAscending.filter { index(of: $0) <= currentIndex }.reversed())
    }

    var upcomingRentPeriods: [RentPeriod] {
        rentPeriodsAscending.filter { index(of: $0) > currentIndex }
    }

    var paidRentTotal: Double {
        guard let rentSettings else { return 0 }
        return Double(rentPeriods.filter { $0.paid }.count) * rentSettings.monthlyAmount
    }

    func setupRent(amount: Double, startYear: Int, startMonth: Int) throws {
        guard rentSettings == nil else { throw StoreError("Аренда уже настроена") }
        guard amount >= 0 else { throw StoreError("Укажите сумму — ноль или больше") }
        rentSettings = RentSettings(monthlyAmount: amount, startYear: startYear, startMonth: startMonth)
        ensureRentPeriods()
        persist()
    }

    /// Создаёт периоды с месяца начала учёта по текущий и шесть следующих. Дубли не появляются.
    func refreshRentWindow() {
        ensureRentPeriods()
    }

    private func ensureRentPeriods() {
        guard let settings = rentSettings else { return }
        let startIndex = index(year: settings.startYear, month: settings.startMonth)
        let endIndex = max(currentIndex, startIndex) + 6
        var changed = false
        if startIndex <= endIndex {
            for periodIndex in startIndex...endIndex {
                let year = periodIndex / 12
                let month = periodIndex % 12 + 1
                if !rentPeriods.contains(where: { $0.year == year && $0.month == month }) {
                    rentPeriods.append(RentPeriod(year: year, month: month))
                    changed = true
                }
            }
        }
        if changed { persist() }
    }

    func setRentPaid(_ id: UUID, paid: Bool) {
        guard let index = rentPeriods.firstIndex(where: { $0.id == id }) else { return }
        rentPeriods[index].paid = paid
        rentPeriods[index].paidDate = paid ? RU.key(Date()) : nil
        persist()
    }

    func rentExpensesByMonth() -> [String: Double] {
        guard let rentSettings else { return [:] }
        var result: [String: Double] = [:]
        for period in rentPeriods where period.paid {
            result[RU.monthKey(year: period.year, month: period.month), default: 0] += rentSettings.monthlyAmount
        }
        return result
    }

    func rentExpense(year: Int, month: Int) -> Double {
        rentExpensesByMonth()[RU.monthKey(year: year, month: month)] ?? 0
    }

    func netIncome(year: Int, month: Int) -> Double {
        receipts(year: year, month: month) - rentExpense(year: year, month: month)
    }

    func netIncome(year: Int) -> Double {
        let rent = rentExpensesByMonth()
        return (1...12).reduce(0) { sum, month in
            sum + receipts(year: year, month: month) - (rent[RU.monthKey(year: year, month: month)] ?? 0)
        }
    }

    func monthlyNet(year: Int) -> [Double] {
        (1...12).map { netIncome(year: year, month: $0) }
    }

    // MARK: - Тарифы

    func tariff(_ id: UUID) -> Tariff? {
        tariffs.first { $0.id == id }
    }

    var orderedTariffs: [Tariff] {
        tariffs.sorted { first, second in
            if first.visitsCount != second.visitsCount {
                return first.visitsCount < second.visitsCount
            }
            return first.price < second.price
        }
    }

    func saveTariff(_ value: Tariff) throws {
        var normalized = value
        normalized.name = value.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.name.isEmpty else { throw StoreError("Введите название тарифа") }
        guard normalized.visitsCount >= 1 else { throw StoreError("Занятий — не меньше одного") }
        guard normalized.durationDays >= 1 else { throw StoreError("Срок — не меньше одного дня") }
        guard normalized.price >= 0 else { throw StoreError("Укажите цену — ноль или больше") }
        if let index = tariffs.firstIndex(where: { $0.id == normalized.id }) {
            tariffs[index] = normalized
        } else {
            tariffs.append(normalized)
        }
        persist()
    }

    func deleteTariff(_ id: UUID) {
        tariffs.removeAll { $0.id == id }
        persist()
    }

    // MARK: - Доход

    /// В доход входят только оплаченные абонементы с фактической датой оплаты.
    var paidSubscriptions: [Subscription] {
        subscriptions.filter { $0.paid && RU.isValidDay($0.paidDate) && $0.price >= 0 }
    }

    /// Оплаченные, но без даты оплаты — их не учитываем и показываем предупреждение.
    var paidWithoutDate: [Subscription] {
        subscriptions.filter { $0.paid && !RU.isValidDay($0.paidDate) }
    }

    func receiptsByMonth() -> [String: Double] {
        var result: [String: Double] = [:]
        for subscription in paidSubscriptions {
            guard let paidDate = subscription.paidDate else { continue }
            let key = String(paidDate.prefix(7))
            result[key, default: 0] += subscription.price
        }
        return result
    }

    func receipts(year: Int, month: Int) -> Double {
        receiptsByMonth()[RU.monthKey(year: year, month: month)] ?? 0
    }

    func receipts(year: Int) -> Double {
        let byMonth = receiptsByMonth()
        return (1...12).reduce(0) { sum, month in
            sum + (byMonth[RU.monthKey(year: year, month: month)] ?? 0)
        }
    }

    func paidCount(year: Int, month: Int) -> Int {
        let prefix = RU.monthKey(year: year, month: month)
        return paidSubscriptions.filter { $0.paidDate?.hasPrefix(prefix) == true }.count
    }

    func monthlyReceipts(year: Int) -> [Double] {
        (1...12).map { receipts(year: year, month: $0) }
    }

    var receiptYears: [Int] {
        var years = Set(receiptsByMonth().keys.compactMap { Int($0.prefix(4)) })
        years.insert(Calendar.current.component(.year, from: Date()))
        return years.sorted(by: >)
    }

    // MARK: - Сводка

    var endingSoon: [EndingSoonItem] {
        let today = RU.key(Date())
        return subscriptions
            .compactMap { subscription -> EndingSoonItem? in
                guard status(of: subscription) == .active,
                      let client = client(subscription.clientID) else { return nil }
                let daysLeft = RU.daysBetween(from: today, to: subscription.expiryDate)
                guard subscription.visitsLeft <= 2 || daysLeft <= 5 else { return nil }

                let reason: String
                if subscription.visitsLeft <= 2 {
                    reason = "осталось \(subscription.visitsLeft) \(RUPlural.classes(subscription.visitsLeft))"
                } else if daysLeft <= 1 {
                    reason = "остался 1 день"
                } else {
                    reason = "истекает через \(daysLeft) \(RUPlural.days(daysLeft))"
                }
                return EndingSoonItem(
                    client: client,
                    subscription: subscription,
                    reason: reason,
                    daysLeft: daysLeft
                )
            }
            .sorted { $0.subscription.visitsLeft < $1.subscription.visitsLeft }
    }

    // MARK: - Хранение

    private func load() -> Bool {
        guard let data = try? Data(contentsOf: Self.fileURL) else { return false }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let snapshot = try? decoder.decode(StudioSnapshot.self, from: data) else { return false }
        clients = snapshot.clients
        subscriptions = snapshot.subscriptions
        visits = snapshot.visits
        transfers = snapshot.transfers
        classes = snapshot.classes ?? Self.defaultClasses()
        tariffs = snapshot.tariffs ?? []
        rentSettings = snapshot.rentSettings
        rentPeriods = snapshot.rentPeriods ?? []
        staff = snapshot.staff ?? []
        favoriteAsanaIDs = Set(snapshot.favoriteAsanas ?? [])
        if !snapshot.studioName.isEmpty { studioName = snapshot.studioName }
        if snapshot.classes == nil { persist() }
        refreshRentWindow()
        return true
    }

    private func persist() {
        guard persistenceEnabled else { return }
        guard let data = encodedSnapshotData() else {
            saveError = "Не удалось подготовить данные для сохранения"
            return
        }
        do {
            try data.write(to: Self.fileURL, options: .atomic)
            saveError = nil
        } catch {
            saveError = "Не удалось сохранить данные: \(error.localizedDescription)"
        }
    }

    /// Полная база для экспорта и резервных копий.
    func encodedSnapshotData() -> Data? {
        let snapshot = StudioSnapshot(
            clients: clients,
            subscriptions: subscriptions,
            visits: visits,
            transfers: transfers,
            studioName: studioName,
            classes: classes,
            tariffs: tariffs,
            rentSettings: rentSettings,
            rentPeriods: rentPeriods,
            staff: staff,
            favoriteAsanas: Array(favoriteAsanaIDs).sorted()
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(snapshot)
    }

    func setStudioName(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        studioName = trimmed
        persist()
    }

    // MARK: - Резервные копии и восстановление

    private static let lastBackupKey = "backup.lastAt"

    private static var backupsDirectory: URL {
        let manager = FileManager.default
        let base = (try? manager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? manager.temporaryDirectory
        return base.appendingPathComponent("Backups", isDirectory: true)
    }

    var backups: [BackupFile] {
        let manager = FileManager.default
        let urls = (try? manager.contentsOfDirectory(
            at: Self.backupsDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey]
        )) ?? []
        return urls
            .filter { $0.pathExtension.lowercased() == "json" }
            .compactMap { url -> BackupFile? in
                guard let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey]) else {
                    return nil
                }
                return BackupFile(
                    url: url,
                    date: values.contentModificationDate ?? .distantPast,
                    size: values.fileSize ?? 0
                )
            }
            .sorted { $0.date > $1.date }
    }

    @discardableResult
    func createBackup() throws -> URL {
        guard let data = encodedSnapshotData() else {
            throw StoreError("Не удалось подготовить резервную копию")
        }
        let manager = FileManager.default
        try manager.createDirectory(at: Self.backupsDirectory, withIntermediateDirectories: true)

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        let url = Self.backupsDirectory.appendingPathComponent("backup-\(formatter.string(from: Date())).json")

        do {
            try data.write(to: url, options: .atomic)
        } catch {
            // Не хватило места — удаляем самые старые копии и пробуем снова.
            for old in backups.reversed() {
                try? manager.removeItem(at: old.url)
                if (try? data.write(to: url, options: .atomic)) != nil { break }
            }
            guard manager.fileExists(atPath: url.path) else {
                throw StoreError("Не хватило места для резервной копии")
            }
        }

        let all = backups
        if all.count > 25 {
            for old in all[25...] {
                try? manager.removeItem(at: old.url)
            }
        }
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.lastBackupKey)
        return url
    }

    /// Раз в неделю при запуске создаётся внутренняя копия.
    func maintainAutomaticBackup() {
        let existing = backups
        if existing.isEmpty {
            try? createBackup()
            return
        }
        guard let last = existing.first?.date else { return }
        if Date().timeIntervalSince(last) > 7 * 24 * 60 * 60 {
            try? createBackup()
        }
    }

    func restoreBackup(_ backup: BackupFile) throws {
        let data = try Data(contentsOf: backup.url)
        try importSnapshot(from: data)
    }

    func importSnapshot(from data: Data) throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let snapshot: StudioSnapshot
        do {
            snapshot = try decoder.decode(StudioSnapshot.self, from: data)
        } catch {
            throw StoreError("Файл не похож на копию базы: \(error.localizedDescription)")
        }
        try Self.validate(snapshot)

        // Перед восстановлением сохраняем текущее состояние отдельной копией.
        try? createBackup()
        apply(snapshot)
        persist()
    }

    private func apply(_ snapshot: StudioSnapshot) {
        clients = snapshot.clients
        subscriptions = snapshot.subscriptions
        visits = snapshot.visits
        transfers = snapshot.transfers
        classes = snapshot.classes ?? Self.defaultClasses()
        tariffs = snapshot.tariffs ?? []
        rentSettings = snapshot.rentSettings
        rentPeriods = snapshot.rentPeriods ?? []
        staff = snapshot.staff ?? []
        favoriteAsanaIDs = Set(snapshot.favoriteAsanas ?? [])
        if !snapshot.studioName.isEmpty { studioName = snapshot.studioName }
        refreshRentWindow()
        if let currentUserID, !staff.contains(where: { $0.id == currentUserID && $0.isActive }) {
            logOut()
        }
    }

    private static func validate(_ snapshot: StudioSnapshot) throws {
        let clientIDs = Set(snapshot.clients.map(\.id))
        let subscriptionIDs = Set(snapshot.subscriptions.map(\.id))

        for subscription in snapshot.subscriptions {
            guard subscription.visitsTotal >= 1,
                  subscription.visitsLeft >= 0,
                  subscription.visitsLeft <= subscription.visitsTotal else {
                throw StoreError("В абонементах некорректное число занятий")
            }
            guard subscription.price >= 0 else {
                throw StoreError("В абонементах указана отрицательная цена")
            }
            guard RU.isValidDay(subscription.purchaseDate),
                  RU.isValidDay(subscription.expiryDate),
                  subscription.expiryDate >= subscription.purchaseDate else {
                throw StoreError("В абонементах некорректные даты")
            }
        }

        for visit in snapshot.visits {
            guard clientIDs.contains(visit.clientID),
                  subscriptionIDs.contains(visit.subscriptionID),
                  RU.isValidDay(visit.date) else {
                throw StoreError("В визитах есть запись с неизвестным клиентом или абонементом")
            }
        }

        for transfer in snapshot.transfers {
            guard clientIDs.contains(transfer.clientID),
                  subscriptionIDs.contains(transfer.subscriptionID),
                  transfer.days >= 1 else {
                throw StoreError("В переносах есть некорректная запись")
            }
        }

        for item in snapshot.classes ?? [] {
            guard item.capacity >= 1, item.durationMin >= 1 else {
                throw StoreError("В направлениях есть некорректное занятие")
            }
        }

        for tariff in snapshot.tariffs ?? [] {
            guard tariff.visitsCount >= 1, tariff.durationDays >= 1, tariff.price >= 0 else {
                throw StoreError("В тарифах есть некорректная запись")
            }
        }

        if let rent = snapshot.rentSettings {
            guard rent.monthlyAmount >= 0, (1...12).contains(rent.startMonth) else {
                throw StoreError("В настройках аренды некорректные данные")
            }
        }
    }

    private static var fileURL: URL {
        let manager = FileManager.default
        let directory = (try? manager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? manager.temporaryDirectory
        return directory.appendingPathComponent("studio.json")
    }

    /// Наполнение для превью — не сохраняется на устройство.
    static var preview: StudioStore {
        let store = StudioStore(persistenceEnabled: false)
        let today = RU.key(Date())
        let admin = StaffUser(name: "Анна Ким", role: .admin)
        store.staff = [
            admin,
            StaffUser(name: "Ольга Пак", role: .trainer),
            StaffUser(name: "Дмитрий Ли", role: .trainer)
        ]
        store.currentUserID = admin.id
        store.classes = defaultClasses()
        store.tariffs = [
            Tariff(name: "Пробное занятие", visitsCount: 1, durationDays: 7, price: 5000),
            Tariff(name: "4 занятия", visitsCount: 4, durationDays: 30, price: 16000),
            Tariff(name: "8 занятий / месяц", visitsCount: 8, durationDays: 30, price: 28000),
            Tariff(name: "Безлимит / месяц", visitsCount: 999, durationDays: 30, price: 45000)
        ]

        store.rentSettings = RentSettings(
            monthlyAmount: 200000,
            startYear: RU.calendar.component(.year, from: Date()),
            startMonth: 1
        )
        store.rentPeriods = (0..<12).map { offset -> RentPeriod in
            let (year, month) = RU.addMonths(
                offset - 5,
                year: RU.calendar.component(.year, from: Date()),
                month: RU.calendar.component(.month, from: Date())
            )
            var period = RentPeriod(year: year, month: month)
            period.paid = offset <= 5
            period.paidDate = period.paid ? RU.key(Date()) : nil
            return period
        }

        let aigul = Client(name: "Айгуль Ким", phone: "+7 701 234 56 78", since: RU.addDays(-140, toKey: today))
        let maria = Client(
            name: "Мария Соколова",
            phone: "+7 705 111 22 33",
            note: "Беременность, второй триместр — мягкая практика.",
            since: RU.addDays(-60, toKey: today)
        )
        let daniyar = Client(name: "Данияр Ли", phone: "+7 747 909 10 11", since: RU.addDays(-300, toKey: today))
        let elena = Client(name: "Елена Волкова", phone: "+7 702 555 44 33", since: RU.addDays(-30, toKey: today))
        store.clients = [aigul, maria, daniyar, elena]

        let aigulSub = Subscription(
            clientID: aigul.id,
            tariffName: "8 занятий / месяц",
            purchaseDate: RU.addDays(-18, toKey: today),
            expiryDate: RU.addDays(11, toKey: today),
            visitsTotal: 8,
            visitsLeft: 2,
            price: 28000,
            paid: true,
            paidDate: RU.addDays(-18, toKey: today)
        )
        let mariaSub = Subscription(
            clientID: maria.id,
            tariffName: "4 занятия",
            purchaseDate: RU.addDays(-25, toKey: today),
            expiryDate: RU.addDays(4, toKey: today),
            visitsTotal: 4,
            visitsLeft: 1,
            price: 16000,
            paid: false
        )
        let daniyarSub = Subscription(
            clientID: daniyar.id,
            tariffName: "Безлимит / месяц",
            purchaseDate: RU.addDays(-6, toKey: today),
            expiryDate: RU.addDays(24, toKey: today),
            visitsTotal: 999,
            visitsLeft: 990,
            price: 45000,
            paid: true,
            paidDate: RU.addDays(-6, toKey: today)
        )
        let elenaSub = Subscription(
            clientID: elena.id,
            tariffName: "8 занятий / месяц",
            purchaseDate: RU.addDays(-4, toKey: today),
            expiryDate: RU.addDays(26, toKey: today),
            visitsTotal: 8,
            visitsLeft: 7,
            price: 28000,
            paid: true,
            paidDate: RU.addDays(-4, toKey: today)
        )
        store.subscriptions = [aigulSub, mariaSub, daniyarSub, elenaSub]

        store.visits = [
            Visit(
                clientID: aigul.id,
                subscriptionID: aigulSub.id,
                date: today,
                createdAt: Date().addingTimeInterval(-5400)
            ),
            Visit(
                clientID: maria.id,
                subscriptionID: mariaSub.id,
                date: today,
                createdAt: Date().addingTimeInterval(-1800)
            )
        ]

        return store
    }
}
