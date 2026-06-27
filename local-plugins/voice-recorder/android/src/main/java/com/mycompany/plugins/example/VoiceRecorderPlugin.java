package com.mycompany.plugins.example;

import android.Manifest;
import android.media.MediaRecorder;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.IOException;

@CapacitorPlugin(
    name = "VoiceRecorder",
    permissions = {
        @Permission(
            alias = "record",
            strings = { Manifest.permission.RECORD_AUDIO }
        )
    }
)
public class VoiceRecorderPlugin extends Plugin {

    private static final String LOGTAG = "VoiceRecorderPlugin";

    private MediaRecorder mediaRecorder;
    private File outputFile;
    private boolean recording = false;
    private PluginCall pendingStartCall;

    @PluginMethod
    public void startRecording(PluginCall call) {

        if (getPermissionState("record") != PermissionState.GRANTED) {
            pendingStartCall = call;
            requestPermissionForAlias(
                "record",
                call,
                "handleRecordPermission"
            );
            return;
        }

        if (recording) {
            call.reject("Already recording");
            return;
        }

        try {
            outputFile = new File(
                getContext().getCacheDir(),
                "voice_" + System.currentTimeMillis() + ".m4a"
            );

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

        } catch (IOException | IllegalStateException ex) {
            Log.e(LOGTAG, "startRecording", ex);
            call.reject(ex.getMessage());
        }
    }

    @PermissionCallback
    private void handleRecordPermission(PluginCall call) {

        if (getPermissionState("record") == PermissionState.GRANTED) {

            if (pendingStartCall != null) {
                PluginCall saved = pendingStartCall;
                pendingStartCall = null;
                startRecording(saved);
            }

        } else {

            if (pendingStartCall != null) {
                pendingStartCall.reject("Microphone permission denied");
                pendingStartCall = null;
            }

            if (call != null) {
                call.reject("Microphone permission denied");
            }
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {

        if (!recording || mediaRecorder == null) {
            call.reject("Not recording");
            return;
        }

        try {

            mediaRecorder.stop();
            mediaRecorder.release();
            mediaRecorder = null;
            recording = false;

            JSObject ret = new JSObject();
            ret.put("path", outputFile.getAbsolutePath());
            ret.put("name", outputFile.getName());

            call.resolve(ret);

        } catch (RuntimeException ex) {

            Log.e(LOGTAG, "stopRecording", ex);

            if (outputFile != null && outputFile.exists()) {
                outputFile.delete();
            }

            mediaRecorder = null;
            recording = false;

            call.reject(ex.getMessage());
        }
    }
}
