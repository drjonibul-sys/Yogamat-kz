//
//  RentView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct RentView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var amountText = ""
    @State private var startMonth = Calendar.current.component(.month, from: Date())
    @State private var startYear = Calendar.current.component(.year, from: Date())
    @State private var errorMessage: String?

    private var currentYear: Int { Calendar.current.component(.year, from: Date()) }
    private var currentMonth: Int { Calendar.current.component(.month, from: Date()) }
    private var currentIndex: Int { currentYear * 12 + currentMonth - 1 }

    private var years: [Int] {
        let year = Calendar.current.component(.year, from: Date())
        return Array((year - 2)...(year + 2))
    }

    private var paidCount: Int {
        store.rentPeriods.filter { $0.paid }.count
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if store.rentSettings == nil {
                            setupCard
                        } else {
                            summaryCard
                            pastSection
                            if !store.upcomingRentPeriods.isEmpty {
                                upcomingSection
                            }
                        }
                        Color.clear.frame(height: 6)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Аренда")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .alert("Проверьте данные", isPresented: alertBinding) {
                Button("Хорошо", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .onAppear {
                store.refreshRentWindow()
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    // MARK: - Настройка

    private var setupCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Аренда студии")
                    .font(.rounded(17, .semibold))
                    .foregroundStyle(Palette.ink)
                Text("Укажите месячную сумму и месяц начала учёта. Сумма сохраняется один раз — изменить её потом нельзя, останется только отмечать оплату каждого месяца.")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }

            LabeledField("Сумма в месяц, ₸") {
                TextField("200 000", text: $amountText)
                    .keyboardType(.decimalPad)
            }

            LabeledField("Начало учёта") {
                HStack {
                    Menu {
                        ForEach(1...12, id: \.self) { month in
                            Button(RU.monthNames[month - 1]) { startMonth = month }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(RU.monthNames[startMonth - 1])
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(Palette.ink)
                    }
                    Spacer()
                    Menu {
                        ForEach(years, id: \.self) { year in
                            Button(String(year)) { startYear = year }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(String(startYear))
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(Palette.ink)
                    }
                }
            }

            Text("Периоды создадутся с \(RU.monthYearLower(year: startYear, month: startMonth)) по текущий и шесть следующих месяцев.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            Button("Начать учёт аренды") { setup() }
                .buttonStyle(SageButtonStyle(filled: true))
        }
        .padding(18)
        .studioCard()
    }

    private func setup() {
        let normalized = amountText
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        do {
            guard let amount = Double(normalized), amount >= 0 else {
                throw StoreError("Укажите сумму — ноль или больше")
            }
            try store.setupRent(amount: amount, startYear: startYear, startMonth: startMonth)
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Сводка

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Ежемесячно")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                    Text(RU.moneyPrefix(store.rentSettings?.monthlyAmount ?? 0))
                        .font(.rounded(28, .bold))
                        .foregroundStyle(Palette.ink)
                }
                Spacer(minLength: 6)
                if let settings = store.rentSettings {
                    Text(RU.monthYearLower(year: settings.startYear, month: settings.startMonth))
                        .font(.rounded(11.5, .medium))
                        .foregroundStyle(Palette.sageDeep)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Palette.sageTint))
                }
            }

            Divider().overlay(Palette.hairline)

            if let settings = store.rentSettings {
                InfoRow(
                    title: "Учёт с",
                    value: "\(RU.monthNames[settings.startMonth - 1]) \(String(settings.startYear))"
                )
            }
            InfoRow(
                title: "Выплачено всего",
                value: RU.moneyPrefix(store.paidRentTotal),
                valueColor: Palette.sageDeep
            )
            InfoRow(
                title: "Оплачено периодов",
                value: "\(paidCount) из \(store.rentPeriods.count)"
            )
        }
        .padding(18)
        .studioCard()
    }

    // MARK: - Периоды

    private var pastSection: some View {
        let periods = store.pastAndCurrentRentPeriods
        return VStack(alignment: .leading, spacing: 8) {
            Text("Текущий и прошлые месяцы")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(periods) { period in
                    rentRow(period, isCurrent: period.year == currentYear && period.month == currentMonth)
                    if period.id != periods.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 14)
                    }
                }
            }
            .studioCard()
        }
    }

    private var upcomingSection: some View {
        let periods = store.upcomingRentPeriods
        return VStack(alignment: .leading, spacing: 8) {
            Text("Предстоящие месяцы")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(periods) { period in
                    rentRow(period, isCurrent: false)
                    if period.id != periods.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 14)
                    }
                }
            }
            .studioCard()
        }
    }

    private func rentRow(_ period: RentPeriod, isCurrent: Bool) -> some View {
        let overdue = !period.paid && (period.year * 12 + period.month - 1) < currentIndex

        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("\(RU.monthNames[period.month - 1]) \(String(period.year))")
                        .font(.rounded(14, .medium))
                        .foregroundStyle(Palette.ink)
                    if isCurrent {
                        Text("текущий")
                            .font(.rounded(10.5, .medium))
                            .foregroundStyle(Palette.sageDeep)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Palette.sageTint))
                    }
                }

                HStack(spacing: 4) {
                    Text(RU.moneyPrefix(store.rentSettings?.monthlyAmount ?? 0))
                        .font(.rounded(12))
                        .foregroundStyle(Palette.inkSoft)
                    if period.paid, let date = period.paidDate {
                        Text("· оплачено \(RU.longDay(date))")
                            .font(.rounded(12))
                            .foregroundStyle(Palette.sageDeep)
                    }
                }

                if overdue {
                    Text("просрочено")
                        .font(.rounded(11.5, .medium))
                        .foregroundStyle(Palette.terracotta)
                }
            }
            Spacer(minLength: 6)
            Toggle("", isOn: Binding(
                get: { period.paid },
                set: { store.setRentPaid(period.id, paid: $0) }
            ))
            .labelsHidden()
            .tint(Palette.sage)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}
