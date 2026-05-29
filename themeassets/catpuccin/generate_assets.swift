import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

typealias LabColor = (L: Double, a: Double, b: Double)
typealias RgbColor = (r: Double, g: Double, b: Double)

struct OklchColor {
    let L: Double
    let C: Double
    let h: Double
}

struct HueAnchor {
    let sourceHue: Double
    let target: OklchColor
}

struct Swatch {
    let name: String
    let family: String
    let lab: LabColor
    let rgb: RgbColor
}

struct AssetProfile {
    let name: String
    let anchors: [HueAnchor]
    let snapStrength: Double
    let detailPreserve: Double
    let contrast: Double
    let chromaBoost: Double
    let shadowCoolStrength: Double
    let highlightCoolStrength: Double
    let verdantStrength: Double
    let warmSurfaceStrength: Double
    let neutralCoolStrength: Double
    let minShadowL: Double
    let maxHighlightL: Double
    let hueRotation: Double
    let neutralHueName: String
    let neutralTargetL: Double
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

func clamp(_ value: Double, _ minValue: Double = 0.0, _ maxValue: Double = 1.0) -> Double {
    min(maxValue, max(minValue, value))
}

func lerp(_ start: Double, _ end: Double, _ t: Double) -> Double {
    start + ((end - start) * clamp(t))
}

func smoothstep(_ minValue: Double, _ maxValue: Double, _ value: Double) -> Double {
    if maxValue <= minValue {
        return value >= maxValue ? 1.0 : 0.0
    }
    let t = clamp((value - minValue) / (maxValue - minValue))
    return t * t * (3.0 - (2.0 * t))
}

func mixAnglesDeg(_ from: Double, _ to: Double, _ t: Double) -> Double {
    let amount = clamp(t)
    let delta = ((((to - from).truncatingRemainder(dividingBy: 360.0)) + 540.0).truncatingRemainder(dividingBy: 360.0)) - 180.0
    return (from + (delta * amount) + 360.0).truncatingRemainder(dividingBy: 360.0)
}

func hueDistanceDeg(_ a: Double, _ b: Double) -> Double {
    abs(((((a - b).truncatingRemainder(dividingBy: 360.0)) + 540.0).truncatingRemainder(dividingBy: 360.0)) - 180.0)
}

func hueProximity(_ center: Double, _ width: Double, _ hue: Double) -> Double {
    1.0 - clamp(hueDistanceDeg(hue, center) / max(1.0, width))
}

func srgbChannelToLinear(_ value: Double) -> Double {
    value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
}

func linearChannelToSrgb(_ value: Double) -> Double {
    value <= 0.0031308 ? value * 12.92 : (1.055 * pow(value, 1.0 / 2.4)) - 0.055
}

func rgbToOklab(_ r: Double, _ g: Double, _ b: Double) -> LabColor {
    let lr = srgbChannelToLinear(clamp(r))
    let lg = srgbChannelToLinear(clamp(g))
    let lb = srgbChannelToLinear(clamp(b))
    let l = (0.4122214708 * lr) + (0.5363325363 * lg) + (0.0514459929 * lb)
    let m = (0.2119034982 * lr) + (0.6806995451 * lg) + (0.1073969566 * lb)
    let s = (0.0883024619 * lr) + (0.2817188376 * lg) + (0.6299787005 * lb)
    let lRoot = cbrt(l)
    let mRoot = cbrt(m)
    let sRoot = cbrt(s)
    return (
        L: (0.2104542553 * lRoot) + (0.793617785 * mRoot) - (0.0040720468 * sRoot),
        a: (1.9779984951 * lRoot) - (2.428592205 * mRoot) + (0.4505937099 * sRoot),
        b: (0.0259040371 * lRoot) + (0.7827717662 * mRoot) - (0.808675766 * sRoot)
    )
}

func oklabToRgb(_ L: Double, _ a: Double, _ b: Double) -> RgbColor {
    let lRoot = L + (0.3963377774 * a) + (0.2158037573 * b)
    let mRoot = L - (0.1055613458 * a) - (0.0638541728 * b)
    let sRoot = L - (0.0894841775 * a) - (1.291485548 * b)
    let l = lRoot * lRoot * lRoot
    let m = mRoot * mRoot * mRoot
    let s = sRoot * sRoot * sRoot
    let lr = (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s)
    let lg = (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s)
    let lb = (-0.0041960863 * l) - (0.7034186147 * m) + (1.707614701 * s)
    return (r: linearChannelToSrgb(lr), g: linearChannelToSrgb(lg), b: linearChannelToSrgb(lb))
}

func oklabToOklch(_ lab: LabColor) -> OklchColor {
    let chroma = sqrt((lab.a * lab.a) + (lab.b * lab.b))
    var hue = atan2(lab.b, lab.a) * (180.0 / Double.pi)
    if hue < 0 { hue += 360.0 }
    return OklchColor(L: lab.L, C: chroma, h: hue)
}

func oklchToOklab(_ L: Double, _ C: Double, _ h: Double) -> LabColor {
    let angle = h * Double.pi / 180.0
    return (L: L, a: C * cos(angle), b: C * sin(angle))
}

func isInSrgbGamut(_ rgb: RgbColor) -> Bool {
    rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1
}

func oklchToClippedSrgb(_ L: Double, _ C: Double, _ h: Double) -> RgbColor {
    var lab = oklchToOklab(L, C, h)
    var rgb = oklabToRgb(lab.L, lab.a, lab.b)
    if isInSrgbGamut(rgb) {
        return (r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b))
    }

    var low = 0.0
    var high = C
    var best = (r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b))
    for _ in 0..<8 {
        let mid = (low + high) / 2.0
        lab = oklchToOklab(L, mid, h)
        rgb = oklabToRgb(lab.L, lab.a, lab.b)
        if isInSrgbGamut(rgb) {
            low = mid
            best = (r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b))
        } else {
            high = mid
        }
    }
    return best
}

func hexToOklch(_ hex: String) -> OklchColor {
    let sanitized = hex.replacingOccurrences(of: "#", with: "")
    let r = Double(Int(sanitized.prefix(2), radix: 16) ?? 0) / 255.0
    let g = Double(Int(sanitized.dropFirst(2).prefix(2), radix: 16) ?? 0) / 255.0
    let b = Double(Int(sanitized.dropFirst(4).prefix(2), radix: 16) ?? 0) / 255.0
    return oklabToOklch(rgbToOklab(r, g, b))
}

let colors: [String: OklchColor] = [
    "rosewater": hexToOklch("#f5e0dc"),
    "flamingo": hexToOklch("#f2cdcd"),
    "pink": hexToOklch("#f5c2e7"),
    "crust": hexToOklch("#11111b"),
    "mantle": hexToOklch("#181825"),
    "base": hexToOklch("#1e1e2e"),
    "surface0": hexToOklch("#313244"),
    "surface1": hexToOklch("#45475a"),
    "surface2": hexToOklch("#585b70"),
    "overlay0": hexToOklch("#6c7086"),
    "overlay1": hexToOklch("#7f849c"),
    "overlay2": hexToOklch("#9399b2"),
    "subtext0": hexToOklch("#a6adc8"),
    "subtext1": hexToOklch("#bac2de"),
    "text": hexToOklch("#cdd6f4"),
    "red": hexToOklch("#f38ba8"),
    "maroon": hexToOklch("#eba0ac"),
    "peach": hexToOklch("#fab387"),
    "yellow": hexToOklch("#f9e2af"),
    "green": hexToOklch("#a6e3a1"),
    "teal": hexToOklch("#94e2d5"),
    "sky": hexToOklch("#89dceb"),
    "sapphire": hexToOklch("#74c7ec"),
    "blue": hexToOklch("#89b4fa"),
    "lavender": hexToOklch("#b4befe"),
    "mauve": hexToOklch("#cba6f7")
]

