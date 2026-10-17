
import AmikooReporter from './reporter.js';

export { AmikooReporter };
export default AmikooReporter;

// Aggregation
export {
    prepareAmikooRun,
    submitAmikooRun
} from './aggregation.js';

// Reporter types
export type {
    AmikooReporterOptions,
    AmikooTestResult,
    AmikooReport
} from './types.js';

// S3 uploader
export {
    uploadVideoToS3
} from './s3-uploader.js';

export type {
    S3VideoEvidence,
    S3UploadOptions
} from './s3-uploader.js';

// Video evidence
export {
    registerVideoEvidence
} from './video-evidence.js';

export type {
    VideoEvidenceOptions,
    VideoEvidenceRecord
} from './video-evidence.js';

// Video provider interface
export type {
    VideoProvider
} from './video-provider.js';

// Appium provider
export {
    AppiumVideoProvider
} from './appium-video.js';

export type {
    AppiumRecordingDriver
} from './appium-video.js';

// Provider-independent video recorder
export {
    VideoRecorder
} from './video-recorder.js';

export type {
    VideoRecorderOptions,
    VideoTestInfo
} from './video-recorder.js';

export {
    AdbVideoProvider,
    type AdbVideoProviderOptions
} from './adb-video.js';