//
//  AuthView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct AuthView: View {
    @Environment(StudioStore.self) private var store

    @State private var step: Step = .pickUser
    @State private var setupName = ""
    @State private var setupPin = ""
    @State private var setupPinConfirm = ""
    @State private var pendingRecoveryCode: String?
    @State private var enteredCode = ""
    @State private var newPin = ""
    @State private var newPinConfirm = ""
    @State private var pin = ""
    @State private var errorMessage: String?

    enum Step {
        case setup
        case setupRecovery
        case pickUser
        case pin(UUID)
        case recovery(UUID)
    }

    var body: some View {
        ZStack {
            StudioBackground()
            ScrollView {
                VStack(spacing: 16) {
                    header
                    switch step {
                    case .setup:
                        setupCard
                    case .setupRecovery:
                        recoveryCodeCard
                    case .pickUser:
                        pickUserCard
                    case .pin(let id):
                        pinCard(userID: id)
                    case .recovery(let id):
                        recoveryCard(userID: id)
                    }
                }
                .padding(20)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
        }
        .alert("Проверьте данные", isPresented: alertBinding) {
            Button("Хорошо", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .onAppear {
            if store.staff.isEmpty {
                step = .setup
            }
        }
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private var header: some View {
        VStack(spacing: 10) {
            BrandLogo(width: 120)

            Text(store.studioName)
                .font(.rounded(14))
                .foregroundStyle(Palette.inkSoft)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 24)
    }

    // MARK: - Первый запуск

    private var setupCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Первый запуск")
                .font(.rounded(24, .bold))
                .foregroundStyle(Palette.ink)
            Text("Задайте PIN администратора — он понадобится для входа. PIN хранится на этом устройстве.")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            LabeledField("Имя (необязательно)") {
                TextField("Например: Анна Ким", text: $setupName)
                    .textInputAutocapitalization(.words)
            }

            LabeledField("PIN") {
                SecureField("4–8 цифр", text: $setupPin)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .onChange(of: setupPin) { _, value in
                        setupPin = Self.digits(value)
                    }
            }

            LabeledField("Повторите PIN") {
                SecureField("Ещё раз", text: $setupPinConfirm)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .onChange(of: setupPinConfirm) { _, value in
                        setupPinConfirm = Self.digits(value)
                    }
            }

            Button("Далее") { nextFromSetup() }
                .buttonStyle(SageButtonStyle())
        }
        .padding(18)
        .studioCard()
    }

    private var setupRecoveryCode: String {
        pendingRecoveryCode ?? ""
    }

    private var recoveryCodeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Код восстановления")
                .font(.rounded(24, .bold))
                .foregroundStyle(Palette.ink)
            Text("Запишите код: он показывается один раз и понадобится, если вы забудете PIN.")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            Text(setupRecoveryCode)
                .font(.system(size: 28, weight: .bold, design: .monospaced))
                .foregroundStyle(Palette.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Palette.sageTint)
                )

            Button("Создать аккаунт и войти") { createAdmin() }
                .buttonStyle(SageButtonStyle())
        }
        .padding(18)
        .studioCard()
    }

    private func nextFromSetup() {
        guard StudioStore.isValidPIN(setupPin) else {
            errorMessage = "PIN — от 4 до 8 цифр"
            return
        }
        guard setupPin == setupPinConfirm else {
            errorMessage = "PIN-коды не совпадают"
            return
        }
        pendingRecoveryCode = StudioStore.makeRecoveryCode()
        step = .setupRecovery
    }

    private func createAdmin() {
        guard let code = pendingRecoveryCode else { return }
        do {
            try store.setupAdmin(name: setupName, pin: setupPin, recoveryCode: code)
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Выбор пользователя

    private var pickUserCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Кто вы?")
                .font(.rounded(24, .bold))
                .foregroundStyle(Palette.ink)
            Text("Выберите себя, чтобы войти в приложение.")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)

            ForEach(store.staff.filter { $0.isActive }) { user in
                Button {
                    pin = ""
                    step = .pin(user.id)
                } label: {
                    HStack(spacing: 12) {
                        AvatarView(name: user.name, size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name)
                                .font(.rounded(15.5, .semibold))
                                .foregroundStyle(Palette.ink)
                            Text(user.role.title)
                                .font(.rounded(12))
                                .foregroundStyle(Palette.inkSoft)
                        }
                        Spacer(minLength: 6)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Palette.inkSoft.opacity(0.5))
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Palette.card)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(18)
        .studioCard()
    }

    // MARK: - Вход по PIN

    private func pinCard(userID: UUID) -> some View {
        let user = store.staffUser(userID)

        return VStack(alignment: .leading, spacing: 14) {
            Button {
                pin = ""
                step = .pickUser
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                    Text("Кто вы?")
                }
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
            }
            .buttonStyle(.plain)

            HStack(spacing: 12) {
                AvatarView(name: user?.name ?? "", size: 52)
                VStack(alignment: .leading, spacing: 2) {
                    Text(user?.name ?? "—")
                        .font(.rounded(19, .semibold))
                        .foregroundStyle(Palette.ink)
                    Text(user?.role.title ?? "")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.inkSoft)
                }
            }

            LabeledField("PIN") {
                SecureField("Введите PIN", text: $pin)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .onChange(of: pin) { _, value in
                        pin = Self.digits(value)
                    }
            }

            TimelineView(.periodic(from: .now, by: 1)) { _ in
                let remaining = store.lockRemainingSeconds(userID: userID)
                if remaining > 0 {
                    Text("Слишком много попыток. Вход заблокирован ещё на \(remaining) с.")
                        .font(.rounded(12.5))
                        .foregroundStyle(Palette.terracotta)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Button("Войти") { logIn(userID: userID) }
                .buttonStyle(SageButtonStyle())

            Button("Забыли PIN?") {
                enteredCode = ""
                newPin = ""
                newPinConfirm = ""
                step = .recovery(userID)
            }
            .font(.rounded(13))
            .foregroundStyle(Palette.sageDeep)
            .frame(maxWidth: .infinity)
        }
        .padding(18)
        .studioCard()
    }

    private func logIn(userID: UUID) {
        do {
            try store.logIn(userID: userID, pin: pin)
        } catch let error {
            errorMessage = error.localizedDescription
            pin = ""
        }
    }

    // MARK: - Восстановление

    private func recoveryCard(userID: UUID) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Button {
                step = .pin(userID)
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                    Text("Назад")
                }
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
            }
            .buttonStyle(.plain)

            Text("Восстановление доступа")
                .font(.rounded(24, .bold))
                .foregroundStyle(Palette.ink)
            Text("Введите код восстановления, который записали при первом запуске, и задайте новый PIN.")
                .font(.rounded(13))
                .foregroundStyle(Palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            LabeledField("Код восстановления") {
                TextField("XXXX-XXXX", text: $enteredCode)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }

            LabeledField("Новый PIN") {
                SecureField("4–8 цифр", text: $newPin)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .onChange(of: newPin) { _, value in
                        newPin = Self.digits(value)
                    }
            }

            LabeledField("Повторите PIN") {
                SecureField("Ещё раз", text: $newPinConfirm)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .onChange(of: newPinConfirm) { _, value in
                        newPinConfirm = Self.digits(value)
                    }
            }

            Button("Сохранить и войти") { recover(userID: userID) }
                .buttonStyle(SageButtonStyle())
        }
        .padding(18)
        .studioCard()
    }

    private func recover(userID: UUID) {
        guard newPin == newPinConfirm else {
            errorMessage = "PIN-коды не совпадают"
            return
        }
        do {
            try store.resetPIN(userID: userID, code: enteredCode, newPin: newPin)
            try store.logIn(userID: userID, pin: newPin)
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }

    private static func digits(_ value: String) -> String {
        String(value.filter { $0 >= "0" && $0 <= "9" }.prefix(8))
    }
}
