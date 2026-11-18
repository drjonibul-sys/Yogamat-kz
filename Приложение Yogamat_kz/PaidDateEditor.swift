//
//  PaidDateEditor.swift
//  Приложение Yogamat_kz
//

import SwiftUI

/// Дата фактической оплаты абонемента.
struct PaidDateEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let subscriptionID: UUID

    @State private var date = Date()

    private var subscription: Subscription? {
        store.subscription(subscriptionID)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Дата оплаты")
                                .font(.rounded(15, .semibold))
                                .foregroundStyle(Palette.ink)

                            DatePicker(
                                "Дата оплаты",
                                selection: $date,
                                displayedComponents: .date
                            )
                            .datePickerStyle(.graphical)
                            .tint(Palette.sage)
                            .labelsHidden()

                            Text("Сумма попадёт в доход месяца выбранной даты.")
                                .font(.rounded(11.5))
                                .foregroundStyle(Palette.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(16)
                        .studioCard()

                        Button("Сохранить") { save() }
                            .buttonStyle(SageButtonStyle(filled: true))

                        Color.clear.frame(height: 4)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Дата оплаты")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .font(.rounded(16, .medium))
                        .tint(Palette.inkSoft)
                }
            }
            .task {
                if let key = subscription?.paidDate, let value = RU.date(fromKey: key) {
                    date = value
                } else if let key = subscription?.purchaseDate, let value = RU.date(fromKey: key) {
                    date = value
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private func save() {
        store.setPaidDate(subscriptionID, date: RU.key(date))
        dismiss()
    }
}
