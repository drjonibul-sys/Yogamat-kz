//
//  IncomeCharts.swift
//  Приложение Yogamat_kz
//

import SwiftUI

private func niceAxisCeil(_ value: Double) -> Double {
    guard value > 0 else { return 1 }
    let exponent = floor(log10(value))
    let base = pow(10, exponent)
    let fraction = value / base
    let steps: [Double] = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    let rounded = steps.first { fraction <= $0 } ?? 10
    return rounded * base
}

struct MonthlyBarsChart: View {
    let values: [Double]
    let selectedIndex: Int

    private let plotHeight: CGFloat = 170
    private let gap: CGFloat = 5
    private let axisWidth: CGFloat = 40

    var body: some View {
        let axisMax = niceAxisCeil(max(values.max() ?? 0, 1000))
        let rawMin = min(values.min() ?? 0, 0)
        let axisMin = rawMin < 0 ? -niceAxisCeil(-rawMin) : 0
        let span = axisMax - axisMin

        VStack(spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                axisLabels(axisMax: axisMax, axisMin: axisMin, span: span)
                    .frame(width: axisWidth, height: plotHeight)

                GeometryReader { proxy in
                    bars(width: proxy.size.width, axisMax: axisMax, span: span)
                }
                .frame(height: plotHeight)
            }

            monthLabels
                .padding(.leading, axisWidth + 8)
        }
    }

    private func axisLabels(axisMax: Double, axisMin: Double, span: Double) -> some View {
        let ticks: [Double] = axisMin < 0 ? [axisMax, axisMax / 2, 0, axisMin] : [axisMax, axisMax / 2, 0]
        return GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                ForEach(ticks, id: \.self) { tick in
                    Text(RU.shortAxis(tick))
                        .font(.rounded(9.5))
                        .foregroundStyle(Palette.inkSoft)
                        .frame(width: axisWidth, alignment: .trailing)
                        .position(
                            x: axisWidth / 2,
                            y: yPosition(tick, axisMax: axisMax, span: span, height: proxy.size.height)
                        )
                }
            }
        }
    }

    private func yPosition(_ value: Double, axisMax: Double, span: Double, height: CGFloat) -> CGFloat {
        let ratio = (axisMax - value) / max(span, 1)
        let raw = height * CGFloat(ratio)
        return max(6, min(height - 6, raw))
    }

    private func bars(width: CGFloat, axisMax: Double, span: Double) -> some View {
        let barWidth = max(4, (width - gap * 11) / 12)
        let zeroLineY = yPosition(0, axisMax: axisMax, span: span, height: plotHeight)

        return ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(Palette.hairline)
                .frame(width: width, height: 1)
                .position(x: width / 2, y: zeroLineY)

            ForEach(values.indices, id: \.self) { index in
                let value = values[index]
                let barHeight = CGFloat(abs(value) / span) * plotHeight
                let centerX = barWidth / 2 + CGFloat(index) * (barWidth + gap)
                let centerY = value > 0
                    ? zeroLineY - barHeight / 2
                    : (value < 0 ? zeroLineY + barHeight / 2 : zeroLineY)

                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(color(for: index, value: value))
                    .frame(width: barWidth, height: max(2, barHeight))
                    .position(x: centerX, y: centerY)

                if index == selectedIndex, value != 0 {
                    Text(RU.shortAxis(value))
                        .font(.rounded(10, .semibold))
                        .foregroundStyle(Palette.ink)
                        .position(
                            x: centerX,
                            y: value > 0
                                ? max(8, zeroLineY - barHeight - 10)
                                : min(plotHeight - 8, zeroLineY + barHeight + 10)
                        )
                }
            }
        }
        .frame(width: width, height: plotHeight)
    }

    private func color(for index: Int, value: Double) -> Color {
        if index == selectedIndex {
            return value < 0 ? Palette.terracotta : Palette.sageDeep
        }
        return value < 0 ? Palette.powder : Palette.sage.opacity(0.45)
    }

    private var monthLabels: some View {
        HStack(spacing: gap) {
            ForEach(RU.monthShortNames.indices, id: \.self) { index in
                Text(RU.monthShortNames[index])
                    .font(.rounded(9))
                    .foregroundStyle(Palette.inkSoft)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

struct CumulativeLineChart: View {
    let values: [Double]

    private let plotHeight: CGFloat = 130
    private let axisWidth: CGFloat = 40

    var body: some View {
        let axisMax = niceAxisCeil(max(values.max() ?? 0, 1000))
        let rawMin = min(values.min() ?? 0, 0)
        let axisMin = rawMin < 0 ? -niceAxisCeil(-rawMin) : 0
        let span = axisMax - axisMin

        HStack(alignment: .top, spacing: 8) {
            axisLabels(axisMax: axisMax, axisMin: axisMin, span: span)
                .frame(width: axisWidth, height: plotHeight)

            GeometryReader { proxy in
                chart(width: proxy.size.width, axisMax: axisMax, span: span)
            }
            .frame(height: plotHeight)
        }
    }

    private func axisLabels(axisMax: Double, axisMin: Double, span: Double) -> some View {
        let ticks: [Double] = axisMin < 0 ? [axisMax, 0, axisMin] : [axisMax, 0]
        return GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                ForEach(ticks, id: \.self) { tick in
                    Text(RU.shortAxis(tick))
                        .font(.rounded(9.5))
                        .foregroundStyle(Palette.inkSoft)
                        .frame(width: axisWidth, alignment: .trailing)
                        .position(
                            x: axisWidth / 2,
                            y: max(6, min(proxy.size.height - 6, yPosition(tick, axisMax: axisMax, span: span)))
                        )
                }
            }
        }
    }

    private func yPosition(_ value: Double, axisMax: Double, span: Double) -> CGFloat {
        let inset: CGFloat = 4
        let usableHeight = plotHeight - inset * 2
        let ratio = (axisMax - value) / max(span, 1)
        return inset + usableHeight * CGFloat(min(max(ratio, 0), 1))
    }

    private func chart(width: CGFloat, axisMax: Double, span: Double) -> some View {
        let inset: CGFloat = 4
        let usableWidth = max(1, width - inset * 2)
        let zeroY = yPosition(0, axisMax: axisMax, span: span)

        let points: [CGPoint] = values.indices.map { index in
            let value = values[index]
            let x = inset + usableWidth * CGFloat(index) / CGFloat(max(values.count - 1, 1))
            return CGPoint(x: x, y: yPosition(value, axisMax: axisMax, span: span))
        }

        return ZStack(alignment: .topLeading) {
            Path { path in
                guard let first = points.first, let last = points.last else { return }
                path.move(to: CGPoint(x: first.x, y: zeroY))
                for point in points { path.addLine(to: point) }
                path.addLine(to: CGPoint(x: last.x, y: zeroY))
                path.closeSubpath()
            }
            .fill(Palette.sage.opacity(0.10))

            Path { path in
                guard let first = points.first else { return }
                path.move(to: first)
                for point in points.dropFirst() { path.addLine(to: point) }
            }
            .stroke(Palette.sage, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

            if let last = points.last {
                Circle()
                    .fill(Palette.sageDeep)
                    .frame(width: 7, height: 7)
                    .position(x: last.x, y: last.y)
            }
        }
        .frame(width: width, height: plotHeight)
    }
}
