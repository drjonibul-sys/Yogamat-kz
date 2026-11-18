//
//  VisitsView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct VisitsView: View {
    @Environment(StudioStore.self) private var store

    @State private var sheet: Sheet?
    @State private var classFilter: UUID?
    @State private var search = ""

    enum Sheet: Identifiable {
        case newVisit
        case client(UUID)
        case export

        var id: String {
            switch self {
            case .newVisit: return "new"
            case .client(let id): return "client-\(id.uuidString)"
            case .export: return "export"
            }
        }
    }

    private struct DaySection: Identifiable {
        let key: String
        let visits: [Visit]
        var id: String { key }
    }

    /// Фильтр, который всё ещё существует в справочнике направлений.
    private var activeFilter: UUID? {
        guard let classFilter, store.studioClass(classFilter) != nil else { return nil }
        return classFilter
    }

    private var isFiltering: Bool {
        activeFilter != nil || !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var filteredVisits: [Visit] {
        var list = store.visits
        if let activeFilter {
            list = list.filter { $0.classID == activeFilter }
        }
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            list = list.filter { visit in
                store.client(visit.clientID)?.name.localizedCaseInsensitiveContains(query) ?? false
            }
        }
        return list
    }

    private var sections: [DaySection] {
        Dictionary(grouping: filteredVisits, by: { $0.date })
            .map { DaySection(key: $0.key, visits: $0.value.sorted { $0.createdAt > $1.createdAt }) }
            .sorted { $0.key > $1.key }
    }

    private var usedClasses: [StudioClass] {
        let ids = Set(store.visits.compactMap { $0.classID })
        return store.classes
            .filter { ids.contains($0.id) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                searchField

                if !usedClasses.isEmpty || isFiltering {
                    filterChips
                }

                if store.visits.isEmpty {
                    EmptyHintCard(
                        icon: "calendar",
                        title: "Визитов пока нет",
                        message: "Отметьте первое посещение — занятие спишется с абонемента."
                    )
                } else if filteredVisits.isEmpty {
                    EmptyHintCard(
                        icon: "line.3.horizontal.decrease",
                        title: "Ничего не нашли",
                        message: "Измените имя клиента, выберите другое направление или сбросьте фильтры."
                    )
                } else {
                    ForEach(sections) { section in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(RU.dayTitle(section.key))
                                    .font(.rounded(15, .semibold))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Text("\(section.visits.count) \(RUPlural.visits(section.visits.count))")
                                    .font(.rounded(12))
                                    .foregroundStyle(Palette.inkSoft)
                            }
                            .padding(.horizontal, 4)

                            VStack(spacing: 0) {
                                ForEach(section.visits) { visit in
                                    visitRow(visit)
                                    if visit.id != section.visits.last?.id {
                                        Divider()
                                            .overlay(Palette.hairline)
                                            .padding(.leading, 16)
                                    }
                                }
                            }
                            .studioCard()
                        }
                    }
                }
                Color.clear.frame(height: 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $sheet) { item in
            switch item {
            case .newVisit:
                VisitEditor(initialClientID: nil)
            case .client(let id):
                ClientDetailView(clientID: id)
            case .export:
                VisitsExportView(visits: filteredVisits)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Визиты")
                    .font(.rounded(30, .bold))
                    .foregroundStyle(Palette.ink)
                Text(headerSubtitle)
                    .font(.rounded(14))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer()
            HStack(spacing: 10) {
                if store.isAdmin {
                    Button {
                        sheet = .export
                    } label: {
                        Image(systemName: "tablecells")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Palette.sageDeep)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(Palette.sageTint))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Выгрузить в таблицу")
                }

                Button {
                    sheet = .newVisit
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

    private var headerSubtitle: String {
        let total = store.visits.count
        if isFiltering {
            return "\(filteredVisits.count) из \(total) \(RUPlural.visits(total))"
        }
        return "\(total) \(RUPlural.visits(total)) всего"
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Palette.inkSoft)
            TextField("Поиск по имени клиента…", text: $search)
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
        .background(Capsule().fill(Palette.card))
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterPill(title: "Все", selected: activeFilter == nil && !isFiltering) {
                    classFilter = nil
                }
                ForEach(usedClasses) { item in
                    FilterPill(title: item.name, selected: activeFilter == item.id) {
                        classFilter = item.id
                    }
                }
                if isFiltering {
                    FilterPill(title: "Сбросить", selected: false) {
                        search = ""
                        classFilter = nil
                    }
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func visitRow(_ visit: Visit) -> some View {
        Button {
            sheet = .client(visit.clientID)
        } label: {
            HStack(spacing: 12) {
                Text(RU.time(visit.createdAt))
                    .font(.rounded(15, .bold))
                    .foregroundStyle(Palette.inkSoft)
                    .frame(width: 48, alignment: .leading)

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

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func subtitle(for visit: Visit) -> String {
        var parts: [String] = []
        if let classID = visit.classID, let item = store.studioClass(classID) {
            parts.append(item.name)
        }
        if let subscription = store.subscription(visit.subscriptionID) {
            parts.append(subscription.tariffName)
        }
        return parts.isEmpty ? "визит" : parts.joined(separator: " · ")
    }
}
