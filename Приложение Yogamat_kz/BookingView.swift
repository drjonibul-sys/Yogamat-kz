//
//  BookingView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

private struct BookingClientRoute: Identifiable {
    let id: UUID
}

struct BookingView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let classID: UUID
    let dateKey: String

    @State private var search = ""
    @State private var selectedClientID: UUID?
    @State private var clientRoute: BookingClientRoute?
    @State private var errorMessage: String?

    private var item: StudioClass? { store.studioClass(classID) }

    private var booked: Int { store.bookedCount(forClass: classID, on: dateKey) }

    private var freeSeats: Int { max(0, (item?.capacity ?? 0) - booked) }

    private var candidates: [Client] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        let list = store.clientsWithActiveSubscription
        guard !query.isEmpty else { return list }
        return list.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    private var selectedSubscription: Subscription? {
        guard let selectedClientID else { return nil }
        return store.activeSubscription(for: selectedClientID)
    }

    var body: some View {
        ZStack {
            StudioBackground()
            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 18)
                    .padding(.top, 8)

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        classCard
                        searchField
                        clientsSection
                        if let subscription = selectedSubscription {
                            subscriptionCard(subscription)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 14)
                    .padding(.bottom, 12)
                }
                .scrollIndicators(.hidden)

                bottomBar
            }
        }
        .presentationBackground(Palette.canvas)
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
        .sheet(item: $clientRoute) { route in
            ClientDetailView(clientID: route.id)
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

            Text("Запись на занятие")
                .font(.rounded(26, .bold))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 4)
        }
        .padding(.top, 4)
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
        parts.append("свободно \(freeSeats) из \(item?.capacity ?? 0) мест")
        return parts.joined(separator: " · ")
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Palette.inkSoft)
            TextField("Найти клиента…", text: $search)
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
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .background(Capsule().fill(Palette.card))
    }

    private var clientsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Клиенты с абонементом")
                    .font(.rounded(17, .bold))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text("\(candidates.count) \(RUPlural.clients(candidates.count))")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            .padding(.horizontal, 4)

            if candidates.isEmpty {
                EmptyHintCard(
                    icon: "person.2",
                    title: "Никого не нашли",
                    message: "В списке — клиенты с действующим абонементом."
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(candidates) { client in
                        row(client)
                        if client.id != candidates.last?.id {
                            Divider()
                                .overlay(Palette.hairline)
                                .padding(.leading, 14)
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .studioCard()
            }
        }
    }

    private func row(_ client: Client) -> some View {
        let isSelected = selectedClientID == client.id
        return Button {
            selectedClientID = client.id
        } label: {
            HStack(spacing: 12) {
                AvatarView(name: client.name, size: 44)

                VStack(alignment: .leading, spacing: 3) {
                    Text(client.name)
                        .font(.rounded(15.5, .semibold))
                        .foregroundStyle(Palette.ink)
                    Text(remainingText(client))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)

                ZStack {
                    Circle()
                        .fill(isSelected ? Palette.sage : Color.clear)
                    Circle()
                        .strokeBorder(Palette.hairline, lineWidth: 1.5)
                        .opacity(isSelected ? 0 : 1)
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.white)
                    }
                }
                .frame(width: 26, height: 26)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(isSelected ? Palette.sageTint.opacity(0.7) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func remainingText(_ client: Client) -> String {
        guard let subscription = store.activeSubscription(for: client.id) else {
            return "нет активного абонемента"
        }
        return "осталось \(subscription.visitsLeft) из \(subscription.visitsTotal) занятий"
    }

    private func subscriptionCard(_ subscription: Subscription) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Абонемент")
                .font(.rounded(17, .bold))
                .foregroundStyle(Palette.ink)

            Button {
                if let selectedClientID {
                    clientRoute = BookingClientRoute(id: selectedClientID)
                }
            } label: {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Спишется с «\(subscription.tariffName)»")
                            .font(.rounded(13.5))
                            .foregroundStyle(Palette.inkSoft)
                        Text("Останется \(max(0, subscription.visitsLeft - 1)) из \(subscription.visitsTotal) занятий")
                            .font(.rounded(13.5, .medium))
                            .foregroundStyle(Palette.ink)
                    }
                    Spacer(minLength: 6)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Palette.inkSoft.opacity(0.5))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .studioCard()
    }

    private var bottomBar: some View {
        VStack(spacing: 7) {
            Button {
                book()
            } label: {
                Text("Записать на занятие")
                    .font(.rounded(16, .semibold))
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Capsule().fill(Palette.sageDeep))
            }
            .buttonStyle(.plain)
            .disabled(selectedClientID == nil)
            .opacity(selectedClientID == nil ? 0.45 : 1)

            Text("Повторно в этот день записать нельзя")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
        }
        .padding(.horizontal, 18)
        .padding(.top, 6)
        .padding(.bottom, 10)
        .background(Palette.canvas.opacity(0.95))
    }

    private func book() {
        guard let clientID = selectedClientID else { return }
        do {
            try store.bookVisit(clientID: clientID, classID: classID, date: dateKey)
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
