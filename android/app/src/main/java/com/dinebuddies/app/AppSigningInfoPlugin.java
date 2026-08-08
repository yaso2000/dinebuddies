package com.dinebuddies.app;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.MessageDigest;

@CapacitorPlugin(name = "AppSigningInfo")
public class AppSigningInfoPlugin extends Plugin {

    private static final String TAG = "AppSigningInfo";

    @PluginMethod
    public void getSigningCertificates(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            String packageName = getContext().getPackageName();
            Signature[] signatures;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo packageInfo =
                    pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo signingInfo = packageInfo.signingInfo;
                if (signingInfo == null) {
                    call.reject("NO_SIGNING_INFO", "Package has no signingInfo");
                    return;
                }
                // Always use the APK content signers (what Google Sign-In validates).
                // Certificate history can return a rotated/older cert and mislead debugging.
                signatures = signingInfo.getApkContentsSigners();
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo packageInfo =
                    pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                @SuppressWarnings("deprecation")
                Signature[] legacy = packageInfo.signatures;
                signatures = legacy;
            }

            if (signatures == null || signatures.length == 0) {
                call.reject("NO_SIGNATURES", "No signing certificates found");
                return;
            }

            Signature primary = signatures[0];
            JSObject ret = new JSObject();
            ret.put("packageName", packageName);
            ret.put("sha1", fingerprint(primary.toByteArray(), "SHA-1"));
            ret.put("sha256", fingerprint(primary.toByteArray(), "SHA-256"));
            ret.put("signerCount", signatures.length);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "getSigningCertificates failed", e);
            call.reject("SIGNING_INFO_FAILED", e.getMessage(), e);
        }
    }

    private static String fingerprint(byte[] cert, String algorithm) throws Exception {
        MessageDigest md = MessageDigest.getInstance(algorithm);
        byte[] digest = md.digest(cert);
        StringBuilder sb = new StringBuilder(digest.length * 2);
        for (byte b : digest) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
