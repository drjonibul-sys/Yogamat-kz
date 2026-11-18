//
//  ClientsView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct ClientsView: View {
    @Environment(StudioStore.self) private var store

    @State private var search = ""
    @State private var filter: ClientFilter = .all
    @State private var sheet: Sheet?
    @State private var pendingClientID: UUID?
    @State private var exportURL: URL?
    @AppStorage("clients.sort") private var sortRaw = ClientSort.name.rawValue

    enum ClientSort: String, CaseIterable, Identifiable {
        case name
        case lastVisit

        var id: String { rawValue }

        var title: String {
            switch self {
            case .name: return "По имени"
            case .lastVisit: return "По последнему визиту"
            }
        }
    }

    private var sort: ClientSort {
        ClientSort(rawValue: sortRaw) ?? .name
    }

    enum ClientFilter: String, CaseIterable, Identifiable {
        case all
        case withoutSubscription
        case unpaid

        var id: String { rawValue }

        var title: String {
            switch self {
            case .all: return "Все"
            case .withoutSubscription: return "Без абонемента"
            case .unpaid: return "Не оплачено"
            }
        }
    }

    enum Sheet: Identifiable {
        case client(UUID)
        case add
        case quickSale

        var id: String {
            switch self {
            case .client(let id): return "client-\(id.uuidString)"
            case .add: return "add"
            case .quickSale: return "quickSale"
            }
        }
    }

    private var query: String {
        search.trimmingCharacters(in: .whitespaces)
    }

    private var digits: String {
        query.filter { $0.isNumber }
    }

    private var isFiltering: Bool {
        filter != .all || !query.isEmpty
    }

    private var filtered: [Client] {
        var list = store.clients
        switch filter {
        case .all:
            break
        case .withoutSubscription:
            list = list.filter { store.activeSubscription(for: $0.id) == nil }
        case .unpaid:
            list = list.filter { hasUnpaidSubscription($0) }
        }
        if !query.isEmpty {
            list = list.filter { client in
                if client.name.localizedCaseInsensitiveContains(query) { return true }
                guard !digits.isEmpty else { return false }
                return phoneDigits(client.phone).contains(digits)
            }
        }
        return list.sorted(by: isOrderedBefore)
    }

    private func isOrderedBefore(_ first: Client, _ second: Client) -> Bool {
        switch sort {
        case .name:
            return first.name.localizedStandardCompare(second.name) == .orderedAscending
        case .lastVisit:
            let firstKey = store.visits(of: first.id).first?.date
            let secondKey = store.visits(of: second.id).first?.date
            if firstKey != secondKey {
                guard let firstKey else { return false }
                guard let secondKey else { return true }
                return firstKey > secondKey
            }
            return first.name.localizedStandardCompare(second.name) == .orderedAscending
        }
    }

    private func hasUnpaidSubscription(_ client: Client) -> Bool {
        store.subscriptions.contains { $0.clientID == client.id && !$0.paid }
    }

    private func phoneDigits(_ phone: String) -> String {
        phone.filter { $0.isNumber }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                headerRow
                searchField
                filterRow

                if filtered.isEmpty {
                    EmptyHintCard(
                        icon: isFiltering ? "magnifyingglass" : "person.crop.circle.badge.plus",
                        title: isFiltering ? "Никого не нашли" : "Пока нет клиентов",
                        message: emptyMessage
                    )
                } else {
                    VStack(spacing: 10) {
                        ForEach(filtered) { client in
                            Button {
                                sheet = .client(client.id)
                            } label: {
                                clientRow(client)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                Color.clear.frame(height: 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .scrollIndicators(.hidden)
        .onAppear { refreshExport() }
        .onChange(of: search) { _, _ in refreshExport() }
        .onChange(of: filter) { _, _ in refreshExport() }
        .onChange(of: store.clients) { _, _ in refreshExport() }
        .onChange(of: store.subscriptions) { _, _ in refreshExport() }
        .sheet(item: $sheet, onDismiss: openPendingClient) { item in
            switch item {
            case .client(let id):
                ClientDetailView(clientID: id)
            case .add:
                ClientEditor(client: nil)
            case .quickSale:
                QuickSaleView { clientID in
                    pendingClientID = clientID
                    sheet = nil
                }
            }
        }
    }

    private func openPendingClient() {
        guard let clientID = pendingClientID else { return }
        pendingClientID = nil
        sheet = .client(clientID)
    }

    private func refreshExport() {
        exportURL = ClientsCSV.make(clients: filtered, name: "Клиенты", store: store)
    }

    private var headerRow: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Клиенты")
                    .font(.rounded(30, .bold))
                    .foregroundStyle(Palette.ink)
                Text(countLabel)
                    .font(.rounded(14))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer()
            if store.isAdmin {
                HStack(spacing: 10) {
                    if let exportURL {
                        ShareLink(item: exportURL) {
                            Image(systemName: "tablecells")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Palette.sageDeep)
                                .frame(width: 44, height: 44)
                                .background(Circle().fill(Palette.sageTint))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Выгрузить в таблицу")
                    } else {
                        Image(systemName: "tablecells")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Palette.sageDeep)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Palette.sageTint))
                            .opacity(0.45)
                            .accessibilityLabel("Выгрузить в таблицу")
                    }

                    Button {
                        sheet = .quickSale
                    } label: {
                        Image(systemName: "ticket")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Palette.sageDeep)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Palette.sageTint))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Продать абонемент")

                    Button {
                        sheet = .add
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color.white)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Palette.sage))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var countLabel: String {
        let total = store.clients.count
        if isFiltering {
            return "\(filtered.count) из \(total) \(RUPlural.clients(total))"
        }
        return "\(total) \(RUPlural.clients(total))"
    }

    private var emptyMessage: String {
        switch filter {
        case .all:
            return "Добавьте первого клиента и продайте ему абонемент."
        case .withoutSubscription:
            return query.isEmpty
                ? "У всех клиентов есть действующий абонемент."
                : "Среди найденных у всех есть действующий абонемент."
        case .unpaid:
            return query.isEmpty
                ? "У всех клиентов оплата отмечена."
                : "Среди найденных оплата отмечена у всех."
        }
    }

    private var filterRow: some View {
        HStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ClientFilter.allCases) { item in
                        FilterPill(title: item.title, selected: filter == item) {
                            withAnimation(.snappy(duration: 0.18)) {
                                filter = item
                            }
                        }
                    }
                }
                .padding(.horizontal, 2)
            }

            Menu {
                ForEach(ClientSort.allCases) { item in
                    Button {
                        sortRaw = item.rawValue
                    } label: {
                        if item == sort {
                            Label(item.title, systemImage: "checkmark")
                        } else {
                            Text(item.title)
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 11, weight: .semibold))
                    Text(sort == .name ? "По имени" : "По визитам")
                        .font(.rounded(12.5, .medium))
                        .lineLimit(1)
                }
                .foregroundStyle(Palette.inkSoft)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Capsule().fill(Palette.card))
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Palette.inkSoft)
            TextField("Поиск по имени или телефону…", text: $search)
                .font(.rounded(15))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !search.isEmpty {
                Button {
                    search = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Palette.inkSoft)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Palette.card)
        )
    }

    private func clientRow(_ client: Client) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: client.name, size: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(client.name)
                    .font(.rounded(15.5, .semibold))
                    .foregroundStyle(Palette.ink)
                Text(subtitle(for: client))
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)

            if let subscription = store.activeSubscription(for: client.id) {
                Text("\(subscription.visitsLeft) из \(subscription.visitsTotal)")
                    .font(.rounded(12, .medium))
                    .foregroundStyle(Palette.sageDeep)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Palette.sageTint))
            } else {
                Text("нет абонемента")
                    .font(.rounded(11.5))
                    .foregroundStyle(Palette.inkSoft)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }

    private func subtitle(for client: Client) -> String {
        if !client.phone.isEmpty { return client.phone }
        return "клиент с \(RU.longDay(client.since))"
    }
}
