package __PACKAGE__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.TimeZone;

/**
 * Home-screen widget: next installment + the two after it.
 * Data comes from the web app (see AghsatWidgetPlugin). Relative day labels
 * ("today", "in 3 days") are recomputed here, so they stay correct without opening the app.
 */
public class AghsatWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "aghsat_widget";
    public static final String KEY_DATA = "data";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            render(context, manager, id);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, android.os.Bundle newOptions) {
        render(context, manager, appWidgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            refreshAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, AghsatWidgetProvider.class));
        for (int id : ids) {
            render(context, manager, id);
        }
    }

    static long todayEpochDay() {
        long now = System.currentTimeMillis();
        long local = now + TimeZone.getDefault().getOffset(now);
        return (long) Math.floor(local / 86400000.0);
    }

    static String fa(long n) {
        String s = String.valueOf(n);
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            b.append(c >= '0' && c <= '9' ? (char) ('\u06F0' + (c - '0')) : c);
        }
        return b.toString();
    }

    static String rel(long diff) {
        if (diff == 0) return "امروز";
        if (diff == 1) return "فردا";
        if (diff > 0) return fa(diff) + " روز دیگر";
        return fa(-diff) + " روز تأخیر";
    }

    private static void setNoData(RemoteViews v, String line1, String line2) {
        v.setTextViewText(R.id.w_label, "مدیریت اقساط");
        v.setTextViewText(R.id.w_name, line1);
        v.setTextViewText(R.id.w_amount, "");
        v.setTextViewText(R.id.w_sub, line2);
        v.setTextViewText(R.id.w_month, "");
        v.setViewVisibility(R.id.w_div, android.view.View.GONE);
        v.setViewVisibility(R.id.w_r1, android.view.View.GONE);
        v.setViewVisibility(R.id.w_r2, android.view.View.GONE);
    }

    static void render(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.aghsat_widget);
        try {
            try {
                Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
                if (launch != null) {
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
                    v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(context, 0, launch, flags));
                }
            } catch (Exception ignored) {
                // a missing click action must never stop the widget from drawing
            }

            String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
            if (json == null) {
                setNoData(v, "برنامه را یک بار باز کن", "تا سررسیدها اینجا نمایش داده شوند");
            } else {
                JSONObject data = new JSONObject(json);
                JSONArray rows = data.optJSONArray("rows");
                long today = todayEpochDay();

                if (rows == null || rows.length() == 0) {
                    setNoData(v, "سررسیدی در انتظار نیست", "همه‌چیز پرداخت شده است");
                } else {
                    JSONObject first = rows.getJSONObject(0);
                    long diff = first.optLong("day") - today;
                    boolean late = diff < 0;
                    v.setTextViewText(R.id.w_label, late ? "سررسید گذشته" : "سررسید بعدی");
                    v.setTextColor(R.id.w_label, late ? 0xFFFFB4A8 : 0xFFF1DEA1);
                    v.setTextViewText(R.id.w_name, first.optString("t"));
                    v.setTextViewText(R.id.w_amount, first.optString("a") + " تومان");
                    v.setTextColor(R.id.w_amount, late ? 0xFFFFC9BF : 0xFFEAD598);
                    v.setTextViewText(R.id.w_sub, first.optString("d") + "، " + rel(diff));
                    String month = data.optString("m", "");
                    v.setTextViewText(R.id.w_month, month.length() > 0 ? "این ماه: " + month : "");

                    int[] rowIds = {R.id.w_r1, R.id.w_r2};
                    boolean any = false;
                    for (int i = 0; i < rowIds.length; i++) {
                        if (rows.length() > i + 1) {
                            JSONObject r = rows.getJSONObject(i + 1);
                            long d = r.optLong("day") - today;
                            v.setTextViewText(rowIds[i], r.optString("t") + "  " + r.optString("a") + "  (" + rel(d) + ")");
                            v.setViewVisibility(rowIds[i], android.view.View.VISIBLE);
                            any = true;
                        } else {
                            v.setViewVisibility(rowIds[i], android.view.View.GONE);
                        }
                    }
                    v.setViewVisibility(R.id.w_div, any ? android.view.View.VISIBLE : android.view.View.GONE);
                }
            }
        } catch (Throwable e) {
            // show the problem on the widget itself instead of leaving it blank
            setNoData(v, "خطا در نمایش ویجت", e.getClass().getSimpleName());
        }
        try {
            manager.updateAppWidget(widgetId, v);
        } catch (Throwable ignored) {
            // nothing else we can do
        }
    }
}
