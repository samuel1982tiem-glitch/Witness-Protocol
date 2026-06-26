package com.witness.protocol;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register the native plugin so Capacitor can find it
        registerPlugin(VoiceRecorderPlugin.class);
    }
}
