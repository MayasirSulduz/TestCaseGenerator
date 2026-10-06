"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGenerateTests = handleGenerateTests;
exports.handleGenerateTestsStream = handleGenerateTestsStream;
exports.handleDetectFramework = handleDetectFramework;
exports.handleFixTests = handleFixTests;
exports.handleAnalyzeCoverage = handleAnalyzeCoverage;
const detector_service_1 = require("../services/detector.service");
const generator_service_1 = require("../services/generator.service");
const llm_service_1 = require("../services/llm.service");
const codeParser_1 = require("../utils/codeParser");
async function handleGenerateTests(req, res) {
    try {
        const dto = req.body || {};
        if (!dto.code || !dto.code.trim()) {
            res.status(400).json({
                status: 'error',
                message: 'No source code provided'
            });
            return;
        }
        const result = await (0, generator_service_1.generateTestsWithCoverage)(dto);
        if (result.status === 'error') {
            res.status(500).json(result);
            return;
        }
        res.json(result);
    }
    catch (error) {
        console.error('Error in handleGenerateTests:', error);
        res.status(500).json({
            status: 'error',
            message: error?.message || 'Internal Server Error'
        });
    }
}
async function handleGenerateTestsStream(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
        const dto = req.body || {};
        if (!dto.code || !dto.code.trim()) {
            sendEvent('error', { message: 'No source code provided' });
            res.end();
            return;
        }
        const onLog = (tag, text) => {
            sendEvent('log', { tag, text });
        };
        const onTrial = (trial) => {
            sendEvent('trial', trial);
        };
        const result = await (0, generator_service_1.generateTestsWithCoverage)(dto, onLog, onTrial);
        sendEvent('done', result);
        sendEvent('result', result);
        res.end();
    }
    catch (error) {
        console.error('Error in handleGenerateTestsStream:', error);
        sendEvent('error', { message: error?.message || 'Internal Server Error' });
        res.end();
    }
}
function handleDetectFramework(req, res) {
    try {
        const dto = req.body || {};
        const filename = dto.filename || '';
        const result = (0, detector_service_1.detectFramework)(filename);
        res.json(result);
    }
    catch (error) {
        console.error('Error in handleDetectFramework:', error);
        res.status(500).json({
            status: 'error',
            message: error?.message || 'Failed to detect framework'
        });
    }
}
async function handleFixTests(req, res) {
    try {
        const { testCode, errorMessage, sourceCode, framework, language } = req.body || {};
        const prompt = `Fix the following ${framework} test code for ${language} that failed with an error.

Source Code:
\`\`\`${language?.toLowerCase() || ''}
${sourceCode || ''}
\`\`\`

Failing Test Code:
\`\`\`${language?.toLowerCase() || ''}
${testCode || ''}
\`\`\`

Error Message:
${errorMessage || ''}

Return ONLY the corrected test code with no markdown formatting or commentary.`;
        const llmResult = await (0, llm_service_1.callLLMWithFallback)(prompt, 3000);
        if (!llmResult) {
            res.status(500).json({ status: 'error', message: 'All AI models failed to fix test code. Please check your API keys.' });
            return;
        }
        res.json({
            status: 'success',
            tests: (0, codeParser_1.extractCodeFromMarkdown)(llmResult.content),
            modelUsed: llmResult.modelUsed,
            fallbackUsed: llmResult.fallbackUsed,
            fallbackReason: llmResult.fallbackReason
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error?.message || 'Failed to fix test code' });
    }
}
async function handleAnalyzeCoverage(req, res) {
    try {
        const { code, language, framework, filename } = req.body || {};
        const result = await (0, generator_service_1.generateTestsWithCoverage)({
            code,
            language: language || 'JavaScript',
            framework: framework || 'Jest',
            filename: filename || 'app'
        });
        res.json({
            status: 'success',
            coverageReport: result.coverageReport
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error?.message || 'Failed to analyze coverage' });
    }
}
