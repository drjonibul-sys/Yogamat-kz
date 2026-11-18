//
//  OverviewView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct OverviewView: View {
    @Environment(StudioStore.self) private var store

    var openClients: () -> Void
    var openVisits: () -> Void

    @State private var sheet: OverviewSheet?

    enum OverviewSheet: Identifiable {
        case client(UUID)
        case addClient
        case newVisit(UUID?)
        case newSubscription(UUID)
        case rent
        case account

        var id: String {
            switch self {
            case .client(let id): return "client-\(id.uuidString)"
            case .addClient: return "addClient"
            case .newVisit(let id): return "visit-\(id?.uuidString ?? "new")"
            case .newSubscription(let id): return "sub-\(id.uuidString)"
            case .rent: return "rent"
            case .account: return "account"
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Доброе утро" }
        if hour < 18 { return "Добрый день" }
        return "Добрый вечер"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                statsRow
                if store.saveError != nil {
                    saveBanner
                }
                if store.isAdmin, store.rentSettings != nil, !store.unpaidRentPeriods.isEmpty {
                    rentReminderCard
                }
                if store.isAdmin, !unpaidSubscriptions.isEmpty {
                    unpaidCard
                }
                todayCard
                whoCard
                endingCard
                Color.clear.frame(height: 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $sheet) { item in
            switch item {
            case .client(let id):
                ClientDetailView(clientID: id)
            case .addClient:
                ClientEditor(client: nil)
            case .newVisit(let id):
                VisitEditor(initialClientID: id)
            case .newSubscription(let id):
                SubscriptionEditor(clientID: id)
            case .rent:
                RentView()
            case .account:
                AccountView()
            }
        }
    }

    // MARK: - Шапка

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(greeting)
                    .font(.rounded(30, .bold))
                    .foregroundStyle(Palette.ink)
                Text(RU.weekdayLong(Date()))
                    .font(.rounded(15))
                    .foregroundStyle(Palette.inkSoft)
                HStack(spacing: 6) {
                    BrandMark(size: 18)
                    Text(store.studioName)
                        .font(.rounded(14))
                        .foregroundStyle(Palette.inkSoft.opacity(0.9))
                }
            }
            Spacer(minLength: 0)
            Button {
                sheet = .account
            } label: {
                AvatarView(name: store.currentUser?.name ?? "", size: 50)
                    .overlay(
                        Circle().strokeBorder(Palette.sage.opacity(0.35), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 4)
    }

    private var saveBanner: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 13, weight: .semibold))
            Text(store.saveError ?? "")
                .font(.rounded(12.5))
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(Palette.terracotta)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Palette.powderTint)
        )
    }

    // MARK: - Показатели

    private var statsRow: some View {
        HStack(alignment: .top, spacing: 10) {
            StatCard(
                icon: "person.2.fill",
                title: "Клиентов",
                value: "\(store.clients.count)",
                caption: nil,
                background: Palette.sageTint,
                iconColor: Palette.sageDeep
            )
            StatCard(
                icon: "calendar",
                title: "Занятий сегодня",
                value: "\(store.todayVisits.count)",
                caption: nil,
                background: Palette.card,
                iconColor: Palette.inkSoft
            )
            StatCard(
                icon: "ticket",
                title: "Заканчиваются",
                value: "\(store.endingSoon.count)",
                caption: RUPlural.abonements(store.endingSoon.count),
                background: Palette.powderTint,
                iconColor: Palette.terracotta,
                captionColor: Palette.terracotta
            )
        }
    }

    // MARK: - Аренда

    private var rentReminderCard: some View {
        let amount = store.rentSettings?.monthlyAmount ?? 0

        return Button {
            sheet = .rent
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Palette.powderTint)
                    Image(systemName: "house.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.terracotta)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Аренда · \(RU.moneyPrefix(amount))")
                        .font(.rounded(14.5, .semibold))
                        .foregroundStyle(Palette.ink)
                    Text(rentReminderLine(current: store.currentRentPeriod, missed: store.missedRentPeriods))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.terracotta)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(14)
            .studioCard()
        }
        .buttonStyle(.plain)
    }

    private func rentReminderLine(current: RentPeriod?, missed: [RentPeriod]) -> String {
        var parts: [String] = []
        if let current, !current.paid {
            parts.append("\(RU.monthYearLower(year: current.year, month: current.month)) не оплачена")
        } else {
            parts.append("Не оплачено периодов: \(store.unpaidRentPeriods.count)")
        }
        if !missed.isEmpty {
            let names = missed.prefix(3).map { RU.monthYearLower(year: $0.year, month: $0.month) }
            let tail = missed.count > 3 ? " и ещё \(missed.count - 3)" : ""
            parts.append("Пропущено: " + names.joined(separator: ", ") + tail)
        }
        return parts.joined(separator: " · ")
    }

    // MARK: - Не отмечена оплата

    private var unpaidSubscriptions: [Subscription] {
        store.subscriptions
            .filter { !$0.paid }
            .sorted { first, second in
                if first.purchaseDate != second.purchaseDate {
                    return first.purchaseDate > second.purchaseDate
                }
                return first.tariffName.localizedStandardCompare(second.tariffName) == .orderedAscending
            }
    }

    private var unpaidCard: some View {
        let items = unpaidSubscriptions

        return VStack(alignment: .leading, spacing: 6) {
            sectionHeader("Не отмечена оплата", actionTitle: nil, action: nil)
                .padding(.horizontal, 18)
                .padding(.bottom, 4)

            ForEach(items) { subscription in
                Button {
                    sheet = .client(subscription.clientID)
                } label: {
                    unpaidRow(subscription)
                }
                .buttonStyle(.plain)

                if subscription.id != items.last?.id {
                    Divider()
                        .overlay(Palette.hairline)
                        .padding(.leading, 70)
                }
            }
            Color.clear.frame(height: 4)
        }
        .padding(.top, 17)
        .padding(.bottom, 14)
        .studioCard()
    }

    private func unpaidRow(_ subscription: Subscription) -> some View {
        let name = store.client(subscription.clientID)?.name ?? "—"

        return HStack(spacing: 10) {
            Button {
                sheet = .client(subscription.clientID)
            } label: {
                HStack(spacing: 12) {
                    AvatarView(name: name, size: 40)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(name)
                            .font(.rounded(15, .semibold))
                            .foregroundStyle(Palette.ink)
                        Text("«\(subscription.tariffName)» · куплен \(RU.shortDate(subscription.purchaseDate))")
                            .font(.rounded(12.5))
                            .foregroundStyle(Palette.terracotta)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 6)

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Palette.inkSoft.opacity(0.5))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Button {
                store.setPaid(subscription.id, paid: true)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Оплачено")
                        .font(.rounded(12, .semibold))
                }
                .foregroundStyle(Palette.sageDeep)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Capsule().fill(Palette.sageTint))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Отметить оплату")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
    }

    // MARK: - Сегодня в студии

    private var todayCard: some View {        VStack(spacing: 0) {
            sectionHeader("Сегодня в студии", actionTitle: "Все визиты", action: openVisits)
                .padding(.horizontal, 18)
                .padding(.top, 17)
                .padding(.bottom, 6)

            if store.todayVisits.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Сегодня ещё никого не отметили")
                        .font(.rounded(14, .medium))
                        .foregroundStyle(Palette.ink)
                    Text("Отметьте визит — занятие спишется с абонемента клиента.")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 16)
            } else {
                ForEach(store.todayVisits) { visit in
                    visitRow(visit)
                    if visit.id != store.todayVisits.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 18)
                    }
                }
                Color.clear.frame(height: 4)
            }
        }
        .studioCard()
    }

    private func visitRow(_ visit: Visit) -> some View {
        let latest = store.todayVisits.first
        return Button {
            sheet = .client(visit.clientID)
        } label: {
            HStack(spacing: 12) {
                Text(RU.time(visit.createdAt))
                    .font(.rounded(19, .bold))
                    .foregroundStyle(Palette.ink)
                    .frame(width: 62, alignment: .leading)

                VStack(alignment: .leading, spacing: 3) {
                    Text(store.client(visit.clientID)?.name ?? "—")
                        .font(.rounded(15, .semibold))
                        .foregroundStyle(Palette.ink)
                    Text(subtitle(for: visit))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)

                if latest?.id == visit.id, Date().timeIntervalSince(visit.createdAt) < 7200 {
                    Text("Сейчас")
                        .font(.rounded(12, .medium))
                        .foregroundStyle(Palette.sageDeep)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Palette.sageTint))
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func subtitle(for visit: Visit) -> String {
        if let subscription = store.subscription(visit.subscriptionID) {
            return "\(subscription.tariffName) · осталось \(subscription.visitsLeft) из \(subscription.visitsTotal)"
        }
        return "визит"
    }

    // MARK: - Кого отметить

    private var whoCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Кого отметить", actionTitle: "Все клиенты", action: openClients)
                .padding(.horizontal, 18)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(store.clientsWithActiveSubscription) { client in
                        Button {
                            sheet = .newVisit(client.id)
                        } label: {
                            quickPerson(client)
                        }
                        .buttonStyle(.plain)
                    }

                    if store.isAdmin {
                        Button {
                            sheet = .addClient
                        } label: {
                            VStack(spacing: 8) {
                                ZStack {
                                    Circle()
                                        .strokeBorder(
                                            Palette.sage.opacity(0.55),
                                            style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])
                                        )
                                    Image(systemName: "plus")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(Palette.sageDeep)
                                }
                                .frame(width: 48, height: 48)

                                Text("Добавить\nклиента")
                                    .font(.rounded(11.5, .medium))
                                    .foregroundStyle(Palette.sageDeep)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                            }
                            .frame(width: 66)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 4)
            }
        }
        .padding(.top, 17)
        .padding(.bottom, 16)
        .studioCard()
    }

    private func quickPerson(_ client: Client) -> some View {
        VStack(spacing: 8) {
            AvatarView(name: client.name, size: 48)
            Text(shortName(client.name))
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(width: 66)
    }

    // MARK: - Скоро закончатся абонементы

    private var endingCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeader("Скоро закончатся абонементы", actionTitle: nil, action: nil)
                .padding(.horizontal, 18)
                .padding(.bottom, 4)

            if store.endingSoon.isEmpty {
                Text("Пока ни у кого не заканчивается абонемент.")
                    .font(.rounded(13.5))
                    .foregroundStyle(Palette.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 8)
            } else {
                ForEach(store.endingSoon) { item in
                    Button {
                        sheet = .client(item.client.id)
                    } label: {
                        endingRow(item)
                    }
                    .buttonStyle(.plain)

                    if item.id != store.endingSoon.last?.id {
                        Divider()
                            .overlay(Palette.hairline)
                            .padding(.leading, 70)
                    }
                }
                Color.clear.frame(height: 4)
            }
        }
        .padding(.top, 17)
        .padding(.bottom, 14)
        .studioCard()
    }

    private func endingRow(_ item: EndingSoonItem) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: item.client.name, size: 40)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.client.name)
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.ink)
                Text(item.reason)
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.terracotta)
            }
            Spacer(minLength: 6)

            Text("до \(RU.longDay(item.subscription.expiryDate))")
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Palette.inkSoft.opacity(0.5))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    // MARK: - Помощники

    private func sectionHeader(_ title: String, actionTitle: String?, action: (() -> Void)?) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.rounded(17, .semibold))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 8)
            if let actionTitle, let action {
                Button(action: action) {
                    HStack(spacing: 3) {
                        Text(actionTitle)
                            .font(.rounded(13))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(Palette.inkSoft)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
