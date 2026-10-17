import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { VideoProvider } from './video-provider.js';

import {
    createTestRunId,
    getTestRunId
} from './test-run-id.js';

import {
    registerVideoEvidence,
    type VideoEvidenceRecord
} from './video-evidence.js';

export interface VideoRecorderOptions {
    bucket: string;
    region: string;
    stopTimeoutMs?: number;
}

export interface VideoTestInfo {
    name: string;
    file: string;
    passed: boolean;
    testRunId?: string;
}

function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    label: string
): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error('[Amikoo] Invalid video timeout.');
    }

    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(
                new Error(
                    `[Amikoo] ${label} timed out after ${timeoutMs}ms.`
                )
            );
        }, timeoutMs);

        operation.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

export class VideoRecorder {
    private testRunId?: string;

    constructor(
        private readonly provider: VideoProvider,
        private readonly options: VideoRecorderOptions
    ) {}

    async start(): Promise<void> {
        await this.provider.start();

        this.testRunId = createTestRunId();

        console.log(
            `[Amikoo] Video recording started. TestRunId: ${this.testRunId}`
        );
    }

    async stop(
        test: VideoTestInfo
    ): Promise<VideoEvidenceRecord> {
        const timeoutMs =
            this.options.stopTimeoutMs ?? 15000;

        const testRunId =
            test.testRunId ||
            this.testRunId ||
            getTestRunId();

        console.log(
            `[Amikoo] Video stop started: ${test.name}`
        );

        const base64 = await withTimeout(
            this.provider.stop(),
            timeoutMs,
            'Video provider stop'
        );

        console.log(
            `[Amikoo] Video stop completed: ${test.name}`
        );

        if (!base64) {
            throw new Error(
                '[Amikoo] Empty video recording.'
            );
        }

        const directory = path.join(
            process.cwd(),
            '.amikoo-videos'
        );

        await fs.mkdir(directory, {
            recursive: true
        });

        const videoPath = path.join(
            directory,
            `${randomUUID()}.mp4`
        );

        await fs.writeFile(
            videoPath,
            Buffer.from(base64, 'base64')
        );

        try {
            console.log(
                `[Amikoo] S3 upload started: ${test.name}`
            );

            const evidence = await registerVideoEvidence({
                bucket: this.options.bucket,
                region: this.options.region,
                testName: test.name,
                testFile: test.file,
                passed: test.passed,
                testRunId,
                videoPath
            });

            console.log(
                `[Amikoo] S3 upload completed: ${test.name}`
            );

            return evidence;
        } finally {
            await fs.rm(videoPath, {
                force: true
            });
        }
    }
}


