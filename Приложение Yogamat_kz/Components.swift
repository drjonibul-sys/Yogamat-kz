//
//  Components.swift
//  Приложение Yogamat_kz
//

import SwiftUI

/// «Айгуль К.» — имя и первая буква фамилии.
func shortName(_ fullName: String) -> String {
    let parts = fullName.split(separator: " ")
    guard let first = parts.first else { return fullName }
    if parts.count > 1, let initial = parts[1].first {
        return "\(first) \(initial)."
    }
    return String(first)
}

enum AvatarTone {
    case sage
    case powder
    case sand

    var background: Color {
        switch self {
        case .sage: return Palette.sage
        case .powder: return Palette.powder
        case .sand: return Palette.sand
        }
    }

    var foreground: Color {
        switch self {
        case .sage: return .white
        case .powder, .sand: return Palette.ink
        }
    }

    static func forName(_ name: String) -> AvatarTone {
        let sum = name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        switch sum % 3 {
        case 0: return .sage
        case 1: return .powder
        default: return .sand
        }
    }
}

struct AvatarView: View {
    let name: String
    var size: CGFloat = 44

    private var initials: String {
        let letters = name
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
            .map(String.init)
            .joined()
            .uppercased()
        return letters.isEmpty ? "—" : letters
    }

    var body: some View {
        let tone = AvatarTone.forName(name)
        ZStack {
            Circle().fill(tone.background)
            Text(initials)
                .font(.rounded(size * 0.34, .semibold))
                .foregroundStyle(tone.foreground)
        }
        .frame(width: size, height: size)
    }
}

struct StatCard: View {
    let icon: String
    let title: String
    let value: String
    var caption: String?
    var background: Color = Palette.card
    var iconColor: Color = Palette.inkSoft
    var captionColor: Color = Palette.terracotta

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(iconColor)
                .padding(.bottom, 4)
            Text(title)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.ink.opacity(0.85))
                .lineLimit(2)
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .topLeading)
            Text(value)
                .font(.rounded(32, .bold))
                .foregroundStyle(Palette.ink)
            if let caption {
                Text(caption)
                    .font(.rounded(11.5))
                    .foregroundStyle(captionColor)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 138, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(background)
                .shadow(color: Palette.ink.opacity(0.04), radius: 12, x: 0, y: 6)
        )
    }
}

struct StatusPill: View {
    let status: SubscriptionStatus

    private var background: Color {
        switch status {
        case .active: return Palette.sageTint
        case .finished: return Palette.powderTint
        case .expired: return Palette.sand
        }
    }

    private var foreground: Color {
        switch status {
        case .active: return Palette.sageDeep
        case .finished: return Palette.terracotta
        case .expired: return Palette.inkSoft
        }
    }

    var body: some View {
        Text(status.title)
            .font(.rounded(11.5, .medium))
            .foregroundStyle(foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(background))
    }
}

struct InfoRow: View {
    let title: String
    let value: String
    var valueColor: Color = Palette.ink

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(title)
                .font(.rounded(13.5))
                .foregroundStyle(Palette.inkSoft)
            Spacer(minLength: 8)
            Text(value)
                .font(.rounded(13.5, .medium))
                .foregroundStyle(valueColor)
                .multilineTextAlignment(.trailing)
        }
    }
}

struct LabeledField<Content: View>: View {
    private let title: String
    private let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)
            content
                .font(.rounded(16))
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Palette.card)
                )
        }
    }
}

struct EmptyHintCard: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Palette.sage)
            Text(title)
                .font(.rounded(15, .semibold))
                .foregroundStyle(Palette.ink)
            Text(message)
                .font(.rounded(12.5))
                .foregroundStyle(Palette.inkSoft)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 26)
        .padding(.horizontal, 18)
        .studioCard()
    }
}

func levelColors(_ level: String) -> (background: Color, foreground: Color) {
    switch level {
    case "Лёгкий": return (Palette.sageTint, Palette.sageDeep)
    case "Средний": return (Palette.powder, Palette.terracotta)
    default: return (Palette.sand, Palette.ink)
    }
}

struct LevelPill: View {
    let level: String

    var body: some View {
        let colors = levelColors(level)
        Text(level)
            .font(.rounded(11.5, .medium))
            .foregroundStyle(colors.foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(colors.background))
    }
}

struct FilterPill: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.rounded(12.5, .medium))
                .foregroundStyle(selected ? Color.white : Palette.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(selected ? Palette.sage : Palette.card))
        }
        .buttonStyle(.plain)
    }
}
