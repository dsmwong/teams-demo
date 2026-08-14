module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': { tsconfig: 'tsconfig.test.json' }
  },
  forceExit: true,
};