let swatchFamilies: [String: String] = [
    "crust": "neutral", "mantle": "neutral", "base": "neutral", "surface0": "neutral", "surface1": "neutral", "surface2": "neutral",
    "overlay0": "neutral", "overlay1": "neutral", "overlay2": "neutral", "subtext0": "neutral", "subtext1": "neutral", "text": "neutral",
    "rosewater": "warm", "flamingo": "warm", "pink": "warm", "red": "warm", "maroon": "warm", "peach": "warm", "yellow": "warm",
    "green": "cool", "teal": "cool", "sky": "cool", "sapphire": "cool", "blue": "cool", "lavender": "cool", "mauve": "cool"
]

let swatchOrder = [
    "crust", "mantle", "base", "surface0", "surface1", "overlay0", "overlay1", "subtext0", "text",
    "rosewater", "pink", "maroon", "peach", "yellow", "green", "teal", "sky", "sapphire", "blue", "lavender", "mauve"
]

let swatches: [Swatch] = swatchOrder.map { name in
    let color = colors[name]!
    let lab = oklchToOklab(color.L, color.C, color.h)
    let rgb = oklchToClippedSrgb(color.L, color.C, color.h)
    return Swatch(name: name, family: swatchFamilies[name] ?? "neutral", lab: lab, rgb: rgb)
}

let neutralStops: [(t: Double, value: Double)] = [
    (0.0, lerp(colors["mantle"]!.L, colors["base"]!.L, 0.45)),
    (0.18, colors["base"]!.L),
    (0.56, colors["surface0"]!.L),
    (0.84, colors["surface1"]!.L),
    (1.0, min(0.965, colors["text"]!.L))
]

let dither4x4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
]

func sampleStopValue(_ t: Double) -> Double {
    let clampedT = clamp(t)
    for index in 0..<(neutralStops.count - 1) {
        let current = neutralStops[index]
        let next = neutralStops[index + 1]
        if clampedT <= next.t {
            let amount = smoothstep(current.t, next.t, clampedT)
            return lerp(current.value, next.value, amount)
        }
    }
    return neutralStops.last?.value ?? 0.0
}

func anchorList(_ values: [(Double, String)]) -> [HueAnchor] {
    values.map { HueAnchor(sourceHue: $0.0, target: colors[$0.1]!) }
}

func buildProfile(_ name: String) -> AssetProfile? {
    switch name {
    case "donkey":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "maroon"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "sapphire"), (205, "blue"), (260, "lavender"), (325, "mauve"), (360, "maroon")]),
            snapStrength: 0.08,
            detailPreserve: 0.22,
            contrast: 0.10,
            chromaBoost: 0.12,
            shadowCoolStrength: 0.22,
            highlightCoolStrength: 0.10,
            verdantStrength: 0.38,
            warmSurfaceStrength: 0.72,
            neutralCoolStrength: 0.34,
            minShadowL: 0.22,
            maxHighlightL: 0.90,
            hueRotation: -4.0,
            neutralHueName: "lavender",
            neutralTargetL: lerp(colors["overlay0"]!.L, colors["subtext0"]!.L, 0.28)
        )
    case "house":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "maroon"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "teal"), (205, "blue"), (260, "lavender"), (325, "pink"), (360, "maroon")]),
            snapStrength: 0.08,
            detailPreserve: 0.22,
            contrast: 0.10,
            chromaBoost: 0.12,
            shadowCoolStrength: 0.22,
            highlightCoolStrength: 0.10,
            verdantStrength: 0.48,
            warmSurfaceStrength: 0.72,
            neutralCoolStrength: 0.38,
            minShadowL: 0.22,
            maxHighlightL: 0.92,
            hueRotation: -4.0,
            neutralHueName: "lavender",
            neutralTargetL: lerp(colors["subtext0"]!.L, colors["rosewater"]!.L, 0.32)
        )
    case "ground":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "surface0"), (120, "overlay0"), (240, "lavender"), (360, "surface0")]),
            snapStrength: 0.06,
            detailPreserve: 0.20,
            contrast: 0.08,
            chromaBoost: 0.06,
            shadowCoolStrength: 0.18,
            highlightCoolStrength: 0.12,
            verdantStrength: 0.0,
            warmSurfaceStrength: 0.08,
            neutralCoolStrength: 0.88,
            minShadowL: 0.26,
            maxHighlightL: 0.62,
            hueRotation: -6.0,
            neutralHueName: "lavender",
            neutralTargetL: lerp(colors["surface1"]!.L, colors["overlay0"]!.L, 0.42)
        )
    case "explore":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "red"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "teal"), (205, "sky"), (260, "lavender"), (325, "pink"), (360, "red")]),
            snapStrength: 0.08,
            detailPreserve: 0.26,
            contrast: 0.12,
            chromaBoost: 0.14,
            shadowCoolStrength: 0.24,
            highlightCoolStrength: 0.14,
            verdantStrength: 0.52,
            warmSurfaceStrength: 0.70,
            neutralCoolStrength: 0.32,
            minShadowL: 0.20,
            maxHighlightL: 0.94,
            hueRotation: -2.0,
            neutralHueName: "lavender",
            neutralTargetL: lerp(colors["subtext0"]!.L, colors["rosewater"]!.L, 0.24)
        )
    case "palma":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "maroon"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "teal"), (205, "blue"), (260, "lavender"), (325, "mauve"), (360, "maroon")]),
            snapStrength: 0.24,
            detailPreserve: 0.14,
            contrast: 0.14,
            chromaBoost: 0.18,
            shadowCoolStrength: 0.34,
            highlightCoolStrength: 0.04,
            verdantStrength: 0.72,
            warmSurfaceStrength: 0.40,
            neutralCoolStrength: 0.52,
            minShadowL: 0.16,
            maxHighlightL: 0.68,
            hueRotation: -6.0,
            neutralHueName: "mauve",
            neutralTargetL: lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.24)
        )
    case "mango":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "red"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "teal"), (205, "blue"), (260, "lavender"), (325, "pink"), (360, "red")]),
            snapStrength: 0.32,
            detailPreserve: 0.24,
            contrast: 0.18,
            chromaBoost: 0.26,
            shadowCoolStrength: 0.44,
            highlightCoolStrength: 0.20,
            verdantStrength: 0.42,
            warmSurfaceStrength: 0.72,
            neutralCoolStrength: 0.28,
            minShadowL: 0.17,
            maxHighlightL: 0.89,
            hueRotation: 2.5,
            neutralHueName: "lavender",
            neutralTargetL: colors["surface1"]!.L
        )
    case "pineapple":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "maroon"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "green"), (205, "sky"), (260, "lavender"), (325, "mauve"), (360, "maroon")]),
            snapStrength: 0.34,
            detailPreserve: 0.24,
            contrast: 0.20,
            chromaBoost: 0.24,
            shadowCoolStrength: 0.42,
            highlightCoolStrength: 0.18,
            verdantStrength: 0.58,
            warmSurfaceStrength: 0.64,
            neutralCoolStrength: 0.24,
            minShadowL: 0.18,
            maxHighlightL: 0.88,
            hueRotation: -1.5,
            neutralHueName: "lavender",
            neutralTargetL: colors["surface1"]!.L
        )
    case "papaya":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "red"), (28, "peach"), (60, "peach"), (95, "yellow"), (120, "green"), (150, "teal"), (205, "sky"), (260, "lavender"), (325, "rosewater"), (360, "red")]),
            snapStrength: 0.32,
            detailPreserve: 0.24,
            contrast: 0.18,
            chromaBoost: 0.24,
            shadowCoolStrength: 0.40,
            highlightCoolStrength: 0.22,
            verdantStrength: 0.38,
            warmSurfaceStrength: 0.74,
            neutralCoolStrength: 0.24,
            minShadowL: 0.18,
            maxHighlightL: 0.89,
            hueRotation: 5.0,
            neutralHueName: "lavender",
            neutralTargetL: colors["surface1"]!.L
        )
    case "cocoa":
        return AssetProfile(
            name: name,
            anchors: anchorList([(0, "maroon"), (28, "peach"), (60, "yellow"), (95, "yellow"), (120, "green"), (150, "sapphire"), (205, "blue"), (260, "lavender"), (325, "mauve"), (360, "maroon")]),
            snapStrength: 0.26,
            detailPreserve: 0.28,
            contrast: 0.14,
            chromaBoost: 0.14,
            shadowCoolStrength: 0.56,
            highlightCoolStrength: 0.22,
            verdantStrength: 0.32,
            warmSurfaceStrength: 0.42,
            neutralCoolStrength: 0.40,
            minShadowL: 0.17,
            maxHighlightL: 0.86,
            hueRotation: -4.5,
            neutralHueName: "lavender",
            neutralTargetL: colors["surface1"]!.L
        )
    default:
        return nil
    }
}

