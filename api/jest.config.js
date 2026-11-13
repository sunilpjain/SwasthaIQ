/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: { '^@swasthyaiq/shared$': '<rootDir>/../shared/src/index.ts' },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.cli.ts', '!src/db/schema.ts'],
  coverageThreshold: {
    global: { lines: 70, statements: 70, functions: 70, branches: 60 },
  },
  // Integration tests share one PostgreSQL database.
  maxWorkers: 1,
  testTimeout: 30000,
};
