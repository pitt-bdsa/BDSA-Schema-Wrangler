import '@testing-library/jest-dom';

// Reset all mocks before each test
beforeEach(() => {
    if (typeof vi !== 'undefined') {
        vi.clearAllMocks();
    }
    // Clear localStorage before each test
    localStorage.clear();
});


