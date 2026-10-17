import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
    uploadVideoToS3,
    type S3VideoEvidence
} from './s3-uploader.js';

export interface VideoEvidenceOptions {
    bucket: string;
    region: string;
    testName: string;
    testFile: string;
    videoPath: string;
    passed: boolean;
    testRunId?: string;
}

export interface VideoEvidenceRecord {
    id: string;
    testRunId?: string;
    testName: string;
    testFile: string;
    passed: boolean;
    recordedAt: string;
    video: S3VideoEvidence;
}

export async function registerVideoEvidence(
    options: VideoEvidenceOptions
): Promise<VideoEvidenceRecord> {
    if (!options.testName || !options.testFile) {
        throw new Error(
            '[Amikoo] Test name and file are required.'
        );
    }

    const video = await uploadVideoToS3({
        bucket: options.bucket,
        region: options.region,
        videoPath: options.videoPath
    });

    const record: VideoEvidenceRecord = {
        id: randomUUID(),
        testRunId: options.testRunId,
        testName: options.testName,
        testFile: options.testFile,
        passed: options.passed,
        recordedAt: new Date().toISOString(),
        video
    };

    const directory = path.join(
        process.cwd(),
        'reports',
        'video-evidence'
    );

    await fs.mkdir(directory, { recursive: true });

    const filename = `${record.id}.json`;
    const destination = path.join(directory, filename);

    await fs.writeFile(
        destination,
        JSON.stringify(record, null, 2),
        'utf8'
    );

    console.log(
        `[Amikoo] Video evidence uploaded: ${video.s3Uri}`
    );

    return record;
}
