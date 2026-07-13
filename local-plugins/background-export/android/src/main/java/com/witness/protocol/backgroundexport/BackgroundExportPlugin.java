package com.witness.protocol.backgroundexport;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundExport")
public class BackgroundExportPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        // ENTIRE method wrapped: any uncaught exception here previously
        // left the JS-side promise hanging forever (neither resolve nor
        // reject called), which was indistinguishable from a slow/stuck
        // call. Now every path either resolves or rejects with the real
        // error message, so the actual cause becomes visible.
        try {
            try {
                if (Build.VERSION.SDK_INT >= 33 && getActivity() != null) {
                    boolean granted = ActivityCompat.checkSelfPermission(
                        getContext(), Manifest.permission.POST_NOTIFICATIONS
                    ) == PackageManager.PERMISSION_GRANTED;
                    if (!granted) {
                        getActivity().runOnUiThread(() -> {
                            try {
                                ActivityCompat.requestPermissions(
                                    getActivity(),
                                    new String[] { Manifest.permission.POST_NOTIFICATIONS },
                                    9821
                                );
                            } catch (Exception inner) {
                                // ignore -- never block the service below
                            }
                        });
                    }
                }
            } catch (Exception outer) {
                // ignore -- never block the service below
            }

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
        } catch (Throwable t) {
            call.reject("native start() failed: " + t.getClass().getSimpleName() + ": " + t.getMessage());
        }
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
