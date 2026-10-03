import UIKit
import WebKit

final class MarketplaceViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let siteURL = URL(string: "https://unipazar-production.up.railway.app/#/")!
    private var webView: WKWebView!
    private let offlineView = UIView()

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Üni Satış"
        view.backgroundColor = UIColor(red: 0.965, green: 0.965, blue: 0.945, alpha: 1)
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .action, target: self, action: #selector(shareCurrentPage)
        )

        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(reloadPage), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        configureOfflineView()
        webView.load(URLRequest(url: siteURL))
    }

    @objc private func reloadPage() {
        if webView.url == nil { webView.load(URLRequest(url: siteURL)) }
        else { webView.reload() }
    }

    @objc private func shareCurrentPage() {
        let url = webView.url ?? siteURL
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        present(sheet, animated: true)
    }

    private func configureOfflineView() {
        offlineView.backgroundColor = view.backgroundColor
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        offlineView.isHidden = true
        let message = UILabel()
        message.text = "Bağlantı kurulamadı. İnternetini kontrol edip yeniden dene."
        message.numberOfLines = 0
        message.textAlignment = .center
        let retry = UIButton(type: .system)
        retry.setTitle("Yeniden dene", for: .normal)
        retry.addTarget(self, action: #selector(reloadPage), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [message, retry])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        offlineView.addSubview(stack)
        view.addSubview(offlineView)
        NSLayoutConstraint.activate([
            offlineView.topAnchor.constraint(equalTo: webView.topAnchor),
            offlineView.bottomAnchor.constraint(equalTo: webView.bottomAnchor),
            offlineView.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
            stack.centerXAnchor.constraint(equalTo: offlineView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offlineView.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: offlineView.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: offlineView.trailingAnchor, constant: -32)
        ])
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.scrollView.refreshControl?.endRefreshing()
        offlineView.isHidden = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        webView.scrollView.refreshControl?.endRefreshing()
        offlineView.isHidden = false
    }

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let trusted = origin.protocol == "https" && origin.host == siteURL.host
        decisionHandler(trusted ? .prompt : .deny)
    }
}
