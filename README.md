# Amikoo WebdriverIO Reporter

A custom WebdriverIO reporter that integrates automated test results with **Amikoo**, including mobile testing with **Appium**.

The reporter captures test results, consolidates results from multiple WebdriverIO workers, and submits them to Amikoo as a single execution.

## Features

- WebdriverIO 9 integration
- Support for Appium Android test execution
- Automatic PASS/FAIL result collection
- Error messages and stack trace reporting
- Multi-worker result aggregation
- Single execution submission to Amikoo
- Support for local and CI/CD execution

## Requirements

- Node.js 20 or later
- WebdriverIO 9
- An existing WebdriverIO test project
- A valid Amikoo API key
- Access to the Amikoo API

## Compatible Project Structure

The reporter can be integrated into an existing WebdriverIO 9 project. It does not require a specific folder structure or changes to existing test cases.

A typical WebdriverIO + Appium project might look like this:

```text
mobile-qa-automation/
├── tests/
│   └── specs/
│       ├── login.spec.ts
│       └── checkout.spec.ts
├── wdio.conf.ts
├── package.json
├── package-lock.json
├── .env
├── .gitignore
└── README.md
```

The `amikoo-wdio-reporter` package is installed as a development dependency and imported into `wdio.conf.ts`.

There is no need to copy the reporter source code into the consuming project.

## Integration Architecture

The reporter operates within the existing WebdriverIO execution lifecycle:

```text
WebdriverIO Test Runner
        |
        v
Appium / Browser Automation
        |
        v
Amikoo WebdriverIO Reporter
        |
        v
Per-Worker JSON Results
        |
        v
Result Aggregation (onComplete)
        |
        v
Amikoo API
        |
        v
Single Consolidated Execution
```

**Execution lifecycle:**

1. `onPrepare` initializes the temporary results directory.
2. WebdriverIO executes the configured test specifications.
3. Each worker collects test results through the custom reporter.
4. Worker results are written to `.amikoo-wdio-results`.
5. `onComplete` aggregates the results after execution.
6. The consolidated execution is submitted to the Amikoo API.

## Integration into Existing Projects

The package is designed to work with existing WebdriverIO projects without replacing their test suites, Page Objects, capabilities, or existing reporters.

To integrate it:

1. Install the package as a development dependency.
2. Configure the Amikoo API key.
3. Register `AmikooReporter` in the `reporters` array.
4. Call `prepareAmikooRun()` from `onPrepare`.
5. Call `submitAmikooRun()` from `onComplete`.

If the project already has lifecycle hooks, preserve their existing behavior and add the Amikoo calls to those hooks.

**Important:** The package is a reporting integration, not a complete test automation framework. WebdriverIO remains responsible for running tests, while Appium handles mobile device automation when applicable.

## Installation

Install the internally distributed package:

```bash
npm install --save-dev ./amikoo-wdio-reporter-0.1.0.tgz
```

The package is currently distributed internally and is not published to the public npm registry.

## Configuration

Set the `AMIKOO_KEY` environment variable securely.

Configure your `wdio.conf.ts`:

```typescript
import AmikooReporter, {
    prepareAmikooRun,
    submitAmikooRun
} from 'amikoo-wdio-reporter';

const amikooOptions = {
    enabled: true,
    repository: 'organization/repository',
    branch: 'main',
    apiKey: process.env.AMIKOO_KEY
};

export const config: WebdriverIO.Config = {
    // Keep your existing WebdriverIO configuration.

    reporters: [
        'spec',
        [AmikooReporter, amikooOptions]
    ],

    onPrepare() {
        prepareAmikooRun();
    },

    async onComplete() {
        await submitAmikooRun(amikooOptions);
    }
};
```

If your project already defines `onPrepare` or `onComplete` hooks, add the corresponding Amikoo function calls to those existing hooks instead of replacing their logic.

## Running Tests

Run your WebdriverIO suite normally:

```bash
npx wdio run ./wdio.conf.ts
```

Each worker writes its test results to a temporary directory. After all workers finish, the aggregation function submits the collected results to Amikoo.

Example console output:

```text
[Amikoo] Worker results collected: 1
[Amikoo] Total tests collected: 5
[Amikoo] Consolidated execution submitted: {"success":true,"data":{"testsProcessed":5,"failedTestCount":3}}
```

## Configuration Options

| Option | Description |
|---|---|
| `apiKey` | Amikoo API key. Defaults to the `AMIKOO_KEY` environment variable. |
| `repository` | Repository identifier in `owner/name` format. |
| `branch` | Branch associated with the execution. Defaults to `GITHUB_REF_NAME` or `main`. |
| `baseUrl` | Amikoo API base URL. Defaults to `https://app.amikoo.ai`. |
| `enabled` | Enables or disables result collection and submission. |

## Validation

The integration was successfully validated on October 12, 2026, using WebdriverIO and Appium Android.

**Amikoo execution #21**

| Metric | Result |
|---|---|
| Tests submitted | 5 |
| Passed | 2 |
| Failed | 3 |
| API response | Success |
| Execution grouping | Single execution |

All five results were successfully processed in one consolidated submission.

## Known Limitations

- Aggregation uses the shared `.amikoo-wdio-results` directory.
- Concurrent suites running from the same working directory are not supported.
- Manual integration with WebdriverIO lifecycle hooks is currently required.
- The reporter collects and submits results; it does not generate or execute test cases.
- API access is required to submit results.

## Security Considerations

- Never hardcode API keys or credentials.
- Do not commit `.env` files containing secrets.
- Test results may include file paths, test names, error messages, and stack traces. Ensure they do not contain sensitive information.
- Review internal distribution and repository access permissions before sharing.

## Development

Install dependencies:

```bash
npm install
```

Run unit tests:

```bash
npm test
```

Run TypeScript validation:

```bash
npm run typecheck
```

Build the package:

```bash
npm run build
```

Generate the distributable package:

```bash
npm pack
```

## Project Status

**Version 0.1.0 — Validated proof of concept**

Successfully tested with WebdriverIO, Appium Android, and the Amikoo API.

Intended for internal evaluation and further adoption review.