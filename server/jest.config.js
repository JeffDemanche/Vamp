/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // `reflect-metadata` must be loaded before any decorated class is imported.
  setupFiles: ["reflect-metadata"],
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  // The in-memory Mongo binary can take a moment to spin up on first run.
  testTimeout: 60000,
  clearMocks: true,
};
