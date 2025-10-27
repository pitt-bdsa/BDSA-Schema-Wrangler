import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProtocolProvider, useProtocols } from './ProtocolContext';
import { InMemoryProtocolStorage } from '../storage/protocolStorage';

// Test component that uses the hook
function TestComponent() {
    const {
        protocols,
        stainProtocols,
        regionProtocols,
        addProtocol,
        updateProtocol,
        deleteProtocol,
        loading
    } = useProtocols();

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div data-testid="protocol-count">{protocols.length}</div>
            <div data-testid="stain-count">{stainProtocols.length}</div>
            <div data-testid="region-count">{regionProtocols.length}</div>

            <button onClick={() => addProtocol({
                type: 'stain',
                name: 'H&E',
                stainType: 'Histology'
            })}>
                Add Stain
            </button>

            <button onClick={() => addProtocol({
                type: 'region',
                name: 'Hippocampus',
                regionType: 'Hippocampus'
            })}>
                Add Region
            </button>

            <button onClick={() => updateProtocol({
                id: protocols[0]?.id,
                name: 'Updated Name'
            })}>
                Update First
            </button>

            <button onClick={() => {
                // Delete the first non-default protocol
                const nonDefault = protocols.find(p => !p._isDefault);
                if (nonDefault) deleteProtocol(nonDefault.id);
            }}>
                Delete First Non-Default
            </button>

            <ul>
                {protocols.map(p => (
                    <li key={p.id}>{p.name}</li>
                ))}
            </ul>
        </div>
    );
}

describe('ProtocolContext', () => {
    let storage;

    beforeEach(() => {
        storage = new InMemoryProtocolStorage();
    });

    it('provides default IGNORE protocols', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        // Should have 2 default protocols (stain + region IGNORE)
        expect(screen.getByTestId('protocol-count')).toHaveTextContent('2');
        expect(screen.getByTestId('stain-count')).toHaveTextContent('1');
        expect(screen.getByTestId('region-count')).toHaveTextContent('1');
    });

    it('adds a new stain protocol', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        const user = userEvent.setup();
        await user.click(screen.getByText('Add Stain'));

        await waitFor(() => {
            expect(screen.getByTestId('protocol-count')).toHaveTextContent('3');
            expect(screen.getByTestId('stain-count')).toHaveTextContent('2');
            expect(screen.getByText('H&E')).toBeInTheDocument();
        });
    });

    it('adds a new region protocol', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        const user = userEvent.setup();
        await user.click(screen.getByText('Add Region'));

        await waitFor(() => {
            expect(screen.getByTestId('protocol-count')).toHaveTextContent('3');
            expect(screen.getByTestId('region-count')).toHaveTextContent('2');
            expect(screen.getByText('Hippocampus')).toBeInTheDocument();
        });
    });

    it('updates a protocol', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        const user = userEvent.setup();

        // Add a protocol first
        await user.click(screen.getByText('Add Stain'));

        await waitFor(() => {
            expect(screen.getByText('H&E')).toBeInTheDocument();
        });

        // Update it
        await user.click(screen.getByText('Update First'));

        await waitFor(() => {
            expect(screen.getByText('Updated Name')).toBeInTheDocument();
        });
    });

    it.skip('deletes a protocol (non-default only)', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        const user = userEvent.setup();

        // Add protocols (they will be non-default)
        await user.click(screen.getByText('Add Stain'));
        await user.click(screen.getByText('Add Region'));

        await waitFor(() => {
            expect(screen.getByTestId('protocol-count')).toHaveTextContent('4');
            expect(screen.getByText('H&E')).toBeInTheDocument();
        });

        // Delete the first non-default protocol
        await user.click(screen.getByText('Delete First Non-Default'));

        await waitFor(() => {
            expect(screen.getByTestId('protocol-count')).toHaveTextContent('3');
            expect(screen.queryByText('H&E')).not.toBeInTheDocument();
        });
    });

    it('loads protocols from storage on mount', async () => {
        // Pre-populate storage
        await storage.save([
            { id: 'test1', type: 'stain', name: 'Pre-loaded H&E' },
            { id: 'test2', type: 'region', name: 'Pre-loaded Hippocampus' }
        ]);

        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        // Should have 2 defaults + 2 loaded = 4
        expect(screen.getByTestId('protocol-count')).toHaveTextContent('4');
        expect(screen.getByText('Pre-loaded H&E')).toBeInTheDocument();
        expect(screen.getByText('Pre-loaded Hippocampus')).toBeInTheDocument();
    });

    it('persists changes to storage', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        const user = userEvent.setup();
        await user.click(screen.getByText('Add Stain'));

        await waitFor(() => {
            expect(screen.getByText('H&E')).toBeInTheDocument();
        });

        // Check storage was updated (excluding defaults)
        const saved = await storage.load();
        expect(saved).toHaveLength(1);
        expect(saved[0].name).toBe('H&E');
    });

    it('throws error when useProtocols is used outside provider', () => {
        // Suppress console.error for this test
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

        expect(() => {
            render(<TestComponent />);
        }).toThrow('useProtocols must be used within a ProtocolProvider');

        spy.mockRestore();
    });

    it('filters protocols by type correctly', async () => {
        render(
            <ProtocolProvider storage={storage}>
                <TestComponent />
            </ProtocolProvider>
        );

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        const user = userEvent.setup();

        // Add 2 stain, 1 region
        await user.click(screen.getByText('Add Stain'));
        await user.click(screen.getByText('Add Stain'));
        await user.click(screen.getByText('Add Region'));

        await waitFor(() => {
            // 2 defaults + 3 added = 5 total
            expect(screen.getByTestId('protocol-count')).toHaveTextContent('5');
            // 1 default stain + 2 added = 3 stain
            expect(screen.getByTestId('stain-count')).toHaveTextContent('3');
            // 1 default region + 1 added = 2 region
            expect(screen.getByTestId('region-count')).toHaveTextContent('2');
        });
    });
});

