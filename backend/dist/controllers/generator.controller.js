"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGenerateTests = handleGenerateTests;
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
