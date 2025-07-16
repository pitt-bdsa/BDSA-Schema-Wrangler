import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// Mock recharts components
vi.mock('recharts', () => ({
    PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
    Pie: ({ children }) => <div data-testid="pie">{children}</div>,
    Cell: () => <div data-testid="cell" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
}));

describe('ColumnControl', () => {
    const mockColumns = ['name', 'age', 'email', 'phone', 'stainId', 'caseId', 'regionId'];
    const mockRowData = [
        { name: 'John', age: '30', email: 'john@test.com', phone: '123-456-7890', stainId: 'H&E', caseId: 'CASE001', regionId: 'Hipp' },
        { name: 'Jane', age: '25', email: 'jane@test.com', phone: '098-765-4321', stainId: 'Tau', caseId: 'CASE002', regionId: 'Frontal' },
        { name: 'Bob', age: '35', email: 'bob@test.com', phone: '555-555-5555', stainId: 'H&E', caseId: 'CASE001', regionId: 'Temporal' }
    ];
    const mockOnColumnVisibilityChange = vi.fn();
    const mockOnColumnMappingChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
    });

    describe('Rendering', () => {
        it('renders both buttons with correct counts', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            expect(screen.getByText('Show/Hide Columns (7/7)')).toBeInTheDocument();
            expect(screen.getByText('Column Mapping (0/3)')).toBeInTheDocument();
        });

        it('shows correct mapping status when columns are mapped', () => {
            localStorageMock.getItem
                .mockReturnValueOnce(null) // hidden columns
                .mockReturnValueOnce(JSON.stringify({
                    localStainID: 'stainId',
                    localCaseId: 'caseId',
                    localRegionId: ''
                }));

            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            expect(screen.getByText('Column Mapping (2/3)')).toBeInTheDocument();
        });
    });

    describe('Column Visibility Modal', () => {
        it('opens column visibility modal when button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

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
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const nameCheckbox = screen.getByLabelText('name');
            fireEvent.click(nameCheckbox);

            await waitFor(() => {
                expect(mockOnColumnVisibilityChange).toHaveBeenCalledWith(['name']);
            });
        });

        it('loads hidden columns from localStorage on mount', () => {
            localStorageMock.getItem
                .mockReturnValueOnce(JSON.stringify(['name', 'email']))
                .mockReturnValueOnce(null);

            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            expect(screen.getByText('Show/Hide Columns (5/7)')).toBeInTheDocument();
        });

        it('saves hidden columns to localStorage when changed', async () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const nameCheckbox = screen.getByLabelText('name');
            fireEvent.click(nameCheckbox);

            await waitFor(() => {
                expect(localStorageMock.setItem).toHaveBeenCalledWith(
                    'bdsa_hidden_columns',
                    JSON.stringify(['name'])
                );
            });
        });

        it('closes column visibility modal when close button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));
            expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Close'));
            expect(screen.queryByText('Show/Hide Columns')).not.toBeInTheDocument();
        });

        it('handles multiple column toggles correctly', async () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

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
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const nameCheckbox = screen.getByLabelText('name');
            fireEvent.click(nameCheckbox);

            await waitFor(() => {
                expect(screen.getByText('Show/Hide Columns (6/7)')).toBeInTheDocument();
            });
        });

        it('highlights mapped columns in the column list', () => {
            localStorageMock.getItem
                .mockReturnValueOnce(null) // hidden columns
                .mockReturnValueOnce(JSON.stringify({
                    localStainID: 'stainId',
                    localCaseId: 'caseId',
                    localRegionId: 'regionId'
                }));

            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const mappedColumns = screen.getAllByText(/stainId|caseId|regionId/);
            mappedColumns.forEach(column => {
                expect(column).toHaveClass('mapped-column');
            });
        });
    });

    describe('Column Mapping Modal', () => {
        it('opens column mapping modal when button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Column Mapping (0/3)'));

            expect(screen.getByText('BDSA Schema Mapping')).toBeInTheDocument();
            expect(screen.getByText('Local Stain ID:')).toBeInTheDocument();
            expect(screen.getByText('Local Case ID:')).toBeInTheDocument();
            expect(screen.getByText('Local Region ID:')).toBeInTheDocument();
        });

        it('loads column mapping from localStorage on mount', () => {
            localStorageMock.getItem
                .mockReturnValueOnce(null) // hidden columns
                .mockReturnValueOnce(JSON.stringify({
                    localStainID: 'stainId',
                    localCaseId: 'caseId',
                    localRegionId: 'regionId'
                }));

            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            expect(screen.getByText('Column Mapping (3/3)')).toBeInTheDocument();
        });

        it('updates column mapping when dropdowns are changed', async () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Column Mapping (0/3)'));

            const stainSelects = screen.getAllByDisplayValue('-- Select Column --');
            const stainSelect = stainSelects[0]; // First select is Local Stain ID
            fireEvent.change(stainSelect, { target: { value: 'stainId' } });

            await waitFor(() => {
                expect(mockOnColumnMappingChange).toHaveBeenCalledWith({
                    localStainID: 'stainId',
                    localCaseId: '',
                    localRegionId: ''
                });
            });
        });

        it('saves column mapping to localStorage when changed', async () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Column Mapping (0/3)'));

            const stainSelects = screen.getAllByDisplayValue('-- Select Column --');
            const stainSelect = stainSelects[0]; // First select is Local Stain ID
            fireEvent.change(stainSelect, { target: { value: 'stainId' } });

            await waitFor(() => {
                expect(localStorageMock.setItem).toHaveBeenCalledWith(
                    'bdsa_column_mapping',
                    JSON.stringify({
                        localStainID: 'stainId',
                        localCaseId: '',
                        localRegionId: ''
                    })
                );
            });
        });

        it('closes column mapping modal when close button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Column Mapping (0/3)'));
            expect(screen.getByText('BDSA Schema Mapping')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Close'));
            expect(screen.queryByText('BDSA Schema Mapping')).not.toBeInTheDocument();
        });

        it('shows all columns in dropdown options', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Column Mapping (0/3)'));

            const stainSelects = screen.getAllByDisplayValue('-- Select Column --');
            const stainSelect = stainSelects[0]; // First select is Local Stain ID
            fireEvent.click(stainSelect);

            // Check that all columns are available as options
            mockColumns.forEach(column => {
                const options = screen.getAllByText(column);
                expect(options.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Pie Chart Modal', () => {
        it('opens pie chart modal when pie button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const pieButtons = screen.getAllByTitle('Show value distribution');
            fireEvent.click(pieButtons[0]); // Click first pie button

            expect(screen.getByText(/Distribution for:/)).toBeInTheDocument();
            expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        });

        it('shows correct column name in pie chart modal', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const pieButtons = screen.getAllByTitle('Show value distribution');
            fireEvent.click(pieButtons[0]); // Click first pie button

            expect(screen.getByText('Distribution for:')).toBeInTheDocument();
            // Check for the specific column name in the pie chart title by looking for the h2 element within the pie modal
            const pieModal = screen.getByTestId('responsive-container').closest('.modal-content');
            const pieChartTitle = within(pieModal).getByRole('heading', { level: 2 });
            expect(pieChartTitle).toHaveTextContent('Distribution for:');
            expect(pieChartTitle).toHaveTextContent('name');
        });

        it('closes pie chart modal when close button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const pieButtons = screen.getAllByTitle('Show value distribution');
            fireEvent.click(pieButtons[0]);

            expect(screen.getByText(/Distribution for:/)).toBeInTheDocument();

            const closeButtons = screen.getAllByText('Close');
            fireEvent.click(closeButtons[1]); // Second close button (pie modal)

            expect(screen.queryByText(/Distribution for:/)).not.toBeInTheDocument();
        });

        it('disables pie buttons when no row data is available', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={[]}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            const pieButtons = screen.getAllByTitle('Show value distribution');
            pieButtons.forEach(button => {
                expect(button).toBeDisabled();
            });
        });
    });

    describe('Modal Separation', () => {
        it('opens only column visibility modal when column button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));

            expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
            expect(screen.queryByText('BDSA Schema Mapping')).not.toBeInTheDocument();
        });

        it('opens only column mapping modal when mapping button is clicked', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Column Mapping (0/3)'));

            expect(screen.getByText('BDSA Schema Mapping')).toBeInTheDocument();
            expect(screen.queryByText('Show/Hide Columns')).not.toBeInTheDocument();
        });

        it('can have both modals open independently', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            fireEvent.click(screen.getByText('Show/Hide Columns (7/7)'));
            fireEvent.click(screen.getByText('Column Mapping (0/3)'));

            expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
            expect(screen.getByText('BDSA Schema Mapping')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles empty column list', () => {
            render(
                <ColumnControl
                    allColumns={[]}
                    rowData={mockRowData}
                    onColumnVisibilityChange={mockOnColumnVisibilityChange}
                    onColumnMappingChange={mockOnColumnMappingChange}
                />
            );

            expect(screen.getByText('Show/Hide Columns (0/0)')).toBeInTheDocument();
            expect(screen.getByText('Column Mapping (0/3)')).toBeInTheDocument();
        });

        it('handles missing callbacks gracefully', () => {
            render(
                <ColumnControl
                    allColumns={mockColumns}
                    rowData={mockRowData}
                />
            );

            expect(screen.getByText('Show/Hide Columns (7/7)')).toBeInTheDocument();
            expect(screen.getByText('Column Mapping (0/3)')).toBeInTheDocument();
        });

        it('handles localStorage errors gracefully', () => {
            localStorageMock.getItem.mockImplementation(() => {
                throw new Error('localStorage error');
            });

            // Should not throw an error
            expect(() => {
                render(
                    <ColumnControl
                        allColumns={mockColumns}
                        rowData={mockRowData}
                        onColumnVisibilityChange={mockOnColumnVisibilityChange}
                        onColumnMappingChange={mockOnColumnMappingChange}
                    />
                );
            }).not.toThrow();
        });
    });
}); 