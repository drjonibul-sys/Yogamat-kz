//
//  ClassesView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

extension ClassType {
    var accentColor: Color {
        self == .yoga ? Palette.sage : Palette.powder
    }
}

struct ClassesView: View {
    @Environment(StudioStore.self) private var store

    @State private var mode: CalendarMode = .week
    @State private var weekStart: Date = RU.startOfWeek()
    @State private var selectedWeekday: Int = RU.weekdayIndex(of: Date())
    @State private var monthStart: Date = RU.startOfMonth()
    @State private var selectedMonthDay: Date = RU.calendar.startOfDay(for: Date())
    @State private var sheet: Sheet?
    @State private var weekPDFURL: URL?
    @AppStorage(ScheduleSettings.hidePastKey) private var hidePastClasses = false
    @AppStorage(ScheduleSettings.onlyMineKey) private var onlyMyClasses = false

    enum Sheet: Identifiable {
        case directions
        case newClass(Int)
        case editClass(UUID, String)
        case infoClass(UUID, String)

        var id: String {
            switch self {
            case .directions: return "directions"
            case .newClass(let day): return "new-\(day)"
            case .editClass(let id, let dateKey): return "edit-\(id.uuidString)-\(dateKey)"
            case .infoClass(let id, let dateKey): return "info-\(id.uuidString)-\(dateKey)"
            }
        }
    }

    private enum CalendarMode: String, CaseIterable, Identifiable {
        case week
        case month

        var id: String { rawValue }

        var title: String {
            switch self {
            case .week: return "Неделя"
            case .month: return "Месяц"
            }
        }
    }

    /// Выбранный день: в неделе — из полосы дней, в месяце — из календаря.
    private var activeDate: Date {
        switch mode {
        case .week: return RU.date(byAddingDays: selectedWeekday - 1, to: weekStart)
        case .month: return selectedMonthDay
        }
    }

    private var activeKey: String { RU.key(activeDate) }
    private var activeWeekday: Int { RU.weekdayIndex(of: activeDate) }
    private var dayClasses: [StudioClass] { scheduleClasses(onWeekday: activeWeekday) }

    /// Тренер с включённым переключателем видит только свои направления.
    private var isMineOnly: Bool {
        onlyMyClasses && !store.isAdmin && store.currentUser?.role == .trainer
    }

    private func scheduleClasses(onWeekday weekday: Int) -> [StudioClass] {
        let list = store.classes(onWeekday: weekday)
        guard isMineOnly else { return list }
        return list.filter(isMine)
    }

    private func isMine(_ item: StudioClass) -> Bool {
        guard let user = store.currentUser else { return false }
        if let ids = item.trainerIDs, !ids.isEmpty {
            return ids.contains(user.id)
        }
        return !item.trainer.isEmpty
            && item.trainer.localizedCaseInsensitiveContains(user.name)
    }

    /// Занятия дня без уже начавшихся, если включён переключатель и день сегодняшний.
    private var visibleDayClasses: [StudioClass] {
        guard hidePastClasses, activeKey == RU.key(Date()) else { return dayClasses }
        let now = RU.minutes(from: Date())
        return dayClasses.filter { $0.startMinutes >= now }
    }

    /// Все занятия сегодняшнего дня уже начались.
    private var todayClassesPassed: Bool {
        hidePastClasses
            && activeKey == RU.key(Date())
            && !dayClasses.isEmpty
            && visibleDayClasses.isEmpty
    }

