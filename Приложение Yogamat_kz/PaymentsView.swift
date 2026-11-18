//
//  PaymentsView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

private struct PaymentEntry: Identifiable {
    enum Kind: Hashable {
        case client(UUID)
        case rent
    }

    let id: String
    let paidDate: String
    let title: String
    let detail: String?
    let amount: Double
    let isRent: Bool
    let kind: Kind
}

private enum PaymentFilter: String, CaseIterable, Identifiable {
    case all
    case subscriptions
    case rent

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "Все"
        case .subscriptions: return "Абонементы"
        case .rent: return "Аренда"
        }
    }
}

private enum PaymentRoute: Identifiable {
    case client(UUID)
    case rent

    var id: String {
        switch self {
        case .client(let id): return "client-\(id.uuidString)"
        case .rent: return "rent"
        }
    }
}

struct PaymentsView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var month = Calendar.current.component(.month, from: Date())
    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var filter: PaymentFilter = .all
    @State private var route: PaymentRoute?

    private var allEntries: [PaymentEntry] {
        let key = RU.monthKey(year: year, month: month)
        var list: [PaymentEntry] = []

        for subscription in store.paidSubscriptions {
            guard let paidDate = subscription.paidDate,
                  paidDate.hasPrefix(key),
                  let client = store.client(subscription.clientID) else { continue }
            list.append(
                PaymentEntry(
                    id: "sub-\(subscription.id.uuidString)",
                    paidDate: paidDate,
                    title: "\(client.name) · \(subscription.tariffName)",
                    detail: "оплачено \(RU.longDay(paidDate))",
                    amount: subscription.price,
                    isRent: false,
                    kind: .client(subscription.clientID)
                )
            )
        }

        for period in store.rentPeriods where period.paid {
            guard let paidDate = period.paidDate, paidDate.hasPrefix(key) else { continue }
            list.append(
                PaymentEntry(
                    id: "rent-\(period.id.uuidString)",
                    paidDate: paidDate,
                    title: "Аренда студии · \(RU.monthNames[period.month - 1].lowercased())",
                    detail: nil,
                    amount: store.rentSettings?.monthlyAmount ?? 0,
                    isRent: true,
                    kind: .rent
                )
            )
        }

        return list.sorted { lhs, rhs in
            if lhs.paidDate != rhs.paidDate { return lhs.paidDate > rhs.paidDate }
            if lhs.isRent != rhs.isRent { return !lhs.isRent }
            return lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
        }
    }

    private var entries: [PaymentEntry] {
        switch filter {
        case .all: return allEntries
        case .subscriptions: return allEntries.filter { !$0.isRent }
        case .rent: return allEntries.filter { $0.isRent }
        }
    }

    private var subscriptionsTotal: Double {
        allEntries.filter { !$0.isRent }.reduce(0) { $0 + $1.amount }
    }

    private var rentTotal: Double {
        allEntries.filter { $0.isRent }.reduce(0) { $0 + $1.amount }
    }

    private var years: [Int] {
        let current = Calendar.current.component(.year, from: Date())
        var list = Set(store.receiptYears)
        list.insert(current)
        return list.sorted(by: >)
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    totals
                    filters
                    list
                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .sheet(item: $route) { item in
            switch item {
            case .client(let id):
                ClientDetailView(clientID: id)
            case .rent:
                RentView()
            }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
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

            Text("Платежи")
                .font(.rounded(28, .bold))
                .foregroundStyle(Palette.ink)

            Spacer(minLength: 4)

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
        .padding(.top, 4)
    }

    private var totals: some View {
        HStack(alignment: .top, spacing: 10) {
            totalCard(
                icon: "ticket",
                title: "Абонементы",
                value: subscriptionsTotal,
                background: Palette.sageTint,
                iconColor: Palette.sageDeep,
                valueColor: Palette.ink
            )
            totalCard(
                icon: "house",
                title: "Аренда",
                value: rentTotal,
                background: Palette.card,
                iconColor: Palette.inkSoft,
                valueColor: Palette.ink
            )
            totalCard(
                icon: "chart.bar.fill",
                title: "Всего",
                value: subscriptionsTotal + rentTotal,
                background: Palette.powderTint,
                iconColor: Palette.terracotta,
                valueColor: Palette.ink
            )
        }
    }

    private func totalCard(
        icon: String,
        title: String,
        value: Double,
        background: Color,
        iconColor: Color,
        valueColor: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(iconColor)
                .padding(.bottom, 4)
            Text(title)
                .font(.rounded(12))
                .foregroundStyle(Palette.inkSoft)
                .lineLimit(1)
            Text(RU.moneyPrefix(value))
                .font(.rounded(17, .semibold))
                .foregroundStyle(valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.55)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(background)
                .shadow(color: Palette.ink.opacity(0.04), radius: 10, x: 0, y: 5)
        )
    }

    private var filters: some View {
        HStack(spacing: 4) {
            ForEach(PaymentFilter.allCases) { item in
                Button {
                    filter = item
                } label: {
                    Text(item.title)
                        .font(.rounded(13, .medium))
                        .foregroundStyle(filter == item ? Color.white : Palette.ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            Capsule().fill(filter == item ? Palette.sage : Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Capsule().fill(Palette.card))
    }

    private var list: some View {
        VStack(spacing: 0) {
            if entries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "banknote")
                        .font(.system(size: 24, weight: .light))
                        .foregroundStyle(Palette.sage)
                    Text("За этот месяц платежей нет")
                        .font(.rounded(14, .medium))
                        .foregroundStyle(Palette.ink)
                    Text("Оплаченные абонементы и аренда появятся здесь.")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
                .padding(.horizontal, 18)
            } else {
                ForEach(entries) { entry in
                    Button {
                        route = entry.isRent ? .rent : entry.kind.route
                    } label: {
                        row(entry)
                    }
                    .buttonStyle(.plain)

                    if entry.id != entries.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 14)
                    }
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .studioCard()
    }

    private func row(_ entry: PaymentEntry) -> some View {
        let parts = dateParts(entry.paidDate)

        return HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(parts.day)
                    .font(.rounded(16, .medium))
                    .foregroundStyle(Palette.ink)
                Text(parts.month)
                    .font(.rounded(11.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            .frame(width: 48, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title)
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                if entry.isRent {
                    Text("аренда")
                        .font(.rounded(10.5, .medium))
                        .foregroundStyle(Palette.terracotta)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Palette.powderTint))
                } else if let detail = entry.detail {
                    Text(detail)
                        .font(.rounded(12))
                        .foregroundStyle(Palette.inkSoft)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 6)

            Text(RU.moneyPrefix(entry.amount))
                .font(.rounded(15, .semibold))
                .foregroundStyle(entry.isRent ? Palette.terracotta : Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Palette.inkSoft.opacity(0.5))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private func dateParts(_ key: String) -> (day: String, month: String) {
        let parts = RU.longDay(key).split(separator: " ")
        guard parts.count >= 2 else { return (key, "") }
        return (String(parts[0]), String(parts[1]))
    }
}

private extension PaymentEntry.Kind {
    var route: PaymentRoute {
        switch self {
        case .client(let id): return .client(id)
        case .rent: return .rent
        }
    }
}
