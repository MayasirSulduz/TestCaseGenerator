export interface CoverageReport {
  totalCoverage: number;
  runCommand: string;
  summaryTable: string;
  missingLines: string;
  suggestions: string[];
  testPassed?: boolean;
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
