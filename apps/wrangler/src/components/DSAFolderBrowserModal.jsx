import React, { useState, useEffect } from 'react';
import './DSAFolderBrowserModal.css';

const DSAFolderBrowserModal = ({
    isOpen,
    onClose,
    dsaClient,
    onSelectResource,
    title = "Select DSA Resource",
    refreshTrigger = 0
}) => {
    const [collections, setCollections] = useState([]);
    const [folders, setFolders] = useState({});
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [expandedCollections, setExpandedCollections] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshSuccess, setRefreshSuccess] = useState(false);
    const [error, setError] = useState('');
    const [selectedResource, setSelectedResource] = useState(null);
    const [bdsaMetadata, setBdsaMetadata] = useState({});
    const [collectionBdsaMetadata, setCollectionBdsaMetadata] = useState({});
    const [folderPagination, setFolderPagination] = useState({});

    // Load collections when modal opens
    useEffect(() => {
        if (isOpen && dsaClient) {
            loadCollections();
        }
    }, [isOpen, dsaClient]);

    // Refresh metadata when refreshTrigger changes (useful after sync operations)
    useEffect(() => {
        if (isOpen && dsaClient && refreshTrigger > 0) {
            console.log('Refresh trigger detected, refreshing metadata...');
            refreshMetadata();
        }
    }, [refreshTrigger, isOpen, dsaClient]);

    // Listen for sync completion events to refresh metadata
    useEffect(() => {
        const handleSyncCompleted = () => {
            if (isOpen && dsaClient) {
                console.log('🔄 Sync completed event received, refreshing BDSA metadata...');
                refreshMetadata();
            }
        };

        window.addEventListener('bdsa-sync-completed', handleSyncCompleted);
        return () => window.removeEventListener('bdsa-sync-completed', handleSyncCompleted);
    }, [isOpen, dsaClient]);

    // Refresh metadata when modal is opened (useful after sync operations)
    const refreshMetadata = async () => {
        if (!dsaClient || refreshing) return;

        setRefreshing(true);
        console.log('🔄 Refreshing BDSA metadata for all collections and folders...');

        try {
            // Re-check metadata for all collections
            if (collections.length > 0) {
                console.log('🔄 Re-checking collections metadata...');
                await checkBdsaMetadataForCollections(collections);
            }

            // Re-check metadata for all loaded folders
            const allFolderIds = Object.keys(folders);
            console.log('🔄 Re-checking folders metadata for:', allFolderIds);

            for (const folderId of allFolderIds) {
                const folderList = folders[folderId];
                if (folderList && folderList.length > 0) {
                    console.log(`🔄 Re-checking metadata for ${folderList.length} folders in ${folderId}`);
                    await checkBdsaMetadataForFolders(folderList);
                }
            }

            console.log('✅ Metadata refresh completed');
            setRefreshSuccess(true);
            // Clear success message after 2 seconds
            setTimeout(() => setRefreshSuccess(false), 2000);
        } catch (error) {
            console.error('❌ Error during metadata refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Check BDSA metadata for collections
    const checkBdsaMetadataForCollections = async (collectionsList) => {
        if (!dsaClient || !collectionsList || collectionsList.length === 0) return;

        try {
            // Check metadata for each collection in parallel
            const metadataPromises = collectionsList.map(async (collection) => {
                try {
                    const metadata = await dsaClient.hasBdsaMetadataForCollection(collection._id);
                    return { collectionId: collection._id, metadata };
                } catch (error) {
                    console.warn(`Failed to check BDSA metadata for collection ${collection.name}:`, error);
                    return { collectionId: collection._id, metadata: { hasAnyBdsaMetadata: false } };
                }
            });

            const results = await Promise.all(metadataPromises);

            // Update the collection BDSA metadata state
            const newMetadata = {};
            results.forEach(({ collectionId, metadata }) => {
                newMetadata[collectionId] = metadata;
            });

            setCollectionBdsaMetadata(prev => ({
                ...prev,
                ...newMetadata
            }));
        } catch (error) {
            console.error('Error checking BDSA metadata for collections:', error);
        }
    };

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

            // Check BDSA metadata for each collection
            await checkBdsaMetadataForCollections(collectionsData);
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
            // Get folders for this collection (parentType: 'collection') with limit
            const foldersData = await dsaClient.getFolders(collection._id, 'collection', 20, 0);
            setFolders(prev => ({
                ...prev,
                [collection._id]: foldersData
            }));

            // Update pagination state
            setFolderPagination(prev => ({
                ...prev,
                [collection._id]: {
                    hasMore: foldersData.length === 20, // If we got exactly 20, there might be more
                    offset: 20,
                    total: foldersData.length
                }
            }));

            // Check BDSA metadata for each folder (limited to 20)
            await checkBdsaMetadataForFolders(foldersData);
        } catch (error) {
            console.error('Error loading folders for collection:', collection.name, error);
        }
    };

    const loadSubFolders = async (folder) => {
        if (!dsaClient) return;

        try {
            // Get subfolders for this folder (parentType: 'folder') with limit
            const subFolders = await dsaClient.getFolders(folder._id, 'folder', 20, 0);
            setFolders(prev => ({
                ...prev,
                [folder._id]: subFolders
            }));

            // Update pagination state
            setFolderPagination(prev => ({
                ...prev,
                [folder._id]: {
                    hasMore: subFolders.length === 20, // If we got exactly 20, there might be more
                    offset: 20,
                    total: subFolders.length
                }
            }));

            // Check BDSA metadata for each subfolder (limited to 20)
            await checkBdsaMetadataForFolders(subFolders);
        } catch (error) {
            console.error('Error loading subfolders for folder:', folder.name, error);
        }
    };

    // Load more folders for pagination
    const loadMoreFolders = async (parentId, parentType = 'collection') => {
        if (!dsaClient) return;

        console.log('📂 Loading more folders for:', { parentId, parentType });

        try {
            const pagination = folderPagination[parentId];
            if (!pagination || !pagination.hasMore) {
                console.log('❌ No more folders to load or pagination not found');
                return;
            }

            console.log('📂 Fetching more folders with pagination:', pagination);
            const moreFolders = await dsaClient.getFolders(parentId, parentType, 20, pagination.offset);
            console.log('📂 Loaded more folders:', moreFolders.map(f => f.name));

            setFolders(prev => ({
                ...prev,
                [parentId]: [...(prev[parentId] || []), ...moreFolders]
            }));

            // Update pagination state
            setFolderPagination(prev => ({
                ...prev,
                [parentId]: {
                    hasMore: moreFolders.length === 20,
                    offset: pagination.offset + moreFolders.length,
                    total: pagination.total + moreFolders.length
                }
            }));

            // Check BDSA metadata for the new folders
            console.log('📂 Checking metadata for newly loaded folders...');
            await checkBdsaMetadataForFolders(moreFolders);
        } catch (error) {
            console.error('Error loading more folders:', error);
        }
    };

    // Check BDSA metadata for a list of folders
    const checkBdsaMetadataForFolders = async (foldersList) => {
        if (!dsaClient || !foldersList || foldersList.length === 0) return;

        console.log('🔍 Checking BDSA metadata for folders:', foldersList.map(f => f.name));

        try {
            // Check metadata for each folder in parallel
            const metadataPromises = foldersList.map(async (folder) => {
                try {
                    const metadata = await dsaClient.hasBdsaMetadata(folder._id);
                    console.log(`📊 Metadata for ${folder.name}:`, metadata);
                    return { folderId: folder._id, metadata };
                } catch (error) {
                    console.warn(`Failed to check BDSA metadata for folder ${folder.name}:`, error);
                    return { folderId: folder._id, metadata: { hasAnyBdsaMetadata: false } };
                }
            });

            const results = await Promise.all(metadataPromises);

            // Update the BDSA metadata state
            const newMetadata = {};
            results.forEach(({ folderId, metadata }) => {
                newMetadata[folderId] = metadata;
            });

            console.log('📝 Updating BDSA metadata state with:', newMetadata);

            setBdsaMetadata(prev => {
                const updated = {
                    ...prev,
                    ...newMetadata
                };
                console.log('📝 New BDSA metadata state:', updated);
                return updated;
            });
        } catch (error) {
            console.error('Error checking BDSA metadata for folders:', error);
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
        const metadata = collectionBdsaMetadata[collection._id] || {};

        return (
            <div key={collection._id} className="dsa-collection">
                <div
                    className={`dsa-folder-header ${selectedResource?._id === collection._id ? 'selected' : ''}`}
                    onClick={() => toggleCollection(collection)}
                >
                    <span className={`dsa-folder-icon ${isExpanded ? 'expanded' : ''}`}>
                        {isExpanded ? '📂' : '📁'}
                    </span>
                    <span className="dsa-folder-name">
                        {collection.name}
                        {(metadata.hasAnyBdsaMetadata || metadata.hasBeenIndexed || metadata.hasWranglerTouch) && (
                            <div className="bdsa-metadata-indicators">
                                {metadata.collectionType === 'metadata' && (
                                    <span className="bdsa-indicator metadata-folder" title={`BDSA Metadata Folder${metadata.lastUpdated ? ` (last updated: ${new Date(metadata.lastUpdated).toLocaleDateString()})` : ''}`}>
                                        📋
                                    </span>
                                )}
                                {metadata.collectionType === 'indexed' && (
                                    <span className="bdsa-indicator indexed-folder" title={`BDSA Indexed Folder${metadata.lastUpdated ? ` (last updated: ${new Date(metadata.lastUpdated).toLocaleDateString()})` : ''}`}>
                                        🔍
                                    </span>
                                )}
                                {metadata.collectionType === 'wrangler-touched' && (
                                    <span className="bdsa-indicator wrangler-touched" title={`BDSA Wrangler Touched${metadata.hasWranglerTouch?.lastTouched ? ` (last touched: ${new Date(metadata.hasWranglerTouch.lastTouched).toLocaleDateString()})` : ''}`}>
                                        ⚡
                                    </span>
                                )}
                                {metadata.statistics && (
                                    <div className="bdsa-stats">
                                        {metadata.statistics.stainProtocolCount > 0 && (
                                            <span className="stat-badge stain" title={`${metadata.statistics.stainProtocolCount} stain protocols`}>
                                                🧪 {metadata.statistics.stainProtocolCount}
                                            </span>
                                        )}
                                        {metadata.statistics.regionProtocolCount > 0 && (
                                            <span className="stat-badge region" title={`${metadata.statistics.regionProtocolCount} region protocols`}>
                                                🧠 {metadata.statistics.regionProtocolCount}
                                            </span>
                                        )}
                                        {metadata.statistics.caseIdMappingCount > 0 && (
                                            <span className="stat-badge caseid" title={`${metadata.statistics.caseIdMappingCount} case ID mappings`}>
                                                🆔 {metadata.statistics.caseIdMappingCount}
                                            </span>
                                        )}
                                        {metadata.statistics.hasColumnMappings && (
                                            <span className="stat-badge column" title="Column mappings">
                                                📊
                                            </span>
                                        )}
                                        {metadata.statistics.hasRegexRules && (
                                            <span className="stat-badge regex" title="Regex rules">
                                                🔍
                                            </span>
                                        )}
                                        {metadata.statistics.institutionId && (
                                            <span className="stat-badge institution" title={`Institution: ${metadata.statistics.institutionId}`}>
                                                🏥 {metadata.statistics.institutionId}
                                            </span>
                                        )}
                                        {metadata.statistics.isMetadataFolder && (
                                            <span className="stat-badge metadata-folder" title="Primary metadata folder">
                                                📋 Metadata
                                            </span>
                                        )}
                                        {metadata.statistics.metadataFolderRef && (
                                            <span className="stat-badge metadata-ref" title={`Metadata stored in: ${metadata.statistics.metadataFolderRef}`}>
                                                🔗 {metadata.statistics.metadataFolderRef}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </span>
                    <span className="dsa-folder-type">Collection</span>
                    <button
                        className="select-collection-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleResourceSelect(collection, 'collection');
                        }}
                        title="Select this collection"
                    >
                        Select
                    </button>
                </div>

                {isExpanded && (
                    <div className="dsa-folder-contents">
                        {/* Render folders in this collection */}
                        {collectionFolders.map(folder => renderFolder(folder, 1))}

                        {/* Show load more button if there are more folders */}
                        {folderPagination[collection._id]?.hasMore && (
                            <div className="dsa-load-more">
                                <button
                                    className="load-more-btn"
                                    onClick={() => loadMoreFolders(collection._id, 'collection')}
                                >
                                    Load more folders...
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderFolder = (folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder._id);
        const subFolders = folders[folder._id] || [];
        const metadata = bdsaMetadata[folder._id] || {};

        console.log(`🎨 Rendering folder ${folder.name}:`, {
            folderId: folder._id,
            metadata,
            hasAnyBdsaMetadata: metadata.hasAnyBdsaMetadata,
            hasBeenIndexed: metadata.hasBeenIndexed,
            hasWranglerTouch: metadata.hasWranglerTouch,
            folderType: metadata.folderType
        });

        return (
            <div key={folder._id} className="dsa-folder" style={{ marginLeft: `${depth * 20}px` }}>
                <div
                    className={`dsa-folder-header ${selectedResource?._id === folder._id ? 'selected' : ''}`}
                    onClick={() => toggleFolder(folder)}
                >
                    <span className={`dsa-folder-icon ${isExpanded ? 'expanded' : ''}`}>
                        {isExpanded ? '📂' : '📁'}
                    </span>
                    <span className="dsa-folder-name">
                        {folder.name}
                        {(metadata.hasAnyBdsaMetadata || metadata.hasBeenIndexed || metadata.hasWranglerTouch) && (
                            <div className="bdsa-metadata-indicators">
                                {metadata.folderType === 'metadata' && (
                                    <span className="bdsa-indicator metadata-folder" title={`BDSA Metadata Folder${metadata.lastUpdated ? ` (last updated: ${new Date(metadata.lastUpdated).toLocaleDateString()})` : ''}`}>
                                        📋
                                    </span>
                                )}
                                {metadata.folderType === 'indexed' && (
                                    <span className="bdsa-indicator indexed-folder" title={`BDSA Indexed Folder${metadata.lastUpdated ? ` (last updated: ${new Date(metadata.lastUpdated).toLocaleDateString()})` : ''}`}>
                                        🔍
                                    </span>
                                )}
                                {metadata.folderType === 'wrangler-touched' && (
                                    <span className="bdsa-indicator wrangler-touched" title={`BDSA Wrangler Touched${metadata.hasWranglerTouch?.lastTouched ? ` (last touched: ${new Date(metadata.hasWranglerTouch.lastTouched).toLocaleDateString()})` : ''}`}>
                                        ⚡
                                    </span>
                                )}
                                {metadata.statistics && (
                                    <div className="bdsa-stats">
                                        {metadata.statistics.stainProtocolCount > 0 && (
                                            <span className="stat-badge stain" title={`${metadata.statistics.stainProtocolCount} stain protocols`}>
                                                🧪 {metadata.statistics.stainProtocolCount}
                                            </span>
                                        )}
                                        {metadata.statistics.regionProtocolCount > 0 && (
                                            <span className="stat-badge region" title={`${metadata.statistics.regionProtocolCount} region protocols`}>
                                                🧠 {metadata.statistics.regionProtocolCount}
                                            </span>
                                        )}
                                        {metadata.statistics.caseIdMappingCount > 0 && (
                                            <span className="stat-badge caseid" title={`${metadata.statistics.caseIdMappingCount} case ID mappings`}>
                                                🆔 {metadata.statistics.caseIdMappingCount}
                                            </span>
                                        )}
                                        {metadata.statistics.hasColumnMappings && (
                                            <span className="stat-badge column" title="Column mappings">
                                                📊
                                            </span>
                                        )}
                                        {metadata.statistics.hasRegexRules && (
                                            <span className="stat-badge regex" title="Regex rules">
                                                🔍
                                            </span>
                                        )}
                                        {metadata.statistics.institutionId && (
                                            <span className="stat-badge institution" title={`Institution: ${metadata.statistics.institutionId}`}>
                                                🏥 {metadata.statistics.institutionId}
                                            </span>
                                        )}
                                        {metadata.statistics.isMetadataFolder && (
                                            <span className="stat-badge metadata-folder" title="Primary metadata folder">
                                                📋 Metadata
                                            </span>
                                        )}
                                        {metadata.statistics.metadataFolderRef && (
                                            <span className="stat-badge metadata-ref" title={`Metadata stored in: ${metadata.statistics.metadataFolderRef}`}>
                                                🔗 {metadata.statistics.metadataFolderRef}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </span>
                    <span className="dsa-folder-type">Folder</span>
                    <button
                        className="select-folder-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleResourceSelect(folder, 'folder');
                        }}
                        title="Select this folder"
                    >
                        Select
                    </button>
                </div>

                {isExpanded && (
                    <div className="dsa-folder-contents">
                        {/* Render subfolders */}
                        {subFolders.map(subFolder => renderFolder(subFolder, depth + 1))}

                        {/* Show load more button if there are more subfolders */}
                        {folderPagination[folder._id]?.hasMore && (
                            <div className="dsa-load-more">
                                <button
                                    className="load-more-btn"
                                    onClick={() => loadMoreFolders(folder._id, 'folder')}
                                >
                                    Load more folders...
                                </button>
                            </div>
                        )}
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
                    <div className="dsa-header-actions">
                        <button
                            className={`dsa-refresh-btn ${refreshSuccess ? 'success' : ''}`}
                            onClick={refreshMetadata}
                            disabled={refreshing}
                            title={refreshing ? "Refreshing metadata..." : refreshSuccess ? "Metadata refreshed!" : "Refresh BDSA metadata indicators"}
                        >
                            {refreshing ? '⏳ Refreshing...' : refreshSuccess ? '✅ Refreshed!' : '🔄 Refresh'}
                        </button>
                        <button className="dsa-close-btn" onClick={onClose}>✕</button>
                    </div>
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
