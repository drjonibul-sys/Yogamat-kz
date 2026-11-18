//
//  VisitsPDF.swift
//  Приложение Yogamat_kz
//

import UIKit

enum VisitsPDF {
    /// Табель посещений за месяц, готовый к печати или сохранению в «Файлы».
    static func make(month: Int, year: Int, store: StudioStore) -> URL? {
        let key = RU.monthKey(year: year, month: month)
        let days = daysInMonth(year: year, month: month)

        var perClient: [UUID: Set<Int>] = [:]
        for visit in store.visits where visit.date.hasPrefix(key) {
            guard let day = Int(visit.date.suffix(2)), (1...days).contains(day) else { continue }
            perClient[visit.clientID, default: []].insert(day)
        }

        let clients = perClient.keys
            .compactMap { store.client($0) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }

        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842)
        let margin: CGFloat = 26
        let nameWidth: CGFloat = 138
        let totalWidth: CGFloat = 30
        let gridWidth = pageRect.width - margin * 2
        let dayWidth = (gridWidth - nameWidth - totalWidth) / CGFloat(days)
        let rowHeight: CGFloat = 15
        let headerHeight: CGFloat = 16
        let bottomLimit = pageRect.height - margin - 18

        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let data = renderer.pdfData { context in
            var pageNumber = 0
            var y: CGFloat = 0

            func startPage() {
                context.beginPage()
                pageNumber += 1
                y = margin

                Self.draw(
                    "Табель посещений — \(RU.monthNames[month - 1]) \(String(year))",
                    in: CGRect(x: margin, y: y, width: gridWidth, height: 24),
                    font: .systemFont(ofSize: 17, weight: .semibold),
                    color: UIColor(red: 0.12, green: 0.16, blue: 0.13, alpha: 1)
                )
                y += 22

                Self.draw(
                    "\(store.studioName) · сформировано \(RU.shortDate(RU.key(Date())))",
                    in: CGRect(x: margin, y: y, width: gridWidth, height: 14),
                    font: .systemFont(ofSize: 9),
                    color: UIColor(white: 0.42, alpha: 1)
                )
                y += 18

                Self.draw(
                    "Клиент",
                    in: CGRect(x: margin, y: y, width: nameWidth, height: headerHeight),
                    font: .systemFont(ofSize: 7, weight: .semibold),
                    color: .darkGray
                )
                for day in 1...days {
                    let x = margin + nameWidth + CGFloat(day - 1) * dayWidth
                    Self.draw(
                        "\(day)",
                        in: CGRect(x: x, y: y, width: dayWidth, height: headerHeight),
                        font: .systemFont(ofSize: 6),
                        color: .darkGray,
                        align: .center
                    )
                }
                Self.draw(
                    "Итого",
                    in: CGRect(
                        x: margin + nameWidth + CGFloat(days) * dayWidth,
                        y: y,
                        width: totalWidth,
                        height: headerHeight
                    ),
                    font: .systemFont(ofSize: 7, weight: .semibold),
                    color: .darkGray,
                    align: .center
                )
                y += headerHeight + 2
            }

            startPage()

            if clients.isEmpty {
                Self.draw(
                    "За этот месяц отмеченных визитов нет.",
                    in: CGRect(x: margin, y: y + 6, width: gridWidth, height: 16),
                    font: .systemFont(ofSize: 10),
                    color: .darkGray
                )
            } else {
                for client in clients {
                    if y + rowHeight > bottomLimit {
                        Self.drawFooter(pageNumber: pageNumber, pageRect: pageRect, margin: margin)
                        startPage()
                    }

                    let visited = perClient[client.id] ?? []
                    Self.draw(
                        client.name,
                        in: CGRect(x: margin, y: y + 1, width: nameWidth - 4, height: rowHeight - 2),
                        font: .systemFont(ofSize: 8),
                        color: .black
                    )

                    for day in 1...days where visited.contains(day) {
                        let x = margin + nameWidth + CGFloat(day - 1) * dayWidth
                        Self.draw(
                            "•",
                            in: CGRect(x: x, y: y, width: dayWidth, height: rowHeight),
                            font: .systemFont(ofSize: 9),
                            color: UIColor(red: 0.43, green: 0.58, blue: 0.41, alpha: 1),
                            align: .center
                        )
                    }

                    Self.draw(
                        "\(visited.count)",
                        in: CGRect(
                            x: margin + nameWidth + CGFloat(days) * dayWidth,
                            y: y + 1,
                            width: totalWidth,
                            height: rowHeight - 2
                        ),
                        font: .systemFont(ofSize: 8, weight: .semibold),
                        color: .black,
                        align: .center
                    )

                    let line = UIBezierPath()
                    line.move(to: CGPoint(x: margin, y: y + rowHeight))
                    line.addLine(to: CGPoint(x: pageRect.width - margin, y: y + rowHeight))
                    UIColor(white: 0.88, alpha: 1).setStroke()
                    line.lineWidth = 0.5
                    line.stroke()

                    y += rowHeight
                }
            }

            Self.drawFooter(pageNumber: pageNumber, pageRect: pageRect, margin: margin)
        }

        let name = "Табель визитов \(RU.monthNames[month - 1]) \(String(year)).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: url)
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }

    private static func draw(
        _ text: String,
        in rect: CGRect,
        font: UIFont,
        color: UIColor,
        align: NSTextAlignment = .left
    ) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = align
        paragraph.lineBreakMode = .byTruncatingTail
        (text as NSString).draw(in: rect, withAttributes: [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: paragraph
        ])
    }

    private static func drawFooter(pageNumber: Int, pageRect: CGRect, margin: CGFloat) {
        draw(
            "\(pageNumber)",
            in: CGRect(x: pageRect.width - margin - 60, y: pageRect.height - margin + 4, width: 60, height: 12),
            font: .systemFont(ofSize: 7),
            color: .gray,
            align: .right
        )
    }

    private static func daysInMonth(year: Int, month: Int) -> Int {
        let calendar = RU.calendar
        guard let date = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = calendar.range(of: .day, in: .month, for: date) else {
            return 30
        }
        return range.count
    }
}
