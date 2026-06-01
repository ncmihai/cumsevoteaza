import AppKit
import Foundation
import PDFKit
import Vision

if CommandLine.arguments.count < 2 {
  FileHandle.standardError.write(Data("Usage: swift extract_pdf_text.swift <file.pdf>\n".utf8))
  exit(2)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: url) else {
  FileHandle.standardError.write(Data("Could not open PDF\n".utf8))
  exit(1)
}

func renderPage(_ page: PDFPage, scale: CGFloat = 2.0) -> CGImage? {
  let bounds = page.bounds(for: .mediaBox)
  let width = max(1, Int(bounds.width * scale))
  let height = max(1, Int(bounds.height * scale))
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  guard
    let context = CGContext(
      data: nil,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )
  else {
    return nil
  }

  context.setFillColor(NSColor.white.cgColor)
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.saveGState()
  context.scaleBy(x: scale, y: scale)
  context.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()
  return context.makeImage()
}

func recognizeText(_ image: CGImage) throws -> String {
  var lines: [(CGRect, String)] = []
  let request = VNRecognizeTextRequest { request, _ in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    for observation in observations {
      guard let candidate = observation.topCandidates(1).first else { continue }
      let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
      if !text.isEmpty {
        lines.append((observation.boundingBox, text))
      }
    }
  }
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["ro-RO", "en-US"]

  let handler = VNImageRequestHandler(cgImage: image, options: [:])
  try handler.perform([request])

  return lines
    .sorted { left, right in
      let yDistance = abs(left.0.midY - right.0.midY)
      if yDistance > 0.01 {
        return left.0.midY > right.0.midY
      }
      return left.0.minX < right.0.minX
    }
    .map(\.1)
    .joined(separator: "\n")
}

var pageTexts: [String] = []
for index in 0..<document.pageCount {
  guard let page = document.page(at: index), let image = renderPage(page) else { continue }
  let text = (try? recognizeText(image)) ?? ""
  if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
    pageTexts.append(text)
  }
}

print(pageTexts.joined(separator: "\n\n"))
