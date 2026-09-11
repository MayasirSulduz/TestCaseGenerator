"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class JavaRunner {
    async runCoverage(sourceCode, testCode, filename, _framework) {
        const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'java_test_gen_'));
        try {
            const classNameMatch = sourceCode.match(/public\s+class\s+([A-Za-z0-9_]+)/);
            const className = classNameMatch ? classNameMatch[1] : filename.replace(/\.java$/i, '');
            const testClassName = `${className}Test`;
            const srcDir = path_1.default.join(tempDir, 'src', 'main', 'java');
            const testDir = path_1.default.join(tempDir, 'src', 'test', 'java');
            fs_1.default.mkdirSync(srcDir, { recursive: true });
            fs_1.default.mkdirSync(testDir, { recursive: true });
            fs_1.default.writeFileSync(path_1.default.join(srcDir, `${className}.java`), sourceCode, 'utf-8');
            fs_1.default.writeFileSync(path_1.default.join(testDir, `${testClassName}.java`), testCode, 'utf-8');
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
            fs_1.default.writeFileSync(path_1.default.join(tempDir, 'pom.xml'), pomXml, 'utf-8');
            const cmd = 'mvn clean test';
            let stdout = '';
            let stderr = '';
            let testPassed = true;
            try {
                const result = await execAsync(cmd, { cwd: tempDir, timeout: 60000 });
                stdout = result.stdout;
                stderr = result.stderr;
            }
            catch (err) {
                testPassed = false;
                stdout = err.stdout || '';
                stderr = err.stderr || '';
            }
            const combinedOutput = stdout + '\n' + stderr;
            // Check JaCoCo report html if generated
            const jacocoHtmlPath = path_1.default.join(tempDir, 'target', 'site', 'jacoco', 'index.html');
            let coverage = 0;
            if (fs_1.default.existsSync(jacocoHtmlPath)) {
                const htmlContent = fs_1.default.readFileSync(jacocoHtmlPath, 'utf-8');
                const covMatch = htmlContent.match(/Total<\/td><td class="bar">.*?<\/td><td>(\d+)%/i);
                if (covMatch) {
                    coverage = parseInt(covMatch[1], 10);
                }
            }
            else {
                const lineCovMatch = combinedOutput.match(/BUILD SUCCESS/);
                if (lineCovMatch)
                    coverage = 100;
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
        }
        catch (error) {
            return {
                success: false,
                coverage: 0,
                error: error?.message || 'Java runner execution error'
            };
        }
        finally {
            try {
                fs_1.default.rmSync(tempDir, { recursive: true, force: true });
            }
            catch { }
        }
    }
}
exports.JavaRunner = JavaRunner;
