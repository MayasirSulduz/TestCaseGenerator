"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRuntimeEnvironment = checkRuntimeEnvironment;
exports.getInstallationGuide = getInstallationGuide;
const child_process_1 = require("child_process");
function checkRuntimeEnvironment() {
    const checkCmd = (cmd) => {
        try {
            (0, child_process_1.execSync)(cmd, { stdio: 'ignore', timeout: 3000 });
            return true;
        }
        catch {
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
function getInstallationGuide(language) {
    const guides = {
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
