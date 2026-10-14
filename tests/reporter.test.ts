
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import AmikooReporter from '../src/reporter.js';
import {
    prepareAmikooRun,
    submitAmikooRun
} from '../src/aggregation.js';

const { sendResultsMock } = vi.hoisted(() => ({
    sendResultsMock: vi.fn()
}));

vi.mock('../src/api-client.js', () => ({
    AmikooApiClient: class {
        sendResults = sendResultsMock;
    }
}));

const resultsDir = path.join(
    process.cwd(),
    '.amikoo-wdio-results'
);

const options = {
    apiKey: 'test-key',
    repository: 'qa-agentic-lab/virtualshop-mobile-qa',
    branch: 'main'
};

describe('Amikoo WDIO Reporter', () => {
    beforeEach(() => {
        sendResultsMock.mockReset();
        sendResultsMock.mockResolvedValue({
            success: true,
            data: { testsProcessed: 1 }
        });

        prepareAmikooRun();
    });

    afterEach(() => {
        fs.rmSync(resultsDir, {
            recursive: true,
            force: true
        });
    });

    function createReporter(
        extraOptions: Record<string, unknown> = {}
    ): AmikooReporter {
        return new AmikooReporter({
            ...options,
            outputDir: './reports',
            logFile: './reports/amikoo-test.log',
            ...extraOptions
        } as ConstructorParameters<typeof AmikooReporter>[0]);
    }

    it('should capture a passed test', async () => {
        const reporter = createReporter();

        reporter.onTestPass({
            title: 'should register successfully',
            fullTitle: 'Registration should register successfully',
            file: 'register-login.spec.ts',
            duration: 2500
        });

        reporter.onRunnerEnd();

        const files = fs.readdirSync(resultsDir);
        expect(files).toHaveLength(1);

        const tests = JSON.parse(
            fs.readFileSync(
                path.join(resultsDir, files[0]),
                'utf8'
            )
        );

        expect(tests).toHaveLength(1);
        expect(tests[0].result).toBe(true);
        expect(tests[0].duration).toBe(2.5);
        expect(tests[0].name).toBe(
            'should register successfully'
        );

        expect(sendResultsMock).not.toHaveBeenCalled();

        await submitAmikooRun(options);

        expect(sendResultsMock).toHaveBeenCalledOnce();
        expect(sendResultsMock).toHaveBeenCalledWith(
            tests,
            options.repository,
            options.branch
        );
    });

    it('should capture a failed test with error details', async () => {
        const reporter = createReporter();

        reporter.onTestFail({
            title: 'should display catalog',
            fullTitle: 'Catalog should display catalog',
            file: 'catalog.spec.ts',
            duration: 1000,
            error: {
                message: 'Element not found',
                stack: 'Error: Element not found'
            }
        });

        reporter.onRunnerEnd();

        const files = fs.readdirSync(resultsDir);
        expect(files).toHaveLength(1);

        const tests = JSON.parse(
            fs.readFileSync(
                path.join(resultsDir, files[0]),
                'utf8'
            )
        );

        expect(tests).toHaveLength(1);
        expect(tests[0].result).toBe(false);
        expect(tests[0].duration).toBe(1);
        expect(tests[0].error.message).toBe(
            'Element not found'
        );
        expect(tests[0].error.stack).toBe(
            'Error: Element not found'
        );

        await submitAmikooRun(options);

        expect(sendResultsMock).toHaveBeenCalledOnce();
    });

    it('should consolidate multiple workers into one submission', async () => {

        sendResultsMock.mockResolvedValue({
            success: true,
            data: { testsProcessed: 2 }
        });

        const reporter1 = createReporter();
        const reporter2 = createReporter();

        reporter1.onTestPass({
            title: 'test one',
            fullTitle: 'Suite test one',
            file: 'one.spec.ts',
            duration: 1000
        });

        reporter2.onTestFail({
            title: 'test two',
            fullTitle: 'Suite test two',
            file: 'two.spec.ts',
            duration: 2000,
            error: {
                message: 'Timeout'
            }
        });

        reporter1.onRunnerEnd();
        reporter2.onRunnerEnd();

        expect(sendResultsMock).not.toHaveBeenCalled();

        await submitAmikooRun(options);

        expect(sendResultsMock).toHaveBeenCalledOnce();

        const [tests, repository, branch] =
            sendResultsMock.mock.calls[0];

        expect(tests).toHaveLength(2);
        expect(tests.filter((test: any) => test.result)).toHaveLength(1);
        expect(tests.filter((test: any) => !test.result)).toHaveLength(1);
        expect(repository).toBe(options.repository);
        expect(branch).toBe(options.branch);

        expect(fs.existsSync(resultsDir)).toBe(false);
    });

    it('should not collect or submit results when disabled', async () => {
        const reporter = createReporter({
            enabled: false
        });

        reporter.onTestPass({
            title: 'example',
            duration: 100
        });

        reporter.onRunnerEnd();

        expect(fs.readdirSync(resultsDir)).toHaveLength(0);

        await submitAmikooRun({
            ...options,
            enabled: false
        });

        expect(sendResultsMock).not.toHaveBeenCalled();
    });

        it('should preserve JSON results when API submission fails', async () => {
        sendResultsMock.mockRejectedValue(
            new Error('Network connection failed')
        );

        const reporter = createReporter();

        reporter.onTestPass({
            title: 'network failure test',
            fullTitle: 'Suite network failure test',
            file: 'network.spec.ts',
            duration: 1000
        });

        reporter.onRunnerEnd();

        await expect(
            submitAmikooRun(options)
        ).rejects.toThrow('Network connection failed');

        expect(sendResultsMock).toHaveBeenCalledOnce();
        expect(fs.readdirSync(resultsDir)).toHaveLength(1);
    });

    it('should preserve JSON results when Amikoo returns success false', async () => {
        sendResultsMock.mockResolvedValue({
            success: false,
            message: 'Submission rejected'
        });

        const reporter = createReporter();

        reporter.onTestPass({
            title: 'rejected submission',
            fullTitle: 'Suite rejected submission',
            file: 'rejected.spec.ts',
            duration: 1000
        });

        reporter.onRunnerEnd();

        await expect(
            submitAmikooRun(options)
        ).rejects.toThrow(
            'Amikoo did not confirm a successful submission'
        );

        expect(sendResultsMock).toHaveBeenCalledOnce();
        expect(fs.readdirSync(resultsDir)).toHaveLength(1);
    });

    it('should preserve JSON results when processed count does not match', async () => {
        sendResultsMock.mockResolvedValue({
            success: true,
            data: { testsProcessed: 0 }
        });

        const reporter = createReporter();

        reporter.onTestPass({
            title: 'count mismatch',
            fullTitle: 'Suite count mismatch',
            file: 'mismatch.spec.ts',
            duration: 1000
        });

        reporter.onRunnerEnd();

        await expect(
            submitAmikooRun(options)
        ).rejects.toThrow(
            'Amikoo reported 0 processed tests, but 1 were submitted'
        );

        expect(sendResultsMock).toHaveBeenCalledOnce();
        expect(fs.readdirSync(resultsDir)).toHaveLength(1);
    });

    it('should reject invalid JSON without submitting results', async () => {
        fs.writeFileSync(
            path.join(resultsDir, 'invalid.json'),
            '{invalid-json',
            'utf8'
        );

        await expect(
            submitAmikooRun(options)
        ).rejects.toThrow(
            'Unable to read results file "invalid.json"'
        );

        expect(sendResultsMock).not.toHaveBeenCalled();
        expect(fs.existsSync(
            path.join(resultsDir, 'invalid.json')
        )).toBe(true);
    });
});
