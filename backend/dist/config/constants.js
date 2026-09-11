"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPENDENCY_MAP = exports.AVAILABLE_FRAMEWORKS_MAP = exports.FRAMEWORK_MAP = exports.LANGUAGE_MAP = void 0;
exports.LANGUAGE_MAP = {
    js: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    py: 'Python',
    java: 'Java'
};
exports.FRAMEWORK_MAP = {
    js: 'Jest',
    jsx: 'Jest',
    ts: 'Jest',
    tsx: 'Jest',
    py: 'pytest',
    java: 'JUnit5'
};
exports.AVAILABLE_FRAMEWORKS_MAP = {
    JavaScript: ['Jest', 'Mocha', 'Jasmine'],
    TypeScript: ['Jest', 'Mocha', 'Jasmine'],
    Python: ['pytest', 'unittest', 'nose2'],
    Java: ['JUnit5', 'JUnit4']
};
exports.DEPENDENCY_MAP = {
    Python: {
        pytest: ['pytest', 'pytest-cov'],
        unittest: [],
        nose2: ['nose2', 'coverage']
    },
    JavaScript: {
        Jest: ['jest'],
        Mocha: ['mocha', 'chai', 'nyc'],
        Jasmine: ['jasmine', 'jasmine-core']
    },
    TypeScript: {
        Jest: ['jest', '@types/jest', 'ts-jest', 'ts-node'],
        Mocha: ['mocha', 'chai', 'nyc', '@types/mocha', '@types/chai', 'ts-node'],
        Jasmine: ['jasmine', '@types/jasmine', 'ts-node']
    },
    Java: {
        JUnit5: ['org.junit.jupiter:junit-jupiter:5.10.1', 'org.jacoco:jacoco-maven-plugin:0.8.11'],
        JUnit4: ['junit:junit:4.13.2', 'org.jacoco:jacoco-maven-plugin:0.8.11']
    }
};
