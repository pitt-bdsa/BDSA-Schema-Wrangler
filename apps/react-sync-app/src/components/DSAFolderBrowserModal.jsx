import React, { useState, useEffect } from 'react';
import './DSAFolderBrowserModal.css';

const DSAFolderBrowserModal = ({
    isOpen,
    onClose,
    dsaClient,
    onSelectResource,
    title = "Select DSA Resource"
}) => {
    const [collections, setCollections] = useState([]);
    const [folders, setFolders] = useState({});
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [expandedCollections, setExpandedCollections] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedResource, setSelectedResource] = useState(null);

    // Load collections when modal opens
    useEffect(() => {
        if (isOpen && dsaClient) {
            loadCollections();
        }
    }, [isOpen, dsaClient]);

    const loadCollections = async () => {
        if (!dsaClient) {
            setError('DSA client not available');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Get collections using the DSA client
            const collectionsData = await dsaClient.getCollections();
            setCollections(collectionsData);
            console.log('Loaded collections:', collectionsData);
        } catch (error) {
            console.error('Error loading collections:', error);
            setError('Failed to load collections: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadFolders = async (collection) => {
        if (!dsaClient) return;

        try {
            // Get folders for this collection
            const foldersData = await dsaClient.getFolders(collection._id);
            setFolders(prev => ({
                ...prev,
                [collection._id]: foldersData
            }));
        } catch (error) {
            console.error('Error loading folders for collection:', collection.name, error);
        }
    };

    const loadSubFolders = async (folder) => {
        if (!dsaClient) return;

        try {
            // Get subfolders for this folder
            const subFolders = await dsaClient.getFolders(folder._id);
            setFolders(prev => ({
                ...prev,
                [folder._id]: subFolders
            }));
        } catch (error) {
            console.error('Error loading subfolders for folder:', folder.name, error);
        }
    };

    const toggleCollection = async (collection) => {
        const isExpanded = expandedCollections.has(collection._id);

        if (isExpanded) {
            setExpandedCollections(prev => {
                const newSet = new Set(prev);
                newSet.delete(collection._id);
                return newSet;
            });
        } else {
            setExpandedCollections(prev => new Set(prev).add(collection._id));
            // Load folders for this collection
            await loadFolders(collection);
        }
    };

    const toggleFolder = async (folder) => {
        const isExpanded = expandedFolders.has(folder._id);

        if (isExpanded) {
            setExpandedFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(folder._id);
                return newSet;
            });
        } else {
            setExpandedFolders(prev => new Set(prev).add(folder._id));
            // Load subfolders for this folder
            await loadSubFolders(folder);
        }
    };

    const handleResourceSelect = (resource, type) => {
        setSelectedResource({ ...resource, type });
    };

    const handleConfirmSelection = () => {
        if (selectedResource) {
            onSelectResource(selectedResource);
            onClose();
        }
    };

    const renderCollection = (collection) => {
        const isExpanded = expandedCollections.has(collection._id);
        const collectionFolders = folders[collection._id] || [];

        return (
            <div key={collection._id} className="dsa-collection">
                <div
                    className="dsa-folder-header"
                    onClick={() => toggleCollection(collection)}
                >
                    <span className={`dsa-folder-icon ${isExpanded ? 'expanded' : ''}`}>
                        {isExpanded ? '📂' : '📁'}
                    </span>
                    <span className="dsa-folder-name">{collection.name}</span>
                    <span className="dsa-folder-type">Collection</span>
                </div>

                {isExpanded && (
                    <div className="dsa-folder-contents">
                        {/* Collection itself can be selected */}
                        <div
                            className={`dsa-resource-item ${selectedResource?._id === collection._id ? 'selected' : ''}`}
                            onClick={() => handleResourceSelect(collection, 'collection')}
                        >
                            <span className="dsa-resource-icon">📁</span>
                            <span className="dsa-resource-name">{collection.name}</span>
                            <span className="dsa-resource-type">Collection</span>
                        </div>

                        {/* Render folders in this collection */}
                        {collectionFolders.map(folder => renderFolder(folder, 1))}
                    </div>
                )}
            </div>
        );
    };

    const renderFolder = (folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder._id);
        const subFolders = folders[folder._id] || [];

        return (
            <div key={folder._id} className="dsa-folder" style={{ marginLeft: `${depth * 20}px` }}>
                <div
                    className="dsa-folder-header"
                    onClick={() => toggleFolder(folder)}
                >
                    <span className={`dsa-folder-icon ${isExpanded ? 'expanded' : ''}`}>
                        {isExpanded ? '📂' : '📁'}
                    </span>
                    <span className="dsa-folder-name">{folder.name}</span>
                    <span className="dsa-folder-type">Folder</span>
                </div>

                {isExpanded && (
                    <div className="dsa-folder-contents">
                        {/* Folder itself can be selected */}
                        <div
                            className={`dsa-resource-item ${selectedResource?._id === folder._id ? 'selected' : ''}`}
                            onClick={() => handleResourceSelect(folder, 'folder')}
                        >
                            <span className="dsa-resource-icon">📁</span>
                            <span className="dsa-resource-name">{folder.name}</span>
                            <span className="dsa-resource-type">Folder</span>
                        </div>

                        {/* Render subfolders */}
                        {subFolders.map(subFolder => renderFolder(subFolder, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="dsa-folder-browser-modal-overlay" onClick={onClose}>
            <div className="dsa-folder-browser-modal" onClick={(e) => e.stopPropagation()}>
                <div className="dsa-folder-browser-header">
                    <h3>{title}</h3>
                    <button className="dsa-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="dsa-folder-browser-content">
                    {loading && (
                        <div className="dsa-loading">
                            <span>Loading collections...</span>
                        </div>
                    )}

                    {error && (
                        <div className="dsa-error">
                            <span>{error}</span>
                            <button onClick={loadCollections}>Retry</button>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="dsa-collections">
                            {collections.length === 0 ? (
                                <div className="dsa-empty">
                                    <span>No collections found</span>
                                </div>
                            ) : (
                                collections.map(collection => renderCollection(collection))
                            )}
                        </div>
                    )}
                </div>

                <div className="dsa-folder-browser-footer">
                    <div className="dsa-selection-info">
                        {selectedResource ? (
                            <span>Selected: {selectedResource.name} ({selectedResource.type})</span>
                        ) : (
                            <span>No resource selected</span>
                        )}
                    </div>
                    <div className="dsa-footer-buttons">
                        <button onClick={onClose} className="dsa-cancel-btn">Cancel</button>
                        <button
                            onClick={handleConfirmSelection}
                            className="dsa-confirm-btn"
                            disabled={!selectedResource}
                        >
                            Select
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DSAFolderBrowserModal;




