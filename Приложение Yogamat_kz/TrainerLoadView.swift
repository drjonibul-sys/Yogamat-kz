//
//  TrainerLoadView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

private struct DirectionLoad: Identifiable {
    let item: StudioClass
    let sessions: Int
    let visits: Int

    var id: UUID { item.id }
}

private struct TrainerLoadReport: Identifiable {
    let trainer: StaffUser
    let directions: [DirectionLoad]
    let sessions: Int
    let visits: Int
    let occupancy: Int

    var id: UUID { trainer.id }
}

struct TrainerLoadView: View {
    @Environment(StudioStore.self) private var store

    @State private var month = Calendar.current.component(.month, from: Date())
    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var selected: TrainerLoadReport?

    private var monthKey: String {
        RU.monthKey(year: year, month: month)
    }

    private var loads: [TrainerLoadReport] {
        let calendar = RU.calendar
        let today = RU.key(Date())

        guard let first = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = calendar.range(of: .day, in: .month, for: first) else {
            return []
        }

        var reports: [TrainerLoadReport] = []

        for trainer in store.trainers {
            let assigned = store.classes.filter { isAssigned($0, to: trainer) }
            guard !assigned.isEmpty else { continue }

            var directions: [DirectionLoad] = []
            var sessions = 0

            for item in assigned {
                var itemSessions = 0
                for day in range {
                    guard let date = calendar.date(byAdding: .day, value: day - 1, to: first) else { continue }
                    guard RU.key(date) <= today else { continue }
                    if item.weekdays.contains(RU.weekdayIndex(of: date)) {
                        itemSessions += 1
                    }
                }
                guard itemSessions > 0 else { continue }

                let visits = store.visits
                    .filter { $0.classID == item.id && $0.date.hasPrefix(monthKey) }
                    .count
                directions.append(DirectionLoad(item: item, sessions: itemSessions, visits: visits))
                sessions += itemSessions
            }

            guard sessions > 0 else { continue }

            let visits = directions.reduce(0) { $0 + $1.visits }
            let capacity = directions.reduce(0) { $0 + $1.sessions * $1.item.capacity }
            let occupancy = capacity > 0
                ? min(100, Int((Double(visits) / Double(capacity) * 100).rounded()))
                : 0

            reports.append(
                TrainerLoadReport(
                    trainer: trainer,
                    directions: directions.sorted { $0.sessions > $1.sessions },
                    sessions: sessions,
                    visits: visits,
                    occupancy: occupancy
                )
            )
        }

        return reports.sorted { lhs, rhs in
            if lhs.sessions != rhs.sessions { return lhs.sessions > rhs.sessions }
            return lhs.trainer.name.localizedStandardCompare(rhs.trainer.name) == .orderedAscending
        }
    }

    private var totalSessions: Int { loads.reduce(0) { $0 + $1.sessions } }
    private var totalVisits: Int { loads.reduce(0) { $0 + $1.visits } }

    private var years: [Int] {
        let current = Calendar.current.component(.year, from: Date())
        return Array((current - 2)...(current + 1))
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    heroCard

                    if loads.isEmpty {
                        EmptyHintCard(
                            icon: "person.2",
                            title: "Тренеров пока нет",
                            message: "Добавьте тренеров в настройках и назначьте их на направления."
                        )
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("По нагрузке")
                                .font(.rounded(17, .semibold))
                                .foregroundStyle(Palette.ink)
                                .padding(.horizontal, 4)

                            VStack(spacing: 0) {
                                ForEach(loads) { report in
                                    Button {
                                        selected = report
                                    } label: {
                                        row(report)
                                    }
                                    .buttonStyle(.plain)

                                    if report.id != loads.last?.id {
                                        Divider()
                                            .overlay(Palette.hairline)
                                            .padding(.leading, 62)
                                    }
                                }
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                            .studioCard()
                        }
                    }

                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .sheet(item: $selected) { report in
            TrainerDirectionsView(report: report)
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Text("Тренеры")
                .font(.rounded(28, .bold))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 8)

            Menu {
                Section("Месяц") {
                    ForEach(1...12, id: \.self) { value in
                        Button(RU.monthNames[value - 1]) { month = value }
                    }
                }
                Section("Год") {
                    ForEach(years, id: \.self) { value in
                        Button(String(value)) { year = value }
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Text(RU.monthTitle(RU.calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()))
                        .font(.rounded(13.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Palette.inkSoft)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().fill(Palette.card))
            }
        }
        .padding(.top, 4)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(RU.monthTitle(RU.calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()))
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)

            HStack(alignment: .center, spacing: 18) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(totalSessions)")
                        .font(.rounded(32, .bold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(RUPlural.classes(totalSessions))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(totalVisits)")
                        .font(.rounded(32, .bold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(RUPlural.visits(totalVisits))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .studioCard()
    }

    private func row(_ report: TrainerLoadReport) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                AvatarView(name: report.trainer.name, size: 40)

                VStack(alignment: .leading, spacing: 3) {
                    Text(report.trainer.name)
                        .font(.rounded(15.5, .semibold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                    Text("\(report.directions.count) \(RUPlural.directions(report.directions.count)) · средняя заполняемость \(report.occupancy)%")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)

                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(report.sessions)")
                        .font(.rounded(17, .semibold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text(RUPlural.classes(report.sessions))
                        .font(.rounded(11.5))
                        .foregroundStyle(Palette.inkSoft)
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.sageTint)
                    Capsule()
                        .fill(Palette.sage)
                        .frame(width: max(0, proxy.size.width * CGFloat(report.occupancy) / 100))
                }
            }
            .frame(height: 6)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private func isAssigned(_ item: StudioClass, to trainer: StaffUser) -> Bool {
        guard item.active else { return false }
        if let ids = item.trainerIDs, !ids.isEmpty {
            return ids.contains(trainer.id)
        }
        return !item.trainer.isEmpty
            && item.trainer.localizedCaseInsensitiveContains(trainer.name)
    }
}

private struct TrainerDirectionsView: View {
    @Environment(\.dismiss) private var dismiss

    let report: TrainerLoadReport

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header

                    VStack(spacing: 0) {
                        ForEach(report.directions) { direction in
                            row(direction)
                            if direction.id != report.directions.last?.id {
                                Divider()
                                    .overlay(Palette.hairline)
                                    .padding(.leading, 16)
                            }
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .studioCard()

                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .presentationDetents([.medium, .large])
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
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

                VStack(alignment: .leading, spacing: 2) {
                    Text(report.trainer.name)
                        .font(.rounded(24, .bold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text("\(report.sessions) \(RUPlural.classes(report.sessions)) · \(report.visits) \(RUPlural.visits(report.visits)) · \(report.occupancy)%")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 4)
            }
        }
        .padding(.top, 4)
    }

    private func row(_ direction: DirectionLoad) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(direction.item.name)
                    .font(.rounded(15.5, .semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                Text("\(direction.sessions) \(RUPlural.classes(direction.sessions)) · \(direction.visits) \(RUPlural.visits(direction.visits))")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer(minLength: 6)

            Text(direction.item.type.title)
                .font(.rounded(11.5, .medium))
                .foregroundStyle(Palette.inkSoft)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
