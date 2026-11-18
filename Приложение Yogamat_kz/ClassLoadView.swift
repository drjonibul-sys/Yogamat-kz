//
//  ClassLoadView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

private struct ClassLoadReport: Identifiable {
    let item: StudioClass
    let sessions: Int
    let visits: Int
    let occupancy: Int

    var id: UUID { item.id }
}

struct ClassLoadView: View {
    @Environment(StudioStore.self) private var store

    @State private var month = Calendar.current.component(.month, from: Date())
    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var selectedClass: StudioClass?

    private var loads: [ClassLoadReport] {
        let key = RU.monthKey(year: year, month: month)
        let calendar = RU.calendar
        let today = RU.key(Date())

        guard let first = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = calendar.range(of: .day, in: .month, for: first) else {
            return []
        }

        var reports: [ClassLoadReport] = []

        for item in store.classes where item.active {
            var sessions = 0
            for day in range {
                guard let date = calendar.date(byAdding: .day, value: day - 1, to: first) else { continue }
                guard RU.key(date) <= today else { continue }
                if item.weekdays.contains(RU.weekdayIndex(of: date)) {
                    sessions += 1
                }
            }
            guard sessions > 0 else { continue }

            let visits = store.visits
                .filter { $0.classID == item.id && $0.date.hasPrefix(key) }
                .count
            let capacity = sessions * item.capacity
            let occupancy = capacity > 0
                ? min(100, Int((Double(visits) / Double(capacity) * 100).rounded()))
                : 0

            reports.append(
                ClassLoadReport(item: item, sessions: sessions, visits: visits, occupancy: occupancy)
            )
        }

        return reports.sorted { lhs, rhs in
            if lhs.occupancy != rhs.occupancy { return lhs.occupancy > rhs.occupancy }
            return lhs.item.name.localizedStandardCompare(rhs.item.name) == .orderedAscending
        }
    }

    private var totalSessions: Int { loads.reduce(0) { $0 + $1.sessions } }
    private var totalVisits: Int { loads.reduce(0) { $0 + $1.visits } }

    private var averageLoad: Int {
        let capacity = loads.reduce(0) { $0 + $1.sessions * $1.item.capacity }
        guard capacity > 0 else { return 0 }
        return min(100, Int((Double(totalVisits) / Double(capacity) * 100).rounded()))
    }

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
                            icon: "chart.bar",
                            title: "Нет занятий в этом месяце",
                            message: "Выберите другой месяц или добавьте занятия в расписание."
                        )
                    } else {
                        VStack(spacing: 10) {
                            ForEach(loads) { report in
                                Button {
                                    selectedClass = report.item
                                } label: {
                                    card(report)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationDragIndicator(.visible)
        .presentationBackground(Palette.canvas)
        .sheet(item: $selectedClass) { item in
            ClassEditorView(existing: item)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Загрузка направлений")
                .font(.rounded(28, .bold))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
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
                        Text("\(RU.monthNames[month - 1]) \(String(year))")
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
        }
        .padding(.top, 8)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Средняя загрузка")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
            Text("\(averageLoad)%")
                .font(.rounded(40, .bold))
                .foregroundStyle(Palette.ink)
            Text(summaryLine)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Palette.sageTint)
        )
    }

    private var summaryLine: String {
        let directions = "\(loads.count) \(RUPlural.directions(loads.count))"
        let sessions = "\(countText(totalSessions)) \(RUPlural.classes(totalSessions))"
        let visits = "\(countText(totalVisits)) \(RUPlural.visits(totalVisits))"
        return "\(directions) · \(sessions) · \(visits)"
    }

    private func card(_ report: ClassLoadReport) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(report.item.name)
                        .font(.rounded(17, .semibold))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                    Text("\(report.sessions) \(RUPlural.classes(report.sessions)) · \(report.visits) \(RUPlural.visits(report.visits))")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)

                Text("\(report.occupancy)%")
                    .font(.rounded(17, .semibold))
                    .foregroundStyle(Palette.sageDeep)

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
                    .padding(.top, 3)
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.sageTint)
                    Capsule()
                        .fill(Palette.sage)
                        .frame(width: max(0, proxy.size.width * CGFloat(report.occupancy) / 100))
                }
            }
            .frame(height: 8)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }

    private func countText(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.locale = RU.locale
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }
}
