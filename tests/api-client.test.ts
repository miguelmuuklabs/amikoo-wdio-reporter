
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmikooApiClient } from '../src/api-client.js';

describe('Amikoo API Client', () => {
    const originalFetch = globalThis.fetch;

    const test = {
        name: 'should register successfully',
        filePath: 'register-login.spec.ts',
        fullTitle: 'Registration should register successfully',
        duration: 2.5,
        executionAt: '2026-10-12T12:00:00.000Z',
        result: true,
        error: {}
    };

    beforeEach(() => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    data: { access_token: 'mock-token' }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    data: { id: 123 }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    data: { executionNumber: 10 }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    success: true,
                    data: { testsProcessed: 1 }
                })
            });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('authenticates and submits results to Amikoo', async () => {
        const client = new AmikooApiClient({
            apiKey: 'mock-api-key'
        });

        const response = await client.sendResults(
            [test],
            'qa-agentic-lab/virtualshop-mobile-qa',
            'main'
        );

        expect(response).toMatchObject({
            success: true
        });

        expect(globalThis.fetch).toHaveBeenCalledTimes(4);

        const calls = vi.mocked(globalThis.fetch).mock.calls;

        expect(calls[0][0]).toContain('/validate_key');
        expect(calls[1][0]).toContain('/repository/get');
        expect(calls[2][0]).toContain('/execution/execution_number');
        expect(calls[3][0]).toContain('/execution/feedback');

        const payload = JSON.parse(
            calls[3][1]?.body as string
        );

        expect(payload.repositoryId).toBe(123);
        expect(payload.executionNumber).toBe(10);
        expect(payload.branch).toBe('main');
        expect(payload.tests).toHaveLength(1);
        expect(payload.tests[0].result).toBe(true);
        expect(payload.tests[0].hashId).toMatch(/^[a-f0-9]{64}$/);
    });
});
