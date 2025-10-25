import '@testing-library/jest-dom';

// Mock window.fetch for tests
global.fetch = vi.fn();

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

