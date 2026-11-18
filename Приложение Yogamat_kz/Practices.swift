//
//  Practices.swift
//  Приложение Yogamat_kz
//

import Foundation
import SwiftUI

struct PracticeStage: Codable, Hashable {
    let title: String
    let minutes: Int
    let poses: [String]
    let action: String
    let technique: String
    let sensations: String
    let adaptation: String
}

enum PracticeGroup: String, CaseIterable, Identifiable {
    case easyToMedium
    case mediumToHard
    case easy
    case medium
    case hard

    var id: String { rawValue }

    var title: String {
        switch self {
        case .easyToMedium: return "Лёгкая → средняя"
        case .mediumToHard: return "Средняя → тяжёлая"
        case .easy: return "Лёгкая"
        case .medium: return "Средняя"
        case .hard: return "Тяжёлая"
        }
    }

    var order: Int {
        switch self {
        case .easyToMedium: return 0
        case .mediumToHard: return 1
        case .easy: return 2
        case .medium: return 3
        case .hard: return 4
        }
    }
}

struct Practice: Identifiable, Codable, Hashable {
    let id: String
    let level: Int
    let kind: String
    let title: String
    let goal: String
    let suitable: String
    let readiness: String
    let equipment: String
    let focus: [String]
    let coverPose: String
    let durationMinutes: Int
    let stages: [PracticeStage]
    var order: Int?

    var group: PracticeGroup {
        if kind == "transition" {
            return level >= 3 ? .mediumToHard : .easyToMedium
        }
        switch level {
        case 1: return .easy
        case 2: return .medium
        default: return .hard
        }
    }
}

struct PracticeRoute: Hashable {
    enum Kind: Hashable {
        case practice(String)
        case asana(String)
    }

    let kind: Kind

    static func practice(_ id: String) -> PracticeRoute {
        PracticeRoute(kind: .practice(id))
    }

    static func asana(_ id: String) -> PracticeRoute {
        PracticeRoute(kind: .asana(id))
    }
}

final class PracticeLibrary {
    static let shared = PracticeLibrary()

    let practices: [Practice]
    private let byID: [String: Practice]

    private init() {
        var items: [Practice] = []
        if let url = AsanaLibrary.resourceURL("practices", "json"),
           let data = try? Data(contentsOf: url),
           let decoded = try? JSONDecoder().decode([Practice].self, from: data) {
            items = decoded
            for index in items.indices {
                items[index].order = index
            }
            items.sort { lhs, rhs in
                if lhs.group != rhs.group {
                    return lhs.group.order < rhs.group.order
                }
                return (lhs.order ?? 0) < (rhs.order ?? 0)
            }
        }
        practices = items
        byID = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
    }

    func practice(_ id: String) -> Practice? {
        byID[id]
    }
}

func practiceGroupColors(_ group: PracticeGroup) -> (background: Color, foreground: Color) {
    switch group {
    case .easy:
        return (Palette.sageTint, Palette.sageDeep)
    case .easyToMedium:
        return (Palette.powderTint, Palette.terracotta)
    case .medium:
        return (Palette.powder, Palette.terracotta)
    case .mediumToHard:
        return (Palette.sand, Palette.ink)
    case .hard:
        return (Palette.terracotta.opacity(0.16), Palette.terracotta)
    }
}

struct PracticeGroupPill: View {
    let group: PracticeGroup

    var body: some View {
        let colors = practiceGroupColors(group)
        Text(group.title)
            .font(.rounded(11.5, .medium))
            .foregroundStyle(colors.foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(colors.background))
    }
}
