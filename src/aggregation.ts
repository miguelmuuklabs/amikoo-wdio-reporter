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

interface AmikooSubmissionResponse {
    success?: boolean;
    data?: {
        testsProcessed?: number;
        failedTestCount?: number;
    };
}

function log(message: string): void {
    console.log(`[Amikoo] ${message}`);
}

function logError(message: string): void {
    console.error(`[Amikoo] ${message}`);
}

export function prepareAmikooRun(): void {
    if (fs.existsSync(RESULTS_DIR)) {
        const pendingFiles = fs.readdirSync(RESULTS_DIR)
            .filter(file => file.endsWith('.json'));

        if (pendingFiles.length > 0) {
            throw new Error(
                `[Amikoo] Found ${pendingFiles.length} pending result file(s). ` +
                'Previous results will not be deleted. ' +
                'Review them before starting a new execution.'
            );
        }
    }

    fs.mkdirSync(RESULTS_DIR, {
        recursive: true
    });

    console.log('[Amikoo] Run initialized.');
}

export async function submitAmikooRun(
    options: AmikooReporterOptions
): Promise<void> {
    if (options.enabled === false) {
        log('Reporter disabled. Submission skipped.');
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
        throw new Error(
            '[Amikoo] Repository not configured.'
        );
    }

    if (!fs.existsSync(RESULTS_DIR)) {
        throw new Error(
            '[Amikoo] Results directory not found.'
        );
    }

    const files = fs.readdirSync(RESULTS_DIR)
        .filter(file => file.endsWith('.json'))
        .sort();

    const tests: AmikooTestResult[] = [];

    for (const file of files) {
        const filePath = path.join(RESULTS_DIR, file);

        let workerTests: unknown;

        try {
            const content = fs.readFileSync(
                filePath,
                'utf8'
            );

            workerTests = JSON.parse(content);
        } catch (error) {
            const reason =
                error instanceof Error
                    ? error.message
                    : String(error);

            throw new Error(
                `[Amikoo] Unable to read results file "${file}": ${reason}`
            );
        }

        if (!Array.isArray(workerTests)) {
            throw new Error(
                `[Amikoo] Invalid results file: ${file}. Expected an array.`
            );
        }

        tests.push(
            ...(workerTests as AmikooTestResult[])
        );

        log(
            `Loaded ${workerTests.length} result(s) from ${file}.`
        );
    }

    log(`Repository: ${repository}`);
    log(`Branch: ${branch}`);
    log(`Workers collected: ${files.length}`);
    log(`Total tests collected: ${tests.length}`);

    if (!tests.length) {
        log('No tests to submit.');
        return;
    }

    const passed = tests.filter(
        test => test.result === true
    ).length;

    const failed = tests.filter(
        test => test.result === false
    ).length;

    log(
        `Results summary: ${passed} PASS, ${failed} FAIL.`
    );

    try {
        const client = new AmikooApiClient(options);

        log('Submitting consolidated execution...');

        const response = await client.sendResults(
            tests,
            repository,
            branch
        ) as AmikooSubmissionResponse;

        if (response?.success !== true) {
            throw new Error(
                'Amikoo did not confirm a successful submission.'
            );
        }

        const processed = response.data?.testsProcessed;

        if (
            typeof processed === 'number' &&
            processed !== tests.length
        ) {
            throw new Error(
                `Amikoo reported ${processed} processed tests, ` +
                `but ${tests.length} were submitted.`
            );
        }

        log(
            'Consolidated execution confirmed: ' +
            JSON.stringify(response)
        );

        fs.rmSync(RESULTS_DIR, {
            recursive: true,
            force: true
        });

        log('Temporary results cleaned successfully.');
    } catch (error) {
        const reason =
            error instanceof Error
                ? error.message
                : String(error);

        logError(`Submission failed: ${reason}`);

        logError(
            'Results preserved at: ' + RESULTS_DIR
        );

        logError(
            'Automatic resubmission is disabled to avoid duplicate executions.'
        );

        throw error;
    }
}