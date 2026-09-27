import SwiftUI

@main
struct ElsewhereHereApp: App {
    var body: some Scene {
        WindowGroup {
            DemoWebView()
                .ignoresSafeArea()
                .background(Color.black)
                .preferredColorScheme(.dark)
        }
    }
}
