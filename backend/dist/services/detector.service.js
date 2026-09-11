"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFramework = detectFramework;
const constants_1 = require("../config/constants");
function detectFramework(filename) {
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    const detectedLanguage = constants_1.LANGUAGE_MAP[ext] || 'JavaScript';
    const detectedFramework = constants_1.FRAMEWORK_MAP[ext] || 'Jest';
    const availableFrameworks = constants_1.AVAILABLE_FRAMEWORKS_MAP[detectedLanguage] || [detectedFramework];
    return {
        status: 'success',
        framework: detectedFramework,
        language: detectedLanguage,
        extension: ext,
        availableFrameworks
    };
}
