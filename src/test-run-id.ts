import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIRECTORY = path.join(
    process.cwd(),
    '.amikoo-test-run-ids'
);

interface TestRunRecord {
    id: string;
    processId: number;
    createdAt: string;
}

function getRecordPath(processId: number): string {
    return path.join(DIRECTORY, `${processId}.json`);
}

export function createTestRunId(): string {
    const id = crypto.randomUUID();

    fs.mkdirSync(DIRECTORY, {
        recursive: true
    });

    const record: TestRunRecord = {
        id,
        processId: process.pid,
        createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
        getRecordPath(process.pid),
        JSON.stringify(record, null, 2),
        'utf8'
    );

    return id;
}

export function getTestRunId(): string | undefined {
    const file = getRecordPath(process.pid);

    if (!fs.existsSync(file)) {
        return undefined;
    }

    try {
        const record = JSON.parse(
            fs.readFileSync(file, 'utf8')
        ) as TestRunRecord;

        return record.id;
    } catch {
        return undefined;
    }
}

export function clearTestRunId(): void {
    fs.rmSync(
        getRecordPath(process.pid),
        { force: true }
    );
}
