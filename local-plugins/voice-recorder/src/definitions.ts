export interface VoiceRecorderPlugin {
  startRecording(): Promise<void>;
  stopRecording(): Promise<{
    path: string;
    name: string;
  }>;
}
