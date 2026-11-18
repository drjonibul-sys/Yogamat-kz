//
//  ClientsCSV.swift
//  Приложение Yogamat_kz
//

import Foundation

enum ClientsCSV {
    /// Таблица клиентов: имя, телефон, заметка, «клиент с», тариф и остаток занятий.
    static func make(clients: [Client], name: String, store: StudioStore) -> URL? {
        guard !clients.isEmpty else { return nil }

        let header = [
            "Имя", "Телефон", "Заметка", "Клиент с", "Тариф", "Осталось"
        ]
        .map(field)
        .joined(separator: ";")
        var lines: [String] = [header]

        for client in clients {
            let subscription = store.activeSubscription(for: client.id)
            let row = [
                client.name,
                client.phone,
                client.note,
                RU.shortDate(client.since),
                subscription?.tariffName ?? "",
                subscription.map { "\($0.visitsLeft) из \($0.visitsTotal)" } ?? "нет абонемента"
            ]
            lines.append(row.map(field).joined(separator: ";"))
        }

        // BOM помогает Excel открыть файл в UTF-8.
        let text = "\u{FEFF}" + lines.joined(separator: "\r\n") + "\r\n"
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(fileName(name) + ".csv")
        try? FileManager.default.removeItem(at: url)
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    private static func field(_ value: String) -> String {
        let clean = value
            .replacingOccurrences(of: "\"", with: "\"\"")
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        return "\"" + clean + "\""
    }

    private static func fileName(_ value: String) -> String {
        value
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
    }
}
