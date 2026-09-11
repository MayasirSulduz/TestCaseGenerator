import { CoverageResult } from '../../types';

export interface ITestRunner {
  runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    framework: string
  ): Promise<CoverageResult>;
}
