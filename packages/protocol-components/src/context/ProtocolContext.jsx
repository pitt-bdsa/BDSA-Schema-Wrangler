import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { defaultStorage, generateProtocolId } from '../storage/protocolStorage';

/**
 * Protocol Context - Single source of truth for all protocols
 * 
 * State Shape:
 * {
 *   protocols: [
 *     { id, type: 'stain'|'region', name, ...otherFields },
 *     ...
 *   ],
 *   loading: boolean,
 *   error: string|null
 * }
 */

const ProtocolContext = createContext(null);

// Action types
const ACTIONS = {
    LOAD_START: 'LOAD_START',
    LOAD_SUCCESS: 'LOAD_SUCCESS',
    LOAD_ERROR: 'LOAD_ERROR',
    ADD: 'ADD',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    CLEAR_ALL: 'CLEAR_ALL'
};

// Default protocols (IGNORE protocols)
const DEFAULT_PROTOCOLS = [
    {
        id: 'ignore_stain',
        type: 'stain',
        name: 'IGNORE',
        description: 'Mark slide for exclusion from processing',
        stainType: 'ignore',
        _isDefault: true
    },
    {
        id: 'ignore_region',
        type: 'region',
        name: 'IGNORE',
        description: 'Mark slide for exclusion from processing',
        regionType: 'ignore',
        _isDefault: true
    }
];

// Reducer to manage protocol state
function protocolReducer(state, action) {
    switch (action.type) {
        case ACTIONS.LOAD_START:
            return { ...state, loading: true, error: null };

        case ACTIONS.LOAD_SUCCESS:
            // Merge default protocols with loaded ones
            const loadedIds = new Set(action.payload.map(p => p.id));
            const defaultsToAdd = DEFAULT_PROTOCOLS.filter(d => !loadedIds.has(d.id));
            return {
                ...state,
                protocols: [...defaultsToAdd, ...action.payload],
                loading: false,
                error: null
            };

        case ACTIONS.LOAD_ERROR:
            return { ...state, loading: false, error: action.payload };

        case ACTIONS.ADD:
            return {
                ...state,
                protocols: [...state.protocols, { ...action.payload, id: action.payload.id || generateProtocolId() }]
            };

        case ACTIONS.UPDATE:
            return {
                ...state,
                protocols: state.protocols.map(p =>
                    p.id === action.payload.id ? { ...p, ...action.payload } : p
                )
            };

        case ACTIONS.DELETE:
            return {
                ...state,
                protocols: state.protocols.filter(p => p.id !== action.payload && !p._isDefault)
            };

        case ACTIONS.CLEAR_ALL:
            return {
                ...state,
                protocols: DEFAULT_PROTOCOLS
            };

        default:
            return state;
    }
}

/**
 * ProtocolProvider - Wrap your app with this to provide protocol state
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {Object} props.storage - Storage implementation (defaults to localStorage)
 */
export function ProtocolProvider({ children, storage = defaultStorage }) {
    const [state, dispatch] = useReducer(protocolReducer, {
        protocols: DEFAULT_PROTOCOLS,
        loading: true,
        error: null
    });

    // Load protocols on mount
    useEffect(() => {
        const loadProtocols = async () => {
            dispatch({ type: ACTIONS.LOAD_START });
            try {
                const protocols = await storage.load();
                dispatch({ type: ACTIONS.LOAD_SUCCESS, payload: protocols });
            } catch (error) {
                dispatch({ type: ACTIONS.LOAD_ERROR, payload: error.message });
            }
        };
        loadProtocols();
    }, [storage]);

    // Save to storage whenever protocols change
    useEffect(() => {
        if (!state.loading) {
            // Only save non-default protocols
            const toSave = state.protocols.filter(p => !p._isDefault);
            storage.save(toSave).catch(err => {
                console.error('Failed to save protocols:', err);
            });
        }
    }, [state.protocols, state.loading, storage]);

    // Action creators
    const addProtocol = useCallback((protocol) => {
        dispatch({ type: ACTIONS.ADD, payload: protocol });
    }, []);

    const updateProtocol = useCallback((protocol) => {
        dispatch({ type: ACTIONS.UPDATE, payload: protocol });
    }, []);

    const deleteProtocol = useCallback((id) => {
        dispatch({ type: ACTIONS.DELETE, payload: id });
    }, []);

    const clearAllProtocols = useCallback(async () => {
        await storage.clear();
        dispatch({ type: ACTIONS.CLEAR_ALL });
    }, [storage]);

    // Derived selectors
    const getProtocolsByType = useCallback((type) => {
        return state.protocols.filter(p => p.type === type);
    }, [state.protocols]);

    const getProtocolById = useCallback((id) => {
        return state.protocols.find(p => p.id === id);
    }, [state.protocols]);

    const value = {
        // State
        protocols: state.protocols,
        loading: state.loading,
        error: state.error,

        // Actions
        addProtocol,
        updateProtocol,
        deleteProtocol,
        clearAllProtocols,

        // Selectors
        getProtocolsByType,
        getProtocolById,

        // Computed
        stainProtocols: getProtocolsByType('stain'),
        regionProtocols: getProtocolsByType('region')
    };

    return (
        <ProtocolContext.Provider value={value}>
            {children}
        </ProtocolContext.Provider>
    );
}

/**
 * useProtocols - The ONE hook you need for protocol management!
 * 
 * @returns {Object} Protocol state and actions
 * 
 * @example
 * function MyComponent() {
 *   const { protocols, stainProtocols, addProtocol, loading } = useProtocols();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   
 *   return (
 *     <div>
 *       {stainProtocols.map(p => <div key={p.id}>{p.name}</div>)}
 *       <button onClick={() => addProtocol({ type: 'stain', name: 'H&E' })}>
 *         Add Protocol
 *       </button>
 *     </div>
 *   );
 * }
 */
export function useProtocols() {
    const context = useContext(ProtocolContext);
    if (!context) {
        throw new Error('useProtocols must be used within a ProtocolProvider');
    }
    return context;
}

export default ProtocolContext;


