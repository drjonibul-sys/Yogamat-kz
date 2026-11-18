//
//  TariffsView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct TariffsView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var route: Route?

    enum Route: Identifiable {
        case new
        case edit(UUID)

        var id: String {
            switch self {
            case .new: return "new"
            case .edit(let id): return "edit-\(id.uuidString)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 10) {
                        if store.tariffs.isEmpty {
                            EmptyHintCard(
                                icon: "ticket",
                                title: "Тарифов пока нет",
                                message: "Добавьте первый, например «8 занятий / месяц»."
                            )
                        } else {
                            ForEach(store.orderedTariffs) { tariff in
                                Button {
                                    route = .edit(tariff.id)
                                } label: {
                                    row(tariff)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        Color.clear.frame(height: 6)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Тарифы")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { dismiss() }
                        .tint(Palette.sageDeep)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        route = .new
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Palette.sageDeep)
                }
            }
            .sheet(item: $route) { item in
                switch item {
                case .new:
                    TariffEditor(tariff: nil)
                case .edit(let id):
                    TariffEditor(tariff: store.tariff(id))
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private func row(_ tariff: Tariff) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(tariff.name)
                    .font(.rounded(15.5, .semibold))
                    .foregroundStyle(Palette.ink)
                Text("\(tariff.visitsCount) \(RUPlural.classes(tariff.visitsCount)) · \(tariff.durationDays) \(RUPlural.days(tariff.durationDays))")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer(minLength: 6)
            Text(RU.money(tariff.price))
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.sageDeep)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }
}

struct TariffEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let tariff: Tariff?

    @State private var name: String
    @State private var visitsCount: Int
    @State private var durationDays: Int
    @State private var priceText: String
    @State private var errorMessage: String?
    @State private var confirmDelete = false

    init(tariff: Tariff?) {
        self.tariff = tariff
        _name = State(initialValue: tariff?.name ?? "")
        _visitsCount = State(initialValue: tariff?.visitsCount ?? 8)
        _durationDays = State(initialValue: tariff?.durationDays ?? 30)
        _priceText = State(initialValue: tariff.map { String(Int($0.price)) } ?? "")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        LabeledField("Название") {
                            TextField("Например: 8 занятий / месяц", text: $name)
                        }
                        LabeledField("Занятий в абонементе") {
                            HStack {
                                Text("\(visitsCount)")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $visitsCount, in: 1...999)
                                    .labelsHidden()
                            }
                        }
                        LabeledField("Срок действия") {
                            HStack {
                                Text("\(durationDays) \(RUPlural.days(durationDays))")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $durationDays, in: 1...365)
                                    .labelsHidden()
                            }
                        }
                        LabeledField("Цена, ₸") {
                            TextField("15 000", text: $priceText)
                                .keyboardType(.decimalPad)
                        }

                        if tariff != nil {
                            Button(role: .destructive) {
                                confirmDelete = true
                            } label: {
                                Text("Удалить тариф")
                                    .font(.rounded(15.5, .semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .background(
                                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .fill(Palette.powderTint)
                                    )
                                    .foregroundStyle(Palette.terracotta)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(tariff == nil ? "Новый тариф" : "Тариф")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .tint(Palette.inkSoft)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Сохранить") { save() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .alert("Проверьте данные", isPresented: alertBinding) {
                Button("Хорошо", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .confirmationDialog("Удалить тариф?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Удалить", role: .destructive) {
                    if let tariff {
                        store.deleteTariff(tariff.id)
                        dismiss()
                    }
                }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text("Проданные абонементы останутся у клиентов.")
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

    private func save() {
        let normalized = priceText
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        do {
            guard let price = Double(normalized), price >= 0 else {
                throw StoreError("Укажите цену — ноль или больше")
            }
            var value = tariff ?? Tariff(name: name, visitsCount: visitsCount, durationDays: durationDays, price: price)
            value.name = name
            value.visitsCount = visitsCount
            value.durationDays = durationDays
            value.price = price
            try store.saveTariff(value)
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
