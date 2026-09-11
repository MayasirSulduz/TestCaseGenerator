"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const env_config_1 = require("./config/env.config");
const generator_controller_1 = require("./controllers/generator.controller");
const health_controller_1 = require("./controllers/health.controller");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (!origin || env_config_1.envConfig.corsOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
                callback(null, true);
            }
            else {
                callback(null, true);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // API Routes
    app.post('/api/generate-tests', generator_controller_1.handleGenerateTests);
    app.post('/api/detect-framework', generator_controller_1.handleDetectFramework);
    app.post('/api/fix-tests', generator_controller_1.handleFixTests);
    app.post('/api/analyze-coverage', generator_controller_1.handleAnalyzeCoverage);
    app.post('/api/get-coverage-report', generator_controller_1.handleAnalyzeCoverage);
    app.get('/api/health', health_controller_1.handleHealthCheck);
    return app;
}
