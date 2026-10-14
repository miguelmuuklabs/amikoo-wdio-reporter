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
- HTTP request timeout of 15 seconds
- Automatic retries for transient authentication and repository lookup failures
- Exponential retry delays (1s and 2s, maximum 3 attempts)
- HTTP and network error handling
- Protection against automatic execution resubmission
- Preservation of worker JSON results when submission fails
- Validation of API submission confirmation and processed test count
- Protection against overwriting pending results
- Detailed execution diagnostics
- Automated build and unit test validation with GitHub Actions

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
npm install --save-dev ./amikoo-wdio-reporter-0.2.0.tgz
```

The package is currently distributed internally and is not published to the public npm registry.

## Environment Variables

The Amikoo reporter requires a valid API key to authenticate requests to the Amikoo API.

The API key must be configured in the **WebdriverIO project that consumes the package**, not in the reporter's source code.

### Local Configuration

Create a `.env` file in the root directory of your WebdriverIO project:

```env
AMIKOO_KEY=your_amiko_api_key
```

If your project uses `dotenv`, install it:

```bash
npm install dotenv
```

Then load the environment variables at the beginning of `wdio.conf.ts`:

```typescript
import 'dotenv/config';
```

The reporter can then access the API key using:

```typescript
apiKey: process.env.AMIKOO_KEY
```

Alternatively, you can provide `AMIKOO_KEY` directly through your operating system's environment variables without using a `.env` file.

### GitHub Actions Configuration

For CI/CD executions, configure the API key as a GitHub Actions repository secret:

1. Open the consuming project's GitHub repository.
2. Navigate to **Settings → Secrets and variables → Actions**.
3. Create a new repository secret named `AMIKOO_KEY`.
4. Reference the secret in your workflow:

```yaml
env:
  AMIKOO_KEY: ${{ secrets.AMIKOO_KEY }}
```

### Security

Never commit actual API keys to source control.

Ensure `.env` is included in the consuming project's `.gitignore`:

```gitignore
.env
.env.*
!.env.example
```

The reporter uses the configured API key to authenticate requests to Amikoo. Each consuming project is responsible for providing its own credentials.

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
[Amikoo] Worker results collected: 5
[Amikoo] Repository: qa-agentic-lab/virtualshop-mobile-qa
[Amikoo] Branch: main
[Amikoo] Workers collected: 1
[Amikoo] Total tests collected: 5
[Amikoo] Results summary: 2 PASS, 3 FAIL.
[Amikoo] Submitting consolidated execution...
[Amikoo] Consolidated execution confirmed: {"success":true,"data":{"testsProcessed":5,"failedTestCount":3}}
[Amikoo] Temporary results cleaned successfully.
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

## Reliability and Error Handling

Version 0.2.0 introduces additional reliability safeguards.

### HTTP Requests

- Requests have a configured timeout of 15 seconds.
- Authentication and repository lookup requests can retry transient failures.
- Retryable HTTP statuses include 429, 500, 502, 503, and 504.
- Network failures and timeout errors can trigger retries on permitted endpoints.
- A maximum of 3 attempts is allowed, with exponential delays of 1 and 2 seconds.

### Duplicate Submission Protection

The reporter does not automatically retry:

- `/execution/execution_number`
- `/execution/feedback`

This reduces the risk of creating duplicate executions when the API processes a request but its response is lost.

This is not a guarantee of server-side idempotency.

### Result Preservation

If submission fails or Amikoo does not confirm success, the reporter preserves the worker JSON files in:

`.amikoo-wdio-results`

The reporter also checks the number of processed tests when the API provides `testsProcessed`.

A new execution will not initialize while pending JSON files remain in the results directory.

Pending files must be reviewed manually before starting another execution. Do not resubmit them without checking whether Amikoo already processed the previous request.

### Diagnostics

The reporter logs:

- Repository and branch
- Number of worker result files
- Total collected tests
- PASS and FAIL counts
- Submission confirmation or error details
- Location of preserved results when submission fails

## Known Limitations

- Aggregation uses the shared `.amikoo-wdio-results` directory.
- Concurrent suites running from the same working directory are not supported.
- Manual integration with WebdriverIO lifecycle hooks is currently required.
- The reporter collects and submits results; it does not generate or execute test cases.
- Pending result files require manual review and recovery.
- Automatic resubmission is intentionally disabled for execution submission.
- Server-side idempotency is not guaranteed.
- Concurrent runs sharing the same results directory are not supported.
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

**Version 0.2.0 — Reliability improvements**

Build and unit test validation completed successfully.

- 16 unit tests passing
- HTTP retry and error handling implemented
- Timeout error handling validated with mocked requests
- Multi-worker aggregation validated
- Failed submission result preservation validated
- GitHub Actions CI workflow configured

**Previous validation — Version 0.1.0**

Successfully validated against the real Amikoo API on October 12, 2026.

Amikoo execution #21 processed five Android test results in a single consolidated execution.

**Version 0.2.0 real integration validation is pending.**

The package remains intended for internal evaluation.