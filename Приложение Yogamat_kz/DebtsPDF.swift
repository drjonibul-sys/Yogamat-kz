//
//  DebtsPDF.swift
//  Приложение Yogamat_kz
//

import UIKit

enum DebtsPDF {
    /// Список неоплаченных абонементов, готовый к печати или сохранению в «Файлы».
    static func make(store: StudioStore) -> URL? {
        let debts = store.subscriptions
            .filter { !$0.paid }
            .sorted { first, second in
                if first.purchaseDate != second.purchaseDate {
                    return first.purchaseDate > second.purchaseDate
                }
                return first.tariffName.localizedStandardCompare(second.tariffName) == .orderedAscending
            }
        guard !debts.isEmpty else { return nil }

        let total = debts.reduce(0) { $0 + $1.price }
        let clientsCount = Set(debts.map(\.clientID)).count
        let summary = "Итого: \(RU.money(total)) · \(debts.count) \(RUPlural.abonements(debts.count)) у \(clientsCount) \(RUPlural.clients(clientsCount))"

        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842)
        let margin: CGFloat = 26
        let contentWidth = pageRect.width - margin * 2
        let nameWidth: CGFloat = 196
        let tariffWidth: CGFloat = 156
        let dateWidth: CGFloat = 84
        let sumWidth = contentWidth - nameWidth - tariffWidth - dateWidth
        let rowHeight: CGFloat = 17
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
                    "Долги",
                    in: CGRect(x: margin, y: y, width: contentWidth, height: 24),
                    font: .systemFont(ofSize: 17, weight: .semibold),
                    color: UIColor(red: 0.12, green: 0.16, blue: 0.13, alpha: 1)
                )
                y += 22

                Self.draw(
                    "\(store.studioName) · сформировано \(RU.shortDate(RU.key(Date())))",
                    in: CGRect(x: margin, y: y, width: contentWidth, height: 14),
                    font: .systemFont(ofSize: 9),
                    color: UIColor(white: 0.42, alpha: 1)
                )
                y += 16

                Self.draw(
                    summary,
                    in: CGRect(x: margin, y: y, width: contentWidth, height: 14),
                    font: .systemFont(ofSize: 9, weight: .medium),
                    color: UIColor(red: 0.69, green: 0.42, blue: 0.29, alpha: 1)
                )
                y += 20

                let headerRect = CGRect(x: margin, y: y, width: contentWidth, height: headerHeight)
                Self.draw(
                    "Клиент",
                    in: CGRect(x: margin, y: y, width: nameWidth, height: headerHeight),
                    font: .systemFont(ofSize: 7, weight: .semibold),
                    color: .darkGray
                )
                Self.draw(
                    "Тариф",
                    in: CGRect(x: margin + nameWidth, y: y, width: tariffWidth, height: headerHeight),
                    font: .systemFont(ofSize: 7, weight: .semibold),
                    color: .darkGray
                )
                Self.draw(
                    "Куплен",
                    in: CGRect(x: margin + nameWidth + tariffWidth, y: y, width: dateWidth, height: headerHeight),
                    font: .systemFont(ofSize: 7, weight: .semibold),
                    color: .darkGray
                )
                Self.draw(
                    "Сумма",
                    in: CGRect(
                        x: margin + nameWidth + tariffWidth + dateWidth,
                        y: y,
                        width: sumWidth,
                        height: headerHeight
                    ),
                    font: .systemFont(ofSize: 7, weight: .semibold),
                    color: .darkGray,
                    align: .right
                )
                let line = UIBezierPath()
                line.move(to: CGPoint(x: margin, y: headerRect.maxY))
                line.addLine(to: CGPoint(x: pageRect.width - margin, y: headerRect.maxY))
                UIColor(white: 0.88, alpha: 1).setStroke()
                line.lineWidth = 0.5
                line.stroke()
                y += headerHeight + 2
            }

            startPage()

            for subscription in debts {
                if y + rowHeight > bottomLimit {
                    Self.drawFooter(pageNumber: pageNumber, pageRect: pageRect, margin: margin)
                    startPage()
                }

                let client = store.client(subscription.clientID)?.name ?? "—"
                let purchase = RU.shortDate(subscription.purchaseDate)

                Self.draw(
                    client,
                    in: CGRect(x: margin, y: y + 1, width: nameWidth - 4, height: rowHeight - 2),
                    font: .systemFont(ofSize: 8),
                    color: .black
                )
                Self.draw(
                    subscription.tariffName,
                    in: CGRect(
                        x: margin + nameWidth,
                        y: y + 1,
                        width: tariffWidth - 4,
                        height: rowHeight - 2
                    ),
                    font: .systemFont(ofSize: 8),
                    color: .darkGray
                )
                Self.draw(
                    purchase,
                    in: CGRect(
                        x: margin + nameWidth + tariffWidth,
                        y: y + 1,
                        width: dateWidth - 4,
                        height: rowHeight - 2
                    ),
                    font: .systemFont(ofSize: 8),
                    color: .darkGray
                )
                Self.draw(
                    RU.money(subscription.price),
                    in: CGRect(
                        x: margin + nameWidth + tariffWidth + dateWidth,
                        y: y + 1,
                        width: sumWidth,
                        height: rowHeight - 2
                    ),
                    font: .systemFont(ofSize: 8, weight: .semibold),
                    color: UIColor(red: 0.69, green: 0.42, blue: 0.29, alpha: 1),
                    align: .right
                )

                let line = UIBezierPath()
                line.move(to: CGPoint(x: margin, y: y + rowHeight))
                line.addLine(to: CGPoint(x: pageRect.width - margin, y: y + rowHeight))
                UIColor(white: 0.88, alpha: 1).setStroke()
                line.lineWidth = 0.5
                line.stroke()

                y += rowHeight
            }

            Self.drawFooter(pageNumber: pageNumber, pageRect: pageRect, margin: margin)
        }

        let name = "Долги \(RU.shortDate(RU.key(Date()))).pdf"
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
}
