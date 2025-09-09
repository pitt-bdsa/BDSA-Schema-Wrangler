import React, { useState, useEffect } from 'react';
import {
    subscribeToDataStore,
    getDataStoreSnapshot,
    updateCaseIdMappings,
    updateCaseProtocolMappings,
    DATA_CHANGE_EVENTS
} from '../utils/dataStore';

/**
 * Debug component to test and monitor data store synchronization
 * Add this temporarily to any tab to verify synchronization is working
 */
const DataStoreDebug = () => {
    const [dataStore, setDataStore] = useState(getDataStoreSnapshot());
    const [events, setEvents] = useState([]);
    const [showDebug, setShowDebug] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToDataStore((event) => {
            console.log('🔍 DataStoreDebug received event:', event.eventType, event.data);

            // Update local state
            setDataStore(event.dataStore);

            // Add to events log
            setEvents(prev => [...prev.slice(-9), {
                timestamp: new Date().toLocaleTimeString(),
                type: event.eventType,
                data: event.data
            }]);
        });

        return unsubscribe;
    }, []);

    const testCaseIdUpdate = () => {
        const testMapping = {
            [`test-${Date.now()}`]: `BDSA-001-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
        };
        updateCaseIdMappings(testMapping);
    };

    const testProtocolUpdate = () => {
        const testMapping = {
            [`BDSA-001-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`]: {
                'test-slide.svs': ['test-protocol-1', 'test-protocol-2']
            }
        };
        updateCaseProtocolMappings(testMapping);
    };

    if (!showDebug) {
        return (
            <div style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                zIndex: 1000,
                backgroundColor: '#007bff',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} onClick={() => setShowDebug(true)}>
                🔍 Debug Store
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '400px',
            maxHeight: '500px',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            fontSize: '12px',
            overflow: 'hidden'
        }}>
            <div style={{
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <strong>🔍 Data Store Debug</strong>
                <button
                    onClick={() => setShowDebug(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    ×
                </button>
            </div>

            <div style={{ padding: '12px', maxHeight: '200px', overflow: 'auto' }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Current State:</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                    • Data Source: {dataStore.currentDataSource || 'none'}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                    • Data Rows: {dataStore.dataCount || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                    • Case ID Mappings: {Object.keys(dataStore.caseIdMappings || {}).length}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                    • Protocol Mappings: {Object.keys(dataStore.caseProtocolMappings || {}).length}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                    • Loading: {dataStore.isLoading ? 'Yes' : 'No'}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                    • Last Update: {dataStore.lastUpdate ? new Date(dataStore.lastUpdate).toLocaleTimeString() : 'never'}
                </div>
            </div>

            <div style={{ padding: '12px', borderTop: '1px solid #eee' }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Test Actions:</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={testCaseIdUpdate}
                        style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        Test Case ID
                    </button>
                    <button
                        onClick={testProtocolUpdate}
                        style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        Test Protocol
                    </button>
                    <button
                        onClick={() => setEvents([])}
                        style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#ffc107',
                            color: 'black',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        Clear Events
                    </button>
                </div>
            </div>

            <div style={{
                padding: '12px',
                borderTop: '1px solid #eee',
                maxHeight: '150px',
                overflow: 'auto'
            }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Recent Events ({events.length}):</strong>
                </div>
                {events.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
                        No events yet...
                    </div>
                ) : (
                    events.slice().reverse().map((event, index) => (
                        <div key={index} style={{
                            fontSize: '11px',
                            padding: '2px 0',
                            borderBottom: index < events.length - 1 ? '1px solid #f0f0f0' : 'none'
                        }}>
                            <span style={{ color: '#666' }}>{event.timestamp}</span>{' '}
                            <span style={{
                                color: event.type.includes('ERROR') ? '#dc3545' :
                                    event.type.includes('LOADED') ? '#28a745' : '#007bff',
                                fontWeight: 'bold'
                            }}>
                                {event.type}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DataStoreDebug;
