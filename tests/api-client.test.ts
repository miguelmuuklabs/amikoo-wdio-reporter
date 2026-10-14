import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach
} from 'vitest';

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

    const repository = 'qa-agentic-lab/virtualshop-mobile-qa';

    const successResponse = (data: unknown) => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(data)
    });

    const errorResponse = (
        status: number,
        message: string
    ) => ({
        ok: false,
        status,
        text: async () => JSON.stringify({ message })
    });

    const authenticationResponse = () =>
        successResponse({
            data: { access_token: 'mock-token' }
        });

    const repositoryResponse = () =>
        successResponse({
            data: { id: 123 }
        });

    const executionResponse = () =>
        successResponse({
            data: { executionNumber: 10 }
        });

    const feedbackResponse = () =>
        successResponse({
            success: true,
            data: { testsProcessed: 1 }
        });

    const createClient = () =>
        new AmikooApiClient({
            apiKey: 'mock-api-key'
        });

    beforeEach(() => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(authenticationResponse())
            .mockResolvedValueOnce(repositoryResponse())
            .mockResolvedValueOnce(executionResponse())
            .mockResolvedValueOnce(feedbackResponse());
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('authenticates and submits results to Amikoo', async () => {
        const response = await createClient().sendResults(
            [test],
            repository,
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

    it('retries HTTP 503 and succeeds on the next attempt', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(
                errorResponse(503, 'Service unavailable')
            )
            .mockResolvedValueOnce(authenticationResponse())
            .mockResolvedValueOnce(repositoryResponse())
            .mockResolvedValueOnce(executionResponse())
            .mockResolvedValueOnce(feedbackResponse());

        const response = await createClient().sendResults(
            [test],
            repository,
            'main'
        );

        expect(response).toMatchObject({
            success: true
        });

        expect(globalThis.fetch).toHaveBeenCalledTimes(5);

        const calls = vi.mocked(globalThis.fetch).mock.calls;

        expect(calls[0][0]).toContain('/validate_key');
        expect(calls[1][0]).toContain('/validate_key');
    });

    it('does not retry HTTP 401 authentication errors', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValue(
                errorResponse(401, 'Unauthorized')
            );

        await expect(
            createClient().sendResults(
                [test],
                repository,
                'main'
            )
        ).rejects.toThrow('HTTP 401');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries network errors up to the configured limit', async () => {
        globalThis.fetch = vi.fn()
            .mockRejectedValue(
                new TypeError('Network connection failed')
            );

        await expect(
            createClient().sendResults(
                [test],
                repository,
                'main'
            )
        ).rejects.toThrow('Network connection failed');

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry failed execution feedback submissions', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(authenticationResponse())
            .mockResolvedValueOnce(repositoryResponse())
            .mockResolvedValueOnce(executionResponse())
            .mockResolvedValueOnce(
                errorResponse(503, 'Service unavailable')
            );

        await expect(
            createClient().sendResults(
                [test],
                repository,
                'main'
            )
        ).rejects.toThrow('HTTP 503');

        expect(globalThis.fetch).toHaveBeenCalledTimes(4);

        const calls = vi.mocked(globalThis.fetch).mock.calls;

        const feedbackCalls = calls.filter(
            call => String(call[0]).includes('/execution/feedback')
        );

        expect(feedbackCalls).toHaveLength(1);
    });

    it('does not retry execution number retrieval failures', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(authenticationResponse())
            .mockResolvedValueOnce(repositoryResponse())
            .mockResolvedValueOnce(
                errorResponse(503, 'Service unavailable')
            );

        await expect(
            createClient().sendResults(
                [test],
                repository,
                'main'
            )
        ).rejects.toThrow('HTTP 503');

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it('rejects invalid repository formats before making requests', async () => {
        await expect(
            createClient().sendResults(
                [test],
                'invalid-repository',
                'main'
            )
        ).rejects.toThrow(
            'Repository must have the format owner/name'
        );

        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});