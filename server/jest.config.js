module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  forceExit: true,
};