func interpolateHueAnchor(_ hue: Double, _ anchors: [HueAnchor]) -> OklchColor {
    let wrappedHue = ((hue.truncatingRemainder(dividingBy: 360.0)) + 360.0).truncatingRemainder(dividingBy: 360.0)
    for index in 0..<(anchors.count - 1) {
        let current = anchors[index]
        let next = anchors[index + 1]
        if wrappedHue <= next.sourceHue {
            let amount = clamp((wrappedHue - current.sourceHue) / max(0.0001, next.sourceHue - current.sourceHue))
            return OklchColor(
                L: lerp(current.target.L, next.target.L, amount),
                C: lerp(current.target.C, next.target.C, amount),
                h: mixAnglesDeg(current.target.h, next.target.h, amount)
            )
        }
    }
    return anchors.last!.target
}

func percentileFromHistogram(_ histogram: [Int], _ total: Int, _ percentile: Double) -> Double {
    if total == 0 { return 0 }
    let target = max(0, min(total - 1, Int(Double(total) * clamp(percentile))))
    var running = 0
    for (index, value) in histogram.enumerated() {
        running += value
        if running > target {
            return Double(index) / Double(max(1, histogram.count - 1))
        }
    }
    return 1.0
}

func buildStats(_ pixels: [UInt8]) -> (lowL: Double, highL: Double, chromaScale: Double) {
    var histogram = Array(repeating: 0, count: 64)
    let pixelCount = max(1, pixels.count / 4)
    let sampleStep = max(1, pixelCount / 12000)
    var sampleCount = 0
    var totalChroma = 0.0
    var maxChroma = 0.0
    var pixelIndex = 0
    while pixelIndex < pixelCount {
        let offset = pixelIndex * 4
        let alpha = Double(pixels[offset + 3]) / 255.0
        if alpha > 0.05 {
            let r = clamp(Double(pixels[offset]) / 255.0 / max(alpha, 0.0001))
            let g = clamp(Double(pixels[offset + 1]) / 255.0 / max(alpha, 0.0001))
            let b = clamp(Double(pixels[offset + 2]) / 255.0 / max(alpha, 0.0001))
            let lab = rgbToOklab(r, g, b)
            let lch = oklabToOklch(lab)
            let bin = max(0, min(histogram.count - 1, Int(round(lch.L * Double(histogram.count - 1)))))
            histogram[bin] += 1
            sampleCount += 1
            totalChroma += lch.C
            maxChroma = max(maxChroma, lch.C)
        }
        pixelIndex += sampleStep
    }
    let lowL = max(0.0, percentileFromHistogram(histogram, sampleCount, 0.025) - 0.015)
    let highL = min(1.0, percentileFromHistogram(histogram, sampleCount, 0.985) + 0.015)
    let avgChroma = sampleCount > 0 ? totalChroma / Double(sampleCount) : 0.0
    let chromaScale = max(0.08, avgChroma * 1.85, maxChroma * 0.82)
    return (lowL, max(lowL + 0.2, highL), chromaScale)
}

func scoreSwatch(_ swatch: Swatch, targetLab: LabColor, saturation: Double, verdantWeight: Double, warmWeight: Double, shadowWeight: Double, profile: AssetProfile) -> Double {
    let deltaL = swatch.lab.L - targetLab.L
    let deltaA = swatch.lab.a - targetLab.a
    let deltaB = swatch.lab.b - targetLab.b
    var score = sqrt((deltaL * deltaL * 1.4) + (deltaA * deltaA) + (deltaB * deltaB))
    if verdantWeight > 0.28 && swatch.family == "warm" {
        score += verdantWeight * profile.verdantStrength * 0.06
    }
    if warmWeight > 0.28 && swatch.family == "cool" && shadowWeight < 0.5 {
        score += warmWeight * profile.warmSurfaceStrength * 0.05
    }
    if saturation < 0.12 && swatch.family != "neutral" {
        score += (0.12 - saturation) * 0.08
    }
    if shadowWeight > 0.5 && swatch.lab.L > 0.8 {
        score += shadowWeight * 0.08
    }
    return score
}

func blendLab(_ from: LabColor, _ to: LabColor, _ t: Double) -> LabColor {
    (
        L: lerp(from.L, to.L, t),
        a: lerp(from.a, to.a, t),
        b: lerp(from.b, to.b, t)
    )
}

struct SoilToneStop {
    let t: Double
    let L: Double
    let C: Double
    let h: Double
}

func sampleSoilToneStop(_ t: Double, _ stops: [SoilToneStop]) -> OklchColor {
    let clampedT = clamp(t)
    for index in 0..<(stops.count - 1) {
        let current = stops[index]
        let next = stops[index + 1]
        if clampedT <= next.t {
            let amount = smoothstep(current.t, next.t, clampedT)
            return OklchColor(
                L: lerp(current.L, next.L, amount),
                C: lerp(current.C, next.C, amount),
                h: mixAnglesDeg(current.h, next.h, amount)
            )
        }
    }
    let last = stops.last!
    return OklchColor(L: last.L, C: last.C, h: last.h)
}

func groundSoilStops() -> [SoilToneStop] {
    let shadowHue = mixAnglesDeg(colors["base"]!.h, colors["mauve"]!.h, 0.12)
    let bodyHue = mixAnglesDeg(colors["surface0"]!.h, colors["lavender"]!.h, 0.08)
    let liftHue = mixAnglesDeg(colors["surface1"]!.h, colors["lavender"]!.h, 0.10)
    let fiberHue = mixAnglesDeg(colors["overlay0"]!.h, colors["lavender"]!.h, 0.10)
    return [
        SoilToneStop(t: 0.0, L: lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.30), C: 0.014, h: shadowHue),
        SoilToneStop(t: 0.18, L: lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.56), C: 0.018, h: shadowHue),
        SoilToneStop(t: 0.40, L: lerp(colors["surface1"]!.L, colors["overlay0"]!.L, 0.26), C: 0.022, h: bodyHue),
        SoilToneStop(t: 0.60, L: lerp(colors["surface1"]!.L, colors["overlay0"]!.L, 0.54), C: 0.026, h: bodyHue),
        SoilToneStop(t: 0.78, L: lerp(colors["overlay0"]!.L, colors["overlay1"]!.L, 0.30), C: 0.028, h: liftHue),
        SoilToneStop(t: 0.92, L: lerp(colors["overlay0"]!.L, colors["overlay1"]!.L, 0.60), C: 0.030, h: liftHue),
        SoilToneStop(t: 1.0, L: lerp(colors["overlay1"]!.L, colors["subtext0"]!.L, 0.24), C: 0.028, h: fiberHue)
    ]
}

func groundTileTextureT(x: Int, y: Int, width: Int, height: Int) -> Double {
    let fx = Double(x)
    let fy = Double(y)
    let nx = width > 1 ? fx / Double(width - 1) : 0.5
    let ny = height > 1 ? fy / Double(height - 1) : 0.5

    let furrowPrimary = sin((fx * 0.11) + (fy * 0.09) + 0.35) * 0.5 + 0.5
    let furrowSecondary = sin((fx * 0.07) - (fy * 0.08) + 1.15) * 0.5 + 0.5
    let rake = (furrowPrimary * 0.72) + (furrowSecondary * 0.28)

    let ditherIndex = ((y & 3) << 2) | (x & 3)
    let dither = Double(dither4x4[ditherIndex]) / 16.0

    let edgeDistance = abs(nx - 0.5) + abs(ny - 0.5) * 0.88
    let edgeShade = smoothstep(0.14, 0.56, edgeDistance) * 0.08

    return clamp(rake + (dither * 0.035) - edgeShade, 0.0, 1.0)
}

