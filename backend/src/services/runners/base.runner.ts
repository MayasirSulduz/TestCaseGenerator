import { CoverageResult } from '../../types';

export interface ITestRunner {
  runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    framework: string,
    isFinalMeasurement?: boolean
  ): Promise<CoverageResult>;
}
