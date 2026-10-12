import crypto from 'node:crypto';
import type {
    AmikooReporterOptions,
    AmikooTestResult
} from './types.js';

export class AmikooApiClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(options: AmikooReporterOptions) {
        this.baseUrl = (
            options.baseUrl || 'https://app.amikoo.ai'
        ).replace(/\/$/, '');

        this.apiKey = options.apiKey || process.env.AMIKOO_KEY || '';

        if (!this.apiKey) {
            throw new Error('AMIKOO_KEY is required');
        }
    }

    private async request(
        endpoint: string,
        token?: string,
        payload?: unknown,
        method: 'GET' | 'POST' = 'POST'
    ): Promise<any> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: {
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
                ...(payload !== undefined
                    ? { 'Content-Type': 'application/json' }
                    : {})
            },
            ...(payload !== undefined
                ? { body: JSON.stringify(payload) }
                : {})
        });

        const raw = await response.text();

        let data: any;

        try {
            data = JSON.parse(raw);
        } catch {
            data = { message: raw.slice(0, 500) };
        }

        if (!response.ok) {
            throw new Error(
                `${endpoint}: HTTP ${response.status} ${JSON.stringify(data)}`
            );
        }

        return data;
    }

    async sendResults(
        tests: AmikooTestResult[],
        repository: string,
        branch: string
    ): Promise<unknown> {
        const [owner, name] = repository.split('/');

        if (!owner || !name) {
            throw new Error(
                'Repository must have the format owner/name'
            );
        }

        const auth = await this.request(
            '/validate_key',
            undefined,
            { key: this.apiKey }
        );

        const token = auth?.data?.access_token;

        if (!token) {
            throw new Error('Amikoo authentication failed');
        }

        const repositoryResponse = await this.request(
            '/repository/get',
            token,
            { owner, name }
        );

        const repo =
            repositoryResponse?.data ?? repositoryResponse;

        const repositoryId = repo?.id ?? repo?.repositoryId;

        if (!repositoryId) {
            throw new Error('Repository not found in Amikoo');
        }

        const executionResponse = await this.request(
            '/execution/execution_number',
            token,
            undefined,
            'GET'
        );

        const execution =
            executionResponse?.data ?? executionResponse;

        const executionNumber = execution?.executionNumber;

        if (executionNumber === undefined) {
            throw new Error('Execution number not returned');
        }

        const formattedTests = tests.map(test => {
            const hashObject = {
                owner,
                repositoryId,
                fileLocation: test.filePath,
                fullTitle: test.fullTitle,
                branch
            };

            const hashId = crypto
                .createHash('sha256')
                .update(
                    `${owner}/${repositoryId}:${test.filePath}:${test.fullTitle}:${branch}`
                )
                .digest('hex');

            return {
                hashId,
                hashObject,
                ...test
            };
        });

        return this.request(
            '/execution/feedback',
            token,
            {
                repositoryId,
                branch,
                tests: formattedTests,
                executionNumber,
                videos: []
            }
        );
    }
}
