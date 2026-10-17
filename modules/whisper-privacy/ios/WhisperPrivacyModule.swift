import ExpoModulesCore
import UIKit

public final class WhisperPrivacyModule: Module {
  private var observers: [NSObjectProtocol] = []
  private var covers: [ObjectIdentifier: UIView] = [:]
  private var initialized = false
  private var inactive = false

  public func definition() -> ModuleDefinition {
    Name("WhisperPrivacy")
    Events("onCaptureState")

    AsyncFunction("initialize") { () -> Bool in
      if !self.initialized {
        self.initialized = true
        self.inactive = UIApplication.shared.applicationState != .active
        self.observe(UIApplication.willResignActiveNotification) {
          self.inactive = true
          self.updateCovers()
        }
        self.observe(UIApplication.didBecomeActiveNotification) {
          self.inactive = false
          self.updateCovers()
        }
        self.observe(UIScreen.capturedDidChangeNotification) { self.updateCovers() }
        self.observe(UIWindow.didBecomeVisibleNotification) { self.updateCovers() }
      }
      self.updateCovers()
      return self.isCaptured()
    }.runOnQueue(.main)

    AsyncFunction("isCaptured") { self.isCaptured() }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        for observer in self.observers { NotificationCenter.default.removeObserver(observer) }
        self.observers.removeAll()
        for cover in self.covers.values { cover.removeFromSuperview() }
        self.covers.removeAll()
      }
    }
  }

  private func observe(_ name: Notification.Name, action: @escaping () -> Void) {
    observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in action() })
  }

  private func windows() -> [UIWindow] {
    UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
  }

  private func isCaptured() -> Bool {
    // Compatibility path for the app's iOS 15.1 minimum deployment target.
    // A device matrix is still required; this is not screenshot detection.
    windows().contains { $0.screen.isCaptured }
  }

  private func updateCovers() {
    let captured = isCaptured()
    let allWindows = windows()
    let liveIds = Set(allWindows.map { ObjectIdentifier($0) })
    for id in Array(covers.keys) where !liveIds.contains(id) {
      covers.removeValue(forKey: id)?.removeFromSuperview()
    }
    for window in allWindows {
      let id = ObjectIdentifier(window)
      if inactive || captured {
        let cover = covers[id] ?? UIView(frame: window.bounds)
        cover.backgroundColor = .black
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.isUserInteractionEnabled = true
        cover.accessibilityLabel = "Conversation hidden"
        cover.isAccessibilityElement = true
        cover.accessibilityViewIsModal = true
        covers[id] = cover
        if cover.superview !== window { window.addSubview(cover) }
        window.bringSubviewToFront(cover)
      } else {
        covers.removeValue(forKey: id)?.removeFromSuperview()
      }
    }
    sendEvent("onCaptureState", ["captured": captured])
  }
}
