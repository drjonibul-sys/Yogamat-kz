//
//  VisitsCSV.swift
//  Приложение Yogamat_kz
//

import SwiftUI

enum VisitsCSV {
    /// Таблица визитов: дата, время, клиент, направление, тариф.
    static func make(visits: [Visit], name: String, store: StudioStore) -> URL? {
        guard !visits.isEmpty else { return nil }

        let sorted = visits.sorted { first, second in
            if first.date != second.date { return first.date > second.date }
            return first.createdAt > second.createdAt
        }

        let header = ["Дата", "Время", "Клиент", "Направление", "Тариф"]
            .map(field)
            .joined(separator: ";")
        var lines: [String] = [header]

        for visit in sorted {
            let direction = visit.classID.flatMap { store.studioClass($0)?.name } ?? ""
            let tariff = store.subscription(visit.subscriptionID)?.tariffName ?? ""
            let row = [
                RU.shortDate(visit.date),
                RU.time(visit.createdAt),
                store.client(visit.clientID)?.name ?? "—",
                direction,
                tariff
            ]
            lines.append(row.map(field).joined(separator: ";"))
        }

        // BOM помогает Excel открыть файл в UTF-8.
        let text = "\u{FEFF}" + lines.joined(separator: "\r\n") + "\r\n"
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(fileName(name) + ".csv")
        try? FileManager.default.removeItem(at: url)
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    private static func field(_ value: String) -> String {
        let clean = value
            .replacingOccurrences(of: "\"", with: "\"\"")
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        return "\"" + clean + "\""
    }

    private static func fileName(_ value: String) -> String {
        value
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
    }
}

struct VisitsExportView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    /// Визиты, которые сейчас видны в журнале по фильтрам.
    let visits: [Visit]

    @State private var scope: Scope = .month
    @State private var monthStart: Date = RU.startOfMonth()
    @State private var fileURL: URL?

    enum Scope: String, CaseIterable, Identifiable {
        case month
        case all

        var id: String { rawValue }

        var title: String {
            switch self {
            case .month: return "Месяц"
            case .all: return "Все визиты"
            }
        }
    }

    private var monthKey: String {
        let components = RU.calendar.dateComponents([.year, .month], from: monthStart)
        return RU.monthKey(year: components.year ?? 2026, month: components.month ?? 1)
    }

    private var monthVisits: [Visit] {
        let key = monthKey
        return visits.filter { $0.date.hasPrefix(key) }
    }

    private var scopeVisits: [Visit] {
        scope == .month ? monthVisits : visits
    }

    private var fileName: String {
        scope == .month ? "Визиты \(RU.monthTitle(monthStart))" : "Визиты по фильтру"
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    scopePills

                    if scope == .month {
                        monthCard
                    }

                    Text(caption)
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .padding(.horizontal, 4)

                    shareButton
                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .presentationDetents([.medium])
        .onAppear { refresh() }
        .onChange(of: scope) { _, _ in refresh() }
        .onChange(of: monthStart) { _, _ in refresh() }
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

            Text("Выгрузить в таблицу")
                .font(.rounded(24, .bold))
                .foregroundStyle(Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Spacer(minLength: 4)
        }
        .padding(.top, 4)
    }

    private var scopePills: some View {
        HStack(spacing: 8) {
            ForEach(Scope.allCases) { item in
                FilterPill(title: item.title, selected: item == scope) {
                    withAnimation(.snappy(duration: 0.18)) {
                        scope = item
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 2)
    }

    private var monthCard: some View {
        HStack(spacing: 10) {
            Button {
                shiftMonth(-1)
            } label: {
                circleLabel("chevron.left")
            }
            .buttonStyle(.plain)

            VStack(spacing: 3) {
                Text(RU.monthTitle(monthStart))
                    .font(.rounded(17, .semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("\(monthVisits.count) \(RUPlural.visits(monthVisits.count))")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            .frame(maxWidth: .infinity)

            Button {
                shiftMonth(1)
            } label: {
                circleLabel("chevron.right")
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .studioCard()
    }

    private var caption: String {
        let count = scopeVisits.count
        if count == 0 {
            return scope == .month
                ? "В этом месяце визитов нет. Выберите другой месяц."
                : "По текущему фильтру визитов нет."
        }
        return "В таблицу попадут \(count) \(RUPlural.visits(count)) — только те, что видны в журнале сейчас."
    }

    private var shareButton: some View {
        Group {
            if let fileURL {
                ShareLink(item: fileURL) {
                    buttonLabel
                }
                .buttonStyle(.plain)
            } else {
                buttonLabel
                    .opacity(0.45)
            }
        }
    }

    private var buttonLabel: some View {
        HStack(spacing: 8) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 15, weight: .semibold))
            Text("Выгрузить таблицу")
                .font(.rounded(16, .semibold))
        }
        .foregroundStyle(Color.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Capsule().fill(Palette.sage))
    }

    private func circleLabel(_ icon: String) -> some View {
        ZStack {
            Circle().fill(Palette.sageTint)
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Palette.sageDeep)
        }
        .frame(width: 36, height: 36)
    }

    private func shiftMonth(_ delta: Int) {
        let components = RU.calendar.dateComponents([.year, .month], from: monthStart)
        guard let year = components.year, let month = components.month else { return }
        let next = RU.addMonths(delta, year: year, month: month)
        guard let first = RU.calendar.date(
            from: DateComponents(year: next.year, month: next.month, day: 1)
        ) else { return }
        withAnimation(.snappy(duration: 0.2)) {
            monthStart = RU.calendar.startOfDay(for: first)
        }
    }

    private func refresh() {
        fileURL = VisitsCSV.make(visits: scopeVisits, name: fileName, store: store)
    }
}
