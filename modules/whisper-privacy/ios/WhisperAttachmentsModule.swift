import ExpoModulesCore
import UIKit
import PDFKit
import AVFoundation

public final class WhisperAttachmentsModule: Module {
  private func invalid(_ message: String) -> NSError {
    NSError(domain: "WhisperAttachments", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
  public func definition() -> ModuleDefinition {
    Name("WhisperAttachments")
    AsyncFunction("cleanTemporaryFiles") {
      let directory = FileManager.default.temporaryDirectory
      let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
      for file in files where file.lastPathComponent.hasPrefix("whisper-private-") {
        try? FileManager.default.removeItem(at: file)
      }
    }
    AsyncFunction("renderPdfPage") { (base64: String, index: Int) throws -> [String: Any] in
      guard base64.count <= 4_000_000, let data = Data(base64Encoded: base64),
            let document = PDFDocument(data: data), document.pageCount > 0,
            document.pageCount <= 100, index >= 0, index < document.pageCount,
            let page = document.page(at: index) else { throw self.invalid("Invalid PDF or page") }
      let bounds = page.bounds(for: .mediaBox)
      guard bounds.width > 0, bounds.height > 0 else { throw self.invalid("Invalid page dimensions") }
      let scale = 1200 / max(bounds.width, bounds.height)
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let size = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
      let image = UIGraphicsImageRenderer(size: size, format: format).image { renderer in
        UIColor.white.setFill()
        renderer.fill(CGRect(origin: .zero, size: size))
        let context = renderer.cgContext
        context.translateBy(x: 0, y: size.height)
        context.scaleBy(x: scale, y: -scale)
        context.translateBy(x: -bounds.minX, y: -bounds.minY)
        page.draw(with: .mediaBox, to: context)
      }
      guard let jpeg = image.jpegData(compressionQuality: 0.85) else { throw self.invalid("Cannot render PDF") }
      return ["pageCount": document.pageCount, "image": jpeg.base64EncodedString()]
    }
    AsyncFunction("cleanVideoFile") { (inputUri: String) async throws -> String in
      guard let url = URL(string: inputUri), url.isFileURL else { throw self.invalid("Local video required") }
      let asset = AVURLAsset(url: url)
      let duration = try await asset.load(.duration)
      let composition = AVMutableComposition()
      for mediaType in [AVMediaType.video, AVMediaType.audio] {
        let tracks = try await asset.loadTracks(withMediaType: mediaType)
        guard tracks.count <= 1 else { throw self.invalid("Multiple media tracks unsupported") }
        if let source = tracks.first,
           let target = composition.addMutableTrack(withMediaType: mediaType, preferredTrackID: kCMPersistentTrackID_Invalid) {
          try target.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: source, at: .zero)
          target.preferredTransform = try await source.load(.preferredTransform)
        }
      }
      guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough),
            export.supportedFileTypes.contains(.mp4) else { throw self.invalid("Unsupported video codec") }
      let output = FileManager.default.temporaryDirectory.appendingPathComponent("whisper-private-\(UUID().uuidString).mp4")
      var retained = false
      defer { if !retained { try? FileManager.default.removeItem(at: output) } }
      export.outputURL = output
      export.outputFileType = .mp4
      export.metadata = []
      await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        export.exportAsynchronously { continuation.resume() }
      }
      guard export.status == .completed else { throw self.invalid("Video export failed") }
      retained = true
      return output.absoluteString
    }
  }
}
