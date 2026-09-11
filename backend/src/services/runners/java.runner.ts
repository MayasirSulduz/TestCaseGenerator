import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { CoverageResult } from '../../types';
import { ITestRunner } from './base.runner';

const execAsync = promisify(exec);

export class JavaRunner implements ITestRunner {
  async runCoverage(
    sourceCode: string,
    testCode: string,
    filename: string,
    _framework: string
  ): Promise<CoverageResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'java_test_gen_'));

    try {
      const classNameMatch = sourceCode.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = classNameMatch ? classNameMatch[1] : filename.replace(/\.java$/i, '');
      const testClassName = `${className}Test`;

      const srcDir = path.join(tempDir, 'src', 'main', 'java');
      const testDir = path.join(tempDir, 'src', 'test', 'java');

      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, `${className}.java`), sourceCode, 'utf-8');
      fs.writeFileSync(path.join(testDir, `${testClassName}.java`), testCode, 'utf-8');

      // Minimal pom.xml with JaCoCo plugin and JUnit 5
      const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>temp-java-test</artifactId>
    <version>1.0-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.1</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.3</version>
            </plugin>
            <plugin>
                <groupId>org.jacoco</groupId>
                <artifactId>jacoco-maven-plugin</artifactId>
                <version>0.8.11</version>
                <executions>
                    <execution>
                        <goals>
                            <goal>prepare-agent</goal>
                        </goals>
                    </execution>
                    <execution>
                        <id>report</id>
                        <phase>test</phase>
                        <goals>
                            <goal>report</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>`;

      fs.writeFileSync(path.join(tempDir, 'pom.xml'), pomXml, 'utf-8');

      const cmd = 'mvn clean test';

      let stdout = '';
      let stderr = '';
      let testPassed = true;

      try {
        const result = await execAsync(cmd, { cwd: tempDir, timeout: 60000 });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        testPassed = false;
        stdout = err.stdout || '';
        stderr = err.stderr || '';
      }

      const combinedOutput = stdout + '\n' + stderr;

      // Check JaCoCo report html if generated
      const jacocoHtmlPath = path.join(tempDir, 'target', 'site', 'jacoco', 'index.html');
      let coverage = 0;

      if (fs.existsSync(jacocoHtmlPath)) {
        const htmlContent = fs.readFileSync(jacocoHtmlPath, 'utf-8');
        const covMatch = htmlContent.match(/Total<\/td><td class="bar">.*?<\/td><td>(\d+)%/i);
        if (covMatch) {
          coverage = parseInt(covMatch[1], 10);
        }
      } else {
        const lineCovMatch = combinedOutput.match(/BUILD SUCCESS/);
        if (lineCovMatch) coverage = 100;
      }

      return {
        success: testPassed,
        coverage,
        missing_lines: coverage === 100 ? 'None' : 'Check JaCoCo report',
        coverage_table: combinedOutput.slice(0, 1000),
        test_passed: testPassed,
        stdout,
        stderr
      };
    } catch (error: any) {
      return {
        success: false,
        coverage: 0,
        error: error?.message || 'Java runner execution error'
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
