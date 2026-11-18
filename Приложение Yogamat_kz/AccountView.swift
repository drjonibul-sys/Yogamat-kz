//
//  AccountView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct AccountView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var sheet: Sheet?
    @State private var confirmSwitch = false

    enum Sheet: String, Identifiable {
        case staff
        case pin
        case asanas
        case practices
        case settings

        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        profileCard
                        actionsCard

                        if !store.isAdmin {
                            Text("Тренер видит клиентов на просмотр, отмечает и переносит посещения и смотрит классы. Цены, тарифы, доход, аренда и настройки доступны только администратору.")
                                .font(.rounded(12))
                                .foregroundStyle(Palette.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, 4)
                        }
                        Color.clear.frame(height: 4)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Аккаунт")
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
                case .staff:
                    StaffView()
                case .pin:
                    ChangePINView()
                case .asanas:
                    AsanaCatalogView()
                case .practices:
                    PracticesView()
                case .settings:
                    SettingsView()
                }
            }
            .confirmationDialog(
                "Сменить пользователя?",
                isPresented: $confirmSwitch,
                titleVisibility: .visible
            ) {
                Button("Сменить пользователя", role: .destructive) {
                    dismiss()
                    store.logOut()
                }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text("Придётся снова выбрать пользователя и ввести PIN.")
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private var profileCard: some View {
        HStack(spacing: 12) {
            AvatarView(name: store.currentUser?.name ?? "", size: 52)
            VStack(alignment: .leading, spacing: 3) {
                Text(store.currentUser?.name ?? "—")
                    .font(.rounded(19, .semibold))
                    .foregroundStyle(Palette.ink)
                Text(store.currentUser?.role.title ?? "")
                    .font(.rounded(12.5))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer(minLength: 6)
        }
        .padding(18)
        .studioCard()
    }

    private var actionsCard: some View {
        VStack(spacing: 0) {
            if store.isAdmin {
                row("Настройки", icon: "gearshape.fill") {
                    sheet = .settings
                }
                Divider().overlay(Palette.hairline)
                row("Сотрудники и роли", icon: "person.2.fill") {
                    sheet = .staff
                }
                Divider().overlay(Palette.hairline)
            }
            row("Сменить PIN", icon: "key.fill") {
                sheet = .pin
            }
            Divider().overlay(Palette.hairline)
            row("Справочник асан", icon: "book.closed.fill") {
                sheet = .asanas
            }
            Divider().overlay(Palette.hairline)
            row("Практики занятий", icon: "figure.flexibility") {
                sheet = .practices
            }
            Divider().overlay(Palette.hairline)
            row("Сменить пользователя", icon: "arrow.left.arrow.right") {
                confirmSwitch = true
            }
        }
        .studioCard()
    }

    private func row(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.sageDeep)
                    .frame(width: 22)
                Text(title)
                    .font(.rounded(15))
                    .foregroundStyle(Palette.ink)
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct ChangePINView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var currentPin = ""
    @State private var newPin = ""
    @State private var confirmPin = ""
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        LabeledField("Текущий PIN") {
                            SecureField("Введите текущий PIN", text: $currentPin)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .onChange(of: currentPin) { _, value in
                                    currentPin = digits(value)
                                }
                        }
                        LabeledField("Новый PIN") {
                            SecureField("4–8 цифр", text: $newPin)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .onChange(of: newPin) { _, value in
                                    newPin = digits(value)
                                }
                        }
                        LabeledField("Повторите новый PIN") {
                            SecureField("Ещё раз", text: $confirmPin)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .onChange(of: confirmPin) { _, value in
                                    confirmPin = digits(value)
                                }
                        }
                        Button("Сохранить") { save() }
                            .buttonStyle(SageButtonStyle())
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Сменить PIN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .tint(Palette.inkSoft)
                }
            }
            .alert("Проверьте данные", isPresented: alertBinding) {
                Button("Хорошо", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
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

    private func digits(_ value: String) -> String {
        String(value.filter { $0 >= "0" && $0 <= "9" }.prefix(8))
    }

    private func save() {
        guard let userID = store.currentUser?.id else { return }
        guard newPin == confirmPin else {
            errorMessage = "PIN-коды не совпадают"
            return
        }
        do {
            try store.changePIN(userID: userID, currentPin: currentPin, newPin: newPin)
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}

struct StaffView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var route: Route?

    enum Route: Identifiable {
        case new
        case edit(UUID)

        var id: String {
            switch self {
            case .new: return "new"
            case .edit(let id): return "edit-\(id.uuidString)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let admin = store.staff.first(where: { $0.role == .admin }) {
                            adminCard(admin)
                        }
                        trainersSection
                        Color.clear.frame(height: 6)
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Сотрудники")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { dismiss() }
                        .tint(Palette.sageDeep)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        route = .new
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Palette.sageDeep)
                }
            }
            .sheet(item: $route) { item in
                switch item {
                case .new:
                    StaffEditor(trainer: nil)
                case .edit(let id):
                    StaffEditor(trainer: store.staffUser(id))
                }
            }
        }
        .presentationBackground(Palette.canvas)
    }

    private func adminCard(_ admin: StaffUser) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: admin.name, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(admin.name)
                    .font(.rounded(15.5, .semibold))
                    .foregroundStyle(Palette.ink)
                Text("Администратор · полный доступ")
                    .font(.rounded(12))
                    .foregroundStyle(Palette.inkSoft)
            }
            Spacer(minLength: 6)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .studioCard()
    }

    private var trainersSection: some View {
        let trainers = store.staff.filter { $0.role == .trainer }

        return VStack(alignment: .leading, spacing: 8) {
            Text("Тренеры")
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
                .padding(.horizontal, 4)

            if trainers.isEmpty {
                EmptyHintCard(
                    icon: "person.badge.plus",
                    title: "Тренеров пока нет",
                    message: "Добавьте тренера с именем и PIN — он сможет отмечать посещения."
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(trainers) { trainer in
                        Button {
                            route = .edit(trainer.id)
                        } label: {
                            HStack(spacing: 10) {
                                AvatarView(name: trainer.name, size: 38)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(trainer.name)
                                        .font(.rounded(14.5, .medium))
                                        .foregroundStyle(Palette.ink)
                                    Text(trainer.isActive ? "Тренер" : "Отключён")
                                        .font(.rounded(11.5))
                                        .foregroundStyle(trainer.isActive ? Palette.inkSoft : Palette.terracotta)
                                }
                                Spacer(minLength: 6)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(Palette.inkSoft.opacity(0.5))
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if trainer.id != trainers.last?.id {
                            Divider()
                                .overlay(Palette.hairline)
                                .padding(.leading, 14)
                        }
                    }
                }
                .studioCard()
            }
        }
    }
}

