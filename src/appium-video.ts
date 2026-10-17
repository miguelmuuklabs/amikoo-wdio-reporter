import type { VideoProvider } from './video-provider.js';

export interface AppiumRecordingDriver {
  startRecordingScreen(): Promise<unknown>;
  stopRecordingScreen(): Promise<string>;
}

export class AppiumVideoProvider implements VideoProvider {
  constructor(
    private readonly driver: AppiumRecordingDriver
  ) {}

  async start(): Promise<void> {
    await this.driver.startRecordingScreen();
  }

  async stop(): Promise<string> {
    return this.driver.stopRecordingScreen();
  }
}