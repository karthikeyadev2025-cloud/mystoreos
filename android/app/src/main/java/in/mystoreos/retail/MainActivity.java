package in.mystoreos.retail;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.graphics.Color;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── ANDROID 15+ (API 35+) EDGE-TO-EDGE FIX ──────────────────────
        // On API 35+, Android FORCES edge-to-edge and IGNORES
        // setDecorFitsSystemWindows(true), fitsSystemWindows, and
        // windowTranslucentStatus. The ONLY reliable fix is to read the
        // real system-bar insets at runtime and apply them as padding to
        // the content view, so the WebView sits below the status bar and
        // above the navigation bar on every device and Android version.

        // Keep solid bar backgrounds so they don't blend into content.
        getWindow().setStatusBarColor(Color.parseColor("#0F172A"));
        getWindow().setNavigationBarColor(Color.parseColor("#0F172A"));

        // White icons on the dark bars.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        // Apply system-bar insets as padding on the root content view.
        final View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        // Trigger an initial inset pass.
        ViewCompat.requestApplyInsets(content);
    }
}
