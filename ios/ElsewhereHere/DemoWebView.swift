import CoreLocation
import SwiftUI
import UniformTypeIdentifiers
import WebKit

struct DemoWebView: UIViewRepresentable {
    private static let appURL = URL(string: "\(BundledWebAppHandler.scheme)://localhost/")!

    /// Marks the page as running inside the app and locks the viewport so it
    /// behaves like a native screen: no pinch or double-tap zoom.
    private static let nativeShellScript = """
    document.documentElement.classList.add('native-app');
    document.addEventListener('DOMContentLoaded', function () {
      var meta = document.querySelector('meta[name=viewport]');
      if (meta) {
        meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      }
    });
    """

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundledWebAppHandler(), forURLScheme: BundledWebAppHandler.scheme)
        configuration.userContentController.addUserScript(
            WKUserScript(source: Self.nativeShellScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        #if DEBUG
        webView.isInspectable = true
        #endif
        context.coordinator.requestLocationAccess()
        webView.load(URLRequest(url: Self.appURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKUIDelegate, CLLocationManagerDelegate {
        private let locationManager = CLLocationManager()

        /// WebKit only returns positions to the page once the app itself holds location authorization.
        func requestLocationAccess() {
            locationManager.delegate = self
            if locationManager.authorizationStatus == .notDetermined {
                locationManager.requestWhenInUseAuthorization()
            }
        }

        func webView(
            _ webView: WKWebView,
            requestGeolocationPermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.grant)
        }

        /// Links with target="_blank" (source links, external maps) open in Safari.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme) {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}

/// Serves the Vite build copied into the app bundle's `web` folder.
/// Paths without a matching file get `index.html` so client-side routes load.
final class BundledWebAppHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "elsewhere"

    private let root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var fileURL = root.appendingPathComponent(url.path)
        var isDirectory: ObjCBool = false
        if !FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDirectory) || isDirectory.boolValue {
            fileURL = root.appendingPathComponent("index.html")
        }

        guard fileURL.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path),
              let data = try? Data(contentsOf: fileURL)
        else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let mimeType = UTType(filenameExtension: fileURL.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType,
                "Content-Length": String(data.count),
                "Cache-Control": "no-cache",
            ]
        )!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
