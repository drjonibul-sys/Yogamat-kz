//
//  QuickSaleView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct QuickSaleView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var onCreated: (UUID) -> Void

    @State private var name = ""
    @State private var phone = ""
    @State private var selectedTariffID: UUID?
    @State private var purchase = Date()
    @State private var paid = true
    @State private var paidDate = Date()
    @State private var errorMessage: String?

    private var tariff: Tariff? {
        guard let selectedTariffID else { return nil }
        return store.tariff(selectedTariffID)
    }

    private var expiryKey: String {
        guard let tariff else { return "" }
        return RU.addDays(tariff.durationDays, toKey: RU.key(purchase))
    }

    var body: some View {
        ZStack {
            StudioBackground()
            VStack(spacing: 0) {
                header
                    .padding(.horizontal, 18)
                    .padding(.top, 8)

                ScrollView {
                    VStack(spacing: 14) {
                        clientCard
                        subscriptionCard
                        paymentCard
                        Color.clear.frame(height: 4)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 10)
                }
                .scrollIndicators(.hidden)
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 7) {
                Button {
                    save()
                } label: {
                    Text("Создать клиента и абонемент")
                        .font(.rounded(16, .semibold))
                        .foregroundStyle(Color.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Capsule().fill(Palette.sage))
                }
                .buttonStyle(.plain)

                Text("Клиент и абонемент сохранятся вместе")
                    .font(.rounded(11.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 10)
            .background(Palette.canvas.opacity(0.95))
        }
        .alert(
            "Проверьте данные",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("Хорошо", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .presentationBackground(Palette.canvas)
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

            Text("Быстрая продажа")
                .font(.rounded(26, .bold))
                .foregroundStyle(Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
        }
        .padding(.top, 4)
    }

    private var clientCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Клиент")
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)

            quickField("Имя и фамилия", placeholder: "Например: Айгуль Ким", text: $name)
                .textInputAutocapitalization(.words)

            quickField("Телефон", placeholder: "+7 700 000 00 00", text: $phone)
                .keyboardType(.phonePad)
        }
        .padding(16)
        .studioCard()
    }

    private func quickField(_ title: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)
            TextField(placeholder, text: text)
                .font(.rounded(16))
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Palette.canvas)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Palette.hairline, lineWidth: 1)
                )
        }
    }

    private var subscriptionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Абонемент")
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)

            if store.orderedTariffs.isEmpty {
                Text("Тарифов пока нет — добавьте их в разделе «Доход».")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.orderedTariffs) { item in
                            Button {
                                selectedTariffID = item.id
                            } label: {
                                Text(item.name)
                                    .font(.rounded(12.5, .medium))
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .minimumScaleFactor(0.8)
                                    .frame(width: 78, height: 52)
                                    .background(
                                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .fill(selectedTariffID == item.id ? Palette.sage : chipColor(for: item))
                                    )
                                    .foregroundStyle(selectedTariffID == item.id ? Color.white : Palette.ink)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            if let tariff {
                Divider().overlay(Palette.hairline)

                quickRow("Занятий", "\(tariff.visitsCount)")
                Divider().overlay(Palette.hairline)
                quickRow("Срок", "\(tariff.durationDays) \(RUPlural.days(tariff.durationDays))")
                Divider().overlay(Palette.hairline)

                HStack {
                    Text("Дата покупки")
                        .font(.rounded(13.5))
                        .foregroundStyle(Palette.inkSoft)
                    Spacer(minLength: 8)
                    DatePicker("", selection: $purchase, displayedComponents: .date)
                        .labelsHidden()
                        .datePickerStyle(.compact)
                }
                .padding(.vertical, 6)

                Divider().overlay(Palette.hairline)
                quickRow("Действует до", RU.longDay(expiryKey))
                Divider().overlay(Palette.hairline)
                quickRow("Цена", RU.moneyPrefix(tariff.price), valueColor: Palette.sageDeep)
            }
        }
        .padding(16)
        .studioCard()
    }

    private func chipColor(for item: Tariff) -> Color {
        let sum = item.name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        switch sum % 3 {
        case 0: return Palette.sageTint.opacity(0.6)
        case 1: return Palette.powderTint
        default: return Palette.sand
        }
    }

    private func quickRow(_ title: String, _ value: String, valueColor: Color = Palette.ink) -> some View {
        HStack {
            Text(title)
                .font(.rounded(13.5))
                .foregroundStyle(Palette.inkSoft)
            Spacer(minLength: 8)
            Text(value)
                .font(.rounded(13.5, .medium))
                .foregroundStyle(valueColor)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 8)
    }

    private var paymentCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Оплата")
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.bottom, 2)

            HStack {
                Text("Оплачено")
                    .font(.rounded(13.5))
                    .foregroundStyle(Palette.inkSoft)
                Spacer(minLength: 8)
                Toggle("", isOn: $paid)
                    .labelsHidden()
                    .tint(Palette.sage)
            }
            .padding(.vertical, 6)

            if paid {
                Divider().overlay(Palette.hairline)
                HStack {
                    Text("Дата оплаты")
                        .font(.rounded(13.5))
                        .foregroundStyle(Palette.inkSoft)
                    Spacer(minLength: 8)
                    DatePicker("", selection: $paidDate, displayedComponents: .date)
                        .labelsHidden()
                        .datePickerStyle(.compact)
                }
                .padding(.vertical, 6)
            }
        }
        .padding(16)
        .studioCard()
    }

    private func save() {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Введите имя клиента"
            return
        }
        guard let tariff else {
            errorMessage = "Выберите тариф"
            return
        }
        do {
            let client = try store.addQuickSale(
                name: name,
                phone: phone,
                tariffName: tariff.name,
                purchaseDate: RU.key(purchase),
                expiryDate: expiryKey,
                visitsTotal: tariff.visitsCount,
                price: tariff.price,
                paid: paid,
                paidDate: RU.key(paidDate)
            )
            onCreated(client.id)
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
