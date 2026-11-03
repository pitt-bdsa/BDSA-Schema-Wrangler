import React, { useCallback, useEffect, useMemo, useState } from 'react';
import bdsaCatalogService from '../utils/bdsaCatalogService';
import { docId } from '../utils/bdsaCatalogMapper';
import { resolveTemplateIdForRegion } from '../utils/bdsaBlockAssignment';
import './ProtocolList.css';
import './ProtocolModal.css';
import './SectioningProtocolsPanel.css';

const emptyProtocolForm = { name: '', description: '' };

const SectioningProtocolsPanel = ({ regionTemplates = [], onCatalogChanged }) => {
    const [protocols, setProtocols] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [protocolModal, setProtocolModal] = useState(null);
    const [blockModal, setBlockModal] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const catalog = await bdsaCatalogService.listSectioningCatalog();
            setProtocols(catalog.protocols);
            setBlocks(catalog.blocks);
        } catch (err) {
            setError(err.message || 'Failed to load sectioning protocols');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const blocksByProtocol = useMemo(() => {
        const map = {};
        protocols.forEach((protocol) => {
            map[docId(protocol)] = [];
        });
        blocks.forEach((block) => {
            const key = String(block.protocolId || '');
            if (!map[key]) map[key] = [];
            map[key].push(block);
        });
        return map;
    }, [protocols, blocks]);

    const templates = regionTemplates.filter((region) => region.id && region.id !== 'ignore');

    const notifyAndReload = async () => {
        if (typeof onCatalogChanged === 'function') {
            onCatalogChanged();
        }
        await load();
    };

    const handleSaveProtocol = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError('');
        try {
            await bdsaCatalogService.saveSectioningProtocol(
                protocolModal.form,
                protocolModal.existing?._id
            );
            setProtocolModal(null);
            await notifyAndReload();
        } catch (err) {
            setError(err.message || 'Failed to save sectioning protocol');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProtocol = async (protocol) => {
        if (!window.confirm(`Delete sectioning protocol "${protocol.name}" and its blocks?`)) {
            return;
        }
        try {
            await bdsaCatalogService.deleteSectioningProtocol(protocol._id);
            await notifyAndReload();
        } catch (err) {
            setError(err.message || 'Failed to delete sectioning protocol');
        }
    };

    const handleSaveBlock = async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError('');
        try {
            await bdsaCatalogService.saveBlock({
                name: blockModal.form.name,
                protocolId: blockModal.protocolId,
                regionIds: blockModal.form.regionIds,
                templates,
            }, blockModal.existing);
            setBlockModal(null);
            await notifyAndReload();
        } catch (err) {
            setError(err.message || 'Failed to save block');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBlock = async (block) => {
        if (!window.confirm(`Delete block "${block.name}"?`)) {
            return;
        }
        try {
            await bdsaCatalogService.deleteBlock(block._id);
            await notifyAndReload();
        } catch (err) {
            setError(err.message || 'Failed to delete block');
        }
    };

    const openAddBlock = (protocol) => {
        setBlockModal({
            protocolId: protocol._id,
            existing: null,
            form: { name: '', regionIds: [] },
        });
    };

    const openEditBlock = (block) => {
        const selected = [...new Set((block.regionDefinitions || [])
            .map((region) => resolveTemplateIdForRegion(region, templates))
            .filter(Boolean))];
        setBlockModal({
            protocolId: block.protocolId,
            existing: block,
            form: { name: block.name || '', regionIds: selected },
        });
    };

    const toggleRegion = (regionId) => {
        setBlockModal((current) => {
            const next = new Set(current.form.regionIds.map(String));
            if (next.has(regionId)) next.delete(regionId);
            else next.add(regionId);
            return {
                ...current,
                form: { ...current.form, regionIds: [...next] },
            };
        });
    };

    if (isLoading && protocols.length === 0) {
        return <div className="sectioning-empty">Loading sectioning protocols…</div>;
    }

    return (
        <div className="protocol-list">
            {error && <div className="sectioning-error">{error}</div>}
            <div className="sectioning-empty">
                A sectioning protocol is the blocking recipe for a case workup.
                It owns blocks. Each block lists region definitions sampled from that block.
                Region definitions are the anatomy catalog, not this protocol.
            </div>
            {templates.length === 0 && (
                <div className="sectioning-empty">
                    Add region definitions first. Blocks choose from those regions.
                </div>
            )}

            <div className="protocols-grid">
                {protocols.map((protocol) => {
                    const protocolBlocks = blocksByProtocol[docId(protocol)] || [];
                    return (
                        <div key={docId(protocol)} className="protocol-card">
                            <div className="protocol-header">
                                <div className="protocol-title">
                                    <h4>{protocol.name}</h4>
                                    <div className="protocol-badges">
                                        <span className="status-badge status-synced">Catalog</span>
                                    </div>
                                </div>
                                <div className="protocol-actions">
                                    <button
                                        className="edit-button"
                                        title="Edit sectioning protocol"
                                        onClick={() => setProtocolModal({
                                            existing: protocol,
                                            form: {
                                                name: protocol.name || '',
                                                description: protocol.description || '',
                                            },
                                        })}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="delete-button"
                                        title="Delete sectioning protocol"
                                        onClick={() => handleDeleteProtocol(protocol)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div className="protocol-details">
                                <p><strong>Description:</strong> {protocol.description || 'No description'}</p>
                                <p><strong>Blocks:</strong> {protocolBlocks.length}</p>
                                <div className="sectioning-block-list">
                                    {protocolBlocks.map((block) => {
                                        const regions = block.regionDefinitions || [];
                                        return (
                                            <div key={docId(block)} className="sectioning-block-row">
                                                <div>
                                                    <strong>{block.name}</strong>
                                                    <div className="sectioning-region-chips">
                                                        {regions.length === 0 && <span className="sectioning-chip">No regions</span>}
                                                        {regions.map((region) => (
                                                            <span key={docId(region)} className="sectioning-chip">
                                                                {region.abbreviation || region.displayName || region.schemaRegionKey}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="protocol-actions">
                                                    <button
                                                        className="edit-button"
                                                        title="Edit block"
                                                        onClick={() => openEditBlock(block)}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        title="Delete block"
                                                        onClick={() => handleDeleteBlock(block)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    className="sectioning-add-block"
                                    disabled={templates.length === 0}
                                    onClick={() => openAddBlock(protocol)}
                                >
                                    + Add block
                                </button>
                            </div>
                        </div>
                    );
                })}

                <div
                    className="add-protocol-card"
                    onClick={() => setProtocolModal({ existing: null, form: { ...emptyProtocolForm } })}
                >
                    <div className="add-content">
                        <div className="add-icon">+</div>
                        <h4>Add Sectioning Protocol</h4>
                        <p>Named set of blocks for a case workup</p>
                    </div>
                </div>
            </div>

            {protocolModal && (
                <div className="modal-overlay" onClick={() => setProtocolModal(null)}>
                    <div className="modal-content" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{protocolModal.existing ? 'Edit' : 'Add'} Sectioning Protocol</h2>
                            <button className="close-button" onClick={() => setProtocolModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleSaveProtocol} className="protocol-form">
                            <div className="form-group">
                                <label htmlFor="sectioning-name">Protocol Name *</label>
                                <input
                                    id="sectioning-name"
                                    value={protocolModal.form.name}
                                    onChange={(event) => setProtocolModal((current) => ({
                                        ...current,
                                        form: { ...current.form, name: event.target.value },
                                    }))}
                                    placeholder="e.g., Standard ADRC workup"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="sectioning-description">Description</label>
                                <textarea
                                    id="sectioning-description"
                                    rows="3"
                                    value={protocolModal.form.description}
                                    onChange={(event) => setProtocolModal((current) => ({
                                        ...current,
                                        form: { ...current.form, description: event.target.value },
                                    }))}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-button" onClick={() => setProtocolModal(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="save-button" disabled={isSaving}>
                                    {isSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {blockModal && (
                <div className="modal-overlay" onClick={() => setBlockModal(null)}>
                    <div className="modal-content" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{blockModal.existing ? 'Edit' : 'Add'} Block</h2>
                            <button className="close-button" onClick={() => setBlockModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleSaveBlock} className="protocol-form">
                            <div className="form-group">
                                <label htmlFor="block-name">Block Name *</label>
                                <input
                                    id="block-name"
                                    value={blockModal.form.name}
                                    onChange={(event) => setBlockModal((current) => ({
                                        ...current,
                                        form: { ...current.form, name: event.target.value },
                                    }))}
                                    placeholder="e.g., Frontal block"
                                />
                            </div>
                            <div className="form-group">
                                <label>Region templates</label>
                                {templates.length === 0 ? (
                                    <p>No region templates available.</p>
                                ) : (
                                    <div className="landmarks-checkbox-group">
                                        {templates.map((region) => {
                                            const id = String(region.id);
                                            return (
                                                <label key={id} className="checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={blockModal.form.regionIds.map(String).includes(id)}
                                                        onChange={() => toggleRegion(id)}
                                                    />
                                                    {region.name}
                                                    {region.abbreviation ? ` (${region.abbreviation})` : ''}
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cancel-button" onClick={() => setBlockModal(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="save-button" disabled={isSaving || templates.length === 0}>
                                    {isSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SectioningProtocolsPanel;
