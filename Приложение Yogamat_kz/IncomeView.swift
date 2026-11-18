//
//  IncomeView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

private struct MonthIncomeRow: Identifiable {
    let month: Int
    let receipts: Double
    let rent: Double
    let net: Double

    var id: Int { month }
}

struct IncomeView: View {
    @Environment(StudioStore.self) private var store

    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var selectedMonth: Int = Calendar.current.component(.month, from: Date())
    @State private var sheet: Sheet?

    enum Sheet: String, Identifiable {
        case tariffs
        case rent
        case payments
        case load
        case debts
        case trainers

        var id: String { rawValue }
    }

    private var monthReceipts: Double {
        store.receipts(year: selectedYear, month: selectedMonth)
    }

    private var monthRent: Double {
        store.rentExpense(year: selectedYear, month: selectedMonth)
    }

    private var monthNet: Double {
        monthReceipts - monthRent
    }

    private var yearNet: Double {
        store.netIncome(year: selectedYear)
    }

    private var monthlyNet: [Double] {
        store.monthlyNet(year: selectedYear)
    }

    private var averageMonth: Double {
        let currentYear = Calendar.current.component(.year, from: Date())
        let divisor: Double
        if selectedYear == currentYear {
            divisor = Double(max(Calendar.current.component(.month, from: Date()), 1))
        } else {
            divisor = 12
        }
        return yearNet / divisor
    }

    private var previousMonth: (year: Int, month: Int) {
        var month = selectedMonth - 1
        var year = selectedYear
        if month < 1 {
            month = 12
            year -= 1
        }
        return (year, month)
    }

    private var monthChange: Int? {
        let previous = store.netIncome(year: previousMonth.year, month: previousMonth.month)
        guard previous > 0 else { return nil }
        return Int((((monthNet - previous) / previous) * 100).rounded())
    }

    private var tableRows: [MonthIncomeRow] {
        (1...12)
            .map { month in
                let receipts = store.receipts(year: selectedYear, month: month)
                let rent = store.rentExpense(year: selectedYear, month: month)
                return MonthIncomeRow(
                    month: month,
                    receipts: receipts,
                    rent: rent,
                    net: receipts - rent
                )
            }
            .filter { $0.receipts > 0 || $0.rent > 0 }
            .sorted { $0.month > $1.month }
    }

    private var heroTitle: String {
        let month = RU.monthNames[selectedMonth - 1]
        return store.rentSettings == nil ? month : "\(month), после аренды"
    }

    private var heroSubtitle: String {
        let receipts = RU.moneyPrefix(monthReceipts)
        if store.rentSettings == nil {
            return "Поступления \(receipts) · аренда не настроена"
        }
        if monthRent > 0 {
            return "Поступления \(receipts) · аренда \(RU.moneyPrefix(monthRent))"
        }
        return "Поступления \(receipts) · аренда не оплачена"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                heroCard
                statCards

                if !store.paidWithoutDate.isEmpty {
                    warningCard
                }

                debtsLink
                barChartCard
                cumulativeCard
                tableCard
                paymentsLink
                loadLink
                trainersLink
                tariffsLink
                rentLink
                Color.clear.frame(height: 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .scrollIndicators(.hidden)
        .onAppear {
            store.refreshRentWindow()
        }
        .sheet(item: $sheet) { item in
            switch item {
            case .tariffs:
                TariffsView()
            case .rent:
                RentView()
            case .payments:
                PaymentsView()
            case .load:
                ClassLoadView()
            case .debts:
                DebtsView()
            case .trainers:
                TrainerLoadView()
            }
        }
    }

    // MARK: - Шапка

    private var header: some View {
        HStack(alignment: .center) {
            Text("Доход")
                .font(.rounded(30, .bold))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 8)

            Menu {
                Section("Месяц") {
                    ForEach(1...12, id: \.self) { month in
                        Button {
                            selectedMonth = month
                        } label: {
                            Text(RU.monthNames[month - 1])
                        }
                    }
                }
                Section("Год") {
                    ForEach(store.receiptYears, id: \.self) { year in
                        Button {
                            selectedYear = year
                        } label: {
                            Text(String(year))
                        }
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Text("\(RU.monthNames[selectedMonth - 1]) \(String(selectedYear))")
                        .font(.rounded(14, .medium))
                        .foregroundStyle(Palette.ink)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Palette.inkSoft)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Capsule().fill(Color.white.opacity(0.8)))
            }
        }
        .padding(.top, 4)
    }

