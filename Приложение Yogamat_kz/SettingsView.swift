//
//  SettingsView.swift
//  Приложение Yogamat_kz
//

import SwiftUI
import UniformTypeIdentifiers

private struct SettingsAlert: Identifiable {
    let id = UUID()
    let title: String
    let text: String
}

struct SettingsView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var studioName = ""
    @AppStorage(ClassReminders.enabledKey) private var remindersEnabled = false
    @AppStorage(PaymentReminders.enabledKey) private var paymentRemindersEnabled = false
    @AppStorage(ScheduleSettings.hidePastKey) private var hidePastClasses = false
    @AppStorage(ScheduleSettings.onlyMineKey) private var onlyMyClasses = false
    @State private var month = Calendar.current.component(.month, from: Date())
    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var exportURL: URL?
    @State private var pdfURL: URL?
    @State private var showImporter = false
    @State private var alertInfo: SettingsAlert?
    @State private var pendingBackup: BackupFile?
    @State private var showRestoreConfirm = false
    @State private var archiveScriptURL: URL?

    private var version: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    private var years: [Int] {
        let current = Calendar.current.component(.year, from: Date())
        return Array((current - 2)...(current + 1))
    }

    private var unpaidSubscriptionsCount: Int {
        store.subscriptions.filter { !$0.paid }.count
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        studioCard
                        remindersCard
                        paymentRemindersCard
                        hidePastCard
                        if store.currentUser?.role == .trainer {
                            onlyMineCard
                        }
                        archiveCard
                        backupsCard
                        dataCard
                        reportCard
                        aboutCard
                        Color.clear.frame(height: 4)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Настройки")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Готово") { dismiss() }
                        .font(.rounded(16, .semibold))
                        .tint(Palette.sageDeep)
                }
            }
            .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json]) { result in
                handleImport(result)
            }
            .alert(
                alertInfo?.title ?? "",
                isPresented: Binding(
                    get: { alertInfo != nil },
                    set: { if !$0 { alertInfo = nil } }
                )
            ) {
                Button("Хорошо", role: .cancel) {}
            } message: {
                Text(alertInfo?.text ?? "")
            }
            .confirmationDialog(
                "Восстановить резервную копию?",
                isPresented: $showRestoreConfirm,
                titleVisibility: .visible
            ) {
                Button("Восстановить", role: .destructive) { restorePending() }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text("Текущее состояние сначала сохранится отдельной копией.")
            }
            .task {
                studioName = store.studioName
                refreshExportFile()
                refreshPDF()
                archiveScriptURL = ProjectArchive.scriptURL()
            }
            .onChange(of: month) { _, _ in
                refreshPDF()
            }
            .onChange(of: year) { _, _ in
                refreshPDF()
            }
            .onChange(of: studioName) { _, value in
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty, trimmed != store.studioName {
                    store.setStudioName(trimmed)
                    refreshExportFile()
                }
            }
            .onChange(of: remindersEnabled) { _, isOn in
                if isOn {
                    Task {
                        let granted = await ClassReminders.enable(classes: store.classes)
                        if !granted {
                            remindersEnabled = false
                            alertInfo = SettingsAlert(
                                title: "Уведомления запрещены",
                                text: "Разрешите уведомления для приложения в настройках iOS — без этого напоминания не придут."
                            )
                        }
                    }
                } else {
                    Task { await ClassReminders.disable() }
                }
            }
            .onChange(of: paymentRemindersEnabled) { _, isOn in
                if isOn {
                    Task {
                        let granted = await PaymentReminders.enable(unpaidCount: unpaidSubscriptionsCount)
                        if !granted {
                            paymentRemindersEnabled = false
                            alertInfo = SettingsAlert(
                                title: "Уведомления запрещены",
                                text: "Разрешите уведомления для приложения в настройках iOS — без этого напоминание об оплате не придёт."
                            )
                        }
                    }
                } else {
                    Task { await PaymentReminders.disable() }
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    // MARK: - Студия

    private var studioCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Студия")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            LabeledField("Название студии") {
                TextField("Студия Yogamat.kz", text: $studioName)
            }
            Text("Название показывается на экране входа и в шапке «Обзора».")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    private var remindersCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Напоминать о занятиях", isOn: $remindersEnabled)
                .font(.rounded(15, .medium))
                .foregroundStyle(Palette.ink)
                .tint(Palette.sage)

            Text("За 30 минут до начала занятия из расписания. Уведомления приходят только на этом устройстве, без сервера.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    private var paymentRemindersCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Напоминать об оплате", isOn: $paymentRemindersEnabled)
                .font(.rounded(15, .medium))
                .foregroundStyle(Palette.ink)
                .tint(Palette.sage)

            Text("Каждый понедельник в 10:00 — сколько абонементов без отметки оплаты. Если таких нет, уведомление не приходит; напоминание приходит только на этом устройстве.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    private var hidePastCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Скрывать прошедшие занятия", isOn: $hidePastClasses)
                .font(.rounded(15, .medium))
                .foregroundStyle(Palette.ink)
                .tint(Palette.sage)

            Text("В неделе и календаре месяца не показываются занятия, которые уже начались сегодня. На состав группы, запись и напоминания переключатель не влияет.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    private var onlyMineCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Только мои занятия", isOn: $onlyMyClasses)
                .font(.rounded(15, .medium))
                .foregroundStyle(Palette.ink)
                .tint(Palette.sage)

            Text("В неделе и календаре месяца показываются только направления, назначенные вам. На состав группы и журнал визитов переключатель не влияет.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    // MARK: - Архив материалов

    private var archiveCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Архив материалов")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)

            Text("Скрипт собирает ZIP всего проекта на Mac: проект Xcode, исходные данные и файлы приложения. Для сборки нужен компьютер — в приложении ZIP не создаётся.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            if let archiveScriptURL {
                ShareLink(item: archiveScriptURL) {
                    Text("Скачать скрипт")
                        .font(.rounded(15, .semibold))
                        .foregroundStyle(Color.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Palette.sage)
                        )
                }
                .buttonStyle(.plain)
            } else {
                Text("Скачать скрипт")
                    .font(.rounded(15, .semibold))
                    .foregroundStyle(Palette.sageDeep)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(Palette.sageTint)
                    )
                    .opacity(0.45)
            }

            Text("Или в «Файлах» нажмите кнопку ветки внизу, сделайте Commit и Push — проект скачается с GitHub как ZIP.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    // MARK: - Резервные копии
    private var backupsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Резервные копии")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            Text("Раз в неделю копия создаётся автоматически. Хранятся последние 25 копий.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            if let last = store.backups.first {
                Text("Последняя: \(dateText(last.date)) · \(byteText(last.size)) · \(store.backups.count) из 25")
                    .font(.rounded(12))
                    .foregroundStyle(Palette.sageDeep)
            } else {
                Text("Копий пока нет")
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
            }

            Button("Создать копию сейчас") { createBackup() }
                .buttonStyle(SageButtonStyle(filled: false))

            if !store.backups.isEmpty {
                ForEach(store.backups.prefix(4)) { backup in
                    Divider().overlay(Palette.hairline)
                    Button {
                        pendingBackup = backup
                        showRestoreConfirm = true
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "clock.arrow.circlepath")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Palette.sageDeep)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(dateText(backup.date))
                                    .font(.rounded(13))
                                    .foregroundStyle(Palette.ink)
                                Text(byteText(backup.size))
                                    .font(.rounded(11))
                                    .foregroundStyle(Palette.inkSoft)
                            }
                            Spacer(minLength: 6)
                            Image(systemName: "arrow.uturn.backward")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Palette.inkSoft.opacity(0.6))
                        }
                        .contentShape(Rectangle())
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
            }

            Text("Перед восстановлением текущее состояние сохранится отдельной копией.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    // MARK: - Данные

    private var dataCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Данные")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)

            if let exportURL {
                ShareLink(item: exportURL) {
                    rowLabel(
                        "Экспорт JSON",
                        subtitle: "Сохранить базу в «Файлы» или отправить",
                        icon: "square.and.arrow.up"
                    )
                }
                .buttonStyle(.plain)
            } else {
                rowLabel(
                    "Экспорт JSON",
                    subtitle: "Готовим файл…",
                    icon: "square.and.arrow.up"
                )
                .opacity(0.5)
            }

            Divider().overlay(Palette.hairline)

            Button {
                showImporter = true
            } label: {
                rowLabel(
                    "Импорт копии",
                    subtitle: "Восстановить базу из файла JSON",
                    icon: "square.and.arrow.down"
                )
            }
            .buttonStyle(.plain)

            Text("Перед восстановлением текущее состояние сохранится отдельной копией.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
        .padding(16)
        .studioCard()
    }

    // MARK: - Табель

    private var reportCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Табель визитов")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)

            HStack {
                Text("Месяц")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
                Spacer()
                Menu {
                    Section("Месяц") {
                        ForEach(1...12, id: \.self) { value in
                            Button(RU.monthNames[value - 1]) { month = value }
                        }
                    }
                    Section("Год") {
                        ForEach(years, id: \.self) { value in
                            Button(String(value)) { year = value }
                        }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Text("\(RU.monthNames[month - 1]) \(String(year))")
                            .font(.rounded(14, .medium))
                            .foregroundStyle(Palette.ink)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Palette.inkSoft)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(Palette.card))
                }
            }

            Divider().overlay(Palette.hairline)

            if let pdfURL {
                ShareLink(item: pdfURL) {
                    rowLabel(
                        "Табель за \(RU.monthNames[month - 1].lowercased()) в PDF",
                        subtitle: "Печать или «Сохранить в Файлы»",
                        icon: "doc.richtext"
                    )
                }
                .buttonStyle(.plain)
            } else {
                rowLabel(
                    "Табель за \(RU.monthNames[month - 1].lowercased()) в PDF",
                    subtitle: "Готовим файл…",
                    icon: "doc.richtext"
                )
                .opacity(0.5)
            }

            Text("Откроется системное окно: печать или «Сохранить в Файлы».")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    // MARK: - О приложении

    private var aboutCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Spacer()
                BrandLogo(width: 84)
                Spacer()
            }
            .padding(.bottom, 2)

            Text("О приложении")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            HStack {
                Text("Версия")
                    .font(.rounded(13))
                    .foregroundStyle(Palette.inkSoft)
                Spacer()
                Text(version)
                    .font(.rounded(13, .medium))
                    .foregroundStyle(Palette.ink)
            }
            HStack {
                Text("Разработано")
                    .font(.rounded(13))
                    .foregroundStyle(Palette.inkSoft)
                Spacer()
                Text("Yogamat.kz")
                    .font(.rounded(13, .medium))
                    .foregroundStyle(Palette.ink)
            }

            Divider().overlay(Palette.hairline)

            Text("Источники справочника")
                .font(.rounded(13, .semibold))
                .foregroundStyle(Palette.ink)

            sourceLink("Ministry of Ayush — Common Yoga Protocol", "https://yoga.ayush.gov.in/YAP/PDF/Common%20Yoga%20Protocol%20Book-English.pdf")
            sourceLink("YogaEasy / EkhartYoga", "https://www.yogaeasy.com/")
            sourceLink("Yoga.org — каталог асан", "https://yoga.org/poses/")
            sourceLink("Yoga Journal", "https://www.yogajournal.com/")

            Text("Справочник и практики знакомят с асанами и не заменяют занятие с преподавателем. Анатомические иллюстрации созданы для приложения, подсветка мышц условная.")
                .font(.rounded(11.5))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .studioCard()
    }

    private func sourceLink(_ title: String, _ address: String) -> some View {
        Group {
            if let url = URL(string: address) {
                Link(destination: url) {
                    HStack(spacing: 6) {
                        Text(title)
                            .font(.rounded(13))
                            .foregroundStyle(Palette.sageDeep)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Palette.sageDeep)
                    }
                }
            } else {
                Text(title)
                    .font(.rounded(13))
                    .foregroundStyle(Palette.inkSoft)
            }
        }
    }

    private func rowLabel(_ title: String, subtitle: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Palette.sageDeep)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.rounded(15))
                    .foregroundStyle(Palette.ink)
                Text(subtitle)
                    .font(.rounded(11.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer(minLength: 6)
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Palette.inkSoft.opacity(0.5))
        }
        .contentShape(Rectangle())
        .padding(.vertical, 8)
    }

    // MARK: - Действия

    private func refreshExportFile() {
        guard let data = store.encodedSnapshotData() else {
            exportURL = nil
            return
        }
        let name = "Yogamat-kz-\(RU.key(Date())).json"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try data.write(to: url, options: .atomic)
            exportURL = url
        } catch {
            exportURL = nil
        }
    }

    private func refreshPDF() {
        pdfURL = VisitsPDF.make(month: month, year: year, store: store)
    }

    private func createBackup() {
        do {
            try store.createBackup()
            alertInfo = SettingsAlert(title: "Копия создана", text: "Внутренняя резервная копия базы сохранена.")
        } catch let error {
            alertInfo = SettingsAlert(title: "Не получилось", text: error.localizedDescription)
        }
    }

    private func restorePending() {
        guard let backup = pendingBackup else { return }
        pendingBackup = nil
        do {
            try store.restoreBackup(backup)
            refreshExportFile()
            refreshPDF()
            alertInfo = SettingsAlert(
                title: "Копия восстановлена",
                text: "База заменена данными из выбранной копии. Прежнее состояние сохранено отдельно."
            )
        } catch let error {
            alertInfo = SettingsAlert(title: "Не получилось", text: error.localizedDescription)
        }
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url):
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            do {
                let data = try Data(contentsOf: url)
                try store.importSnapshot(from: data)
                refreshExportFile()
                refreshPDF()
                alertInfo = SettingsAlert(
                    title: "Копия восстановлена",
                    text: "База заменена данными из файла. Прежнее состояние сохранено отдельной копией."
                )
            } catch let error {
                alertInfo = SettingsAlert(title: "Не получилось", text: error.localizedDescription)
            }
        case .failure(let error):
            alertInfo = SettingsAlert(title: "Не получилось", text: error.localizedDescription)
        }
    }

    private func dateText(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = RU.locale
        formatter.dateFormat = "d MMMM, HH:mm"
        return formatter.string(from: date)
    }

    private func byteText(_ size: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(size))
    }
}