func recolorGroundPixel(
    sourceLab: LabColor,
    sourceLch: OklchColor,
    normalizedL: Double,
    normalizedC: Double,
    saturation: Double,
    x: Int,
    y: Int,
    width: Int,
    height: Int
) -> LabColor {
    let _ = x
    let _ = y
    let _ = width
    let _ = height
    let _ = sourceLch

    let contrastL = clamp((normalizedL - 0.5) * 1.62 + 0.5, 0.0, 1.0)
    let sampled = sampleSoilToneStop(contrastL, groundSoilStops())
    let shadowWeight = 1.0 - smoothstep(0.12, 0.44, contrastL)
    let highlightWeight = smoothstep(0.60, 0.88, contrastL)

    let targetC = clamp(
        sampled.C * pow(max(0.0001, normalizedC), 0.66) * (0.64 + saturation * 0.22),
        0.010,
        0.030
    )
    var targetHue = mixAnglesDeg(sampled.h, colors["surface0"]!.h, shadowWeight * 0.10)
    targetHue = mixAnglesDeg(targetHue, colors["peach"]!.h, highlightWeight * saturation * 0.03)
    let targetL = clamp(sampled.L + 0.120 - shadowWeight * 0.004 + highlightWeight * 0.022, lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.30), colors["subtext0"]!.L)
    var resolved = oklchToOklab(targetL, targetC, targetHue)

    // Preserve original hand-painted grooves mostly in lightness, not hue.
    let detailL = lerp(0.12, 0.22, saturation)
    let detailAB = lerp(0.03, 0.07, saturation)
    resolved = (
        L: lerp(resolved.L, sourceLab.L, detailL),
        a: lerp(resolved.a, sourceLab.a, detailAB),
        b: lerp(resolved.b, sourceLab.b, detailAB)
    )

    let bedTone = oklchToOklab(
        lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.52),
        colors["surface1"]!.C * 0.26,
        mixAnglesDeg(colors["surface0"]!.h, colors["mauve"]!.h, 0.12)
    )
    resolved = blendLab(resolved, bedTone, 0.10)

    let fiberTone = oklchToOklab(
        lerp(colors["surface1"]!.L, colors["overlay0"]!.L, 0.34),
        colors["lavender"]!.C * 0.10,
        mixAnglesDeg(colors["surface1"]!.h, colors["lavender"]!.h, 0.10)
    )
    let fiberWeight = highlightWeight * 0.14
    if fiberWeight > 0.001 {
        resolved = blendLab(resolved, fiberTone, fiberWeight)
    }

    let crackTone = oklchToOklab(
        lerp(colors["mantle"]!.L, colors["base"]!.L, 0.54),
        colors["mauve"]!.C * 0.14,
        mixAnglesDeg(colors["base"]!.h, colors["mauve"]!.h, 0.16)
    )
    if shadowWeight > 0.001 {
        resolved = blendLab(resolved, crackTone, shadowWeight * 0.10)
    }

    let warmSoilTint = oklchToOklab(
        lerp(colors["surface1"]!.L, colors["peach"]!.L, 0.26),
        colors["peach"]!.C * 0.14,
        mixAnglesDeg(colors["surface1"]!.h, colors["peach"]!.h, 0.16)
    )
    resolved = blendLab(resolved, warmSoilTint, 0.14)

    return resolved
}

func houseRoofStops() -> [SoilToneStop] {
    let shadowHue = mixAnglesDeg(colors["maroon"]!.h, colors["mauve"]!.h, 0.36)
    let tileHue = mixAnglesDeg(colors["mauve"]!.h, colors["peach"]!.h, 0.28)
    let warmHue = mixAnglesDeg(colors["peach"]!.h, colors["yellow"]!.h, 0.38)
    let gleamHue = mixAnglesDeg(colors["yellow"]!.h, colors["peach"]!.h, 0.22)
    return [
        SoilToneStop(t: 0.0, L: lerp(colors["base"]!.L, colors["surface0"]!.L, 0.42), C: 0.038, h: shadowHue),
        SoilToneStop(t: 0.20, L: colors["surface0"]!.L, C: 0.048, h: shadowHue),
        SoilToneStop(t: 0.40, L: lerp(colors["surface1"]!.L, colors["maroon"]!.L, 0.22), C: 0.058, h: tileHue),
        SoilToneStop(t: 0.58, L: lerp(colors["maroon"]!.L, colors["peach"]!.L, 0.35), C: 0.072, h: warmHue),
        SoilToneStop(t: 0.76, L: colors["peach"]!.L, C: 0.088, h: warmHue),
        SoilToneStop(t: 0.90, L: lerp(colors["peach"]!.L, colors["yellow"]!.L, 0.42), C: 0.092, h: gleamHue),
        SoilToneStop(t: 1.0, L: min(0.94, colors["yellow"]!.L * 0.98), C: 0.084, h: gleamHue)
    ]
}

func recolorHousePixel(
    sourceLab: LabColor,
    sourceLch: OklchColor,
    normalizedL: Double,
    normalizedC: Double,
    saturation: Double
) -> LabColor {
    let contrastL = clamp((normalizedL - 0.5) * 1.26 + 0.5, 0.0, 1.0)
    let shadowBand = 1.0 - smoothstep(0.12, 0.34, normalizedL)
    let highlightBand = smoothstep(0.68, 0.96, normalizedL)

    var wallWeight = smoothstep(0.46, 0.90, normalizedL) * (1.0 - smoothstep(0.12, 0.34, saturation))
    var roofWeight = smoothstep(0.18, 0.50, saturation) * (1.0 - wallWeight * 0.72)
    let foliageWeight = max(hueProximity(78, 52, sourceLch.h), hueProximity(108, 38, sourceLch.h))
        * smoothstep(0.14, 0.40, saturation) * (1.0 - wallWeight * 0.55)
    let woodWeightRaw = smoothstep(0.10, 0.32, saturation)
        * smoothstep(0.20, 0.62, normalizedL)
        * max(hueProximity(18, 48, sourceLch.h), hueProximity(340, 36, sourceLch.h), 0.18)
        * (1.0 - wallWeight * 0.80) * (1.0 - foliageWeight * 0.70)
    let shadowWeight = shadowBand * (1.0 - wallWeight * 0.35) * (1.0 - foliageWeight * 0.45)

    roofWeight = max(roofWeight, shadowWeight * 0.22)
    wallWeight = max(wallWeight, 0.001)
    let weightSum = wallWeight + roofWeight + foliageWeight + woodWeightRaw + shadowWeight + 0.0001
    wallWeight /= weightSum
    roofWeight /= weightSum
    let foliageW = foliageWeight / weightSum
    let woodW = woodWeightRaw / weightSum
    let shadowW = shadowWeight / weightSum

    let wallLight = oklchToOklab(
        lerp(colors["subtext0"]!.L, colors["rosewater"]!.L, 0.42),
        colors["lavender"]!.C * 0.12,
        mixAnglesDeg(colors["subtext0"]!.h, colors["lavender"]!.h, 0.18)
    )
    let wallShade = oklchToOklab(
        lerp(colors["overlay0"]!.L, colors["surface1"]!.L, 0.38),
        colors["surface1"]!.C * 0.55,
        mixAnglesDeg(colors["surface1"]!.h, colors["lavender"]!.h, 0.24)
    )
    let wallLab = blendLab(wallShade, wallLight, smoothstep(0.28, 0.92, normalizedL))

    let roofSample = sampleSoilToneStop(contrastL, houseRoofStops())
    let roofChroma = clamp(roofSample.C * pow(max(0.0001, normalizedC), 0.44) * (0.82 + saturation * 0.28), 0.028, 0.10)
    let roofLab = oklchToOklab(
        roofSample.L + (highlightBand * 0.028) - (shadowBand * 0.022),
        roofChroma,
        mixAnglesDeg(roofSample.h, colors["yellow"]!.h, highlightBand * 0.24)
    )

    let woodLab = oklchToOklab(
        lerp(colors["surface1"]!.L, colors["maroon"]!.L, 0.48),
        colors["maroon"]!.C * 0.42,
        mixAnglesDeg(colors["maroon"]!.h, colors["peach"]!.h, 0.22)
    )

    let foliageLab = oklchToOklab(
        lerp(colors["surface1"]!.L, colors["green"]!.L, 0.52),
        colors["green"]!.C * 0.52,
        mixAnglesDeg(colors["green"]!.h, colors["teal"]!.h, 0.18)
    )

    let shadowLab = oklchToOklab(
        lerp(colors["base"]!.L, colors["surface0"]!.L, 0.55),
        colors["mauve"]!.C * 0.22,
        mixAnglesDeg(colors["surface0"]!.h, colors["mauve"]!.h, 0.20)
    )

    var resolved = (
        L: wallLab.L * wallWeight + roofLab.L * roofWeight + foliageLab.L * foliageW + woodLab.L * woodW + shadowLab.L * shadowW,
        a: wallLab.a * wallWeight + roofLab.a * roofWeight + foliageLab.a * foliageW + woodLab.a * woodW + shadowLab.a * shadowW,
        b: wallLab.b * wallWeight + roofLab.b * roofWeight + foliageLab.b * foliageW + woodLab.b * woodW + shadowLab.b * shadowW
    )

    let detailL = lerp(0.10, 0.22, saturation) * (1.0 - wallWeight * 0.35)
    let detailAB = lerp(0.12, 0.24, saturation)
    resolved = (
        L: lerp(resolved.L, sourceLab.L, detailL),
        a: lerp(resolved.a, sourceLab.a, detailAB),
        b: lerp(resolved.b, sourceLab.b, detailAB)
    )

    if wallWeight > 0.20 {
        resolved = blendLab(resolved, wallLab, wallWeight * 0.38)
    }
    if roofWeight > 0.18 {
        resolved = blendLab(resolved, roofLab, roofWeight * 0.22)
    }

    let signWeight = highlightBand * wallWeight * 0.55
    if signWeight > 0.001 {
        let signTone = oklchToOklab(
            lerp(colors["peach"]!.L, colors["yellow"]!.L, 0.36),
            colors["yellow"]!.C * 0.42,
            colors["yellow"]!.h
        )
        resolved = blendLab(resolved, signTone, signWeight)
    }

    return resolved
}

