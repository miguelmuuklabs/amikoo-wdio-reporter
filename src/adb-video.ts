import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

import type { ChildProcess } from 'node:child_process';
import type { VideoProvider } from './video-provider.js';

const execFileAsync = promisify(execFile);

export interface AdbVideoProviderOptions {
    deviceId?: string;
    adbPath?: string;
}

export class AdbVideoProvider implements VideoProvider {
    private process?: ChildProcess;
    private remotePath?: string;
    private readonly deviceId: string;
    private readonly adbPath: string;

    constructor(options: AdbVideoProviderOptions = {}) {
        this.deviceId = options.deviceId ?? 'emulator-5554';
        this.adbPath = options.adbPath ?? 'adb';
    }

    private args(...args: string[]): string[] {
        return ['-s', this.deviceId, ...args];
    }

    async start(): Promise<void> {
        if (this.process) {
            throw new Error('[Amikoo] ADB recording already started.');
        }

        const remotePath = `/sdcard/amikoo-${randomUUID()}.mp4`;

        await execFileAsync(
            this.adbPath,
            this.args('get-state')
        );

        const child = spawn(
            this.adbPath,
            this.args(
                'shell',
                'screenrecord',
                '--time-limit',
                '180',
                remotePath
            ),
            {
                stdio: ['ignore', 'ignore', 'pipe']
            }
        );

        this.process = child;
        this.remotePath = remotePath;

        child.stderr?.on('data', data => {
            console.error('[Amikoo] ADB:', data.toString());
        });

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 1000);

            child.once('error', error => {
                clearTimeout(timer);
                reject(error);
            });

            child.once('exit', code => {
                clearTimeout(timer);
                reject(
                    new Error(
                        `[Amikoo] ADB screenrecord exited early (${code}).`
                    )
                );
            });
        });

        console.log('[Amikoo] ADB video recording started.');
    }

    async stop(): Promise<string> {
        const child = this.process;
        const remotePath = this.remotePath;

        if (!child || !remotePath) {
            throw new Error('[Amikoo] No active ADB recording.');
        }

        this.process = undefined;
        this.remotePath = undefined;

        const localPath = path.join(
            os.tmpdir(),
            `amikoo-${randomUUID()}.mp4`
        );

        try {
            if (child.exitCode === null) {
                await execFileAsync(
                    this.adbPath,
                    this.args(
                        'shell',
                        'pkill',
                        '-2',
                        'screenrecord'
                    )
                ).catch(async () => {
                    await execFileAsync(
                        this.adbPath,
                        this.args(
                            'shell',
                            'killall',
                            '-2',
                            'screenrecord'
                        )
                    );
                });
            }

            await new Promise<void>((resolve, reject) => {
                if (child.exitCode !== null) {
                    resolve();
                    return;
                }

                const timer = setTimeout(() => {
                    reject(
                        new Error(
                            '[Amikoo] ADB recording did not stop.'
                        )
                    );
                }, 10000);

                child.once('exit', () => {
                    clearTimeout(timer);
                    resolve();
                });
            });

            await execFileAsync(
                this.adbPath,
                this.args('pull', remotePath, localPath)
            );

            const video = await fs.readFile(localPath);

            if (!video.length) {
                throw new Error('[Amikoo] Empty ADB video.');
            }

            return video.toString('base64');
        } finally {
            await fs.rm(localPath, { force: true });

            await execFileAsync(
                this.adbPath,
                this.args('shell', 'rm', '-f', remotePath)
            ).catch(() => undefined);
        }
    }
}
