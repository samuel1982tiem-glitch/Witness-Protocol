package com.witness.protocol;

import com.getcapacitor.BridgeActivity;
import com.witness.protocol.backgroundexport.BackgroundExportPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register the native plugins so Capacitor can find them
        registerPlugin(VoiceRecorderPlugin.class);
        registerPlugin(BackgroundExportPlugin.class);
    }
}
