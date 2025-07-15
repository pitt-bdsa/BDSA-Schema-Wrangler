import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ColumnControl from './ColumnControl';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

describe('ColumnControl', () => {
    const mockColumns = ['name', 'age', 'email', 'phone'];
    const mockOnColumnVisibilityChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
    });

    it('renders the column control button with correct count', () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        expect(screen.getByText('Show/Hide Columns (4/4)')).toBeInTheDocument();
    });

    it('shows modal when button is clicked', () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        fireEvent.click(screen.getByText('Show/Hide Columns (4/4)'));

        expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
        expect(screen.getByText('name')).toBeInTheDocument();
        expect(screen.getByText('age')).toBeInTheDocument();
        expect(screen.getByText('email')).toBeInTheDocument();
        expect(screen.getByText('phone')).toBeInTheDocument();
    });

    it('toggles column visibility when checkbox is clicked', async () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        fireEvent.click(screen.getByText('Show/Hide Columns (4/4)'));

        const nameCheckbox = screen.getByLabelText('name');
        fireEvent.click(nameCheckbox);

        await waitFor(() => {
            expect(mockOnColumnVisibilityChange).toHaveBeenCalledWith(['name']);
        });
    });

    it('loads hidden columns from localStorage on mount', () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify(['name', 'email']));

        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        expect(screen.getByText('Show/Hide Columns (2/4)')).toBeInTheDocument();
    });

    it('saves hidden columns to localStorage when changed', async () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        fireEvent.click(screen.getByText('Show/Hide Columns (4/4)'));

        const nameCheckbox = screen.getByLabelText('name');
        fireEvent.click(nameCheckbox);

        await waitFor(() => {
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'bdsa_hidden_columns',
                JSON.stringify(['name'])
            );
        });
    });

    it('closes modal when close button is clicked', () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        fireEvent.click(screen.getByText('Show/Hide Columns (4/4)'));
        expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Close'));
        expect(screen.queryByText('Show/Hide Columns')).not.toBeInTheDocument();
    });

    it('handles multiple column toggles correctly', async () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        fireEvent.click(screen.getByText('Show/Hide Columns (4/4)'));

        const nameCheckbox = screen.getByLabelText('name');
        const ageCheckbox = screen.getByLabelText('age');

        fireEvent.click(nameCheckbox);
        fireEvent.click(ageCheckbox);

        await waitFor(() => {
            expect(mockOnColumnVisibilityChange).toHaveBeenCalledWith(['name', 'age']);
        });
    });

    it('shows correct count when columns are hidden', async () => {
        render(
            <ColumnControl
                allColumns={mockColumns}
                onColumnVisibilityChange={mockOnColumnVisibilityChange}
            />
        );

        fireEvent.click(screen.getByText('Show/Hide Columns (4/4)'));

        const nameCheckbox = screen.getByLabelText('name');
        fireEvent.click(nameCheckbox);

        await waitFor(() => {
            expect(screen.getByText('Show/Hide Columns (3/4)')).toBeInTheDocument();
        });
    });
}); 