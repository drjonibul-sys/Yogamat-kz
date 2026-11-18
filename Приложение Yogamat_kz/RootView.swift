//
//  RootView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

enum AppTab: String, CaseIterable {
    case overview
    case clients
    case visits
    case income
    case classes

    var title: String {
        switch self {
        case .overview: return "Обзор"
        case .clients: return "Клиенты"
        case .visits: return "Визиты"
        case .income: return "Доход"
        case .classes: return "Классы"
        }
    }

    var icon: String {
        switch self {
        case .overview: return "house.fill"
        case .clients: return "person.2.fill"
        case .visits: return "calendar"
        case .income: return "chart.bar.fill"
        case .classes: return "figure.mind.and.body"
        }
    }
}

struct RootView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    @State private var tab: AppTab = .overview

    private var visibleTabs: [AppTab] {
        AppTab.allCases.filter { $0 != .income || store.isAdmin }
    }

    var body: some View {
        ZStack {
            StudioBackground()
            Group {
                switch tab {
                case .overview:
                    OverviewView(
                        openClients: { tab = .clients },
                        openVisits: { tab = .visits }
                    )
                case .clients:
                    ClientsView()
                case .visits:
                    VisitsView()
                case .income:
                    if store.isAdmin {
                        IncomeView()
                    } else {
                        OverviewView(
                            openClients: { tab = .clients },
                            openVisits: { tab = .visits }
                        )
                    }
                case .classes:
                    ClassesView()
                }
            }
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            TabBar(tabs: visibleTabs, selection: $tab)
        }
        .onAppear {
            store.refreshRentWindow()
            store.maintainAutomaticBackup()
            Task {
                await ClassReminders.refresh(classes: store.classes)
                await PaymentReminders.refresh(unpaidCount: store.subscriptions.filter { !$0.paid }.count)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                store.refreshRentWindow()
                store.maintainAutomaticBackup()
                Task {
                await ClassReminders.refresh(classes: store.classes)
                await PaymentReminders.refresh(unpaidCount: store.subscriptions.filter { !$0.paid }.count)
            }
            }
        }
        .onChange(of: store.isAdmin) { _, isAdmin in
            if !isAdmin, tab == .income {
                tab = .overview
            }
        }
    }
}

struct TabBar: View {
    let tabs: [AppTab]
    @Binding var selection: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.self) { tab in
                Button {
                    withAnimation(.snappy(duration: 0.2)) {
                        selection = tab
                    }
                } label: {
                    VStack(spacing: 3) {
                        ZStack {
                            if selection == tab {
                                Circle().fill(Palette.sage)
                            }
                            Image(systemName: tab.icon)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(selection == tab ? Color.white : Palette.inkSoft)
                        }
                        .frame(width: 34, height: 34)

                        Text(tab.title)
                            .font(.rounded(10.5, selection == tab ? .semibold : .regular))
                            .foregroundStyle(selection == tab ? Palette.sageDeep : Palette.inkSoft)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 8)
        .background(
            Capsule(style: .continuous)
                .fill(Color.white.opacity(0.92))
                .shadow(color: Palette.ink.opacity(0.07), radius: 18, x: 0, y: 8)
        )
        .padding(.horizontal, 16)
        .frame(maxWidth: 520)
        .padding(.top, 4)
        .padding(.bottom, 4)
    }
}

#Preview {
    RootView()
        .environment(StudioStore.preview)
}
