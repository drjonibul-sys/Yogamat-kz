//
//  ClientBookingView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

/// Запись клиента на занятие прямо из его карточки.
struct ClientBookingView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let clientID: UUID

    @State private var errorMessage: String?

    private struct DayGroup: Identifiable {
        let key: String
        let offset: Int
        let classes: [StudioClass]

        var id: String { key }
    }

    private var client: Client? { store.client(clientID) }
    private var active: Subscription? { store.activeSubscription(for: clientID) }

    private var groups: [DayGroup] {
        (0..<7).compactMap { offset in
            let date = RU.date(byAddingDays: offset, to: Date())
            let key = RU.key(date)
            let classes = store.classes(on: key)
            return classes.isEmpty ? nil : DayGroup(key: key, offset: offset, classes: classes)
        }
    }

    private var subtitle: String {
        guard let client else { return "" }
        guard let active else { return "\(client.name) · нет абонемента" }
        return "\(client.name) · останется \(active.visitsLeft) из \(active.visitsTotal)"
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header

                    if active == nil {
                        EmptyHintCard(
                            icon: "ticket",
                            title: "Нет активного абонемента",
                            message: "Добавьте клиенту абонемент, чтобы записать его на занятие."
                        )
                    } else if groups.isEmpty {
                        EmptyHintCard(
                            icon: "calendar",
                            title: "Свободных занятий нет",
                            message: "На ближайшие 7 дней занятий в расписании нет."
                        )
                    } else {
                        ForEach(groups) { group in
                            daySection(group)
                        }

                        Text("Спишется одно занятие с абонемента клиента")
                            .font(.rounded(12))
                            .foregroundStyle(Palette.inkSoft)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }

                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .presentationDetents([.medium, .large])
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
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                }
                .frame(width: 40, height: 40)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 3) {
                Text("Выбор занятия")
                    .font(.rounded(24, .bold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(subtitle)
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
        }
        .padding(.top, 4)
    }

    private func daySection(_ group: DayGroup) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(dayTitle(group))
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.inkSoft)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(group.classes) { item in
                    row(item, key: group.key)
                    if item.id != group.classes.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 16)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .studioCard()
        }
    }

    private func dayTitle(_ group: DayGroup) -> String {
        switch group.offset {
        case 0: return "Сегодня"
        case 1: return "Завтра"
        default: return RU.longDay(group.key)
        }
    }

    private func row(_ item: StudioClass, key: String) -> some View {
        let booked = store.bookedCount(forClass: item.id, on: key)
        let free = max(0, item.capacity - booked)
        let isFull = free == 0
        let isBooked = store.visits(of: clientID).contains { $0.classID == item.id && $0.date == key }
        let canBook = !isFull && !isBooked

        return Button {
            guard canBook else { return }
            book(item, key: key)
        } label: {
            HStack(spacing: 12) {
                Text(item.timeLabel)
                    .font(.rounded(20, .bold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(width: 60, alignment: .leading)

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name)
                        .font(.rounded(15, .semibold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                    Text(placeLine(item))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)

                Text(seatText(free: free, isBooked: isBooked))
                    .font(.rounded(11.5, .medium))
                    .foregroundStyle(isFull ? Palette.terracotta : Palette.sageDeep)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule().fill(isFull ? Palette.powderTint : Palette.sageTint)
                    )

                if canBook {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Palette.inkSoft.opacity(0.5))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
            .opacity(canBook ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!canBook)
    }

    private func placeLine(_ item: StudioClass) -> String {
        var parts: [String] = []
        if !item.hall.isEmpty { parts.append(item.hall) }
        let trainers = store.trainerNames(for: item)
        if !trainers.isEmpty { parts.append(trainers) }
        return parts.isEmpty ? item.type.title : parts.joined(separator: " · ")
    }

    private func seatText(free: Int, isBooked: Bool) -> String {
        if isBooked { return "записан" }
        if free == 0 { return "мест нет" }
        return "\(free) \(free == 1 ? "место" : "мест")"
    }

    private func book(_ item: StudioClass, key: String) {
        do {
            try store.bookVisit(clientID: clientID, classID: item.id, date: key)
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
