//
//  ClientDetailView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct ClientDetailView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let clientID: UUID

    @State private var sheet: ClientSheet?
    @State private var confirmDelete = false
    @State private var deleteError: String?

    enum ClientSheet: Identifiable {
        case subscription
        case renew
        case visit
        case transfer
        case edit
        case booking
        case paidDate(UUID)

        var id: String {
            switch self {
            case .subscription: return "subscription"
            case .renew: return "renew"
            case .visit: return "visit"
            case .transfer: return "transfer"
            case .edit: return "edit"
            case .booking: return "booking"
            case .paidDate(let id): return "paidDate-\(id.uuidString)"
            }
        }
    }

    private var client: Client? { store.client(clientID) }
    private var active: Subscription? { store.activeSubscription(for: clientID) }
    private var lastSubscription: Subscription? { store.subscriptions(of: clientID).first }
    private var pastSubscriptions: [Subscription] {
        store.subscriptions(of: clientID).filter { store.status(of: $0) != .active }
    }
    private var clientVisits: [Visit] { Array(store.visits(of: clientID).prefix(6)) }
    private var clientTransfers: [Transfer] { store.transfers(of: clientID) }

    private var subscriptionCount: Int { store.subscriptions(of: clientID).count }
    private var visitCount: Int { store.visits(of: clientID).count }
    private var transferCount: Int { store.transfers(of: clientID).count }

    private var deleteMessage: String {
        let name = client?.name ?? "клиента"
        return "Удалить \(name)? Вместе с ним исчезнут \(subscriptionCount) \(RUPlural.abonements(subscriptionCount)), \(visitCount) \(RUPlural.visits(visitCount)) и \(transferCount) \(RUPlural.transfers(transferCount)). Действие нельзя отменить: перед удалением сохранится резервная копия базы."
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        if let client {
                            profileCard(client)
                            if let active {
                                activeCard(active)
                            } else {
                                EmptyHintCard(
                                    icon: "ticket",
                                    title: "Нет активного абонемента",
                                    message: "Добавьте абонемент, чтобы отмечать посещения."
                                )
                            }
                            if !pastSubscriptions.isEmpty {
                                historyCard
                            }
                            visitsCard
                            if !clientTransfers.isEmpty {
                                transfersCard
                            }
                            if store.isAdmin {
                                deleteCard
                            }
                        } else {
                            Text("Клиент не найден")
                                .font(.rounded(15))
                                .foregroundStyle(Palette.inkSoft)
                                .padding(.top, 40)
                        }
                        Color.clear.frame(height: 4)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(client?.name ?? "Клиент")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .sheet(item: $sheet) { item in
                switch item {
                case .subscription:
                    SubscriptionEditor(clientID: clientID)
                case .visit:
                    VisitEditor(initialClientID: clientID)
                case .transfer:
                    TransferEditor(subscriptionID: active?.id ?? UUID())
                case .edit:
                    ClientEditor(client: client)
                case .renew:
                    SubscriptionEditor(clientID: clientID, previous: lastSubscription)
                case .booking:
                    ClientBookingView(clientID: clientID)
                case .paidDate(let id):
                    PaidDateEditor(subscriptionID: id)
                }
            }
            .confirmationDialog(
                "Удалить клиента?",
                isPresented: $confirmDelete,
                titleVisibility: .visible
            ) {
                Button("Удалить клиента", role: .destructive) { deleteClient() }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text(deleteMessage)
            }
            .alert(
                "Не получилось",
                isPresented: Binding(
                    get: { deleteError != nil },
                    set: { if !$0 { deleteError = nil } }
                )
            ) {
                Button("Хорошо", role: .cancel) {}
            } message: {
                Text(deleteError ?? "")
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var deleteCard: some View {
        Button(role: .destructive) {
            confirmDelete = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "trash")
                    .font(.system(size: 15, weight: .medium))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Удалить клиента")
                        .font(.rounded(15, .semibold))
                    Text("Вместе с абонементами и визитами")
                        .font(.rounded(11.5))
                        .opacity(0.85)
                }
                Spacer(minLength: 6)
            }
            .foregroundStyle(Palette.terracotta)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Palette.powderTint)
            )
        }
        .buttonStyle(.plain)
    }

    private func deleteClient() {
        guard let id = client?.id else { return }
        do {
            try store.deleteClient(id)
            dismiss()
        } catch let error {
            deleteError = error.localizedDescription
        }
    }

    // MARK: - Карточка клиента

    private func profileCard(_ client: Client) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                AvatarView(name: client.name, size: 54)

                VStack(alignment: .leading, spacing: 3) {
                    Text(client.name)
                        .font(.rounded(19, .semibold))
                        .foregroundStyle(Palette.ink)
                    if !client.phone.isEmpty {
                        Text(client.phone)
                            .font(.rounded(13.5))
                            .foregroundStyle(Palette.inkSoft)
                    }
                    Text("Клиент с \(RU.longDay(client.since))")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
                Spacer(minLength: 6)

                if store.isAdmin {
                    Button {
                        sheet = .edit
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Palette.sageDeep)
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(Palette.sageTint))
                    }
                    .buttonStyle(.plain)
                }
            }

            if !client.note.isEmpty {
                Text(client.note)
                    .font(.rounded(13.5))
                    .foregroundStyle(Palette.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button("Записать на занятие") { sheet = .booking }
                .buttonStyle(SageButtonStyle(filled: true))
                .disabled(active == nil)
                .opacity(active == nil ? 0.45 : 1)

            HStack(spacing: 10) {
                Button("Отметить визит") { sheet = .visit }
                    .buttonStyle(SageButtonStyle(filled: true))
                    .disabled(active == nil)
                    .opacity(active == nil ? 0.45 : 1)

                Button("Перенести") { sheet = .transfer }
                    .buttonStyle(SageButtonStyle(filled: false))
                    .disabled(active == nil)
                    .opacity(active == nil ? 0.45 : 1)
            }

            if store.isAdmin {
                if lastSubscription != nil {
                    Button("Продлить") { sheet = .renew }
                        .buttonStyle(SageButtonStyle(filled: true))
                }
                Button("Добавить абонемент") { sheet = .subscription }
                    .buttonStyle(SageButtonStyle(filled: false))
            }
        }
        .padding(18)
        .studioCard()
    }

    // MARK: - Активный абонемент

    private func activeCard(_ subscription: Subscription) -> some View {
        let progress = Double(subscription.visitsLeft) / Double(max(subscription.visitsTotal, 1))

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Абонемент")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                    Text(subscription.tariffName)
                        .font(.rounded(17, .semibold))
                        .foregroundStyle(Palette.ink)
                }
                Spacer(minLength: 8)
                StatusPill(status: store.status(of: subscription))
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Осталось \(subscription.visitsLeft) из \(subscription.visitsTotal)")
                        .font(.rounded(13.5, .medium))
                        .foregroundStyle(Palette.ink)
                    Spacer()
                    Text("\(Int((progress * 100).rounded()))%")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Palette.sageTint)
                        Capsule()
                            .fill(Palette.sage)
                            .frame(width: max(0, proxy.size.width * progress))
                    }
                }
                .frame(height: 8)
            }

            Divider().overlay(Palette.hairline)

            InfoRow(
                title: "Срок",
                value: "\(RU.shortDate(subscription.purchaseDate)) — \(RU.shortDate(subscription.expiryDate))"
            )
            InfoRow(title: "Действует", value: "до \(RU.longDay(subscription.expiryDate))")

            if store.isAdmin {
                InfoRow(title: "Цена", value: RU.money(subscription.price))
                paymentRow(subscription)
            }

            if let visit = clientVisits.first {
                InfoRow(title: "Последний визит", value: RU.longDay(visit.date))
            }
        }
        .padding(18)
        .studioCard()
    }

    private func paymentRow(_ subscription: Subscription) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Оплата")
                        .font(.rounded(13.5))
                        .foregroundStyle(Palette.ink)
                    Text(paymentText(subscription))
                        .font(.rounded(12.5))
                        .foregroundStyle(subscription.paid ? Palette.sageDeep : Palette.terracotta)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { subscription.paid },
                    set: { store.setPaid(subscription.id, paid: $0) }
                ))
                .toggleStyle(.switch)
                .labelsHidden()
                .tint(Palette.sage)
            }

            if subscription.paid {
                Button {
                    sheet = .paidDate(subscription.id)
                } label: {
                    HStack(spacing: 8) {
                        Text("Дата оплаты")
                            .font(.rounded(12.5))
                            .foregroundStyle(Palette.inkSoft)
                        Spacer(minLength: 6)
                        Text(subscription.paidDate.map(RU.shortDate) ?? "указать")
                            .font(.rounded(12.5, .medium))
                            .foregroundStyle(Palette.sageDeep)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Palette.inkSoft.opacity(0.5))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func paymentText(_ subscription: Subscription) -> String {
        guard subscription.paid else { return "не оплачено" }
        if let date = subscription.paidDate {
            return "оплачено \(RU.longDay(date))"
        }
        return "оплачено"
    }

    // MARK: - История

    private var historyCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Прошлые абонементы")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.bottom, 4)

            ForEach(pastSubscriptions) { subscription in
                HStack(alignment: .center, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(subscription.tariffName)
                            .font(.rounded(14, .semibold))
                            .foregroundStyle(Palette.ink)
                        Text("\(RU.shortDate(subscription.purchaseDate)) — \(RU.shortDate(subscription.expiryDate))")
                            .font(.rounded(12))
                            .foregroundStyle(Palette.inkSoft)
                    }
                    Spacer(minLength: 6)
                    StatusPill(status: store.status(of: subscription))
                }
                .padding(.vertical, 9)

                if subscription.id != pastSubscriptions.last?.id {
                    Divider().overlay(Palette.hairline)
                }
            }
        }
        .padding(18)
        .studioCard()
    }

    private var visitsCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Посещения")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.bottom, 4)

            if clientVisits.isEmpty {
                Text("Визитов пока нет.")
                    .font(.rounded(13.5))
                    .foregroundStyle(Palette.inkSoft)
                    .padding(.vertical, 6)
            } else {
                ForEach(clientVisits) { visit in
                    HStack(spacing: 10) {
                        Text(RU.longDay(visit.date))
                            .font(.rounded(13.5))
                            .foregroundStyle(Palette.ink)
                        Spacer(minLength: 6)
                        Text(RU.time(visit.createdAt))
                            .font(.rounded(12.5))
                            .foregroundStyle(Palette.inkSoft)
                    }
                    .padding(.vertical, 8)

                    if visit.id != clientVisits.last?.id {
                        Divider().overlay(Palette.hairline)
                    }
                }
            }
        }
        .padding(18)
        .studioCard()
    }

    private var transfersCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Переносы")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.bottom, 4)

            ForEach(clientTransfers) { transfer in
                VStack(alignment: .leading, spacing: 3) {
                    Text("+\(transfer.days) \(RUPlural.days(transfer.days)) · \(RU.longDay(transfer.date))")
                        .font(.rounded(13.5))
                        .foregroundStyle(Palette.ink)
                    if !transfer.note.isEmpty {
                        Text(transfer.note)
                            .font(.rounded(12.5))
                            .foregroundStyle(Palette.inkSoft)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)

                if transfer.id != clientTransfers.last?.id {
                    Divider().overlay(Palette.hairline)
                }
            }
        }
        .padding(18)
        .studioCard()
    }
}
