# Protocol Components - Usage Example

## Complete Working Example

Here's how simple it is to use the new protocol system:

```javascript
import React from 'react';
import {
  ProtocolProvider,
  useProtocols,
  ProtocolList
} from '@bdsa/protocol-components';

// Your main app wrapper
function App() {
  return (
    <ProtocolProvider>
      <ProtocolTab />
    </ProtocolProvider>
  );
}

// Your protocol tab component
function ProtocolTab() {
  const {
    stainProtocols,
    regionProtocols,
    addProtocol,
    updateProtocol,
    deleteProtocol,
    loading
  } = useProtocols();

  const [showModal, setShowModal] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [activeType, setActiveType] = React.useState('stain');

  if (loading) return <div>Loading protocols...</div>;

  const currentProtocols = activeType === 'stain' ? stainProtocols : regionProtocols;

  return (
    <div>
      {/* Tab switcher */}
      <div className="tabs">
        <button onClick={() => setActiveType('stain')}>
          Stain Protocols ({stainProtocols.length})
        </button>
        <button onClick={() => setActiveType('region')}>
          Region Protocols ({regionProtocols.length})
        </button>
      </div>

      {/* Protocol list */}
      <ProtocolList
        protocols={currentProtocols}
        type={activeType}
        onAdd={() => {
          setEditing(null);
          setShowModal(true);
        }}
        onEdit={(protocol) => {
          setEditing(protocol);
          setShowModal(true);
        }}
        onDelete={(protocol) => {
          if (confirm(`Delete protocol "${protocol.name}"?`)) {
            deleteProtocol(protocol.id);
          }
        }}
      />

      {/* Modal for add/edit */}
      {showModal && (
        <ProtocolModal
          protocol={editing}
          type={activeType}
          onSave={(data) => {
            if (editing) {
              updateProtocol({ ...editing, ...data });
            } else {
              addProtocol({ type: activeType, ...data });
            }
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

## That's It!

**Compare to the old way:**

### Old (Wonky) 😵
```javascript
// Multiple pieces of state
const [stainProtocols, setStainProtocols] = useState([]);
const [regionProtocols, setRegionProtocols] = useState([]);
const [syncStatus, setSyncStatus] = useState({});

// Manual subscriptions
useEffect(() => {
  const unsubscribe = protocolStore.subscribe(() => {
    setStainProtocols(protocolStore.stainProtocols);
    setRegionProtocols(protocolStore.regionProtocols);
    setSyncStatus({
      lastSync: protocolStore.lastSync,
      hasLocalChanges: protocolStore.getModifiedProtocols().stain.length > 0
    });
  });
  return unsubscribe;
}, []);

// Class-based methods
const handleAdd = (protocol) => {
  if (type === 'stain') {
    protocolStore.addStainProtocol(protocol);
  } else {
    protocolStore.addRegionProtocol(protocol);
  }
  protocolStore.saveStainProtocols();
  protocolStore.saveRegionProtocols();
};
```

### New (Clean) ✨
```javascript
// ONE hook
const { stainProtocols, addProtocol } = useProtocols();

// Just use it
addProtocol({ type: 'stain', name: 'H&E' });
// Auto-saves!
```

## Features You Get

✅ **Single source of truth**  
✅ **Automatic persistence**  
✅ **Type filtering built-in**  
✅ **Loading states handled**  
✅ **Clean UI components**  
✅ **Fully tested (8 tests passing)**  
✅ **No manual subscriptions**  
✅ **Storage abstraction**

## Props Reference

### ProtocolList

| Prop | Type | Description |
|------|------|-------------|
| `protocols` | `Array` | Array of protocol objects |
| `type` | `'stain' \| 'region'` | Protocol type |
| `onAdd` | `Function` | Callback when add clicked |
| `onEdit` | `Function` | Callback when edit clicked |
| `onDelete` | `Function` | Callback when delete clicked |
| `readOnly` | `boolean` | Hide edit/delete buttons (default: false) |
| `showSync` | `boolean` | Show sync status badges (default: true) |
| `title` | `string` | Custom title (optional) |
| `description` | `string` | Custom description (optional) |

### ProtocolCard

| Prop | Type | Description |
|------|------|-------------|
| `protocol` | `Object` | Protocol object |
| `onEdit` | `Function` | Callback when edit clicked |
| `onDelete` | `Function` | Callback when delete clicked |
| `readOnly` | `boolean` | Hide edit/delete buttons (default: false) |
| `showSync` | `boolean` | Show sync status badge (default: true) |

### useProtocols Hook

Returns:
```typescript
{
  // State
  protocols: Protocol[],
  stainProtocols: Protocol[],
  regionProtocols: Protocol[],
  loading: boolean,
  error: string | null,
  
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


