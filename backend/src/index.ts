import { createApp } from './app';
import { envConfig } from './config/env.config';
import { checkRuntimeEnvironment } from './utils/systemEnv';

const app = createApp();
const port = envConfig.port;

console.log('\n' + '='.repeat(60));
console.log('Node.js TypeScript Server Starting - Multi-Language Test Generator');
console.log('='.repeat(60));
console.log(`Port: ${port}`);
console.log(`CORS Allowed Origins: ${envConfig.corsOrigins.join(', ')}`);
console.log(`Groq API Key: ${envConfig.groqApiKey ? '✓ Set' : '✗ Missing'}`);

console.log('\nChecking Runtime Environments...');
const env = checkRuntimeEnvironment();
console.log(`   Python: ${env.python ? '✓' : '✗'}`);
console.log(`   Node.js: ${env.node ? '✓' : '✗'}`);
console.log(`   npm: ${env.npm ? '✓' : '✗'}`);
console.log(`   Java: ${env.java ? '✓' : '✗'}`);
console.log(`   javac: ${env.javac ? '✓' : '✗'}`);
console.log(`   Maven: ${env.mvn ? '✓' : '✗'}`);

console.log('\nSupported Languages: Python, JavaScript, TypeScript, Java');
console.log('='.repeat(60) + '\n');

app.listen(port, () => {
  console.log(`🚀 Server successfully listening on http://localhost:${port}`);
});
