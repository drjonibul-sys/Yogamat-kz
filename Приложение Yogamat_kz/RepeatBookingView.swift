//
//  RepeatBookingView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct RepeatBookingView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let classID: UUID
    let dateKey: String
    let clientID: UUID

    @State private var weeks = 4
    @State private var errorMessage: String?
    @State private var alertTitle: String?
    @State private var alertText = ""
    @State private var shouldClose = false

    private var item: StudioClass? { store.studioClass(classID) }
    private var client: Client? { store.client(clientID) }
    private var subscription: Subscription? { store.activeSubscription(for: clientID) }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        summaryCard
                        LabeledField("Повторять на") {
                            HStack {
                                Text("\(weeks) \(RUPlural.weeks(weeks))")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $weeks, in: 1...12)
                                    .labelsHidden()
                            }
                        }
                        Text("Записи создаются на те же дни недели и время, что у занятия, на выбранный срок. Уже существующие записи и полные группы пропускаются.")
                            .font(.rounded(12))
                            .foregroundStyle(Palette.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 4)
                        Color.clear.frame(height: 4)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Повторять")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .tint(Palette.inkSoft)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Повторить") { repeatBooking() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .alert(alertTitle ?? "", isPresented: alertBinding) {
                Button("Хорошо", role: .cancel) {
                    if shouldClose { dismiss() }
                }
            } message: {
                Text(alertText)
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { alertTitle != nil },
            set: { if !$0 {
                alertTitle = nil
                alertText = ""
                shouldClose = false
            } }
        )
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item?.name ?? "Занятие")
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)
            Text(client?.name ?? "Клиент")
                .font(.rounded(13.5))
                .foregroundStyle(Palette.inkSoft)
            if let subscription {
                Text("«\(subscription.tariffName)» · осталось \(subscription.visitsLeft) из \(subscription.visitsTotal) занятий")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .studioCard()
    }

    private func repeatBooking() {
        do {
            let result = try store.repeatBooking(
                clientID: clientID,
                classID: classID,
                from: dateKey,
                weeks: weeks
            )
            alertTitle = "Готово"
            alertText = "Создано \(result.created) \(RUPlural.classes(result.created)), пропущено \(result.skipped) \(RUPlural.classes(result.skipped))."
            shouldClose = true
        } catch let error {
            errorMessage = error.localizedDescription
            alertTitle = "Не получилось"
            alertText = error.localizedDescription
            shouldClose = false
        }
    }
}