    // MARK: - Строка месяца

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(heroTitle)
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)

            HStack(alignment: .center, spacing: 10) {
                Text(RU.moneyPrefix(monthNet))
                    .font(.rounded(34, .bold))
                    .foregroundStyle(monthNet < 0 ? Palette.terracotta : Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                Spacer(minLength: 6)

                if let change = monthChange {
                    HStack(spacing: 4) {
                        Image(systemName: change >= 0 ? "arrow.up" : "arrow.down")
                            .font(.system(size: 10, weight: .bold))
                        Text("\(change > 0 ? "+" : "")\(change)% к \(RU.monthDativeNames[previousMonth.month - 1])")
                            .font(.rounded(12, .medium))
                    }
                    .foregroundStyle(change >= 0 ? Palette.sageDeep : Palette.terracotta)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(change >= 0 ? Palette.sageTint : Palette.powderTint))
                }
            }

            Text(heroSubtitle)
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .studioCard()
    }

    // MARK: - Год и средний месяц

    private var statCards: some View {
        HStack(alignment: .top, spacing: 10) {
            IncomeStatCard(
                icon: "chart.bar.fill",
                title: "За год",
                value: RU.moneyPrefix(yearNet),
                tinted: true
            )
            IncomeStatCard(
                icon: "calendar",
                title: "Средний месяц",
                value: RU.moneyPrefix(averageMonth),
                tinted: false
            )
        }
    }

    private var warningCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Palette.terracotta)
            Text("\(store.paidWithoutDate.count) \(RUPlural.abonements(store.paidWithoutDate.count)) с отметкой оплаты без даты — они не входят в доход. Укажите дату оплаты в карточке клиента.")
                .font(.rounded(12.5))
                .foregroundStyle(Palette.terracotta)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Palette.powderTint)
        )
    }

    // MARK: - Графики

    private var barChartCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("По месяцам")
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)
            MonthlyBarsChart(values: monthlyNet, selectedIndex: selectedMonth - 1)
        }
        .padding(18)
        .studioCard()
    }

    private var cumulativeCard: some View {
        var running: Double = 0
        let cumulative = monthlyNet.map { value -> Double in
            running += value
            return running
        }

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Накопительно")
                    .font(.rounded(17, .semibold))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text(RU.millionLabel(cumulative.last ?? 0))
                    .font(.rounded(14, .semibold))
                    .foregroundStyle(Palette.sageDeep)
            }
            CumulativeLineChart(values: cumulative)
        }
        .padding(18)
        .studioCard()
    }

    // MARK: - Таблица

    private var tableCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("По месяцам")
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.bottom, 2)

            if tableRows.isEmpty {
                Text("Пока нет оплаченных абонементов и аренды за \(String(selectedYear)) год.")
                    .font(.rounded(13))
                    .foregroundStyle(Palette.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                HStack(spacing: 6) {
                    Text("")
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Поступления")
                        .frame(width: 76, alignment: .trailing)
                    Text("Аренда")
                        .frame(width: 66, alignment: .trailing)
                    Text("Итог")
                        .frame(width: 78, alignment: .trailing)
                    Color.clear.frame(width: 8)
                }
                .font(.rounded(10))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(Palette.inkSoft)

                ForEach(tableRows) { row in
                    Button {
                        withAnimation(.snappy(duration: 0.2)) {
                            selectedMonth = row.month
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text(RU.monthNames[row.month - 1])
                                .font(.rounded(13, row.month == selectedMonth ? .semibold : .regular))
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(RU.moneyPrefix(row.receipts))
                                .font(.rounded(11.5))
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .frame(width: 76, alignment: .trailing)
                            Text(RU.moneyPrefix(row.rent))
                                .font(.rounded(11.5))
                                .foregroundStyle(Palette.inkSoft)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .frame(width: 66, alignment: .trailing)
                            Text(RU.moneyPrefix(row.net))
                                .font(.rounded(11.5, .semibold))
                                .foregroundStyle(row.net < 0 ? Palette.terracotta : Palette.ink)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .frame(width: 78, alignment: .trailing)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Palette.inkSoft.opacity(0.4))
                                .frame(width: 8)
                        }
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if row.id != tableRows.last?.id {
                        Divider().overlay(Palette.hairline)
                    }
                }
            }
        }
        .padding(18)
        .studioCard()
    }

    private var debtsLink: some View {
        let unpaid = store.subscriptions.filter { !$0.paid }
        let total = unpaid.reduce(0) { $0 + $1.price }

        return Button {
            sheet = .debts
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "creditcard.trianglebadge.exclamationmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(unpaid.isEmpty ? Palette.sageDeep : Palette.terracotta)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Долги")
                        .font(.rounded(14.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Text(
                        unpaid.isEmpty
                            ? "Все абонементы оплачены"
                            : "\(unpaid.count) \(RUPlural.abonements(unpaid.count)) · \(RU.moneyPrefix(total))"
                    )
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private var paymentsLink: some View {
        Button {
            sheet = .payments
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "list.bullet.rectangle")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.sageDeep)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Платежи")
                        .font(.rounded(14.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Text("Все оплаты по датам")
                        .font(.rounded(12))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private var loadLink: some View {
        Button {
            sheet = .load
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "chart.bar.xaxis")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.sageDeep)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Загрузка направлений")
                        .font(.rounded(14.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Text("Занятия, визиты и заполняемость")
                        .font(.rounded(12))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private var trainersLink: some View {
        Button {
            sheet = .trainers
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "person.2")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.sageDeep)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Тренеры")
                        .font(.rounded(14.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Text("Занятия, визиты и заполняемость")
                        .font(.rounded(12))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private var tariffsLink: some View {        Button {
            sheet = .tariffs
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "ticket")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.sageDeep)
                Text("Перейти к тарифам")
                    .font(.rounded(14.5, .medium))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private var rentLink: some View {
        Button {
            sheet = .rent
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "house.fill")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.terracotta)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Аренда студии")
                        .font(.rounded(14.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Text(rentLinkSubtitle)
                        .font(.rounded(12))
                        .foregroundStyle(Palette.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private var rentLinkSubtitle: String {
        guard let settings = store.rentSettings else {
            return "Настроить аренду"
        }
        if let current = store.currentRentPeriod, !current.paid {
            return "\(RU.monthYearLower(year: current.year, month: current.month)) не оплачена · \(RU.moneyPrefix(settings.monthlyAmount))"
        }
        return "\(RU.moneyPrefix(settings.monthlyAmount)) в месяц"
    }
}

private struct IncomeStatCard: View {
    let icon: String
    let title: String
    let value: String
    let tinted: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(tinted ? Palette.sageDeep : Palette.inkSoft)
                Text(title)
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            Text(value)
                .font(.rounded(20, .bold))
                .foregroundStyle(Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(tinted ? Palette.sageTint : Palette.card)
                .shadow(color: Palette.ink.opacity(0.04), radius: 10, x: 0, y: 5)
        )
    }
}
