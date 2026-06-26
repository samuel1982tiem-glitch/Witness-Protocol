import { registerPlugin } from '@capacitor/core';

import type { VoiceRecorderPlugin } from './definitions';

const VoiceRecorder = registerPlugin<VoiceRecorderPlugin>('VoiceRecorder');

export * from './definitions';
export { VoiceRecorder };