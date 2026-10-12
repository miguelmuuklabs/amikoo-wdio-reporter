import fs from 'node:fs';
import path from 'node:path';

import { AmikooApiClient } from './api-client.js';

import type {
    AmikooReporterOptions,
    AmikooTestResult
} from './types.js';

const RESULTS_DIR = path.join(
    process.cwd(),
    '.amikoo-wdio-results'
);

export function prepareAmikooRun(): void {
    fs.rmSync(RESULTS_DIR, {
        recursive: true,
        force: true
    });

    fs.mkdirSync(RESULTS_DIR, {
        recursive: true
    });

    console.log('[Amikoo] Run initialized.');
}

export async function submitAmikooRun(
    options: AmikooReporterOptions
): Promise<void> {
    if (options.enabled === false) {
        return;
    }

    const repository =
        options.repository ||
        process.env.GITHUB_REPOSITORY ||
        '';

    const branch =
        options.branch ||
        process.env.GITHUB_REF_NAME ||
        'main';

    if (!repository) {
        throw new Error('[Amikoo] Repository not configured.');
    }

    if (!fs.existsSync(RESULTS_DIR)) {
        throw new Error('[Amikoo] Results directory not found.');
    }

    const files = fs.readdirSync(RESULTS_DIR)
        .filter(file => file.endsWith('.json'));

    const tests: AmikooTestResult[] = [];

    for (const file of files) {
        const content = fs.readFileSync(
            path.join(RESULTS_DIR, file),
            'utf8'
        );

        const workerTests = JSON.parse(content) as AmikooTestResult[];

        if (!Array.isArray(workerTests)) {
            throw new Error(`[Amikoo] Invalid results file: ${file}`);
        }

        tests.push(...workerTests);
    }

    console.log(`[Amikoo] Total tests collected: ${tests.length}`);

    if (!tests.length) {
        console.log('[Amikoo] No tests to submit.');
        return;
    }

    const client = new AmikooApiClient(options);

    const response = await client.sendResults(
        tests,
        repository,
        branch
    );

    console.log(
        '[Amikoo] Consolidated execution submitted:',
        JSON.stringify(response)
    );

    fs.rmSync(RESULTS_DIR, {
        recursive: true,
        force: true
    });
}