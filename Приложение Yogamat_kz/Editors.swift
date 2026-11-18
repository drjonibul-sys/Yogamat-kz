//
//  Editors.swift
//  Приложение Yogamat_kz
//

import SwiftUI

// MARK: - Клиент

struct ClientEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let client: Client?

    @State private var name: String
    @State private var phone: String
    @State private var note: String
    @State private var since: Date
    @State private var errorMessage: String?

    init(client: Client?) {
        self.client = client
        _name = State(initialValue: client?.name ?? "")
        _phone = State(initialValue: client?.phone ?? "")
        _note = State(initialValue: client?.note ?? "")
        _since = State(initialValue: client.flatMap { RU.date(fromKey: $0.since) } ?? Date())
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        LabeledField("Имя и фамилия") {
                            TextField("Например: Айгуль Ким", text: $name)
                                .textInputAutocapitalization(.words)
                        }
                        LabeledField("Телефон") {
                            TextField("+7 700 000 00 00", text: $phone)
                                .keyboardType(.phonePad)
                        }
                        LabeledField("Заметка") {
                            TextField("Например: ограничения по здоровью", text: $note, axis: .vertical)
                                .lineLimit(3...5)
                        }
                        LabeledField("Клиент с") {
                            DatePicker("", selection: $since, displayedComponents: .date)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                        }
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(client == nil ? "Новый клиент" : "Клиент")
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
        }
        .presentationBackground(Palette.canvas)
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func save() {
        do {
            if let client {
                try store.updateClient(
                    id: client.id,
                    name: name,
                    phone: phone,
                    note: note,
                    since: RU.key(since)
                )
            } else {
                try store.addClient(
                    name: name,
                    phone: phone,
                    note: note,
                    since: RU.key(since)
                )
            }
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Абонемент

struct SubscriptionEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let clientID: UUID
    let previous: Subscription?

    @State private var tariffName = ""
    @State private var total = 8
    @State private var days = 30
    @State private var purchase = Date()
    @State private var priceText = ""
    @State private var paid = false
    @State private var paidDate = Date()
    @State private var errorMessage: String?

    init(clientID: UUID, previous: Subscription? = nil) {
        self.clientID = clientID
        self.previous = previous

        let purchaseDate = previous.flatMap { RU.date(fromKey: $0.expiryDate) } ?? Date()
        let durationDays: Int
        if let previous {
            durationDays = max(1, RU.daysBetween(from: previous.purchaseDate, to: previous.expiryDate))
        } else {
            durationDays = 30
        }

        _tariffName = State(initialValue: previous?.tariffName ?? "")
        _total = State(initialValue: previous?.visitsTotal ?? 8)
        _days = State(initialValue: durationDays)
        _purchase = State(initialValue: purchaseDate)
        _priceText = State(initialValue: previous.map { String(Int($0.price)) } ?? "")
    }

    private var expiryKey: String {
        RU.addDays(days, toKey: RU.key(purchase))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        if previous != nil {
                            Text("Тариф, срок и цена подставлены из последнего абонемента — дату покупки и остальные поля можно изменить.")
                                .font(.rounded(12))
                                .foregroundStyle(Palette.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        LabeledField("Тариф") {
                            TextField("Например: 8 занятий / месяц", text: $tariffName)
                        }

                        if !store.orderedTariffs.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(store.orderedTariffs) { tariff in
                                        Button {
                                            tariffName = tariff.name
                                            total = tariff.visitsCount
                                            days = tariff.durationDays
                                            priceText = String(Int(tariff.price))
                                        } label: {
                                            Text(tariff.name)
                                                .font(.rounded(12.5, .medium))
                                                .foregroundStyle(Palette.sageDeep)
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 7)
                                                .background(Capsule().fill(Palette.sageTint))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 2)
                            }
                        }

                        LabeledField("Занятий в абонементе") {
                            HStack {
                                Text("\(total)")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $total, in: 1...999)
                                    .labelsHidden()
                            }
                        }
                        LabeledField("Срок действия") {
                            HStack {
                                Text("\(days) \(RUPlural.days(days))")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $days, in: 1...365)
                                    .labelsHidden()
                            }
                        }
                        LabeledField("Дата покупки") {
                            DatePicker("", selection: $purchase, displayedComponents: .date)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                        }

                        HStack {
                            Text("Действует до")
                                .font(.rounded(13))
                                .foregroundStyle(Palette.inkSoft)
                            Spacer()
                            Text(RU.longDay(expiryKey))
                                .font(.rounded(13.5, .medium))
                                .foregroundStyle(Palette.sageDeep)
                        }
                        .padding(.horizontal, 4)

                        LabeledField("Цена, ₸") {
                            TextField("15 000", text: $priceText)
                                .keyboardType(.decimalPad)
                        }
                        LabeledField("Оплата") {
                            Toggle("Оплачено", isOn: $paid)
                                .font(.rounded(16))
                                .tint(Palette.sage)
                        }
                        if paid {
                            LabeledField("Дата оплаты") {
                                DatePicker("", selection: $paidDate, displayedComponents: .date)
                                    .labelsHidden()
                                    .datePickerStyle(.compact)
                            }
                        }
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Новый абонемент")
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
        }
        .presentationBackground(Palette.canvas)
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func save() {
        let normalized = priceText
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        do {
            guard let price = Double(normalized), price >= 0 else {
                throw StoreError("Укажите цену — ноль или больше")
            }
            try store.addSubscription(
                clientID: clientID,
                tariffName: tariffName,
                purchaseDate: RU.key(purchase),
                expiryDate: expiryKey,
                visitsTotal: total,
                price: price,
                paid: paid,
                paidDate: paid ? RU.key(paidDate) : nil
            )
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Визит

struct VisitEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let initialClientID: UUID?

    @State private var selectedID: UUID?
    @State private var date = Date()
    @State private var classID: UUID?
    @State private var errorMessage: String?

    private var candidates: [Client] { store.clientsWithActiveSubscription }

    private var dayClasses: [StudioClass] {
        store.classes(onWeekday: RU.weekdayIndex(of: date))
    }

    private var selectedSubscription: Subscription? {
        guard let selectedID else { return nil }
        return store.activeSubscription(for: selectedID)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        if candidates.isEmpty {
                            EmptyHintCard(
                                icon: "ticket",
                                title: "Нет клиентов с абонементом",
                                message: "Сначала добавьте клиенту действующий абонемент."
                            )
                        } else {
                            LabeledField("Клиент") {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 12) {
                                        ForEach(candidates) { client in
                                            Button {
                                                selectedID = client.id
                                            } label: {
                                                VStack(spacing: 6) {
                                                    AvatarView(name: client.name, size: 44)
                                                        .overlay(
                                                            Circle()
                                                                .strokeBorder(
                                                                    selectedID == client.id ? Palette.sageDeep : Color.clear,
                                                                    lineWidth: 2
                                                                )
                                                        )
                                                    Text(shortName(client.name))
                                                        .font(.rounded(11.5, selectedID == client.id ? .semibold : .regular))
                                                        .foregroundStyle(selectedID == client.id ? Palette.sageDeep : Palette.inkSoft)
                                                        .lineLimit(1)
                                                }
                                                .frame(width: 62)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(.vertical, 2)
                                }
                            }

                            LabeledField("Дата занятия") {
                                DatePicker("", selection: $date, displayedComponents: .date)
                                    .labelsHidden()
                                    .datePickerStyle(.compact)
                            }

                            LabeledField("Направление") {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        FilterPill(title: "Без направления", selected: classID == nil) {
                                            classID = nil
                                        }
                                        ForEach(dayClasses) { item in
                                            FilterPill(title: item.name, selected: classID == item.id) {
                                                classID = item.id
                                            }
                                        }
                                    }
                                    .padding(.vertical, 1)
                                }
                            }

                            if let subscription = selectedSubscription {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Спишется с «\(subscription.tariffName)»")
                                        .font(.rounded(13.5, .medium))
                                        .foregroundStyle(Palette.ink)
                                    Text("Останется \(max(0, subscription.visitsLeft - 1)) из \(subscription.visitsTotal)")
                                        .font(.rounded(12.5))
                                        .foregroundStyle(Palette.inkSoft)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .fill(Palette.sageTint.opacity(0.7))
                                )
                            }

                            Button("Отметить визит") { save() }
                                .buttonStyle(SageButtonStyle(filled: true))
                                .disabled(selectedID == nil)
                                .opacity(selectedID == nil ? 0.45 : 1)
                        }
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Новый визит")
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
            .onAppear {
                if selectedID == nil || !candidates.contains(where: { $0.id == selectedID }) {
                    selectedID = initialClientID.flatMap { id in
                        candidates.contains(where: { $0.id == id }) ? id : nil
                    } ?? candidates.first?.id
                }
            }
            .onChange(of: date) { _, _ in
                if let classID, !dayClasses.contains(where: { $0.id == classID }) {
                    self.classID = nil
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

    private func save() {
        guard let selectedID else {
            errorMessage = "Выберите клиента"
            return
        }
        do {
            try store.markVisit(clientID: selectedID, date: RU.key(date), classID: classID)
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Перенос

struct TransferEditor: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let subscriptionID: UUID

    @State private var days = 7
    @State private var date = Date()
    @State private var note = ""
    @State private var errorMessage: String?

    private var subscription: Subscription? { store.subscription(subscriptionID) }

    private var newExpiry: String? {
        guard let subscription else { return nil }
        return RU.addDays(days, toKey: subscription.expiryDate)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                StudioBackground()
                ScrollView {
                    VStack(spacing: 14) {
                        Text("Занятие не списывается. Срок действия абонемента продлевается — клиент сможет использовать занятие позже.")
                            .font(.rounded(13))
                            .foregroundStyle(Palette.inkSoft)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)

                        LabeledField("Продлить на") {
                            HStack {
                                Text("\(days) \(RUPlural.days(days))")
                                    .font(.rounded(16, .medium))
                                    .foregroundStyle(Palette.ink)
                                Spacer()
                                Stepper("", value: $days, in: 1...90)
                                    .labelsHidden()
                            }
                        }
                        LabeledField("Дата переноса") {
                            DatePicker("", selection: $date, displayedComponents: .date)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                        }
                        LabeledField("Комментарий") {
                            TextField("Причина переноса", text: $note)
                        }

                        if let subscription, let newExpiry {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Сейчас: до \(RU.longDay(subscription.expiryDate))")
                                    .font(.rounded(12.5))
                                    .foregroundStyle(Palette.inkSoft)
                                Text("Станет: до \(RU.longDay(newExpiry))")
                                    .font(.rounded(13.5, .medium))
                                    .foregroundStyle(Palette.sageDeep)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(Palette.sageTint.opacity(0.7))
                            )
                        }

                        Button("Продлить абонемент") { save() }
                            .buttonStyle(SageButtonStyle(filled: true))
                    }
                    .padding(18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Перенести занятие")
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

    private func save() {
        do {
            try store.addTransfer(
                subscriptionID: subscriptionID,
                days: days,
                date: RU.key(date),
                note: note
            )
            dismiss()
        } catch let error {
            errorMessage = error.localizedDescription
        }
    }
}
