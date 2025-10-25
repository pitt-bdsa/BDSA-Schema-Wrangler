// Protocol Components - Clean state management for BDSA protocols

// Context and Hook (State Management)
export { ProtocolProvider, useProtocols } from './context/ProtocolContext';

// UI Components
export { ProtocolCard } from './components/ProtocolCard';
export { ProtocolList } from './components/ProtocolList';

// Storage
export {
    LocalStorageProtocolStorage,
    InMemoryProtocolStorage,
    defaultStorage,
    generateProtocolId
} from './storage/protocolStorage';

// Types (for future TypeScript support)
export type Protocol = {
    id: string;
    type: 'stain' | 'region';
    name: string;
    description?: string;
    [key: string]: any;
};