func exploreSignStops() -> [SoilToneStop] {
    let shadowHue = mixAnglesDeg(colors["maroon"]!.h, colors["mauve"]!.h, 0.30)
    let boardHue = mixAnglesDeg(colors["maroon"]!.h, colors["peach"]!.h, 0.26)
    let gleamHue = mixAnglesDeg(colors["peach"]!.h, colors["rosewater"]!.h, 0.14)
    return [
        SoilToneStop(t: 0.0, L: lerp(colors["base"]!.L, colors["maroon"]!.L, 0.36), C: 0.034, h: shadowHue),
        SoilToneStop(t: 0.24, L: lerp(colors["surface0"]!.L, colors["maroon"]!.L, 0.58), C: 0.044, h: boardHue),
        SoilToneStop(t: 0.52, L: lerp(colors["maroon"]!.L, colors["peach"]!.L, 0.40), C: 0.054, h: boardHue),
        SoilToneStop(t: 0.76, L: lerp(colors["maroon"]!.L, colors["peach"]!.L, 0.58), C: 0.056, h: gleamHue),
        SoilToneStop(t: 1.0, L: lerp(colors["peach"]!.L, colors["overlay0"]!.L, 0.34), C: 0.050, h: gleamHue)
    ]
}

func exploreParrotStops() -> [SoilToneStop] {
    let shadowHue = mixAnglesDeg(colors["maroon"]!.h, colors["mauve"]!.h, 0.34)
    let bodyHue = mixAnglesDeg(colors["maroon"]!.h, colors["red"]!.h, 0.22)
    let warmHue = mixAnglesDeg(colors["red"]!.h, colors["peach"]!.h, 0.18)
    return [
        SoilToneStop(t: 0.0, L: lerp(colors["base"]!.L, colors["surface0"]!.L, 0.46), C: 0.032, h: shadowHue),
        SoilToneStop(t: 0.24, L: lerp(colors["surface0"]!.L, colors["maroon"]!.L, 0.44), C: 0.042, h: bodyHue),
        SoilToneStop(t: 0.50, L: lerp(colors["surface0"]!.L, colors["red"]!.L, 0.34), C: 0.050, h: bodyHue),
        SoilToneStop(t: 0.74, L: lerp(colors["maroon"]!.L, colors["peach"]!.L, 0.30), C: 0.054, h: warmHue),
        SoilToneStop(t: 1.0, L: lerp(colors["red"]!.L, colors["peach"]!.L, 0.34), C: 0.048, h: warmHue)
    ]
}

func exploreBlueStops() -> [SoilToneStop] {
    let shadowHue = mixAnglesDeg(colors["surface0"]!.h, colors["blue"]!.h, 0.32)
    let bodyHue = mixAnglesDeg(colors["blue"]!.h, colors["sapphire"]!.h, 0.30)
    let liftHue = mixAnglesDeg(colors["sapphire"]!.h, colors["lavender"]!.h, 0.14)
    return [
        SoilToneStop(t: 0.0, L: lerp(colors["base"]!.L, colors["surface0"]!.L, 0.56), C: 0.028, h: shadowHue),
        SoilToneStop(t: 0.30, L: lerp(colors["surface1"]!.L, colors["blue"]!.L, 0.30), C: 0.038, h: bodyHue),
        SoilToneStop(t: 0.56, L: lerp(colors["surface1"]!.L, colors["sapphire"]!.L, 0.42), C: 0.044, h: bodyHue),
        SoilToneStop(t: 0.80, L: lerp(colors["sapphire"]!.L, colors["lavender"]!.L, 0.30), C: 0.044, h: liftHue),
        SoilToneStop(t: 1.0, L: lerp(colors["sapphire"]!.L, colors["lavender"]!.L, 0.36), C: 0.040, h: liftHue)
    ]
}

func exploreGroundPatchStops() -> [SoilToneStop] {
    let shadowHue = mixAnglesDeg(colors["surface0"]!.h, colors["green"]!.h, 0.18)
    let bodyHue = mixAnglesDeg(colors["surface1"]!.h, colors["green"]!.h, 0.24)
    return [
        SoilToneStop(t: 0.0, L: lerp(colors["base"]!.L, colors["surface0"]!.L, 0.55), C: 0.026, h: shadowHue),
        SoilToneStop(t: 0.40, L: lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.52), C: 0.032, h: bodyHue),
        SoilToneStop(t: 1.0, L: lerp(colors["surface1"]!.L, colors["overlay0"]!.L, 0.42), C: 0.036, h: bodyHue)
    ]
}

