//
//  ClassRosterView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct ClassRosterView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let classID: UUID
    let dateKey: String

    @State private var sheet: SheetRoute?
    @State private var pendingCancel: Visit?
    @State private var showCancelConfirm = false
    @State private var errorMessage: String?
    @State private var search = ""

    enum SheetRoute: Identifiable {
        case booking
        case repeatVisit(Visit)

        var id: String {
            switch self {
            case .booking: return "booking"
            case .repeatVisit(let visit): return "repeat-\(visit.id.uuidString)"
            }
        }
    }

    private var item: StudioClass? { store.studioClass(classID) }
    private var bookedVisits: [Visit] { store.bookedVisits(classID: classID, date: dateKey) }
    private var capacity: Int { item?.capacity ?? 0 }

    private var query: String {
        search.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isSearching: Bool { !query.isEmpty }

    private var filteredVisits: [Visit] {
        guard isSearching else { return bookedVisits }
        return bookedVisits.filter { visit in
            store.client(visit.clientID)?.name.localizedCaseInsensitiveContains(query) ?? false
        }
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    classCard
                    searchField

                    HStack {
                        Text("Записаны")
                            .font(.rounded(19, .bold))
                            .foregroundStyle(Palette.ink)
                        Spacer()
                        Text(countLabel)
                            .font(.rounded(13))
                            .foregroundStyle(Palette.inkSoft)
                    }
                    .padding(.horizontal, 4)

                    if bookedVisits.isEmpty {
                        EmptyHintCard(
                            icon: "person.2",
                            title: "Пока никто не записан",
                            message: "Запишите клиента с действующим абонементом."
                        )
                    } else if filteredVisits.isEmpty {
                        EmptyHintCard(
                            icon: "line.3.horizontal.decrease",
                            title: "Никого не нашли",
                            message: "Измените имя клиента или сбросьте поиск."
                        )
                    } else {
                        VStack(spacing: 0) {
                            ForEach(filteredVisits) { visit in
                                row(visit)
                                if visit.id != filteredVisits.last?.id {
                                    Divider()
                                        .overlay(Palette.hairline)
                                        .padding(.leading, 14)
                                }
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .studioCard()
                    }

                    Button {
                        sheet = .booking
                    } label: {
                        Text("Записать ещё клиента")
                            .font(.rounded(16, .semibold))
                            .foregroundStyle(Color.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Capsule().fill(Palette.sage))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 2)

                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .sheet(item: $sheet) { route in
            switch route {
            case .booking:
                BookingView(classID: classID, dateKey: dateKey)
            case .repeatVisit(let visit):
                RepeatBookingView(classID: classID, dateKey: dateKey, clientID: visit.clientID)
            }
        }
        .confirmationDialog(
            "Отменить запись?",
            isPresented: $showCancelConfirm,
            titleVisibility: .visible
        ) {
            Button("Отменить запись", role: .destructive) { cancelPending() }
            Button("Оставить", role: .cancel) {}
        } message: {
            Text(cancelMessage)
        }
        .alert(
            "Не получилось",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("Хорошо", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                dismiss()
            } label: {
                ZStack {
                    Circle().fill(Palette.card)
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                }
                .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)

            Text("Состав группы")
                .font(.rounded(28, .bold))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 4)
        }
        .padding(.top, 4)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Palette.inkSoft)
            TextField("Поиск по имени клиента…", text: $search)
                .font(.rounded(15))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !search.isEmpty {
                Button {
                    search = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Palette.inkSoft)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Capsule().fill(Palette.card))
    }

    private var countLabel: String {
        if isSearching {
            return "\(shownCount) из \(bookedVisits.count) \(RUPlural.clients(bookedVisits.count))"
        }
        return "\(bookedVisits.count) \(RUPlural.clients(bookedVisits.count))"
    }

    /// Сколько записей показывать: при поиске — только найденные.
    private var shownCount: Int {
        isSearching ? filteredVisits.count : bookedVisits.count
    }

    private var classCard: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .top, spacing: 8) {
                Text(item?.name ?? "Занятие")
                    .font(.rounded(16, .semibold))
                    .foregroundStyle(Palette.ink)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 6)
                LevelPill(level: item?.level ?? "Лёгкий")
            }
            Text(timeLine)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)
            Text(placeLine)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
        .padding(.leading, 20)
        .padding(.trailing, 14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Palette.card)
                .shadow(color: Palette.ink.opacity(0.05), radius: 12, x: 0, y: 6)
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(item?.type.accentColor ?? Palette.sage)
                .frame(width: 5)
                .padding(.vertical, 10)
                .padding(.leading, 6)
        }
    }

    private var timeLine: String {
        guard let item, let date = RU.date(fromKey: dateKey) else { return "" }
        let start = item.startMinutes
        let end = start + item.durationMin
        return "\(RU.weekdayLong(date)) · \(RU.classTime(start))–\(RU.classTime(end))"
    }

    private var placeLine: String {
        var parts: [String] = []
        if let hall = item?.hall, !hall.isEmpty { parts.append(hall) }
        let trainer = item.map { store.trainerNames(for: $0) } ?? ""
        if !trainer.isEmpty { parts.append(trainer) }
        parts.append("записано \(shownCount) из \(capacity)")
        parts.append("свободно \(max(0, capacity - shownCount))")
        return parts.joined(separator: " · ")
    }

    private func row(_ visit: Visit) -> some View {
        let client = store.client(visit.clientID)
        return HStack(spacing: 12) {
            AvatarView(name: client?.name ?? "", size: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(client?.name ?? "Клиент")
                    .font(.rounded(15.5, .semibold))
                    .foregroundStyle(Palette.ink)
                Text(remainingText(visit))
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
                if let until = recurringUntil(visit) {
                    Text("постоянный до \(until)")
                        .font(.rounded(11.5, .medium))
                        .foregroundStyle(Palette.sageDeep)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 6)

            HStack(spacing: 8) {
                Button {
                    sheet = .repeatVisit(visit)
                } label: {
                    ZStack {
                        Circle().fill(Palette.sageTint)
                        Image(systemName: "repeat")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Palette.sageDeep)
                    }
                    .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Повторять")

                Button {
                    pendingCancel = visit
                    showCancelConfirm = true
                } label: {
                    ZStack {
                        Circle().fill(Palette.powderTint)
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Palette.terracotta)
                    }
                    .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private func recurringUntil(_ visit: Visit) -> String? {
        let dates = store.visits(of: visit.clientID)
            .filter { $0.classID == classID && $0.date > dateKey }
            .map(\.date)
        guard let last = dates.max() else { return nil }
        return RU.longDay(last)
    }

    private func remainingText(_ visit: Visit) -> String {
        guard let subscription = store.subscription(visit.subscriptionID) else {
            return "абонемент не найден"
        }
        return "осталось \(subscription.visitsLeft) из \(subscription.visitsTotal) занятий"
    }

    private var cancelMessage: String {
        let name = pendingCancel.flatMap { store.client($0.clientID)?.name } ?? "клиента"
        let tariff = pendingCancel
            .flatMap { store.subscription($0.subscriptionID)?.tariffName }
            ?? "его абонемент"
        return "Снять \(name) с занятия? Занятие вернётся на «\(tariff)», свободное место освободится."
    }

    private func cancelPending() {
        guard let visit = pendingCancel else { return }
        pendingCancel = nil
        do {
            try store.cancelBooking(visit.id)
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
