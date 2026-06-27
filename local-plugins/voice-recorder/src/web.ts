import { WebPlugin } from '@capacitor/core';
import type { VoiceRecorderPlugin } from './definitions';

export class VoiceRecorderWeb extends WebPlugin implements VoiceRecorderPlugin {
  async startRecording(): Promise<void> {
    throw new Error('Recording is not supported on the web.');
  }

  async stopRecording(): Promise<{ path: string; name: string }> {
    throw new Error('Recording is not supported on the web.');
  }
}
