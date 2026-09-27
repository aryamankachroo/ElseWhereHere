import CoreLocation
import SwiftUI
import WebKit

struct DemoWebView: UIViewRepresentable {
    private static let appURL = URL(string: "http://127.0.0.1:5173")!

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.requestLocationAccess()
        webView.load(URLRequest(url: Self.appURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKUIDelegate, CLLocationManagerDelegate {
        private let locationManager = CLLocationManager()

        func requestLocationAccess() {
            locationManager.delegate = self
            locationManager.requestWhenInUseAuthorization()
        }

        func webView(
            _ webView: WKWebView,
            requestGeolocationPermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.grant)
        }
    }
}
