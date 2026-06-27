package com.mycompany.plugins.example;

import android.Manifest;
import android.media.MediaRecorder;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;

import java.io.File;
import java.io.IOException;

@CapacitorPlugin(
    name = "VoiceRecorder",
    permissions = {
        @Permission(alias = "record", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class VoiceRecorderPlugin extends Plugin {
    private static final String LOGTAG = "VoiceRecorderPlugin";
    private MediaRecorder mediaRecorder;
    private File outputFile;
    private boolean recording = false;
    private PluginCall pendingStartCall = null;

    @PluginMethod
    public void startRecording(final PluginCall call) {
        // If permission not granted, request it and save the call
        if (!hasPermission("record")) {
            pendingStartCall = call;
            requestPermissionForAlias("record", call, "handleRecordPermission");
            return;
        }

        if (recording) {
            call.reject("Already recording");
            return;
        }

        try {
            File cacheDir = getContext().getCacheDir();
            outputFile = new File(cacheDir, "voice_" + System.currentTimeMillis() + ".m4a");

            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioEncodingBitRate(128000);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setOutputFile(outputFile.getAbsolutePath());

            mediaRecorder.prepare();
            mediaRecorder.start();
            recording = true;

            JSObject ret = new JSObject();
            ret.put("status", "recording");
            call.resolve(ret);
        } catch (IOException | IllegalStateException e) {
            Log.e(LOGTAG, "startRecording error", e);
            call.reject("Failed to start recording: " + e.getMessage());
        }
    }

    @PermissionCallback
private void handleRecordPermission(PluginCall call) {
    Log.d(LOGTAG, "Permission state = " + getPermissionState("record"));

    if (hasPermission("record")) {
      
            if (pendingStartCall != null) {
                startRecording(pendingStartCall);
                pendingStartCall = null;
            } else if (call != null) {
                JSObject res = new JSObject();
                res.put("status", "permission_granted");
                call.resolve(res);
            }
        } else {
            if (pendingStartCall != null) {
                pendingStartCall.reject("Microphone permission denied");
                pendingStartCall = null;
            }
            if (call != null) call.reject("Microphone permission denied");
        }
    }

    @PluginMethod
    public void stopRecording(final PluginCall call) {
        if (!recording || mediaRecorder == null) {
            call.reject("Not recording");
            return;
        }
        try {
            mediaRecorder.stop();
            mediaRecorder.release();
            mediaRecorder = null;
            recording = false;

            JSObject res = new JSObject();
            res.put("path", outputFile.getAbsolutePath());
            res.put("name", outputFile.getName());
            call.resolve(res);
        } catch (RuntimeException e) {
            Log.e(LOGTAG, "stopRecording error", e);
            if (outputFile != null && outputFile.exists()) outputFile.delete();
            mediaRecorder = null;
            recording = false;
            call.reject("Failed to stop recording: " + e.getMessage());
        }
    }
}
