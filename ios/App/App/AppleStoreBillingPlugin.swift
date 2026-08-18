import Foundation
import StoreKit
import Capacitor

/**
 * Apple In-App Purchase bridge — mirrors android/app/src/main/java/com/dinebuddies/app/GooglePlayBillingPlugin.java.
 *
 * One method, `launchBillingFlow(productId)`, purchases a StoreKit 2 product and resolves
 * `{ signedTransactionInfo, transactionId, productId }`. The server verifies and decodes
 * the signed transaction (functions/appStoreBilling.js) before granting credits/entitlements —
 * this plugin never trusts the purchase result on its own.
 */
@objc(AppleStoreBillingPlugin)
public class AppleStoreBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleStoreBillingPlugin"
    public let jsName = "AppleStoreBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "launchBillingFlow", returnType: CAPPluginReturnPromise)
    ]

    @objc func launchBillingFlow(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("MISSING_PRODUCT_ID")
            return
        }

        if #available(iOS 15.0, *) {
            Task {
                await self.purchase(productId: productId, call: call)
            }
        } else {
            call.reject("UNSUPPORTED_IOS_VERSION", "StoreKit 2 requires iOS 15 or later")
        }
    }

    @available(iOS 15.0, *)
    private func purchase(productId: String, call: CAPPluginCall) async {
        let products: [Product]
        do {
            products = try await Product.products(for: [productId])
        } catch {
            call.reject("QUERY_PRODUCT_FAILED", error.localizedDescription)
            return
        }

        guard let product = products.first else {
            call.reject("PRODUCT_NOT_FOUND", "No App Store product for id: \(productId)")
            return
        }

        let result: Product.PurchaseResult
        do {
            result = try await product.purchase()
        } catch {
            call.reject("PURCHASE_FAILED", error.localizedDescription)
            return
        }

        switch result {
        case .success(let verification):
            switch verification {
            case .verified(let transaction):
                var payload: [String: Any] = [
                    "signedTransactionInfo": verification.jwsRepresentation,
                    "transactionId": String(transaction.id),
                    "productId": transaction.productID
                ]
                if let originalId = Optional(transaction.originalID) {
                    payload["originalTransactionId"] = String(originalId)
                }
                await transaction.finish()
                call.resolve(payload)
            case .unverified(_, let error):
                call.reject("VERIFICATION_FAILED", error.localizedDescription)
            }
        case .userCancelled:
            call.reject("USER_CANCELED", "Purchase canceled")
        case .pending:
            call.reject("PURCHASE_PENDING", "Purchase is pending approval (e.g. Ask to Buy)")
        @unknown default:
            call.reject("PURCHASE_FAILED", "Unknown StoreKit purchase result")
        }
    }
}
