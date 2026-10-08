export interface TrialStep {
  trialNumber: number;
  coverage: number;
  status: 'failed' | 'refining' | 'passed';
  note: string;
}

export interface ProjectTestFile {
  filename: string;
  filepath: string;
  content: string;
  coverage?: number;
  isFixture?: boolean;
}

export interface CoverageReport {
  totalCoverage: number;
  runCommand: string;
  summaryTable: string;
  missingLines: string;
  suggestions: string[];
  testPassed?: boolean;
  executionTimeSec?: string;
  trials?: TrialStep[];
  projectTestFiles?: ProjectTestFile[];
}

export interface FrameworkDetectionResult {
  status: 'success' | 'error';
  framework: string;
  language: string;
  extension: string;
  availableFrameworks: string[];
  error?: string;
}

export interface GenerateTestsResult {
  status: 'success' | 'error';
  tests?: string;
  coverageReport?: CoverageReport;
  message?: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  executionTimeSec?: string;
}

export interface HealthCheckResult {
  status: 'success' | 'ok' | 'error';
  message?: string;
  version?: string;
  groq_api_key_set?: boolean;
  runtime_environment?: {
    python: boolean;
    node: boolean;
    npm: boolean;
    java: boolean;
    javac: boolean;
    mvn: boolean;
  };
}

export interface CodeViewerProps {
  code: string;
  fileName: string;
  framework: string;
  language: string;
  isLoading?: boolean;
  statusPhase?: 'thinking' | 'generating' | 'sandbox' | 'complete';
  sourceCode?: string;
  missingLines?: string;
  coverage?: number;
  onGenerateTargetedLines?: (targetLines: string) => void;
  projectTestFiles?: ProjectTestFile[];
  isZipUpload?: boolean;
  selectedFileIdx?: number;
  onSelectFileIdx?: (idx: number) => void;
}

export interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

export interface FrameworkSelectorProps {
  language: string;
  framework: string;
  availableFrameworks: string[];
  onFrameworkChange: (framework: string) => void;
}

export interface CoverageSliderProps {
  value: number;
  onChange: (value: number) => void;
}