    private var periodLabel: String {
        switch mode {
        case .week: return RU.weekRangeLabel(start: weekStart)
        case .month: return RU.monthTitle(monthStart)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                switch mode {
                case .week:
                    weekStrip
                case .month:
                    monthCard
                }

                daySection

                if store.isAdmin {
                    addCard
                }
                Color.clear.frame(height: 6)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .scrollIndicators(.hidden)
        .onAppear {
            refreshWeekPDF()
            Task { await ClassReminders.refresh(classes: store.classes) }
        }
        .onChange(of: store.classes) { _, classes in
            refreshWeekPDF()
            Task { await ClassReminders.refresh(classes: classes) }
        }
        .onChange(of: store.visits) { _, _ in
            refreshWeekPDF()
        }
        .onChange(of: weekStart) { _, _ in
            refreshWeekPDF()
        }
        .sheet(item: $sheet) { item in
            switch item {
            case .directions:
                ClassDirectionsView()
            case .newClass(let day):
                ClassEditorView(presetWeekday: day)
            case .editClass(let id, let dateKey):
                ClassEditorView(existing: store.studioClass(id), bookingDateKey: dateKey)
            case .infoClass(let id, let dateKey):
                if let info = store.studioClass(id) {
                    ClassInfoView(item: info, dateKey: dateKey)
                }
            }
        }
    }

    // MARK: - Шапка

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                Text("Расписание")
                    .font(.rounded(30, .bold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .layoutPriority(1)
                Spacer(minLength: 8)
                HStack(spacing: 10) {
                    if mode == .week {
                        weekPDFButton
                    }
                    weekButton(icon: "chevron.left") { shift(-1) }
                    weekButton(icon: "chevron.right") { shift(1) }
                }
            }

            HStack(spacing: 10) {
                Text(periodLabel)
                    .font(.rounded(15))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 6)
                modeToggle
            }
        }
        .padding(.top, 4)
    }

    private var modeToggle: some View {
        HStack(spacing: 2) {
            ForEach(CalendarMode.allCases) { item in
                Button {
                    setMode(item)
                } label: {
                    Text(item.title)
                        .font(.rounded(13, item == mode ? .semibold : .medium))
                        .foregroundStyle(item == mode ? Color.white : Palette.inkSoft)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(item == mode ? Palette.sage : Color.clear))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Capsule().fill(Palette.sageTint.opacity(0.85)))
    }

    private func weekButton(icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            circleLabel(icon)
        }
        .buttonStyle(.plain)
    }

    private var weekPDFButton: some View {
        Group {
            if let weekPDFURL {
                ShareLink(item: weekPDFURL) {
                    circleLabel("printer")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Расписание недели в PDF")
            } else {
                circleLabel("printer")
                    .opacity(0.45)
                    .accessibilityLabel("Расписание недели в PDF")
            }
        }
    }

    private func circleLabel(_ icon: String) -> some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.85))
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Palette.ink)
        }
        .frame(width: 38, height: 38)
        .shadow(color: Palette.ink.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private func refreshWeekPDF() {
        weekPDFURL = SchedulePDF.make(weekStart: weekStart, store: store)
    }

    // MARK: - Листание периода

    private func shift(_ delta: Int) {
        switch mode {
        case .week: shiftWeek(delta)
        case .month: shiftMonth(delta)
        }
    }

    private func shiftWeek(_ delta: Int) {
        withAnimation(.snappy(duration: 0.2)) {
            weekStart = RU.date(byAddingDays: delta * 7, to: weekStart)
        }
    }

    private func shiftMonth(_ delta: Int) {
        let components = RU.calendar.dateComponents([.year, .month], from: monthStart)
        guard let year = components.year, let month = components.month else { return }
        let next = RU.addMonths(delta, year: year, month: month)
        guard let first = RU.calendar.date(
            from: DateComponents(year: next.year, month: next.month, day: 1)
        ) else { return }

        let days = RU.calendar.range(of: .day, in: .month, for: first)?.count ?? 28
        let day = min(RU.calendar.component(.day, from: selectedMonthDay), days)
        let target = RU.calendar.date(
            from: DateComponents(year: next.year, month: next.month, day: day)
        )

        withAnimation(.snappy(duration: 0.2)) {
            monthStart = RU.calendar.startOfDay(for: first)
            selectedMonthDay = RU.calendar.startOfDay(for: target ?? first)
        }
    }

    private func setMode(_ newMode: CalendarMode) {
        guard newMode != mode else { return }
        let day = activeDate
        withAnimation(.snappy(duration: 0.2)) {
            switch newMode {
            case .week:
                weekStart = RU.startOfWeek(containing: day)
                selectedWeekday = RU.weekdayIndex(of: day)
            case .month:
                monthStart = RU.startOfMonth(containing: day)
                selectedMonthDay = RU.calendar.startOfDay(for: day)
            }
            mode = newMode
        }
    }

    // MARK: - Дни недели

    private var weekStrip: some View {
        HStack(spacing: 6) {
            ForEach(1...7, id: \.self) { weekday in
                let date = RU.date(byAddingDays: weekday - 1, to: weekStart)
                Button {
                    withAnimation(.snappy(duration: 0.18)) {
                        selectedWeekday = weekday
                    }
                } label: {
                    VStack(spacing: 4) {
                        Text(RU.weekdayShortNames[weekday - 1])
                            .font(.rounded(11.5, .medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text("\(RU.dayNumber(date))")
                            .font(.rounded(17, .bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(selectedWeekday == weekday ? Palette.sage : Palette.card)
                    )
                    .foregroundStyle(selectedWeekday == weekday ? Color.white : Palette.ink)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Календарь месяца

    private var monthCard: some View {
        let weeks = RU.monthGrid(containing: monthStart)

        return VStack(spacing: 2) {
            HStack(spacing: 0) {
                ForEach(RU.weekdayShortNames, id: \.self) { name in
                    Text(name)
                        .font(.rounded(12, .medium))
                        .foregroundStyle(Palette.inkSoft)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.bottom, 6)

            ForEach(weeks.indices, id: \.self) { index in
                let week = weeks[index]
                HStack(spacing: 0) {
                    ForEach(week.indices, id: \.self) { position in
                        monthDayCell(week[position])
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 16)
        .studioCard()
    }

    @ViewBuilder
    private func monthDayCell(_ date: Date?) -> some View {
        if let date {
            let key = RU.key(date)
            let hasClasses = !scheduleClasses(onWeekday: RU.weekdayIndex(of: date)).isEmpty
            let isSelected = key == activeKey
            let isToday = key == RU.key(Date())

            Button {
                withAnimation(.snappy(duration: 0.18)) {
                    selectedMonthDay = RU.calendar.startOfDay(for: date)
                }
            } label: {
                VStack(spacing: 4) {
                    Text("\(RU.dayNumber(date))")
                        .font(.rounded(16, isSelected ? .bold : .medium))
                        .foregroundStyle(
                            isSelected
                                ? Color.white
                                : (hasClasses ? Palette.ink : Palette.terracotta.opacity(0.75))
                        )
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Circle()
                        .fill(
                            hasClasses
                                ? (isSelected ? Color.white.opacity(0.9) : Palette.sage)
                                : Color.clear
                        )
                        .frame(width: 4.5, height: 4.5)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background {
                    if isSelected {
                        Circle()
                            .fill(Palette.sage)
                            .frame(width: 38, height: 38)
                    } else if isToday {
                        Circle()
                            .strokeBorder(Palette.sage.opacity(0.75), lineWidth: 1.2)
                            .frame(width: 38, height: 38)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(RU.weekdayLong(date))
        } else {
            Color.clear
                .frame(height: 44)
        }
    }

    // MARK: - Занятия дня

    private var daySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(RU.longDay(activeKey))
                    .font(.rounded(22, .bold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 6)
                Button {
                    sheet = .directions
                } label: {
                    HStack(spacing: 3) {
                        Text("Направления")
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .font(.rounded(13))
                    .foregroundStyle(Palette.inkSoft)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                }
                .buttonStyle(.plain)
            }

            if visibleDayClasses.isEmpty {
                if todayClassesPassed {
                    EmptyHintCard(
                        icon: "clock.badge.checkmark",
                        title: "Занятия на сегодня прошли",
                        message: "Все занятия на сегодня уже начались. Выберите другой день."
                    )
                } else if isMineOnly {
                    EmptyHintCard(
                        icon: "person.badge.clock",
                        title: "Ваших занятий нет",
                        message: "В этот день у вас нет занятий — выберите другой день."
                    )
                } else {
                    EmptyHintCard(
                        icon: "calendar.badge.plus",
                        title: "Свободный день",
                        message: "Занятий в этот день нет. Добавьте первое или выберите другой день."
                    )
                }
            } else {
                VStack(spacing: 10) {
                    ForEach(visibleDayClasses) { item in
                        classCard(item)
                    }
                }
            }
        }
    }

    private func classCard(_ item: StudioClass) -> some View {
        let booked = store.bookedCount(forClass: item.id, on: activeKey)
        let free = max(0, item.capacity - booked)
        let isFull = free == 0

        return Button {
            if store.isAdmin {
                sheet = .editClass(item.id, activeKey)
            } else {
                sheet = .infoClass(item.id, activeKey)
            }
        } label: {
            HStack(alignment: .center, spacing: 10) {
                Text(item.timeLabel)
                    .font(.rounded(23, .bold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(width: 72, alignment: .leading)

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name)
                        .font(.rounded(15.5, .semibold))
                        .foregroundStyle(Palette.ink)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitle(for: item, free: free, isFull: isFull))
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .layoutPriority(1)

                Spacer(minLength: 4)

                VStack(alignment: .trailing, spacing: 6) {
                    LevelPill(level: item.level)
                    if isFull {
                        Text("мест нет")
                            .font(.rounded(11.5, .medium))
                            .foregroundStyle(Palette.terracotta)
                    }
                }
            }
            .padding(.vertical, 14)
            .padding(.leading, 20)
            .padding(.trailing, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Palette.card)
                    .shadow(color: Palette.ink.opacity(0.05), radius: 14, x: 0, y: 7)
            )
            .overlay(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(item.type.accentColor)
                    .frame(width: 5)
                    .padding(.vertical, 10)
                    .padding(.leading, 6)
            }
        }
        .buttonStyle(.plain)
    }

    private func subtitle(for item: StudioClass, free: Int, isFull: Bool) -> String {
        var parts: [String] = []
        if !item.hall.isEmpty { parts.append(item.hall) }
        let trainerName = store.trainerNames(for: item)
        if !trainerName.isEmpty { parts.append(trainerName) }
        parts.append(isFull ? "полный набор" : "\(free) из \(item.capacity) мест")
        return parts.joined(separator: " · ")
    }

    private var addCard: some View {
        Button {
            sheet = .newClass(activeWeekday)
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Palette.sageTint)
                    Image(systemName: "plus")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.sageDeep)
                }
                .frame(width: 38, height: 38)

                Text("Добавить занятие в этот день")
                    .font(.rounded(15, .medium))
                    .foregroundStyle(Palette.sageDeep)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Palette.card.opacity(0.55))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(
                        Palette.sage.opacity(0.5),
                        style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
