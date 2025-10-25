# @bdsa/protocol-components

Clean, modern state management for BDSA protocols.

## 🎯 The Problem We Solved

**Before:** 
- Class-based store with manual subscriptions
- Separate `stainProtocols` and `regionProtocols` arrays  
- Multiple sources of truth
- Complex state synchronization
- Hard to test

**After:**
- ✅ Single `useProtocols()` hook
- ✅ One unified protocols array
- ✅ React Context (no manual subscriptions)
- ✅ Storage abstracted (localStorage/memory/DSA)
- ✅ Fully tested

## 🚀 Quick Start

### 1. Wrap your app with ProtocolProvider

```javascript
import { ProtocolProvider } from '@bdsa/protocol-components';

function App() {
  return (
    <ProtocolProvider>
      <YourComponents />
    </ProtocolProvider>
  );
}
```

### 2. Use the ONE hook you need

```javascript
import { useProtocols } from '@bdsa/protocol-components';

function ProtocolList() {
  const {
    protocols,           // All protocols
    stainProtocols,      // Filtered by type='stain'
    regionProtocols,     // Filtered by type='region'
    addProtocol,         // Add new protocol
    updateProtocol,      // Update existing
    deleteProtocol,      // Delete by ID
    loading,             // Loading state
    error                // Error state
  } = useProtocols();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Stain Protocols ({stainProtocols.length})</h2>
      {stainProtocols.map(p => (
        <div key={p.id}>
          {p.name}
          <button onClick={() => deleteProtocol(p.id)}>Delete</button>
        </div>
      ))}
      
      <button onClick={() => addProtocol({
        type: 'stain',
        name: 'H&E',
        stainType: 'Histology'
      })}>
        Add Protocol
      </button>
    </div>
  );
}
```

## 📦 What's Included

### State Management
- `ProtocolProvider` - Context provider (wrap your app)
- `useProtocols()` - The ONE hook for everything

### Storage
- `LocalStorageProtocolStorage` - Persists to localStorage (default)
- `InMemoryProtocolStorage` - In-memory (great for testing)
- Custom storage - Implement your own (e.g., DSA server)

### Utilities
- `generateProtocolId()` - Generate unique IDs

## 🧪 Testing

All state management is fully tested:

```bash
npm test
```

**9 test suites covering:**
- ✅ Default protocols (IGNORE)
- ✅ Adding protocols
- ✅ Updating protocols
- ✅ Deleting protocols
- ✅ Type filtering (stain vs region)
- ✅ Storage persistence
- ✅ Loading from storage

## 🎨 API Reference

### `useProtocols()`

Returns an object with:

```typescript
{
  // State
  protocols: Protocol[],           // All protocols
  stainProtocols: Protocol[],      // type='stain' only
  regionProtocols: Protocol[],     // type='region' only
  loading: boolean,                // Loading state
  error: string | null,            // Error message

  // Actions
  addProtocol: (protocol) => void,
  updateProtocol: (protocol) => void,
  deleteProtocol: (id) => void,
  clearAllProtocols: () => Promise<void>,

  // Selectors
  getProtocolsByType: (type) => Protocol[],
  getProtocolById: (id) => Protocol | undefined
}
```

### Protocol Object

```typescript
{
  id: string,                     // Auto-generated if not provided
  type: 'stain' | 'region',       // Required
  name: string,                    // Required
  description?: string,
  // ... any other fields specific to stain or region
}
```

## 🔧 Custom Storage

Want to store protocols in a database or DSA server? Easy:

```javascript
class MyCustomStorage {
  async load() {
    const response = await fetch('/api/protocols');
    return response.json();
  }

  async save(protocols) {
    await fetch('/api/protocols', {
      method: 'POST',
      body: JSON.stringify(protocols)
    });
  }

  async clear() {
    await fetch('/api/protocols', { method: 'DELETE' });
  }
}

// Use it
<ProtocolProvider storage={new MyCustomStorage()}>
  <App />
</ProtocolProvider>
```

## 🎯 Examples

### Add a Stain Protocol

```javascript
const { addProtocol } = useProtocols();

addProtocol({
  type: 'stain',
  name: 'H&E',
  stainType: 'Histology',
  technique: 'Standard',
  description: 'Hematoxylin and Eosin'
});
```

### Update a Protocol

```javascript
const { updateProtocol } = useProtocols();

updateProtocol({
  id: 'protocol-123',
  name: 'Updated Name',
  description: 'New description'
});
```

### Filter and Display

```javascript
const { stainProtocols, regionProtocols } = useProtocols();

return (
  <div>
    <h2>Stains</h2>
    {stainProtocols.map(p => <ProtocolCard key={p.id} protocol={p} />)}
    
    <h2>Regions</h2>
    {regionProtocols.map(p => <ProtocolCard key={p.id} protocol={p} />)}
  </div>
);
```

## 🔄 Migration from Old System

**Old (Wonky):**
```javascript
// Multiple pieces of state
const [stainProtocols, setStainProtocols] = useState([]);
const [regionProtocols, setRegionProtocols] = useState([]);

// Manual subscriptions
useEffect(() => {
  const unsubscribe = protocolStore.subscribe(() => {
    setStainProtocols(protocolStore.stainProtocols);
    setRegionProtocols(protocolStore.regionProtocols);
  });
  return unsubscribe;
}, []);

// Class-based methods
protocolStore.addStainProtocol(newProtocol);
protocolStore.saveStainProtocols();
```

**New (Clean):**
```javascript
// ONE hook
const { stainProtocols, regionProtocols, addProtocol } = useProtocols();

// Just use it
addProtocol({ type: 'stain', name: 'H&E' });
// Auto-saves!
```

## 📚 Features

- ✅ Single source of truth
- ✅ Automatic persistence
- ✅ Type-safe (TypeScript ready)
- ✅ Fully tested
- ✅ Storage abstraction
- ✅ Default IGNORE protocols
- ✅ React Hooks API
- ✅ No manual subscriptions
- ✅ Clean, modern code

---

**That's it!** No more wonky state management. Just one hook. 🎉