func recolorExplorePixel(
    sourceLab: LabColor,
    sourceLch: OklchColor,
    normalizedL: Double,
    normalizedC: Double,
    saturation: Double,
    x: Int,
    y: Int,
    width: Int,
    height: Int
) -> LabColor {
    let _ = x
    let _ = y
    let _ = width
    let _ = height

    let sourceHue = sourceLch.h
    let shadowBand = 1.0 - smoothstep(0.12, 0.36, normalizedL)
    let highlightBand = smoothstep(0.70, 0.96, normalizedL)
    let midBand = smoothstep(0.16, 0.84, normalizedL)

    let neutralTone = oklchToOklab(
        lerp(colors["surface0"]!.L, colors["overlay0"]!.L, midBand),
        colors["surface1"]!.C * 0.20,
        mixAnglesDeg(colors["surface1"]!.h, colors["lavender"]!.h, 0.16)
    )
    let warmTone = oklchToOklab(
        lerp(colors["surface0"]!.L, colors["peach"]!.L, 0.30),
        colors["peach"]!.C * 0.34,
        mixAnglesDeg(colors["maroon"]!.h, colors["peach"]!.h, 0.28)
    )
    let blueTone = oklchToOklab(
        lerp(colors["surface0"]!.L, colors["sapphire"]!.L, 0.34),
        colors["sapphire"]!.C * 0.38,
        mixAnglesDeg(colors["blue"]!.h, colors["sapphire"]!.h, 0.20)
    )
    let foliageTone = oklchToOklab(
        lerp(colors["surface0"]!.L, colors["green"]!.L, 0.34),
        colors["green"]!.C * 0.30,
        mixAnglesDeg(colors["green"]!.h, colors["teal"]!.h, 0.20)
    )
    let shadowTone = oklchToOklab(
        lerp(colors["base"]!.L, colors["surface0"]!.L, 0.58),
        colors["mauve"]!.C * 0.14,
        mixAnglesDeg(colors["surface0"]!.h, colors["mauve"]!.h, 0.18)
    )
    let inkTone = oklchToOklab(colors["crust"]!.L, colors["crust"]!.C * 0.08, colors["crust"]!.h)

    let warmWeight = max(hueProximity(20, 50, sourceHue), hueProximity(350, 34, sourceHue))
        * smoothstep(0.12, 0.48, saturation)
    let blueWeight = max(hueProximity(215, 56, sourceHue), hueProximity(248, 44, sourceHue))
        * smoothstep(0.12, 0.42, saturation)
    let foliageWeight = max(hueProximity(82, 40, sourceHue), hueProximity(112, 30, sourceHue))
        * smoothstep(0.12, 0.38, saturation)
    let inkWeight = (1.0 - smoothstep(0.03, 0.09, normalizedL)) * (1.0 - smoothstep(0.02, 0.08, saturation))

    var resolved = blendLab(sourceLab, neutralTone, 0.62)
    if warmWeight > 0.001 {
        resolved = blendLab(resolved, warmTone, min(0.28, warmWeight * 0.22))
    }
    if blueWeight > 0.001 {
        resolved = blendLab(resolved, blueTone, min(0.24, blueWeight * 0.20))
    }
    if foliageWeight > 0.001 {
        resolved = blendLab(resolved, foliageTone, min(0.18, foliageWeight * 0.16))
    }
    if shadowBand > 0.001 {
        resolved = blendLab(resolved, shadowTone, shadowBand * 0.32)
    }
    if inkWeight > 0.001 {
        resolved = blendLab(resolved, inkTone, inkWeight * 0.52)
    }

    let detailL = lerp(0.16, 0.26, saturation)
    let detailAB = lerp(0.20, 0.32, saturation)
    resolved = (
        L: lerp(resolved.L, sourceLab.L, detailL),
        a: lerp(resolved.a, sourceLab.a, detailAB),
        b: lerp(resolved.b, sourceLab.b, detailAB)
    )

    let fieldBed = oklchToOklab(
        lerp(colors["base"]!.L, colors["surface0"]!.L, 0.62),
        colors["mauve"]!.C * 0.10,
        mixAnglesDeg(colors["surface0"]!.h, colors["mauve"]!.h, 0.16)
    )
    resolved = blendLab(resolved, fieldBed, 0.22)

    let highlightCap = oklchToOklab(
        lerp(colors["overlay0"]!.L, colors["rosewater"]!.L, 0.10),
        colors["peach"]!.C * 0.14,
        mixAnglesDeg(colors["overlay0"]!.h, colors["mauve"]!.h, 0.12)
    )
    if highlightBand > 0.001 {
        resolved = blendLab(resolved, highlightCap, highlightBand * 0.20)
    }

    return resolved
}

func recolorDonkeyPixel(
    sourceLab: LabColor,
    sourceLch: OklchColor,
    normalizedL: Double,
    normalizedC: Double,
    saturation: Double
) -> LabColor {
    let contrastL = clamp((normalizedL - 0.5) * 1.22 + 0.5, 0.0, 1.0)
    let shadowBand = 1.0 - smoothstep(0.12, 0.34, normalizedL)
    let highlightBand = smoothstep(0.68, 0.94, normalizedL)
    let sourceHue = sourceLch.h

    let inkWeight = (1.0 - smoothstep(0.03, 0.09, normalizedL)) * (1.0 - smoothstep(0.02, 0.07, saturation))
    var coatWeight = (1.0 - smoothstep(0.08, 0.26, saturation)) * smoothstep(0.18, 0.84, normalizedL)
    let stripeWeight = max(
        hueProximity(4, 32, sourceHue),
        hueProximity(348, 28, sourceHue),
        hueProximity(38, 48, sourceHue),
        hueProximity(62, 36, sourceHue)
    ) * smoothstep(0.18, 0.50, saturation) * (1.0 - coatWeight * 0.82)
    let plankWeight = max(hueProximity(268, 52, sourceHue), hueProximity(305, 42, sourceHue))
        * (1.0 - smoothstep(0.22, 0.48, saturation))
        * smoothstep(0.08, 0.55, normalizedL)
        * (1.0 - stripeWeight * 0.75) * (1.0 - coatWeight * 0.60)
    var signWeight = max(hueProximity(30, 44, sourceHue), hueProximity(56, 34, sourceHue))
        * smoothstep(0.14, 0.40, saturation) * smoothstep(0.32, 0.88, normalizedL) * (1.0 - stripeWeight * 0.55)
    let harnessWeight = max(hueProximity(300, 48, sourceHue), hueProximity(325, 38, sourceHue))
        * smoothstep(0.10, 0.32, saturation) * (1.0 - coatWeight * 0.70) * (1.0 - plankWeight * 0.50)
    let groundWeight = max(
        hueProximity(72, 50, sourceHue),
        hueProximity(102, 38, sourceHue),
        (1.0 - smoothstep(0.10, 0.28, saturation)) * smoothstep(0.06, 0.38, normalizedL) * 0.55
    ) * (1.0 - coatWeight * 0.45) * (1.0 - signWeight * 0.35)
    let shadowWeight = shadowBand * (1.0 - coatWeight * 0.30)

    coatWeight = max(coatWeight, 0.001)
    signWeight = max(signWeight, 0.001)
    let weightSum = coatWeight + stripeWeight + plankWeight + signWeight + harnessWeight + groundWeight + inkWeight + shadowWeight + 0.0001
    let coatW = coatWeight / weightSum
    let stripeW = stripeWeight / weightSum
    let plankW = plankWeight / weightSum
    let signW = signWeight / weightSum
    let harnessW = harnessWeight / weightSum
    let groundW = groundWeight / weightSum
    let inkW = inkWeight / weightSum
    let shadowW = shadowWeight / weightSum

    let coatShade = oklchToOklab(
        lerp(colors["surface0"]!.L, colors["surface1"]!.L, 0.48),
        colors["surface1"]!.C * 0.42,
        mixAnglesDeg(colors["surface1"]!.h, colors["lavender"]!.h, 0.22)
    )
    let coatLight = oklchToOklab(
        lerp(colors["overlay0"]!.L, colors["subtext0"]!.L, 0.38),
        colors["lavender"]!.C * 0.10,
        mixAnglesDeg(colors["overlay0"]!.h, colors["lavender"]!.h, 0.18)
    )
    let coatLab = blendLab(coatShade, coatLight, smoothstep(0.26, 0.90, normalizedL))

    let stripeSample = sampleSoilToneStop(contrastL, houseRoofStops())
    let stripeChroma = clamp(stripeSample.C * pow(max(0.0001, normalizedC), 0.44) * (0.80 + saturation * 0.24), 0.030, 0.092)
    let stripeLab = oklchToOklab(
        min(stripeSample.L + (highlightBand * 0.016) - (shadowBand * 0.014), colors["peach"]!.L + 0.02),
        stripeChroma,
        mixAnglesDeg(stripeSample.h, colors["yellow"]!.h, highlightBand * 0.18)
    )

    let plankLab = oklchToOklab(
        lerp(colors["base"]!.L, colors["surface0"]!.L, 0.58),
        colors["mauve"]!.C * 0.32,
        mixAnglesDeg(colors["surface0"]!.h, colors["mauve"]!.h, 0.24)
    )

    let signSample = sampleSoilToneStop(contrastL, houseRoofStops())
    let signChroma = clamp(signSample.C * pow(max(0.0001, normalizedC), 0.44) * (0.76 + saturation * 0.22), 0.028, 0.086)
    let signLab = oklchToOklab(
        min(signSample.L + (highlightBand * 0.012) - (shadowBand * 0.012), colors["peach"]!.L + 0.02),
        signChroma,
        mixAnglesDeg(signSample.h, colors["peach"]!.h, highlightBand * 0.12)
    )

    let harnessLab = oklchToOklab(
        lerp(colors["maroon"]!.L, colors["mauve"]!.L, 0.45),
        colors["mauve"]!.C * 0.48,
        mixAnglesDeg(colors["maroon"]!.h, colors["mauve"]!.h, 0.30)
    )

    let groundSample = sampleSoilToneStop(contrastL, exploreGroundPatchStops())
    let groundChroma = clamp(groundSample.C * pow(max(0.0001, normalizedC), 0.52) * (0.68 + saturation * 0.16), 0.020, 0.044)
    let groundLab = oklchToOklab(groundSample.L, groundChroma, mixAnglesDeg(groundSample.h, colors["green"]!.h, 0.14))

    let inkLab = oklchToOklab(colors["crust"]!.L, colors["crust"]!.C * 0.10, colors["crust"]!.h)
    let shadowLab = oklchToOklab(
        lerp(colors["base"]!.L, colors["surface0"]!.L, 0.55),
        colors["mauve"]!.C * 0.18,
        mixAnglesDeg(colors["surface0"]!.h, colors["mauve"]!.h, 0.18)
    )

    var resolved = (
        L: coatLab.L * coatW + stripeLab.L * stripeW + plankLab.L * plankW + signLab.L * signW
            + harnessLab.L * harnessW + groundLab.L * groundW + inkLab.L * inkW + shadowLab.L * shadowW,
        a: coatLab.a * coatW + stripeLab.a * stripeW + plankLab.a * plankW + signLab.a * signW
            + harnessLab.a * harnessW + groundLab.a * groundW + inkLab.a * inkW + shadowLab.a * shadowW,
        b: coatLab.b * coatW + stripeLab.b * stripeW + plankLab.b * plankW + signLab.b * signW
            + harnessLab.b * harnessW + groundLab.b * groundW + inkLab.b * inkW + shadowLab.b * shadowW
    )

    let sourceDetailGuard = 1.0 - smoothstep(0.60, 0.86, normalizedL)
    let detailL = lerp(0.06, 0.14, saturation) * sourceDetailGuard * (1.0 - coatW * 0.40)
    let detailAB = lerp(0.08, 0.16, saturation) * sourceDetailGuard
    resolved = (
        L: lerp(resolved.L, sourceLab.L, detailL),
        a: lerp(resolved.a, sourceLab.a, detailAB),
        b: lerp(resolved.b, sourceLab.b, detailAB)
    )

    if coatW > 0.20 {
        resolved = blendLab(resolved, coatLab, coatW * 0.28)
    }
    if stripeW > 0.16 {
        resolved = blendLab(resolved, stripeLab, stripeW * 0.22)
    }
    if signW > 0.14 {
        resolved = blendLab(resolved, signLab, signW * 0.20)
    }
    if plankW > 0.12 {
        resolved = blendLab(resolved, plankLab, plankW * 0.18)
    }
    if groundW > 0.14 {
        resolved = blendLab(resolved, groundLab, groundW * 0.20)
    }
    if inkW > 0.22 {
        resolved = blendLab(resolved, inkLab, inkW * 0.45)
    }

    return resolved
}

