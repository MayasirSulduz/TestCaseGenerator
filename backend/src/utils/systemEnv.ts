import { execSync } from 'child_process';
import { RuntimeEnvironmentStatus } from '../types';

export function checkRuntimeEnvironment(): RuntimeEnvironmentStatus {
  const checkCmd = (cmd: string): boolean => {
    try {
      execSync(cmd, { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  };

  return {
    python: checkCmd('python3 --version') || checkCmd('python --version'),
    node: checkCmd('node --version'),
    npm: checkCmd('npm --version'),
    java: checkCmd('java -version'),
    javac: checkCmd('javac -version'),
    mvn: checkCmd('mvn --version')
  };
}

export function getInstallationGuide(language: string): string {
  const guides: Record<string, string> = {
    JavaScript: `
🔧 JavaScript/Node.js Installation Guide:
- Download & Install Node.js (includes npm) from: https://nodejs.org/
- Verify: node --version && npm --version
`,
    TypeScript: `
🔧 TypeScript/Node.js Installation Guide:
- Download & Install Node.js from: https://nodejs.org/
- Install TypeScript: npm install -g typescript
- Verify: node --version && npm --version && tsc --version
`,
    Java: `
🔧 Java Development Environment Installation Guide:
- Install OpenJDK (JDK 17 or higher)
- Install Apache Maven
- Verify: java -version && javac -version && mvn --version
`
  };

  return guides[language] || 'No installation guide available.';
}
