//
//  Theme.swift
//  Приложение Yogamat_kz
//

import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

enum Palette {
    static let canvas = Color(hex: 0xF3F6EF)
    static let ink = Color(hex: 0x1F2A22)
    static let inkSoft = Color(hex: 0x6E7C6F)
    static let hairline = Color(hex: 0xE4E9DF)
    static let card = Color(hex: 0xFDFDFB)
    static let sage = Color(hex: 0x8FA98B)
    static let sageDeep = Color(hex: 0x5C7A58)
    static let sageTint = Color(hex: 0xE4EDE0)
    static let powder = Color(hex: 0xF3DCD3)
    static let powderTint = Color(hex: 0xFBE9E3)
    static let terracotta = Color(hex: 0xB06A4A)
    static let sand = Color(hex: 0xEFE6D9)
}

extension Font {
    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

struct StudioBackground: View {
    var body: some View {
        ZStack {
            Palette.canvas
            Circle()
                .fill(Palette.sage.opacity(0.20))
                .frame(width: 460, height: 460)
                .blur(radius: 120)
                .offset(x: 170, y: -340)
            Circle()
                .fill(Palette.powder.opacity(0.30))
                .frame(width: 380, height: 380)
                .blur(radius: 130)
                .offset(x: -170, y: 420)
            if let mark = UIImage(named: "LogoMark") {
                Image(uiImage: mark)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 300)
                    .opacity(0.05)
                    .blendMode(.multiply)
                    .allowsHitTesting(false)
            }
        }
        .ignoresSafeArea()
    }
}

struct BrandLogo: View {
    var width: CGFloat = 120

    var body: some View {
        Group {
            if let image = UIImage(named: "Logo") {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "leaf.fill")
                    .font(.system(size: width * 0.4))
                    .foregroundStyle(Palette.sageDeep)
                    .frame(width: width, height: width)
            }
        }
        .frame(width: width, height: width)
        .clipShape(RoundedRectangle(cornerRadius: width * 0.18, style: .continuous))
    }
}

struct BrandMark: View {
    var size: CGFloat = 22

    var body: some View {
        Group {
            if let image = UIImage(named: "LogoMark") {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "leaf.fill")
                    .font(.system(size: size * 0.7))
                    .foregroundStyle(Palette.sageDeep)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
    }
}

struct StudioCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(Palette.card)
                    .shadow(color: Palette.ink.opacity(0.05), radius: 16, x: 0, y: 8)
            )
    }
}

extension View {
    func studioCard() -> some View {
        modifier(StudioCardModifier())
    }
}

struct SageButtonStyle: ButtonStyle {
    var filled: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.rounded(15.5, .semibold))
            .foregroundStyle(filled ? Color.white : Palette.sageDeep)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(filled ? Palette.sage : Palette.sageTint)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
    }
}
