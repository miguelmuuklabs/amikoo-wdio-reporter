import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface S3VideoEvidence {
    bucket: string;
    region: string;
    key: string;
    s3Uri: string;
}

export interface S3UploadOptions {
    bucket: string;
    region: string;
    videoPath: string;
}

export async function uploadVideoToS3(
    options: S3UploadOptions
): Promise<S3VideoEvidence> {
    const { bucket, region, videoPath } = options;

    if (!bucket || !region) {
        throw new Error(
            '[Amikoo] S3 bucket and region are required.'
        );
    }

    const file = await stat(videoPath);

    if (!file.isFile()) {
        throw new Error('[Amikoo] Invalid video file.');
    }

    const filename = path.basename(videoPath);

    const key = `videos/${randomUUID()}-${filename}`;

    const client = new S3Client({ region });

    try {
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: createReadStream(videoPath),
                ContentType: 'video/mp4',
                ContentLength: file.size
            })
        );

        return {
            bucket,
            region,
            key,
            s3Uri: `s3://${bucket}/${key}`
        };
    } finally {
        client.destroy();
    }
}
