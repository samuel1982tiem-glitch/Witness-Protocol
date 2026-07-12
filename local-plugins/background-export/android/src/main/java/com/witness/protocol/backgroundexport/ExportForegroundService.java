package com.witness.protocol.backgroundexport;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class ExportForegroundService extends Service {

    public static final String CHANNEL_ID = "witness_export_progress";
    public static final int NOTIFICATION_ID = 4821;

    public static final String ACTION_START = "com.witness.protocol.backgroundexport.START";
    public static final String ACTION_UPDATE = "com.witness.protocol.backgroundexport.UPDATE";
    public static final String ACTION_STOP = "com.witness.protocol.backgroundexport.STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_PROGRESS = "progress";
    public static final String EXTRA_MAX = "max";
    public static final String EXTRA_INDETERMINATE = "indeterminate";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra(EXTRA_TITLE);
        String text = intent.getStringExtra(EXTRA_TEXT);
        int progress = intent.getIntExtra(EXTRA_PROGRESS, 0);
        int max = intent.getIntExtra(EXTRA_MAX, 100);
        boolean indeterminate = intent.getBooleanExtra(EXTRA_INDETERMINATE, false);

        Notification notification = buildNotification(title, text, progress, max, indeterminate);

        if (ACTION_START.equals(action)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else if (ACTION_UPDATE.equals(action)) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, notification);
        }

        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title, String text, int progress, int max, boolean indeterminate) {
        createChannelIfNeeded();

        // Reopen the app's launcher activity when the notification is tapped.
        // Looked up dynamically via PackageManager rather than referencing
        // MainActivity directly -- this plugin is a separate library module
        // and cannot depend on classes in the app module that uses it.
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = null;
        if (openIntent != null) {
            openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            pendingIntent = PendingIntent.getActivity(this, 0, openIntent, flags);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title != null ? title : "Witness Protocol")
            .setContentText(text != null ? text : "")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW);

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent);
        }

        if (indeterminate) {
            builder.setProgress(0, 0, true);
        } else {
            builder.setProgress(max, progress, false);
        }

        return builder.build();
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Export Progress",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Shows progress while exporting incident reports/packages.");
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
