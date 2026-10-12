
export interface AmikooReporterOptions {
    apiKey?: string;
    baseUrl?: string;
    repository?: string;
    branch?: string;
    enabled?: boolean;
}

export interface AmikooTestResult {
    name: string;
    filePath: string;
    fullTitle: string;
    duration: number;
    executionAt: string;
    result: boolean;
    error: {
        message?: string;
        stack?: string;
    };
}

export interface AmikooReport {
    framework: 'WebdriverIO';
    automation: 'Appium';
    platform: 'Android';
    tests: AmikooTestResult[];
}
