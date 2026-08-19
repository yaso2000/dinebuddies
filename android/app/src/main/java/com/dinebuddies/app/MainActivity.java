package com.dinebuddies.app;

import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(GooglePlayBillingPlugin.class);
        registerPlugin(AppSigningInfoPlugin.class);
        super.onCreate(savedInstanceState);
        // Android 15+ (targetSdk 35+) enforces edge-to-edge; this makes the system
        // dispatch window insets so the WebView reports correct env(safe-area-inset-*)
        // values to CSS instead of leaving content to draw under the status bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
