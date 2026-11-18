//
//  Asanas.swift
//  Приложение Yogamat_kz
//

import Foundation
import UIKit
import SwiftUI

struct Asana: Identifiable, Codable, Hashable {
    let id: String
    let imageKey: String
    let order: Int
    let level: Int
    let russian: String
    let hindi: String
    let transcription: String
    let sanskritLatin: String
    let summary: String
    let steps: [String]
    let attention: [String]
    let modifications: String
    let caution: String
    let duration: String
    let sources: [AsanaSource]

    var levelTitle: String {
        switch level {
        case 1: return "Лёгкий"
        case 2: return "Средний"
        default: return "Тяжёлый"
        }
    }
}

struct AsanaSource: Codable, Hashable {
    let title: String
    let url: String
}

struct AsanaImage: Codable, Hashable {
    let imageKey: String
    let path: String
    let columns: Int
    let rows: Int
    let column: Int
    let row: Int
}

final class AsanaLibrary {
    static let shared = AsanaLibrary()

    let asanas: [Asana]
    let regions: [String: AsanaImage]
    private let byID: [String: Asana]

    private init() {
        if let url = AsanaLibrary.resourceURL("asanas", "json"),
           let data = try? Data(contentsOf: url),
           let decoded = try? JSONDecoder().decode([Asana].self, from: data) {
            asanas = decoded.sorted { $0.order < $1.order }
        } else {
            asanas = []
        }

        if let url = AsanaLibrary.resourceURL("images", "json"),
           let data = try? Data(contentsOf: url),
           let decoded = try? JSONDecoder().decode([String: AsanaImage].self, from: data) {
            regions = decoded
        } else {
            regions = [:]
        }

        byID = Dictionary(uniqueKeysWithValues: asanas.map { ($0.id, $0) })
    }

    func asana(_ id: String) -> Asana? {
        byID[id]
    }

    func levelCount(_ level: Int) -> Int {
        asanas.filter { $0.level == level }.count
    }

    static func resourceURL(_ name: String, _ ext: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: ext)
            ?? Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "исходные данные")
    }
}

/// Кроп анатомических листов атласа по координатам из исходных данных.
final class AtlasImages {
    static let shared = AtlasImages()

    private let cache = NSCache<NSString, UIImage>()
    private let queue = DispatchQueue(label: "kz.yogamat.atlas", qos: .userInitiated)

    private init() {
        cache.countLimit = 140
        cache.totalCostLimit = 48 * 1024 * 1024
    }

    func cached(key: String, maxSide: CGFloat) -> UIImage? {
        cache.object(forKey: Self.cacheKey(key, maxSide) as NSString)
    }

    func image(key: String, maxSide: CGFloat) async -> UIImage? {
        let cacheKey = Self.cacheKey(key, maxSide)
        if let cached = cache.object(forKey: cacheKey as NSString) { return cached }

        return await withCheckedContinuation { (continuation: CheckedContinuation<UIImage?, Never>) in
            queue.async {
                let result = self.render(key: key, maxSide: maxSide)
                if let result {
                    self.cache.setObject(
                        result,
                        forKey: cacheKey as NSString,
                        cost: Int(result.size.width * result.size.height * 4)
                    )
                }
                continuation.resume(returning: result)
            }
        }
    }

    private static func cacheKey(_ key: String, _ maxSide: CGFloat) -> String {
        "\(key)-\(Int(maxSide))"
    }

    private func render(key: String, maxSide: CGFloat) -> UIImage? {
        guard let region = AsanaLibrary.shared.regions[key] else { return nil }

        let file = (region.path as NSString).lastPathComponent
        let base = (file as NSString).deletingPathExtension
        let ext = (file as NSString).pathExtension

        guard let url = AsanaLibrary.resourceURL(base, ext),
              let sheet = UIImage(contentsOfFile: url.path),
              let source = sheet.cgImage else { return nil }

        let cellWidth = CGFloat(source.width) / CGFloat(max(region.columns, 1))
        let cellHeight = CGFloat(source.height) / CGFloat(max(region.rows, 1))
        let rect = CGRect(
            x: CGFloat(region.column) * cellWidth,
            y: CGFloat(region.row) * cellHeight,
            width: cellWidth,
            height: cellHeight
        )
        guard let cropped = source.cropping(to: rect.integral) else { return nil }

        let longest = max(CGFloat(cropped.width), CGFloat(cropped.height))
        guard maxSide > 0, longest > maxSide else { return UIImage(cgImage: cropped) }

        let ratio = maxSide / longest
        let width = max(1, Int((CGFloat(cropped.width) * ratio).rounded()))
        let height = max(1, Int((CGFloat(cropped.height) * ratio).rounded()))
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return UIImage(cgImage: cropped)
        }
        context.interpolationQuality = .high
        context.draw(cropped, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let scaled = context.makeImage() else { return UIImage(cgImage: cropped) }
        return UIImage(cgImage: scaled)
    }
}

struct AsanaImageView: View {
    let imageKey: String
    var maxSide: CGFloat = 480

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Rectangle().fill(Palette.sageTint.opacity(0.35))
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "figure.mind.and.body")
                    .font(.system(size: 20))
                    .foregroundStyle(Palette.sage.opacity(0.6))
            }
        }
        .clipped()
        .task(id: imageKey) {
            if let cached = AtlasImages.shared.cached(key: imageKey, maxSide: maxSide) {
                image = cached
                return
            }
            image = await AtlasImages.shared.image(key: imageKey, maxSide: maxSide)
        }
    }
}
