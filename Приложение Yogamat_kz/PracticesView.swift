//
//  PracticesView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct PracticesView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var filter: PracticeGroup?

    private var practices: [Practice] {
        PracticeLibrary.shared.practices
    }

    private var items: [Practice] {
        guard let filter else { return practices }
        return practices.filter { $0.group == filter }
    }

    private var durationRange: String {
        let durations = practices.map(\.durationMinutes)
        guard let min = durations.min(), let max = durations.max() else { return "" }
        return "\(min)–\(max) минут"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Комплексы для занятий")
                                .font(.rounded(24, .bold))
                                .foregroundStyle(Palette.ink)
                            Text("\(practices.count) практик · \(durationRange)")
                                .font(.rounded(13))
                                .foregroundStyle(Palette.inkSoft)
                        }
                        .padding(.top, 4)

                        filters

                        VStack(spacing: 10) {
                            ForEach(items) { practice in
                                NavigationLink(value: PracticeRoute.practice(practice.id)) {
                                    card(practice)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        Color.clear.frame(height: 4)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 8)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Практики")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .navigationDestination(for: PracticeRoute.self) { route in
                switch route.kind {
                case .practice(let id):
                    if let practice = PracticeLibrary.shared.practice(id) {
                        PracticeDetailView(practice: practice)
                    }
                case .asana(let id):
                    if let asana = AsanaLibrary.shared.asana(id) {
                        AsanaDetailView(asana: asana)
                    }
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterPill(title: "Все", selected: filter == nil) {
                    filter = nil
                }
                ForEach(PracticeGroup.allCases) { group in
                    FilterPill(title: group.title, selected: filter == group) {
                        filter = group
                    }
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func card(_ practice: Practice) -> some View {
        HStack(spacing: 12) {
            AsanaImageView(imageKey: practice.coverPose, maxSide: 260)
                .frame(width: 76, height: 92)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                PracticeGroupPill(group: practice.group)
                Text(practice.title)
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text("\(practice.durationMinutes) мин · \(practice.stages.count) этапов")
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
                Text(practice.goal)
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 6)

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Palette.inkSoft.opacity(0.5))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }
}

struct PracticeDetailView: View {
    let practice: Practice

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                AsanaImageView(imageKey: practice.coverPose, maxSide: 1200)
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                header

                textCard(title: "Задача", text: practice.goal)
                textCard(title: "Подходит", text: practice.suitable)
                textCard(title: "Оборудование", text: practice.equipment)
                if !practice.readiness.isEmpty {
                    textCard(title: "Готовность к переходу", text: practice.readiness)
                }
                if !practice.focus.isEmpty {
                    focusCard
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("План занятия")
                        .font(.rounded(17, .semibold))
                        .foregroundStyle(Palette.ink)
                        .padding(.horizontal, 4)

                    ForEach(practice.stages.indices, id: \.self) { index in
                        stageCard(index: index)
                    }
                }

                Color.clear.frame(height: 4)
            }
            .padding(18)
        }
        .scrollIndicators(.hidden)
        .navigationTitle(practice.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(practice.title)
                .font(.rounded(24, .bold))
                .foregroundStyle(Palette.ink)
            HStack(spacing: 8) {
                PracticeGroupPill(group: practice.group)
                Text("\(practice.durationMinutes) мин")
                    .font(.rounded(12.5, .medium))
                    .foregroundStyle(Palette.sageDeep)
            }
        }
    }

    private var focusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ориентиры")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            ForEach(practice.focus.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                        .font(.rounded(12.5, .semibold))
                        .foregroundStyle(Palette.sageDeep)
                        .frame(minWidth: 10, alignment: .leading)
                    Text(practice.focus[index])
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

    private func stageCard(index: Int) -> some View {
        let stage = practice.stages[index]
        let start = practice.stages.prefix(index).reduce(0) { $0 + $1.minutes }
        let end = start + stage.minutes

        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(start)–\(end) мин")
                    .font(.rounded(12, .medium))
                    .foregroundStyle(Palette.sageDeep)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Palette.sageTint))
                Text(stage.title)
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.ink)
                Spacer(minLength: 4)
            }

            Text(stage.action)
                .font(.rounded(13))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)

            labeledLine(title: "Техника", text: stage.technique)
            labeledLine(title: "Ощущения", text: stage.sensations)
            labeledLine(title: "Если сложно", text: stage.adaptation)

            if !stage.poses.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(stage.poses, id: \.self) { poseID in
                            NavigationLink(value: PracticeRoute.asana(poseID)) {
                                Text(AsanaLibrary.shared.asana(poseID)?.russian ?? poseID)
                                    .font(.rounded(11.5, .medium))
                                    .foregroundStyle(Palette.sageDeep)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 5)
                                    .background(Capsule().fill(Palette.sageTint.opacity(0.7)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .studioCard()
    }

    private func labeledLine(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.rounded(11.5, .medium))
                .foregroundStyle(Palette.inkSoft)
            Text(text)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
