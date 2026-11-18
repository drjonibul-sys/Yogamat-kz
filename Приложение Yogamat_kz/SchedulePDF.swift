//
//  SchedulePDF.swift
//  Приложение Yogamat_kz
//

import UIKit

enum SchedulePDF {
    /// PDF расписания на неделю с понедельника weekStart.
    static func make(weekStart: Date, store: StudioStore) -> URL? {
        guard let data = makeData(weekStart: weekStart, store: store) else { return nil }
        let name = "Расписание \(RU.weekRangeLabel(start: weekStart)).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: url)
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }

    static func makeData(weekStart: Date, store: StudioStore) -> Data? {
        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842)
        let margin: CGFloat = 28
        let gridWidth = pageRect.width - margin * 2
        let bottomLimit = pageRect.height - margin - 16

        let ink = UIColor(red: 0.12, green: 0.16, blue: 0.13, alpha: 1)
        let soft = UIColor(white: 0.42, alpha: 1)
        let lineColor = UIColor(white: 0.88, alpha: 1)

        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        return renderer.pdfData { context in
            var pageNumber = 0
            var y: CGFloat = 0

            func beginPage(first: Bool) {
                context.beginPage()
                pageNumber += 1
                y = margin

                if first {
                    Self.draw(
                        "Расписание занятий",
                        in: CGRect(x: margin, y: y, width: gridWidth, height: 24),
                        font: .systemFont(ofSize: 18, weight: .semibold),
                        color: ink
                    )
                    y += 22

                    let year = RU.calendar.component(.year, from: weekStart)
                    Self.draw(
                        "\(RU.weekRangeLabel(start: weekStart)) \(year) · \(store.studioName)",
                        in: CGRect(x: margin, y: y, width: gridWidth, height: 14),
                        font: .systemFont(ofSize: 9.5),
                        color: soft
                    )
                    y += 14

                    Self.draw(
                        "Сформировано \(RU.shortDate(RU.key(Date())))",
                        in: CGRect(x: margin, y: y, width: gridWidth, height: 12),
                        font: .systemFont(ofSize: 8.5),
                        color: soft
                    )
                    y += 20
                } else {
                    Self.draw(
                        "Расписание занятий — продолжение",
                        in: CGRect(x: margin, y: y, width: gridWidth, height: 14),
                        font: .systemFont(ofSize: 10, weight: .semibold),
                        color: soft
                    )
                    y += 20
                }
            }

            func ensure(_ needed: CGFloat) {
                if y + needed > bottomLimit {
                    Self.drawFooter(pageNumber: pageNumber, pageRect: pageRect, margin: margin)
                    beginPage(first: false)
                }
            }

            beginPage(first: true)

            for offset in 0..<7 {
                let day = RU.date(byAddingDays: offset, to: weekStart)
                let classes = store.classes(onWeekday: RU.weekdayIndex(of: day))
                let dayHeight = 18 + CGFloat(max(classes.count, 1)) * 24 + 10
                ensure(min(dayHeight, bottomLimit - margin - 4))

                let title = Self.capitalizeFirst(RU.weekdayLong(day))
                Self.draw(
                    title,
                    in: CGRect(x: margin, y: y, width: gridWidth, height: 14),
                    font: .systemFont(ofSize: 11, weight: .semibold),
                    color: ink
                )
                y += 16

                if classes.isEmpty {
                    Self.draw(
                        "Занятий нет",
                        in: CGRect(x: margin + 2, y: y, width: gridWidth - 2, height: 12),
                        font: .systemFont(ofSize: 8.5),
                        color: soft
                    )
                    y += 14
                } else {
                    for item in classes {
                        ensure(26)

                        Self.draw(
                            RU.classTime(item.startMinutes),
                            in: CGRect(x: margin, y: y, width: 50, height: 12),
                            font: .systemFont(ofSize: 9, weight: .semibold),
                            color: ink
                        )
                        Self.draw(
                            item.name,
                            in: CGRect(x: margin + 56, y: y, width: gridWidth - 56, height: 12),
                            font: .systemFont(ofSize: 9, weight: .semibold),
                            color: ink
                        )

                        var details: [String] = []
                        if !item.hall.isEmpty { details.append(item.hall) }
                        let trainer = store.trainerNames(for: item)
                        if !trainer.isEmpty { details.append(trainer) }
                        let booked = store.bookedCount(forClass: item.id, on: RU.key(day))
                        let free = max(0, item.capacity - booked)
                        details.append(free > 0 ? "свободно \(free) из \(item.capacity) мест" : "мест нет")
                        Self.draw(
                            details.joined(separator: " · "),
                            in: CGRect(x: margin + 56, y: y + 12, width: gridWidth - 56, height: 11),
                            font: .systemFont(ofSize: 8),
                            color: soft
                        )
                        y += 16

                        let line = UIBezierPath()
                        line.move(to: CGPoint(x: margin, y: y))
                        line.addLine(to: CGPoint(x: pageRect.width - margin, y: y))
                        lineColor.setStroke()
                        line.lineWidth = 0.5
                        line.stroke()
                        y += 8
                    }
                }
                y += 8
            }

            Self.drawFooter(pageNumber: pageNumber, pageRect: pageRect, margin: margin)
        }
    }

    private static func capitalizeFirst(_ text: String) -> String {
        guard let first = text.first else { return text }
        return String(first).uppercased() + text.dropFirst()
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
}
