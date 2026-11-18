//
//  DebtsView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

/// Все абонементы без отметки оплаты.
struct DebtsView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var sheet: Sheet?
    @State private var pdfURL: URL?

    enum Sheet: Identifiable {
        case client(UUID)

        var id: String {
            switch self {
            case .client(let id): return "client-\(id.uuidString)"
            }
        }
    }

    private var debts: [Subscription] {
        store.subscriptions
            .filter { !$0.paid }
            .sorted { first, second in
                if first.purchaseDate != second.purchaseDate {
                    return first.purchaseDate > second.purchaseDate
                }
                return first.tariffName.localizedStandardCompare(second.tariffName) == .orderedAscending
            }
    }

    private var total: Double {
        debts.reduce(0) { $0 + $1.price }
    }

    private var clientsCount: Int {
        Set(debts.map(\.clientID)).count
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header

                    if debts.isEmpty {
                        EmptyHintCard(
                            icon: "wallet.pass",
                            title: "Неоплаченных абонементов нет",
                            message: "Все абонементы отмечены оплаченными."
                        )
                    } else {
                        summaryCard
                        listSection
                    }

                    Color.clear.frame(height: 6)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .presentationBackground(Palette.canvas)
        .onAppear { refreshPDF() }
        .onChange(of: store.subscriptions) { _, _ in refreshPDF() }
        .sheet(item: $sheet) { item in
            switch item {
            case .client(let id):
                ClientDetailView(clientID: id)
            }
        }
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

            Text("Долги")
                .font(.rounded(28, .bold))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 4)
            pdfButton
        }
        .padding(.top, 4)
    }

    private var pdfButton: some View {
        Group {
            if let pdfURL {
                ShareLink(item: pdfURL) {
                    pdfLabel
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Долги в PDF")
            } else {
                pdfLabel
                    .opacity(0.45)
                    .accessibilityLabel("Долги в PDF")
            }
        }
    }

    private var pdfLabel: some View {
        ZStack {
            Circle().fill(Palette.card)
            Image(systemName: "printer")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Palette.ink)
        }
        .frame(width: 44, height: 44)
    }

    private func refreshPDF() {
        pdfURL = DebtsPDF.make(store: store)
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Не отмечена оплата")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)

            Text(RU.moneyPrefix(total))
                .font(.rounded(32, .bold))
                .foregroundStyle(Palette.terracotta)
                .lineLimit(1)
                .minimumScaleFactor(0.6)

            Text("\(debts.count) \(RUPlural.abonements(debts.count)) у \(clientsCount) \(RUPlural.clients(clientsCount))")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .studioCard()
    }

    private var listSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Клиенты")
                    .font(.rounded(19, .bold))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text("новые сверху")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(debts) { subscription in
                    Button {
                        sheet = .client(subscription.clientID)
                    } label: {
                        row(subscription)
                    }
                    .buttonStyle(.plain)

                    if subscription.id != debts.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 70)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .studioCard()
        }
    }

    private func row(_ subscription: Subscription) -> some View {
        let name = store.client(subscription.clientID)?.name ?? "—"

        return HStack(spacing: 12) {
            AvatarView(name: name, size: 40)

            VStack(alignment: .leading, spacing: 3) {
                Text(name)
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.ink)
                Text("«\(subscription.tariffName)» · куплен \(RU.shortDate(subscription.purchaseDate))")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)

            Text(RU.moneyPrefix(subscription.price))
                .font(.rounded(13.5, .semibold))
                .foregroundStyle(Palette.terracotta)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Palette.inkSoft.opacity(0.5))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