func loadPixels(_ url: URL) throws -> (pixels: [UInt8], width: Int, height: Int) {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "catpuccin", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to load image"])
    }
    let width = image.width
    let height = image.height
    let bytesPerRow = width * 4
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var pixels = Array(repeating: UInt8(0), count: bytesPerRow * height)
    guard let context = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    ) else {
        throw NSError(domain: "catpuccin", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create bitmap context"])
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return (pixels, width, height)
}

func savePixels(_ pixels: [UInt8], width: Int, height: Int, to url: URL) throws {
    let bytesPerRow = width * 4
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var mutablePixels = pixels
    guard let context = CGContext(
        data: &mutablePixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    ), let image = context.makeImage(),
       let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "catpuccin", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to prepare output image"])
    }
    CGImageDestinationAddImage(destination, image, nil)
    if !CGImageDestinationFinalize(destination) {
        throw NSError(domain: "catpuccin", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to finalize output image"])
    }
}

func recolor(_ pixels: inout [UInt8], width: Int, height: Int, profile: AssetProfile) {
    let stats = buildStats(pixels)
    let lightnessRange = max(0.12, stats.highL - stats.lowL)
    let shadowHue = mixAnglesDeg(colors["blue"]!.h, colors["mauve"]!.h, 0.64)
    let highlightHue = mixAnglesDeg(colors["sapphire"]!.h, colors["lavender"]!.h, 0.42)
    let neutralHue = colors[profile.neutralHueName] ?? colors["lavender"]!

    for y in 0..<height {
        for x in 0..<width {
            let offset = ((y * width) + x) * 4
            let alpha = Double(pixels[offset + 3]) / 255.0
            if alpha <= 0.02 {
                continue
            }

            let sourceR = clamp(Double(pixels[offset]) / 255.0 / max(alpha, 0.0001))
            let sourceG = clamp(Double(pixels[offset + 1]) / 255.0 / max(alpha, 0.0001))
            let sourceB = clamp(Double(pixels[offset + 2]) / 255.0 / max(alpha, 0.0001))
            let lab = rgbToOklab(sourceR, sourceG, sourceB)
            let lch = oklabToOklch(lab)
            let normalizedL = clamp((lch.L - stats.lowL) / lightnessRange)
            let normalizedC = clamp(lch.C / stats.chromaScale)
            let saturation = smoothstep(0.06, 0.7, normalizedC)

            if profile.name == "ground" {
                let resolvedLab = recolorGroundPixel(
                    sourceLab: lab,
                    sourceLch: lch,
                    normalizedL: normalizedL,
                    normalizedC: normalizedC,
                    saturation: saturation,
                    x: x,
                    y: y,
                    width: width,
                    height: height
                )
                let rgb = oklabToRgb(resolvedLab.L, resolvedLab.a, resolvedLab.b)
                pixels[offset] = UInt8(clamp(rgb.r) * alpha * 255.0)
                pixels[offset + 1] = UInt8(clamp(rgb.g) * alpha * 255.0)
                pixels[offset + 2] = UInt8(clamp(rgb.b) * alpha * 255.0)
                continue
            }

            if profile.name == "house" {
                let resolvedLab = recolorHousePixel(
                    sourceLab: lab,
                    sourceLch: lch,
                    normalizedL: normalizedL,
                    normalizedC: normalizedC,
                    saturation: saturation
                )
                let rgb = oklabToRgb(resolvedLab.L, resolvedLab.a, resolvedLab.b)
                pixels[offset] = UInt8(clamp(rgb.r) * alpha * 255.0)
                pixels[offset + 1] = UInt8(clamp(rgb.g) * alpha * 255.0)
                pixels[offset + 2] = UInt8(clamp(rgb.b) * alpha * 255.0)
                continue
            }

            if profile.name == "explore" {
                let resolvedLab = recolorExplorePixel(
                    sourceLab: lab,
                    sourceLch: lch,
                    normalizedL: normalizedL,
                    normalizedC: normalizedC,
                    saturation: saturation,
                    x: x,
                    y: y,
                    width: width,
                    height: height
                )
                let rgb = oklabToRgb(resolvedLab.L, resolvedLab.a, resolvedLab.b)
                pixels[offset] = UInt8(clamp(rgb.r) * alpha * 255.0)
                pixels[offset + 1] = UInt8(clamp(rgb.g) * alpha * 255.0)
                pixels[offset + 2] = UInt8(clamp(rgb.b) * alpha * 255.0)
                continue
            }

            if profile.name == "donkey" {
                let resolvedLab = recolorDonkeyPixel(
                    sourceLab: lab,
                    sourceLch: lch,
                    normalizedL: normalizedL,
                    normalizedC: normalizedC,
                    saturation: saturation
                )
                let rgb = oklabToRgb(resolvedLab.L, resolvedLab.a, resolvedLab.b)
                pixels[offset] = UInt8(clamp(rgb.r) * alpha * 255.0)
                pixels[offset + 1] = UInt8(clamp(rgb.g) * alpha * 255.0)
                pixels[offset + 2] = UInt8(clamp(rgb.b) * alpha * 255.0)
                continue
            }

            let hueTarget = interpolateHueAnchor(lch.h + profile.hueRotation, profile.anchors)

            let verdantWeight = max(hueProximity(98, 36, lch.h), hueProximity(122, 42, lch.h))
            let warmWeight = max(hueProximity(28, 42, lch.h), hueProximity(58, 34, lch.h))
            let coolWeight = max(hueProximity(205, 40, lch.h), hueProximity(260, 40, lch.h))
            let shadowWeight = 1.0 - smoothstep(0.12, 0.34, normalizedL)
            let highlightWeight = smoothstep(0.76, 0.98, normalizedL)
            let midToneWeight = pow(max(0.0, sin(Double.pi * normalizedL)), 0.82)

            var targetL = sampleStopValue(normalizedL)
            targetL = lerp(targetL, clamp(targetL + (profile.contrast * 0.05) - (shadowWeight * 0.012) + (highlightWeight * 0.03), 0.0, 1.0), 0.9)
            targetL += verdantWeight * profile.verdantStrength * 0.024 * (1.0 - shadowWeight * 0.55)
            targetL += warmWeight * profile.warmSurfaceStrength * 0.014 * (1.0 - highlightWeight * 0.35)
            targetL -= coolWeight * profile.shadowCoolStrength * 0.008 * shadowWeight
            if targetL < profile.minShadowL {
                targetL = lerp(targetL, profile.minShadowL, 0.68)
            }
            if targetL > profile.maxHighlightL {
                targetL = lerp(targetL, profile.maxHighlightL, 0.46)
            }
            targetL = clamp(targetL, 0.0, 1.0)

            var targetC = hueTarget.C * (0.48 + (0.86 * midToneWeight))
            targetC *= pow(max(0.0001, normalizedC), 0.72)
            targetC *= 0.62 + (saturation * 0.46)
            targetC *= 1.0 + (profile.chromaBoost * (0.12 + (midToneWeight * 0.2)))
            targetC *= 1.0 - (shadowWeight * 0.18)
            targetC *= 1.0 - (highlightWeight * 0.14)
            targetC *= 1.0 + (verdantWeight * profile.verdantStrength * 0.28)
            targetC *= 1.0 + (warmWeight * profile.warmSurfaceStrength * 0.12)
            if saturation < 0.08 {
                targetC *= saturation / 0.08
            }

            var targetHue = saturation > 0.02 ? mixAnglesDeg(lch.h, hueTarget.h, 0.54 + (saturation * 0.2)) : hueTarget.h
            targetHue = mixAnglesDeg(targetHue, colors["green"]!.h, verdantWeight * profile.verdantStrength * 0.28)
            targetHue = mixAnglesDeg(targetHue, colors["peach"]!.h, warmWeight * profile.warmSurfaceStrength * 0.22)
            targetHue = mixAnglesDeg(targetHue, shadowHue, shadowWeight * profile.shadowCoolStrength * 0.24)
            targetHue = mixAnglesDeg(targetHue, highlightHue, highlightWeight * profile.highlightCoolStrength * 0.2)
            if saturation < 0.18 {
                let neutralWeight = (0.18 - saturation) / 0.18
                targetL = lerp(targetL, profile.neutralTargetL, neutralWeight * (0.55 + (profile.neutralCoolStrength * 0.25)))
                targetC = max(targetC, neutralHue.C * neutralWeight * (0.14 + (profile.neutralCoolStrength * 0.08)))
                targetHue = mixAnglesDeg(targetHue, neutralHue.h, neutralWeight * (0.46 + (profile.neutralCoolStrength * 0.24)))
            }
            let brightNeutralWeight = smoothstep(0.64, 0.92, normalizedL) * (1.0 - smoothstep(0.22, 0.52, saturation))
            if brightNeutralWeight > 0.001 {
                targetL = lerp(targetL, min(targetL, profile.maxHighlightL), brightNeutralWeight * 0.78)
                targetC = max(targetC, neutralHue.C * brightNeutralWeight * (0.12 + (profile.neutralCoolStrength * 0.08)))
                targetHue = mixAnglesDeg(targetHue, neutralHue.h, brightNeutralWeight * (0.52 + (profile.neutralCoolStrength * 0.18)))
            }

            let softLab = oklchToOklab(targetL, max(0.0, targetC), targetHue)
            let hardSwatch = swatches.min { lhs, rhs in
                scoreSwatch(lhs, targetLab: softLab, saturation: saturation, verdantWeight: verdantWeight, warmWeight: warmWeight, shadowWeight: shadowWeight, profile: profile)
                < scoreSwatch(rhs, targetLab: softLab, saturation: saturation, verdantWeight: verdantWeight, warmWeight: warmWeight, shadowWeight: shadowWeight, profile: profile)
            }

            let ditherIndex = (y % 4) * 4 + (x % 4)
            let ditherBias = (Double(dither4x4[ditherIndex]) / 15.0) - 0.5
            let snapWeight = clamp((profile.snapStrength * (0.26 + (saturation * 0.52) + (midToneWeight * 0.16))) + (ditherBias * 0.05), 0.0, 0.88)
            let snappedLab = hardSwatch.map { blendLab(softLab, $0.lab, snapWeight) } ?? softLab

            let detailL = clamp((profile.detailPreserve * 0.62) + (midToneWeight * 0.05), 0.0, 0.42)
            let detailAB = clamp(profile.detailPreserve * 0.16, 0.0, 0.18)
            let finalLab = (
                L: lerp(snappedLab.L, lab.L, detailL),
                a: lerp(snappedLab.a, lab.a, detailAB),
                b: lerp(snappedLab.b, lab.b, detailAB)
            )

            let lowSatDetailWeight = saturation < 0.22 ? lerp(0.28, 1.0, saturation / 0.22) : 1.0
            let detailWeight = lowSatDetailWeight * lerp(0.52, 1.0, 1.0 - brightNeutralWeight)
            var resolvedLab = (
                L: lerp(snappedLab.L, finalLab.L, detailWeight),
                a: lerp(snappedLab.a, finalLab.a, detailWeight),
                b: lerp(snappedLab.b, finalLab.b, detailWeight)
            )

            if profile.name == "palma" {
                let leafRegionWeight = y < Int(Double(height) * 0.46) ? 1.0 : 0.0
                let leafWeight = leafRegionWeight * smoothstep(0.42, 0.88, normalizedL) * max(hueProximity(58, 52, lch.h), hueProximity(112, 46, lch.h), 0.35)
                if leafWeight > 0.001 {
                    let leafTone = oklchToOklab(
                        lerp(colors["surface1"]!.L, colors["yellow"]!.L, 0.26),
                        colors["green"]!.C * 0.14,
                        mixAnglesDeg(colors["green"]!.h, colors["yellow"]!.h, 0.34)
                    )
                    resolvedLab = blendLab(resolvedLab, leafTone, leafWeight * 0.88)
                }
            }

            let rgb = oklabToRgb(resolvedLab.L, resolvedLab.a, resolvedLab.b)
            pixels[offset] = UInt8(clamp(rgb.r) * alpha * 255.0)
            pixels[offset + 1] = UInt8(clamp(rgb.g) * alpha * 255.0)
            pixels[offset + 2] = UInt8(clamp(rgb.b) * alpha * 255.0)
        }
    }
}

guard CommandLine.arguments.count >= 4 else {
    fail("usage: generate_assets.swift <input> <output> <profile>")
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let profileName = CommandLine.arguments[3]

guard let profile = buildProfile(profileName) else {
    fail("unknown profile: \(profileName)")
}

do {
    var image = try loadPixels(inputURL)
    recolor(&image.pixels, width: image.width, height: image.height, profile: profile)
    try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
    try savePixels(image.pixels, width: image.width, height: image.height, to: outputURL)
    print(outputURL.path)
} catch {
    fail(error.localizedDescription)
}