struct StaffEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let trainer: StaffUser?

    @State private var name: String
    @State private var pin = ""
    @State private var active: Bool
    @State private var errorMessage: String?
    @State private var confirmDelete = false

    init(trainer: StaffUser?) {
        self.trainer = trainer
        _name = State(initialValue: trainer?.name ?? "")
        _active = State(initialValue: trainer?.isActive ?? true)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        LabeledField("Имя") {
                            TextField("Например: Ольга Пак", text: $name)
                                .textInputAutocapitalization(.words)
                        }
                        LabeledField(trainer == nil ? "PIN" : "Новый PIN (необязательно)") {
                            SecureField("4–8 цифр", text: $pin)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .onChange(of: pin) { _, value in
                                    pin = digits(value)
                                }
                        }

                        if trainer != nil {
                            LabeledField("Доступ") {
                                Toggle("Тренер работает", isOn: $active)
                                    .font(.rounded(16))
                                    .tint(Palette.sage)
                            }

                            Button(role: .destructive) {
                                confirmDelete = true
                            } label: {
                                Text("Удалить тренера")
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
            .navigationTitle(trainer == nil ? "Новый тренер" : "Тренер")
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
            .confirmationDialog("Удалить тренера?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Удалить", role: .destructive) {
                    if let trainer {
                        store.deleteStaff(trainer.id)
                        dismiss()
                    }
                }
                Button("Отмена", role: .cancel) {}
            } message: {
                Text("Доступ закроется, назначения на классы снимутся.")
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

    private func digits(_ value: String) -> String {
        String(value.filter { $0 >= "0" && $0 <= "9" }.prefix(8))
    }

    private func save() {
        do {
            if let trainer {
                try store.updateStaffName(trainer.id, name: name)
                if !pin.isEmpty {
                    try store.setPIN(userID: trainer.id, newPin: pin)
                }
                if trainer.isActive != active {
                    store.setStaffActive(trainer.id, active: active)
                }
            } else {
                try store.addTrainer(name: name, pin: pin)
            }
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
