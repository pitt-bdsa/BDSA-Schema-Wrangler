import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test-setup.js',
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.test.{js,jsx,ts,tsx}',
                '**/test-setup.js'
            ]
        }
    }
});


