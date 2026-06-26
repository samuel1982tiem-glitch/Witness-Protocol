import { registerPlugin } from '@capacitor/core';

export interface VoiceRecorderPlugin {
  startRecording(): Promise<void>;
  stopRecording(): Promise<{ path: string; name?: string }>;
}

const VoiceRecorder = registerPlugin<VoiceRecorderPlugin>('VoiceRecorder', {
  web: () => {
    return {
      startRecording: async () => {
        throw new Error('Voice recording is only supported on the Android native build.');
      },
      stopRecording: async () => {
        throw new Error('Voice recording is only supported on the Android native build.');
      },
    };
  },
});

export default VoiceRecorder;
