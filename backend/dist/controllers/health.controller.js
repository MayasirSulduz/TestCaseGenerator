"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHealthCheck = handleHealthCheck;
const env_config_1 = require("../config/env.config");
const systemEnv_1 = require("../utils/systemEnv");
function handleHealthCheck(_req, res) {
    const env = (0, systemEnv_1.checkRuntimeEnvironment)();
    res.json({
        status: 'success',
        message: 'Node.js TypeScript Test Generator Backend is running',
        version: '1.0.0',
        groq_api_key_set: Boolean(env_config_1.envConfig.groqApiKey),
        runtime_environment: env
    });
}
