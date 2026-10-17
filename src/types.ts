export interface AmikooReporterOptions {
    apiKey?: string;
    baseUrl?: string;
    repository?: string;
    branch?: string;
    enabled?: boolean;
    videoEvidence?: {
        enabled: boolean;
        bucket: string;
        region: string;
    };
}

export interface AmikooVideoEvidence {
    bucket: string;
    region: string;
    key: string;
    s3Uri: string;
}

export interface AmikooTestResult {
    name: string;
    filePath: string;
    fullTitle: string;
    duration: number;
    executionAt: string;
    result: boolean;
    testRunId?: string;
    error: {
        message?: string;
        stack?: string;
    };
    evidence?: {
        video?: AmikooVideoEvidence;
    };
}

export interface AmikooReport {
    framework: 'WebdriverIO';
    automation: 'Appium';
    platform: 'Android';
    tests: AmikooTestResult[];
}

