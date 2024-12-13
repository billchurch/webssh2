// jest.config.js
export default {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/app/$1"
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {
            useESM: true
        }]
    },
    extensionsToTreatAsEsm: [".ts"]
}