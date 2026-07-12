package com.witness.protocol.backgroundexport;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BackgroundExport",
    permissions = {
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class BackgroundExportPlugin extends Plugin {

    private PluginCall pendingStartCall;

    @PluginMethod
    public void start(PluginCall call) {
        // POST_NOTIFICATIONS is a runtime permission on Android 13+ (API 33+).
        // Declaring it in the manifest alone does NOT grant it -- without
        // this request, startForeground() still runs (the process is
        // protected) but the notification itself is silently suppressed,
        // which looked like "nothing happens at all".
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            pendingStartCall = call;
            requestPermissionForAlias("notifications", call, "handleNotificationPermission");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void handleNotificationPermission(PluginCall call) {
        if (pendingStartCall != null) {
            PluginCall saved = pendingStartCall;
            pendingStartCall = null;
            // Proceed either way -- if denied, the foreground service still
            // protects the process, it just won't show a visible notification.
            doStart(saved);
        }
    }

    private void doStart(PluginCall call) {
        String title = call.getString("title", "Witness Protocol");
        String text = call.getString("text", "Exporting…");
        Boolean indeterminate = call.getBoolean("indeterminate", true);

        Intent intent = new Intent(getContext(), ExportForegroundService.class);
        intent.setAction(ExportForegroundService.ACTION_START);
        intent.putExtra(ExportForegroundService.EXTRA_TITLE, title);
        intent.putExtra(ExportForegroundService.EXTRA_TEXT, text);
        intent.putExtra(ExportForegroundService.EXTRA_PROGRESS, 0);
        intent.putExtra(ExportForegroundService.EXTRA_MAX, 100);
        intent.putExtra(ExportForegroundService.EXTRA_INDETERMINATE, indeterminate != null && indeterminate);

        startForegroundServiceCompat(intent);

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "Witness Protocol");
        String text = call.getString("text", "");
        int progress = call.getInt("progress", 0);
        int max = call.getInt("max", 100);
        Boolean indeterminate = call.getBoolean("indeterminate", false);

        Intent intent = new Intent(getContext(), ExportForegroundService.class);
        intent.setAction(ExportForegroundService.ACTION_UPDATE);
        intent.putExtra(ExportForegroundService.EXTRA_TITLE, title);
        intent.putExtra(ExportForegroundService.EXTRA_TEXT, text);
        intent.putExtra(ExportForegroundService.EXTRA_PROGRESS, progress);
        intent.putExtra(ExportForegroundService.EXTRA_MAX, max);
        intent.putExtra(ExportForegroundService.EXTRA_INDETERMINATE, indeterminate != null && indeterminate);

        startForegroundServiceCompat(intent);

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), ExportForegroundService.class);
        intent.setAction(ExportForegroundService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    private void startForegroundServiceCompat(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }
}
