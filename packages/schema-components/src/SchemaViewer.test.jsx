import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchemaViewer from './SchemaViewer';

describe('SchemaViewer', () => {
    describe('Rendering with schemaData prop', () => {
        it('renders schema with basic properties', () => {
            const mockSchema = {
                type: 'object',
                title: 'Test Schema',
                description: 'A test schema',
                properties: {
                    caseId: {
                        type: 'string',
                        description: 'Case identifier'
                    },
                    age: {
                        type: 'number',
                        description: 'Patient age'
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} schemaType="Test" />);

            // Check header
            expect(screen.getByText('Test Schema')).toBeInTheDocument();
            expect(screen.getByText('A test schema')).toBeInTheDocument();

            // Check properties
            expect(screen.getByText('caseId')).toBeInTheDocument();
            expect(screen.getByText('Case identifier')).toBeInTheDocument();
            expect(screen.getByText('age')).toBeInTheDocument();
            expect(screen.getByText('Patient age')).toBeInTheDocument();
        });

        it('renders enum values correctly', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['active', 'inactive', 'pending']
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('status')).toBeInTheDocument();
            expect(screen.getByText(/Allowed values:/)).toBeInTheDocument();
            expect(screen.getByText(/active, inactive, pending/)).toBeInTheDocument();
        });

        it('renders pattern validation', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    email: {
                        type: 'string',
                        pattern: '^[a-z]+@[a-z]+\\.[a-z]+$'
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('email')).toBeInTheDocument();
            expect(screen.getByText(/Pattern:/)).toBeInTheDocument();
            // Pattern is rendered inside a <code> tag - use regex to match flexibly
            expect(screen.getByText(/\^.*@.*\$/, { selector: 'code' })).toBeInTheDocument();
        });

        it('renders CDE references', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    diagnosis: {
                        type: 'string',
                        cde: 'CDE:2003301'
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('diagnosis')).toBeInTheDocument();
            // CDE appears in both <strong> and <code> tags, query for the full value
            expect(screen.getByText('CDE:2003301')).toBeInTheDocument();
        });

        it('renders required fields', () => {
            const mockSchema = {
                type: 'object',
                required: ['caseId', 'slideId'],
                properties: {
                    caseId: { type: 'string' },
                    slideId: { type: 'string' }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText(/Required Fields:/)).toBeInTheDocument();
            expect(screen.getByText(/caseId, slideId/)).toBeInTheDocument();
        });

        it('renders nested properties with indentation', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    clinicalData: {
                        type: 'object',
                        properties: {
                            diagnosis: { type: 'string' },
                            stage: { type: 'string' }
                        }
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('clinicalData')).toBeInTheDocument();
            expect(screen.getByText('diagnosis')).toBeInTheDocument();
            expect(screen.getByText('stage')).toBeInTheDocument();
        });

        it('renders array item properties', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    stainIDs: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                stainType: { type: 'string' },
                                antibody: { type: 'string' }
                            }
                        }
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('stainIDs')).toBeInTheDocument();
            expect(screen.getByText('Array items:')).toBeInTheDocument();
            expect(screen.getByText('stainType')).toBeInTheDocument();
            expect(screen.getByText('antibody')).toBeInTheDocument();
        });

        it('renders abbreviations', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    regions: {
                        type: 'object',
                        properties: {
                            'Olfactory Bulb': {
                                type: 'array',
                                abbreviation: 'OB'
                            }
                        }
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('Olfactory Bulb')).toBeInTheDocument();
            expect(screen.getByText(/Abbreviation:/)).toBeInTheDocument();
            expect(screen.getByText('OB')).toBeInTheDocument();
        });

        it('renders landmarks (items.enum)', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    regions: {
                        type: 'object',
                        properties: {
                            'Olfactory Bulb': {
                                type: 'array',
                                abbreviation: 'OB',
                                items: {
                                    enum: ['Bulb', 'Tract']
                                }
                            }
                        }
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('Olfactory Bulb')).toBeInTheDocument();
            expect(screen.getByText(/Landmarks:/)).toBeInTheDocument();
            expect(screen.getByText(/Bulb, Tract/)).toBeInTheDocument();
        });
    });

    describe('Schema section extraction', () => {
        it('extracts clinical section correctly', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    clinicalData: {
                        type: 'object',
                        title: 'Clinical Data',
                        properties: {
                            diagnosis: { type: 'string' }
                        }
                    },
                    otherData: {
                        type: 'object',
                        properties: {
                            something: { type: 'string' }
                        }
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} schemaSection="clinical" />);

            // Should show clinical section
            expect(screen.getByText('diagnosis')).toBeInTheDocument();
            // Should NOT show other section
            expect(screen.queryByText('something')).not.toBeInTheDocument();
        });

        it('extracts stain section correctly', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    stainIDs: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                stainType: { type: 'string' },
                                antibody: { type: 'string' }
                            }
                        }
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} schemaSection="stain" />);

            expect(screen.getByText('Stain Schema')).toBeInTheDocument();
            expect(screen.getByText('stainType')).toBeInTheDocument();
            expect(screen.getByText('antibody')).toBeInTheDocument();
        });
    });

    describe('Loading from schemaFile', () => {
        beforeEach(() => {
            global.fetch.mockClear();
        });

        it('displays loading state initially', () => {
            global.fetch.mockImplementation(() =>
                new Promise(() => { }) // Never resolves
            );

            render(<SchemaViewer schemaFile="/schema.json" schemaType="BDSA" />);

            expect(screen.getByRole('status')).toBeInTheDocument();
            expect(screen.getByText('Loading BDSA schema...')).toBeInTheDocument();
        });

        it('loads and displays schema from file', async () => {
            const mockSchema = {
                type: 'object',
                title: 'BDSA Schema',
                properties: {
                    caseId: { type: 'string' }
                }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSchema
            });

            render(<SchemaViewer schemaFile="/schema.json" />);

            await waitFor(() => {
                expect(screen.getByText('BDSA Schema')).toBeInTheDocument();
            });

            expect(screen.getByText('caseId')).toBeInTheDocument();
        });

        it('handles fetch errors gracefully', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            render(<SchemaViewer schemaFile="/schema.json" schemaType="BDSA" />);

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            expect(screen.getByText('Error loading schema')).toBeInTheDocument();
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });

        it('handles non-200 responses', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            render(<SchemaViewer schemaFile="/schema.json" schemaType="Test" />);

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            expect(screen.getByText(/Failed to load Test schema/)).toBeInTheDocument();
        });

        it('retry button refetches schema', async () => {
            // First call fails
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            render(<SchemaViewer schemaFile="/schema.json" />);

            await waitFor(() => {
                expect(screen.getByText('Error loading schema')).toBeInTheDocument();
            });

            // Setup successful response for retry
            const mockSchema = {
                type: 'object',
                properties: { test: { type: 'string' } }
            };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSchema
            });

            // Click retry
            const user = userEvent.setup();
            const retryButton = screen.getByRole('button', { name: /retry/i });
            await user.click(retryButton);

            await waitFor(() => {
                expect(screen.getByText('test')).toBeInTheDocument();
            });
        });

        it('refresh button reloads schema', async () => {
            const mockSchema = {
                type: 'object',
                properties: { original: { type: 'string' } }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSchema
            });

            render(<SchemaViewer schemaFile="/schema.json" />);

            await waitFor(() => {
                expect(screen.getByText('original')).toBeInTheDocument();
            });

            // Setup different response for refresh
            const updatedSchema = {
                type: 'object',
                properties: { updated: { type: 'string' } }
            };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedSchema
            });

            // Click refresh
            const user = userEvent.setup();
            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            await user.click(refreshButton);

            await waitFor(() => {
                expect(screen.getByText('updated')).toBeInTheDocument();
            });
        });

        it('does not show refresh button when using schemaData prop', () => {
            const mockSchema = {
                type: 'object',
                properties: { test: { type: 'string' } }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
        });
    });

    describe('Edge cases', () => {
        it('handles empty schema gracefully', () => {
            render(<SchemaViewer schemaData={null} />);

            expect(screen.getByText('No schema data available')).toBeInTheDocument();
        });

        it('handles schema without properties', () => {
            const mockSchema = {
                type: 'object',
                title: 'Empty Schema'
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('Empty Schema')).toBeInTheDocument();
            // Should not crash, just render the overview section
        });

        it('uses schemaType as fallback title', () => {
            const mockSchema = {
                type: 'object',
                properties: {}
            };

            render(<SchemaViewer schemaData={mockSchema} schemaType="Custom" />);

            expect(screen.getByText('Custom Schema')).toBeInTheDocument();
        });

        it('handles missing property descriptions', () => {
            const mockSchema = {
                type: 'object',
                properties: {
                    field: {
                        type: 'string'
                        // No description
                    }
                }
            };

            render(<SchemaViewer schemaData={mockSchema} />);

            expect(screen.getByText('field')).toBeInTheDocument();
            // Should render without crashing
        });
    });
});

