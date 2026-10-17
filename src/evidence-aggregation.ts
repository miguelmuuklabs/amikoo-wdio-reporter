import fs from 'node:fs';
import path from 'node:path';

import type { AmikooTestResult } from './types.js';
import type { VideoEvidenceRecord } from './video-evidence.js';

const EVIDENCE_DIR = path.join(
    process.cwd(),
    'reports',
    'video-evidence'
);

export function attachVideoEvidence(
    tests: AmikooTestResult[]
): AmikooTestResult[] {
    if (!fs.existsSync(EVIDENCE_DIR)) {
        console.warn(
            '[Amikoo] Video evidence directory not found.'
        );

        return tests;
    }

    const evidence: VideoEvidenceRecord[] = [];

    for (
        const file of fs.readdirSync(EVIDENCE_DIR)
            .filter(name => name.endsWith('.json'))
    ) {
        try {
            const record = JSON.parse(
                fs.readFileSync(
                    path.join(EVIDENCE_DIR, file),
                    'utf8'
                )
            ) as VideoEvidenceRecord;

            if (
                record.testRunId &&
                record.video?.s3Uri
            ) {
                evidence.push(record);
            }
        } catch (error) {
            console.warn(
                `[Amikoo] Invalid evidence file: ${file}`,
                error
            );
        }
    }

    const evidenceById = new Map<
        string,
        VideoEvidenceRecord
    >();

    for (const record of evidence) {
        if (!record.testRunId) {
            continue;
        }

        if (evidenceById.has(record.testRunId)) {
            console.warn(
                `[Amikoo] Duplicate evidence ID: ${record.testRunId}`
            );

            evidenceById.delete(record.testRunId);
            continue;
        }

        evidenceById.set(
            record.testRunId,
            record
        );
    }

    let matched = 0;

    const enriched = tests.map(test => {
        if (!test.testRunId) {
            return test;
        }

        const record = evidenceById.get(
            test.testRunId
        );

        if (!record) {
            return test;
        }

        if (
            record.passed !== test.result
        ) {
            console.warn(
                `[Amikoo] Evidence status mismatch: ${test.name}`
            );

            return test;
        }

        matched++;

        evidenceById.delete(test.testRunId);

        return {
            ...test,
            evidence: {
                ...test.evidence,
                video: record.video
            }
        };
    });

    console.log(
        `[Amikoo] Video evidence associated: ` +
        `${matched}/${tests.length}`
    );

    return enriched;
}

