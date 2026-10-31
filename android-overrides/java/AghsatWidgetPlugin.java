package __PACKAGE__;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge between the web app and the home-screen widget.
 * The web app sends a ready-to-show JSON (texts already formatted in Persian),
 * the plugin stores it and asks the widget to redraw.
 */
@CapacitorPlugin(name = "AghsatWidget")
public class AghsatWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json", "{}");
        Context ctx = getContext();
        ctx.getSharedPreferences(AghsatWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit().putString(AghsatWidgetProvider.KEY_DATA, json).apply();
        AghsatWidgetProvider.refreshAll(ctx);
        call.resolve();
    }
}
