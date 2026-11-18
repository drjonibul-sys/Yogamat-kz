//
//  AsanaCatalogView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct AsanaCatalogView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var search = ""
    @State private var level: Int?
    @State private var favoritesOnly = false

    private let gridColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private var items: [Asana] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return AsanaLibrary.shared.asanas.filter { asana in
            if let level, asana.level != level { return false }
            if favoritesOnly, !store.favoriteAsanaIDs.contains(asana.id) { return false }
            guard !query.isEmpty else { return true }
            return asana.russian.localizedCaseInsensitiveContains(query)
                || asana.transcription.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        warningCard
                        searchField
                        filters

                        if favoritesOnly, store.favoriteAsanaIDs.isEmpty {
                            EmptyHintCard(
                                icon: "heart",
                                title: "В избранном пусто",
                                message: "Отметьте асану сердечком, чтобы вернуться к ней позже."
                            )
                        } else if items.isEmpty {
                            EmptyHintCard(
                                icon: "magnifyingglass",
                                title: "Ничего не нашли",
                                message: "Измените запрос или выберите другой уровень."
                            )
                        } else {
                            LazyVGrid(columns: gridColumns, spacing: 12) {
                                ForEach(items) { asana in
                                    cell(asana)
                                }
                            }
                        }
                        Color.clear.frame(height: 4)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 8)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Справочник асан")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .navigationDestination(for: String.self) { id in
                if let asana = AsanaLibrary.shared.asana(id) {
                    AsanaDetailView(asana: asana)
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var warningCard: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Palette.sageDeep)
            Text("Справочник знакомит с асанами и не заменяет занятие с преподавателем. Двигайтесь без боли, дышите свободно, выбирайте опоры. При беременности, травмах или хронических заболеваниях подбирайте практику индивидуально. Сложные балансы и стойки осваивайте с преподавателем.")
                .font(.rounded(12))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Palette.powderTint.opacity(0.6))
        )
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Palette.inkSoft)
            TextField("Поиск по названию…", text: $search)
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

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterPill(
                    title: "Все \(AsanaLibrary.shared.asanas.count)",
                    selected: level == nil && !favoritesOnly
                ) {
                    level = nil
                    favoritesOnly = false
                }
                FilterPill(
                    title: "Лёгкий \(AsanaLibrary.shared.levelCount(1))",
                    selected: level == 1 && !favoritesOnly
                ) {
                    level = 1
                    favoritesOnly = false
                }
                FilterPill(
                    title: "Средний \(AsanaLibrary.shared.levelCount(2))",
                    selected: level == 2 && !favoritesOnly
                ) {
                    level = 2
                    favoritesOnly = false
                }
                FilterPill(
                    title: "Тяжёлый \(AsanaLibrary.shared.levelCount(3))",
                    selected: level == 3 && !favoritesOnly
                ) {
                    level = 3
                    favoritesOnly = false
                }
                FilterPill(
                    title: "Избранное \(store.favoriteAsanaIDs.count)",
                    selected: favoritesOnly
                ) {
                    favoritesOnly.toggle()
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func cell(_ asana: Asana) -> some View {
        ZStack(alignment: .topTrailing) {
            NavigationLink(value: asana.id) {
                cardContent(asana)
            }
            .buttonStyle(.plain)

            Button {
                store.toggleFavoriteAsana(asana.id)
            } label: {
                Image(systemName: store.favoriteAsanaIDs.contains(asana.id) ? "heart.fill" : "heart")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(store.favoriteAsanaIDs.contains(asana.id) ? Palette.terracotta : Palette.inkSoft)
                    .padding(7)
                    .background(Circle().fill(Color.white.opacity(0.9)))
            }
            .buttonStyle(.plain)
            .padding(8)
        }
    }

    private func cardContent(_ asana: Asana) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsanaImageView(imageKey: asana.imageKey, maxSide: 420)
                .frame(height: 116)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            Text(asana.russian)
                .font(.rounded(13.5, .semibold))
                .foregroundStyle(Palette.ink)
                .lineLimit(2)
                .frame(height: 34, alignment: .topLeading)

            Text(asana.transcription)
                .font(.rounded(11))
                .foregroundStyle(Palette.inkSoft)
                .lineLimit(1)

            LevelPill(level: asana.levelTitle)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }
}

struct AsanaDetailView: View {
    @Environment(StudioStore.self) private var store

    let asana: Asana

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                AsanaImageView(imageKey: asana.imageKey, maxSide: 1400)
                    .frame(height: 290)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                header

                Text(asana.summary)
                    .font(.rounded(14))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .studioCard()

                if !asana.steps.isEmpty {
                    section(title: "Техника", ordered: true, items: asana.steps)
                }
                if !asana.attention.isEmpty {
                    section(title: "Важно", ordered: false, items: asana.attention)
                }
                if !asana.modifications.isEmpty {
                    textCard(title: "Упрощения", text: asana.modifications)
                }
                if !asana.caution.isEmpty {
                    textCard(title: "Ограничения", text: asana.caution)
                }
                if !asana.duration.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ориентировочное время")
                            .font(.rounded(12.5))
                            .foregroundStyle(Palette.inkSoft)
                        Text(asana.duration)
                            .font(.rounded(14, .medium))
                            .foregroundStyle(Palette.ink)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .studioCard()
                }
                if !asana.sources.isEmpty {
                    sourcesCard
                }
                Color.clear.frame(height: 4)
            }
            .padding(18)
        }
        .scrollIndicators(.hidden)
        .navigationTitle(asana.russian)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(asana.russian)
                    .font(.rounded(24, .bold))
                    .foregroundStyle(Palette.ink)
                Text(asana.transcription)
                    .font(.rounded(14))
                    .foregroundStyle(Palette.inkSoft)
                Text("\(asana.hindi) · \(asana.sanskritLatin)")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft.opacity(0.9))
            }
            Spacer(minLength: 8)
            Button {
                store.toggleFavoriteAsana(asana.id)
            } label: {
                Image(systemName: store.favoriteAsanaIDs.contains(asana.id) ? "heart.fill" : "heart")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(store.favoriteAsanaIDs.contains(asana.id) ? Palette.terracotta : Palette.inkSoft)
                    .frame(width: 38, height: 38)
                    .background(Circle().fill(Palette.card))
            }
            .buttonStyle(.plain)
        }
    }

    private func section(title: String, ordered: Bool, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            ForEach(items.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 8) {
                    Text(ordered ? "\(index + 1)." : "•")
                        .font(.rounded(12.5, .semibold))
                        .foregroundStyle(Palette.sageDeep)
                        .frame(minWidth: 16, alignment: .leading)
                    Text(items[index])
                        .font(.rounded(13))
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .studioCard()
    }

    private func textCard(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            Text(text)
                .font(.rounded(13))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .studioCard()
    }

    private var sourcesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Источники")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            ForEach(asana.sources, id: \.self) { source in
                if let url = URL(string: source.url) {
                    Link(destination: url) {
                        HStack(spacing: 6) {
                            Text(source.title)
                                .font(.rounded(12.5))
                                .foregroundStyle(Palette.sageDeep)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 4)
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Palette.sageDeep)
                        }
                    }
                } else {
                    Text(source.title)
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .studioCard()
    }
}
