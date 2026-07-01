/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.{ts,tsx}"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@vamp/shared$": "<rootDir>/../shared/src/index.ts",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  // Apollo Client v4 exposes multiple export conditions; force the Node/require
  // build so jsdom can `require` it.
  testEnvironmentOptions: {
    customExportConditions: ["node", "require", "default"],
  },
};
