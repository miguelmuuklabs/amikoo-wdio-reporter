import crypto from 'node:crypto';

import type {
    AmikooReporterOptions,
    AmikooTestResult
} from './types.js';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

const RETRYABLE_STATUS_CODES = new Set([
    429,
    500,
    502,
    503,
    504
]);

type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
    endpoint: string;
    token?: string;
    payload?: unknown;
    method?: HttpMethod;
    retryable?: boolean;
}

class AmikooHttpError extends Error {
    constructor(
        readonly status: number,
        readonly endpoint: string,
        readonly responseBody: unknown
    ) {
        super(
            `${endpoint}: HTTP ${status} ${JSON.stringify(responseBody)}`
        );

        this.name = 'AmikooHttpError';
    }
}

export class AmikooApiClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(options: AmikooReporterOptions) {
        this.baseUrl = (
            options.baseUrl || 'https://app.amikoo.ai'
        ).replace(/\/$/, '');

        this.apiKey =
            options.apiKey ||
            process.env.AMIKOO_KEY ||
            '';

        if (!this.apiKey) {
            throw new Error('[Amikoo] AMIKOO_KEY is required');
        }
    }

    private async delay(ms: number): Promise<void> {
        await new Promise<void>(resolve => {
            setTimeout(resolve, ms);
        });
    }

    private shouldRetry(error: unknown): boolean {
        if (error instanceof AmikooHttpError) {
            return RETRYABLE_STATUS_CODES.has(error.status);
        }

        // fetch() network failures and AbortSignal timeouts.
        if (error instanceof TypeError) {
            return true;
        }

        if (error instanceof Error) {
            return (
                error.name === 'TimeoutError' ||
                error.name === 'AbortError'
            );
        }

        return false;
    }

    private async request({
        endpoint,
        token,
        payload,
        method = 'POST',
        retryable = false
    }: RequestOptions): Promise<any> {
        const maxAttempts = retryable
            ? MAX_ATTEMPTS
            : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(
                    `${this.baseUrl}${endpoint}`,
                    {
                        method,
                        signal: AbortSignal.timeout(
                            REQUEST_TIMEOUT_MS
                        ),
                        headers: {
                            ...(token
                                ? {
                                    Authorization: `Bearer ${token}`
                                }
                                : {}),
                            ...(payload !== undefined
                                ? {
                                    'Content-Type': 'application/json'
                                }
                                : {})
                        },
                        ...(payload !== undefined
                            ? {
                                body: JSON.stringify(payload)
                            }
                            : {})
                    }
                );

                const raw = await response.text();

                let data: any;

                try {
                    data = JSON.parse(raw);
                } catch {
                    data = {
                        message: raw.slice(0, 500)
                    };
                }

                if (!response.ok) {
                    throw new AmikooHttpError(
                        response.status,
                        endpoint,
                        data
                    );
                }

                return data;
            } catch (error) {
                const canRetry =
                    retryable &&
                    attempt < maxAttempts &&
                    this.shouldRetry(error);

                if (!canRetry) {
                    console.error(
                        `[Amikoo] Request failed: ${endpoint}`,
                        error instanceof Error
                            ? error.message
                            : String(error)
                    );

                    throw error;
                }

                const delayMs =
                    INITIAL_RETRY_DELAY_MS *
                    2 ** (attempt - 1);

                console.warn(
                    `[Amikoo] ${endpoint} failed. ` +
                    `Retry ${attempt}/${maxAttempts - 1} ` +
                    `in ${delayMs}ms.`
                );

                await this.delay(delayMs);
            }
        }

        throw new Error(
            `[Amikoo] Unexpected request failure: ${endpoint}`
        );
    }

    async sendResults(
        tests: AmikooTestResult[],
        repository: string,
        branch: string
    ): Promise<unknown> {
        const parts = repository.split('/');

        if (
            parts.length !== 2 ||
            !parts[0] ||
            !parts[1]
        ) {
            throw new Error(
                'Repository must have the format owner/name'
            );
        }

        const [owner, name] = parts;

        // Authentication validation.
        const auth = await this.request({
            endpoint: '/validate_key',
            payload: {
                key: this.apiKey
            },
            retryable: true
        });

        const token = auth?.data?.access_token;

        if (!token) {
            throw new Error(
                '[Amikoo] Authentication failed'
            );
        }

        // Repository lookup.
        const repositoryResponse = await this.request({
            endpoint: '/repository/get',
            token,
            payload: {
                owner,
                name
            },
            retryable: true
        });

        const repo =
            repositoryResponse?.data ??
            repositoryResponse;

        const repositoryId =
            repo?.id ??
            repo?.repositoryId;

        if (!repositoryId) {
            throw new Error(
                '[Amikoo] Repository not found'
            );
        }

        // Execution number retrieval.
        // No automatic retry until endpoint behavior
        // is confirmed to be side-effect-free.
        const executionResponse = await this.request({
            endpoint: '/execution/execution_number',
            token,
            method: 'GET',
            retryable: false
        });

        const execution =
            executionResponse?.data ??
            executionResponse;

        const executionNumber =
            execution?.executionNumber;

        if (executionNumber === undefined) {
            throw new Error(
                '[Amikoo] Execution number not returned'
            );
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
                    `${owner}/${repositoryId}:` +
                    `${test.filePath}:` +
                    `${test.fullTitle}:` +
                    branch
                )
                .digest('hex');

            return {
                hashId,
                hashObject,
                ...test
            };
        });

        // Critical submission:
        // Never automatically retry this POST.
        // The server might have processed the request
        // even if the response was lost.
        return this.request({
            endpoint: '/execution/feedback',
            token,
            payload: {
                repositoryId,
                branch,
                tests: formattedTests,
                executionNumber,
                videos: []
            },
            retryable: false
        });
    }
}
