
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';

import { VideoRecorder } from '../src/video-recorder.js';
import { AppiumVideoProvider } from '../src/appium-video.js';
import { registerVideoEvidence } from '../src/video-evidence.js';

vi.mock('../src/video-evidence.js', () => ({
  registerVideoEvidence: vi.fn()
}));

describe('VideoRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts recording through the provider', async () => {
    const provider = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn()
    };

    const recorder = new VideoRecorder(provider, {
      bucket: 'test-bucket',
      region: 'us-east-2'
    });

    await recorder.start();

    expect(provider.start).toHaveBeenCalledOnce();
  });

  it('uploads video evidence and associates it with the test', async () => {
    const provider = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(
        Buffer.from('fake-video').toString('base64')
      )
    };

    const evidence = {
      id: 'evidence-123',
      testName: 'Login test',
      testFile: 'login.spec.ts',
      passed: true,
      recordedAt: '2026-10-16T00:00:00.000Z',
      video: {
        bucket: 'test-bucket',
        region: 'us-east-2',
        key: 'videos/test.mp4',
        s3Uri: 's3://test-bucket/videos/test.mp4'
      }
    };

    vi.mocked(registerVideoEvidence).mockResolvedValue(evidence);

    const recorder = new VideoRecorder(provider, {
      bucket: 'test-bucket',
      region: 'us-east-2'
    });

    const result = await recorder.stop({
      name: 'Login test',
      file: 'login.spec.ts',
      passed: true
    });

    expect(provider.stop).toHaveBeenCalledOnce();

    expect(registerVideoEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'test-bucket',
        region: 'us-east-2',
        testName: 'Login test',
        testFile: 'login.spec.ts',
        passed: true,
        videoPath: expect.stringMatching(/\.mp4$/)
      })
    );

    expect(result).toEqual(evidence);
  });

  it('rejects empty recordings', async () => {
    const provider = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue('')
    };

    const recorder = new VideoRecorder(provider, {
      bucket: 'test-bucket',
      region: 'us-east-2'
    });

    await expect(
      recorder.stop({
        name: 'Empty video test',
        file: 'empty.spec.ts',
        passed: false
      })
    ).rejects.toThrow('Empty video recording.');

    expect(registerVideoEvidence).not.toHaveBeenCalled();
  });

  it('cleans up temporary videos when upload fails', async () => {
    const provider = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(
        Buffer.from('fake-video').toString('base64')
      )
    };

    vi.mocked(registerVideoEvidence).mockRejectedValue(
      new Error('S3 upload failed')
    );

    const recorder = new VideoRecorder(provider, {
      bucket: 'test-bucket',
      region: 'us-east-2'
    });

    await expect(
      recorder.stop({
        name: 'Failed upload',
        file: 'failure.spec.ts',
        passed: false
      })
    ).rejects.toThrow('S3 upload failed');

    const call = vi.mocked(registerVideoEvidence).mock.calls[0];
    const videoPath = call[0].videoPath;

    await expect(fs.stat(videoPath)).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('delegates Appium recording to its driver', async () => {
    const driver = {
      startRecordingScreen: vi.fn().mockResolvedValue(undefined),
      stopRecordingScreen: vi.fn().mockResolvedValue('base64-video')
    };

    const provider = new AppiumVideoProvider(driver);

    await provider.start();
    const video = await provider.stop();

    expect(driver.startRecordingScreen).toHaveBeenCalledOnce();
    expect(driver.stopRecordingScreen).toHaveBeenCalledOnce();
    expect(video).toBe('base64-video');
  });
});
