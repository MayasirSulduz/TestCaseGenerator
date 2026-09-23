export interface GenerateTestsRequestDTO {
  code: string;
  language: string;
  framework: string;
  coverageTarget?: number;
  filename?: string;
}

export interface CoverageResult {
  success: boolean;
  coverage: number;
  missing_lines?: string;
  coverage_table?: string;
  test_passed?: boolean;
  error?: string;
  stdout?: string;
  stderr?: string;
  failedTests?: string[];
  failedCount?: number;
  passedTests?: number;
  collectionError?: boolean;
}

export interface CoverageReportDTO {
  totalCoverage: number;
  runCommand: string;
  summaryTable: string;
  missingLines: string;
  suggestions: string[];
  testPassed?: boolean;
  executionTimeSec?: string;
}

export interface GenerateTestsResponseDTO {
  status: 'success' | 'error';
  tests?: string;
  coverageReport?: CoverageReportDTO;
  message?: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  executionTimeSec?: string;
}

export interface DetectFrameworkRequestDTO {
  filename: string;
}

export interface DetectFrameworkResponseDTO {
  status: 'success' | 'error';
  framework: string;
  language: string;
  extension: string;
  availableFrameworks: string[];
}

export interface RuntimeEnvironmentStatus {
  python: boolean;
  node: boolean;
  npm: boolean;
  java: boolean;
  javac: boolean;
  mvn: boolean;
}
