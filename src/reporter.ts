import WDIOReporter from '@wdio/reporter';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type {
    AmikooReporterOptions,
    AmikooTestResult
} from './types.js';

export default class AmikooReporter extends WDIOReporter {
    private readonly amikooOptions: AmikooReporterOptions;
    private readonly amikooResults: AmikooTestResult[] = [];

    constructor(
        options: AmikooReporterOptions & {
            logFile?: string;
            outputDir?: string;
            stdout?: boolean;
        }
    ) {
        super({
            ...options,
            stdout: true
        });

        this.amikooOptions = options;
    }

    onTestPass(test: any): void {
        this.recordTest(test, true);
    }

    onTestFail(test: any): void {
        this.recordTest(test, false);
    }

    onTestSkip(test: any): void {
        console.log(`[Amikoo] Skipped: ${test.title}`);
    }

    private recordTest(test: any, passed: boolean): void {
        this.amikooResults.push({
            name: test.title,
            filePath: test.file || 'unknown',
            fullTitle: test.fullTitle || test.title,
            duration: (test.duration || 0) / 1000,
            executionAt: new Date().toISOString(),
            result: passed,
            error: passed
                ? {}
                : {
                    message: test.error?.message,
                    stack: test.error?.stack
                }
        });
    }

    onRunnerEnd(): void {
        if (
            this.amikooOptions.enabled === false ||
            !this.amikooResults.length
        ) {
            return;
        }

        try {
            const directory = path.join(
                process.cwd(),
                '.amikoo-wdio-results'
            );

            fs.mkdirSync(directory, { recursive: true });

            const filename = `${process.pid}-${crypto.randomUUID()}.json`;

            fs.writeFileSync(
                path.join(directory, filename),
                JSON.stringify(this.amikooResults),
                'utf8'
            );

            console.log(
                `[Amikoo] Worker results collected: ${this.amikooResults.length}`
            );
        } catch (error) {
            console.error('[Amikoo] Failed to save worker results:', error);
        }
    }
}
