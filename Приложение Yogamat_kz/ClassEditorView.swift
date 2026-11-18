//
//  ClassEditorView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct ClassDirectionsView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var route: Route?

    enum Route: Identifiable {
        case new
        case edit(UUID)
        case info(UUID)

        var id: String {
            switch self {
            case .new: return "new"
            case .edit(let id): return "edit-\(id.uuidString)"
            case .info(let id): return "info-\(id.uuidString)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(ClassType.allCases, id: \.self) { type in
                            let items = store.orderedClasses.filter { $0.type == type }
                            section(type: type, items: items)
                        }
                        Color.clear.frame(height: 6)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Направления")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { dismiss() }
                        .tint(Palette.sageDeep)
                }
                ToolbarItem(placement: .primaryAction) {
                    if store.isAdmin {
                        Button {
                            route = .new
                        } label: {
                            Image(systemName: "plus")
                        }
                        .tint(Palette.sageDeep)
                    }
                }
            }
            .sheet(item: $route) { item in
                switch item {
                case .new:
                    ClassEditorView()
                case .edit(let id):
                    ClassEditorView(existing: store.studioClass(id))
                case .info(let id):
                    if let info = store.studioClass(id) {
                        ClassInfoView(item: info, dateKey: nextDate(for: info))
                    }
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private func section(type: ClassType, items: [StudioClass]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(type.title)
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text("\(items.count)")
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
            }
            .padding(.horizontal, 4)

            if items.isEmpty {
                Text("Пока нет направлений")
                    .font(.rounded(13))
                    .foregroundStyle(Palette.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .studioCard()
            } else {
                VStack(spacing: 0) {
                    ForEach(items) { item in
                        Button {
                            route = store.isAdmin ? .edit(item.id) : .info(item.id)
                        } label: {
                            row(item)
                        }
                        .buttonStyle(.plain)

                        if item.id != items.last?.id {
                            Divider()
                                .overlay(Palette.hairline)
                                .padding(.leading, 18)
                        }
                    }
                }
                .studioCard()
            }
        }
    }

    private func row(_ item: StudioClass) -> some View {
        HStack(alignment: .top, spacing: 10) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(item.type.accentColor)
                .frame(width: 4, height: 34)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.rounded(14.5, .semibold))
                    .foregroundStyle(Palette.ink)
                Text(facts(item))
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
                Text(schedule(item))
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)

            if !item.active {
                Text("не проводится")
                    .font(.rounded(11))
                    .foregroundStyle(Palette.terracotta)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private func facts(_ item: StudioClass) -> String {
        [item.level, "\(item.durationMin) мин", "до \(item.capacity) чел."].joined(separator: " · ")
    }

    private func schedule(_ item: StudioClass) -> String {
        var parts: [String] = []
        if !item.weekdays.isEmpty {
            parts.append(item.weekdaysLabel)
            parts.append(item.timeLabel)
        }
        if !item.hall.isEmpty { parts.append(item.hall) }
        let trainerName = store.trainerNames(for: item)
        if !trainerName.isEmpty { parts.append(trainerName) }
        return parts.isEmpty ? "Расписание не задано" : parts.joined(separator: " · ")
    }

    private func nextDate(for item: StudioClass) -> String {
        let today = Date()
        let todayIndex = RU.weekdayIndex(of: today)
        guard !item.weekdays.isEmpty else { return RU.key(today) }
        for offset in 0..<7 {
            let index = ((todayIndex - 1 + offset) % 7) + 1
            if item.weekdays.contains(index) {
                return RU.key(RU.date(byAddingDays: offset, to: today))
            }
        }
        return RU.key(today)
    }
}

