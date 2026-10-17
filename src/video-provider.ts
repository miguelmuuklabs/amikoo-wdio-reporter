export interface VideoProvider {
  start(): Promise<void>;
  stop(): Promise<string>;
}