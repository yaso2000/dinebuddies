package com.dinebuddies.app;

import android.app.Activity;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Native Capacitor bridge for consumable Google Play Dine Credits.
 * The server verifies and consumes each purchase token.
 */
@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        PendingPurchasesParams pendingParams =
            PendingPurchasesParams.newBuilder().enableOneTimeProducts().build();

        billingClient =
            BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(pendingParams)
                .build();
    }

    @PluginMethod
    public void launchBillingFlow(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null || productId.trim().isEmpty()) {
            call.reject("MISSING_PRODUCT_ID", "productId is required");
            return;
        }

        if (pendingPurchaseCall != null) {
            call.reject("PURCHASE_IN_PROGRESS", "Another purchase is already in progress");
            return;
        }

        call.setKeepAlive(true);
        pendingPurchaseCall = call;
        final String sku = productId.trim();

        ensureConnected(
            () -> queryAndLaunch(sku),
            () -> {
                clearPending();
                call.reject("BILLING_SETUP_FAILED", "Could not connect to Google Play Billing");
            }
        );
    }

    private void ensureConnected(Runnable onReady, Runnable onError) {
        if (billingClient != null && billingClient.isReady()) {
            onReady.run();
            return;
        }

        billingClient.startConnection(
            new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        onReady.run();
                    } else {
                        onError.run();
                    }
                }

                @Override
                public void onBillingServiceDisconnected() {
                    // Reconnect on the next purchase attempt.
                }
            }
        );
    }

    private void queryAndLaunch(String productId) {
        final PluginCall call = pendingPurchaseCall;
        if (call == null) {
            return;
        }

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        );

        QueryProductDetailsParams params =
            QueryProductDetailsParams.newBuilder().setProductList(products).build();

        billingClient.queryProductDetailsAsync(
            params,
            (BillingResult billingResult, QueryProductDetailsResult productDetailsResult) -> {
                if (pendingPurchaseCall == null) {
                    return;
                }

                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    clearPending();
                    call.reject(
                        "QUERY_PRODUCT_FAILED",
                        "Play response " + billingResult.getResponseCode()
                    );
                    return;
                }

                List<ProductDetails> detailsList = productDetailsResult.getProductDetailsList();
                if (detailsList == null || detailsList.isEmpty()) {
                    clearPending();
                    call.reject(
                        "PRODUCT_NOT_FOUND",
                        "No Play product for id: " + productId
                    );
                    return;
                }

                ProductDetails productDetails = detailsList.get(0);
                BillingFlowParams.ProductDetailsParams.Builder detailsParams =
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails);

                String offerToken = null;
                List<ProductDetails.OneTimePurchaseOfferDetails> offers =
                    productDetails.getOneTimePurchaseOfferDetailsList();
                if (offers != null && !offers.isEmpty()) {
                    offerToken = offers.get(0).getOfferToken();
                } else {
                    ProductDetails.OneTimePurchaseOfferDetails oneTime =
                        productDetails.getOneTimePurchaseOfferDetails();
                    if (oneTime != null) {
                        offerToken = oneTime.getOfferToken();
                    }
                }
                if (offerToken != null && !offerToken.isEmpty()) {
                    detailsParams.setOfferToken(offerToken);
                }

                List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList =
                    Collections.singletonList(detailsParams.build());

                BillingFlowParams flowParams =
                    BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(productDetailsParamsList)
                        .build();

                Activity activity = getActivity();
                if (activity == null) {
                    clearPending();
                    call.reject("NO_ACTIVITY", "No Android activity available");
                    return;
                }

                BillingResult launchResult = billingClient.launchBillingFlow(activity, flowParams);
                if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    clearPending();
                    call.reject(
                        "LAUNCH_FAILED",
                        "Play response " + launchResult.getResponseCode()
                    );
                }
            }
        );
    }

    @Override
    public void onPurchasesUpdated(
        @NonNull BillingResult billingResult,
        @Nullable List<Purchase> purchases
    ) {
        PluginCall call = pendingPurchaseCall;
        if (call == null) {
            return;
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            clearPending();
            call.reject("USER_CANCELED", "Purchase canceled");
            return;
        }

        if (
            billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK
                || purchases == null
                || purchases.isEmpty()
        ) {
            clearPending();
            call.reject(
                "PURCHASE_FAILED",
                "Play response " + billingResult.getResponseCode()
            );
            return;
        }

        Purchase purchase = purchases.get(0);
        String token = purchase.getPurchaseToken();
        if (token == null || token.isEmpty()) {
            clearPending();
            call.reject("GOOGLE_PLAY_NO_PURCHASE_TOKEN", "Missing purchaseToken");
            return;
        }

        JSObject result = new JSObject();
        result.put("purchaseToken", token);
        if (purchase.getOrderId() != null) {
            result.put("orderId", purchase.getOrderId());
        }
        if (purchase.getProducts() != null && !purchase.getProducts().isEmpty()) {
            result.put("productId", purchase.getProducts().get(0));
        }

        clearPending();
        call.resolve(result);
    }

    private void clearPending() {
        pendingPurchaseCall = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
            billingClient = null;
        }
        if (pendingPurchaseCall != null) {
            pendingPurchaseCall.reject("BILLING_DESTROYED", "Billing client destroyed");
            pendingPurchaseCall = null;
        }
        super.handleOnDestroy();
    }
}