struct ClassEditorView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let existing: StudioClass?
    let presetWeekday: Int?
    let bookingDateKey: String?

    @State private var name: String
    @State private var type: ClassType
    @State private var level: String
    @State private var durationMin: Int
    @State private var capacity: Int
    @State private var trainer: String
    @State private var trainerIDs: Set<UUID>
    @State private var hall: String
    @State private var weekdays: Set<Int>
    @State private var time: Date
    @State private var equipment: String
    @State private var details: String
    @State private var active: Bool
    @State private var errorMessage: String?
    @State private var confirmDelete = false
    @State private var actionSheet: ActionSheetKind?

    private let levels = ["Лёгкий", "Средний", "Продвинутый"]

    private enum ActionSheetKind: String, Identifiable {
        case booking
        case roster

        var id: String { rawValue }
    }

    init(existing: StudioClass? = nil, presetWeekday: Int? = nil, bookingDateKey: String? = nil) {
        self.existing = existing
        self.presetWeekday = presetWeekday
        self.bookingDateKey = bookingDateKey

        let base = existing
        let initialDays: Set<Int>
        if let base {
            initialDays = base.weekdays
        } else if let presetWeekday {
            initialDays = [presetWeekday]
        } else {
            initialDays = []
        }

        _name = State(initialValue: base?.name ?? "")
        _type = State(initialValue: base?.type ?? .yoga)
        _level = State(initialValue: base?.level ?? "Лёгкий")
        _durationMin = State(initialValue: base?.durationMin ?? 60)
        _capacity = State(initialValue: base?.capacity ?? 12)
        _trainer = State(initialValue: base?.trainer ?? "")
        _trainerIDs = State(initialValue: Set(base?.trainerIDs ?? []))
        _hall = State(initialValue: base?.hall ?? "зал №1")
        _weekdays = State(initialValue: initialDays)
        _time = State(initialValue: Self.timeDate(minutes: base?.startMinutes ?? 9 * 60))
        _equipment = State(initialValue: base?.equipment ?? "")
        _details = State(initialValue: base?.details ?? "")
        _active = State(initialValue: base?.active ?? true)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        if existing != nil {
                            VStack(spacing: 10) {
                                Button {
                                    actionSheet = .booking
                                } label: {
                                    Text("Записать на занятие")
                                        .font(.rounded(15.5, .semibold))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 14)
                                        .background(
                                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                                .fill(Palette.sageDeep)
                                        )
                                        .foregroundStyle(Color.white)
                                }
                                .buttonStyle(.plain)

                                Button {
                                    actionSheet = .roster
                                } label: {
                                    Text("Состав группы")
                                        .font(.rounded(15.5, .semibold))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 14)
                                        .background(
                                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                                .fill(Palette.sageTint)
                                        )
                                        .foregroundStyle(Palette.sageDeep)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        LabeledField("Название") {
                            TextField("Например: Хатха-йога", text: $name)
                                .textInputAutocapitalization(.sentences)
                        }

                        LabeledField("Вид") {
                            Picker("", selection: $type) {
                                ForEach(ClassType.allCases, id: \.self) { item in
                                    Text(item.title).tag(item)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        LabeledField("Уровень") {
                            HStack(spacing: 6) {
                                ForEach(levels, id: \.self) { item in
                                    Button {
                                        level = item
                                    } label: {
                                        Text(item)
                                            .font(.rounded(12.5, .medium))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 8)
                                            .background(
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .fill(level == item ? Palette.sage : Palette.sageTint.opacity(0.45))
                                            )
                                            .foregroundStyle(level == item ? Color.white : Palette.ink)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        if store.trainers.isEmpty {
                            LabeledField("Тренер") {
                                TextField("Например: Анна Ким", text: $trainer)
                            }
                        } else {
                            LabeledField("Тренеры") {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(store.trainers) { person in
                                            FilterPill(
                                                title: person.name,
                                                selected: trainerIDs.contains(person.id)
                                            ) {
                                                if trainerIDs.contains(person.id) {
                                                    trainerIDs.remove(person.id)
                                                } else {
                                                    trainerIDs.insert(person.id)
                                                }
                                            }
                                        }
                                    }
                                    .padding(.vertical, 1)
                                }
                            }
                        }
                        LabeledField("Зал") {
                            TextField("Например: зал №1", text: $hall)
                        }

                        LabeledField("Длительность") {
                            HStack {
                                Text("\(durationMin) мин")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $durationMin, in: 15...180, step: 5)
                                    .labelsHidden()
                            }
                        }
                        LabeledField("Мест в группе") {
                            HStack {
                                Text("\(capacity)")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $capacity, in: 1...40)
                                    .labelsHidden()
                            }
                        }

                        LabeledField("Дни недели") {
                            HStack(spacing: 5) {
                                ForEach(1...7, id: \.self) { day in
                                    Button {
                                        if weekdays.contains(day) {
                                            weekdays.remove(day)
                                        } else {
                                            weekdays.insert(day)
                                        }
                                    } label: {
                                        Text(RU.weekdayShortNames[day - 1])
                                            .font(.rounded(12.5, .medium))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 8)
                                            .background(
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .fill(weekdays.contains(day) ? Palette.sage : Palette.sageTint.opacity(0.45))
                                            )
                                            .foregroundStyle(weekdays.contains(day) ? Color.white : Palette.ink)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        LabeledField("Время начала") {
                            DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                        }

                        LabeledField("Оборудование") {
                            TextField("Например: коврик, блоки", text: $equipment)
                        }

                        LabeledField("Описание") {
                            TextField("О чём занятие, кому подходит", text: $details, axis: .vertical)
                                .lineLimit(3...6)
                        }

                        LabeledField("Проводится") {
                            Toggle("Направление проводится", isOn: $active)
                                .font(.rounded(16))
                                .tint(Palette.sage)
                        }

                        if existing != nil {
                            Button(role: .destructive) {
                                confirmDelete = true
                            } label: {
                                Text("Удалить занятие")
                                    .font(.rounded(15.5, .semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .background(
                                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                                            .fill(Palette.powderTint)
                                    )
                                    .foregroundStyle(Palette.terracotta)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(existing == nil ? "Новое занятие" : "Занятие")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .tint(Palette.inkSoft)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Сохранить") { save() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .alert("Проверьте данные", isPresented: alertBinding) {
                Button("Хорошо", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .confirmationDialog("Удалить занятие?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Удалить", role: .destructive) {
                    if let existing {
                        store.deleteClass(existing.id)
                        dismiss()
                    }
                }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text("Отметки посещений останутся в журнале.")
            }
            .sheet(item: $actionSheet) { action in
                if let existing {
                    switch action {
                    case .booking:
                        BookingView(classID: existing.id, dateKey: bookingDateKey ?? RU.key(Date()))
                    case .roster:
                        ClassRosterView(classID: existing.id, dateKey: bookingDateKey ?? RU.key(Date()))
                    }
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private static func timeDate(minutes: Int) -> Date {
        let calendar = RU.calendar
        let start = calendar.startOfDay(for: Date())
        return calendar.date(byAdding: .minute, value: minutes, to: start) ?? start
    }

    private func save() {
        var value = existing ?? StudioClass(name: name)
        value.name = name
        value.type = type
        value.level = level
        value.durationMin = durationMin
        value.capacity = capacity
        value.trainer = trainer
        value.trainerIDs = store.trainers.isEmpty ? nil : Array(trainerIDs)
        value.hall = hall
        value.weekdays = weekdays
        value.startMinutes = RU.minutes(from: time)
        value.equipment = equipment
        value.details = details
        value.active = active

        do {
            try store.saveClass(value)
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}

struct ClassInfoView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let item: StudioClass
    let dateKey: String

    @State private var actionSheet: ActionSheetKind?

    private enum ActionSheetKind: String, Identifiable {
        case booking
        case roster

        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.name)
                                .font(.rounded(22, .bold))
                                .foregroundStyle(Palette.ink)
                            HStack(spacing: 8) {
                                Text(item.type.title)
                                    .font(.rounded(12.5))
                                    .foregroundStyle(Palette.inkSoft)
                                LevelPill(level: item.level)
                                if !item.active {
                                    Text("не проводится")
                                        .font(.rounded(11.5))
                                        .foregroundStyle(Palette.terracotta)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(18)
                        .studioCard()

                        VStack(spacing: 10) {
                            Button {
                                actionSheet = .booking
                            } label: {
                                Text("Записать на занятие")
                                    .font(.rounded(16, .semibold))
                                    .foregroundStyle(Color.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 15)
                                    .background(Capsule().fill(Palette.sageDeep))
                            }
                            .buttonStyle(.plain)
                            .opacity(item.active ? 1 : 0.45)
                            .disabled(!item.active)

                            Button {
                                actionSheet = .roster
                            } label: {
                                Text("Состав группы")
                                    .font(.rounded(16, .semibold))
                                    .foregroundStyle(Palette.sageDeep)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 15)
                                    .background(Capsule().fill(Palette.sageTint))
                            }
                            .buttonStyle(.plain)
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            InfoRow(title: "Длительность", value: "\(item.durationMin) мин")
                            InfoRow(title: "Мест в группе", value: "\(item.capacity)")
                            InfoRow(
                                title: "Расписание",
                                value: item.weekdays.isEmpty
                                    ? "Не задано"
                                    : "\(item.weekdaysLabel), \(item.timeLabel)"
                            )
                            InfoRow(title: "Зал", value: item.hall.isEmpty ? "—" : item.hall)
                            InfoRow(
                                title: "Тренеры",
                                value: store.trainerNames(for: item).isEmpty
                                    ? "—"
                                    : store.trainerNames(for: item)
                            )
                            if !item.equipment.isEmpty {
                                InfoRow(title: "Оборудование", value: item.equipment)
                            }
                        }
                        .padding(18)
                        .studioCard()

                        if !item.details.isEmpty {
                            Text(item.details)
                                .font(.rounded(13.5))
                                .foregroundStyle(Palette.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(18)
                                .studioCard()
                        }
                        Color.clear.frame(height: 4)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(item.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .sheet(item: $actionSheet) { action in
                switch action {
                case .booking:
                    BookingView(classID: item.id, dateKey: dateKey)
                case .roster:
                    ClassRosterView(classID: item.id, dateKey: dateKey)
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }
}
