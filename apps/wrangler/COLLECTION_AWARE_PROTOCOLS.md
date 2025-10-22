# Collection-Aware Protocol Storage

## Problem

Protocols were being stored globally in localStorage, which caused a critical issue:
- When loading a new collection/folder, protocols from the **previous collection** would persist
- Users would see stain/region protocols that don't belong to the current collection
- This created confusion and potential data integrity issues

## Root Cause

The protocol store used global localStorage keys:
```javascript
// OLD (BROKEN):
localStorage.setItem('bdsa_stain_protocols', ...)  // Same key for all collections!
localStorage.setItem('bdsa_region_protocols', ...) // Same key for all collections!
```

When switching collections:
1. User loads Collection A → Protocols for A are saved to localStorage
2. User loads Collection B → **Protocols for A are still in localStorage!**
3. User sees protocols from Collection A when working with Collection B ❌

## Solution: Collection-Specific Storage

### Implementation

Protocols are now stored **per collection** using collection-specific localStorage keys:

```javascript
// NEW (CORRECT):
// Collection A
localStorage.setItem('bdsa_stain_protocols_collection_123', ...)
localStorage.setItem('bdsa_region_protocols_collection_123', ...)

// Collection B  
localStorage.setItem('bdsa_stain_protocols_collection_456', ...)
localStorage.setItem('bdsa_region_protocols_collection_456', ...)
```

### Key Components

#### 1. Collection-Specific Key Generation
```javascript
const getCollectionKey = (baseKey, collectionId) => {
    if (!collectionId) return baseKey; // Fallback to global key
    return `${baseKey}_${collectionId}`;
};

// Examples:
getCollectionKey('bdsa_stain_protocols', '123') 
  → 'bdsa_stain_protocols_123'
```

#### 2. Collection Tracking
```javascript
class ProtocolStore {
    constructor() {
        this.currentCollectionId = this.loadCurrentCollectionId();
        // ...
    }
    
    setCurrentCollection(collectionId) {
        // Save current collection's protocols
        // Load new collection's protocols
        // Notify listeners
    }
}
```

#### 3. Automatic Collection Switching
When loading new data, the dataStore automatically switches the protocol collection:

```javascript
// In dataStore.js
const collectionId = sourceInfo?.resourceId || sourceInfo?.collectionId || 'default';
protocolStore.setCurrentCollection(collectionId);
```

### Workflow

#### Loading Collection A
```
1. dataStore.setProcessedData(data, 'dsa', { resourceId: '123' })
2. protocolStore.setCurrentCollection('123')
3. Protocols loaded from 'bdsa_stain_protocols_123'
4. User creates/edits protocols for Collection A
5. Protocols saved to 'bdsa_stain_protocols_123'
```

#### Switching to Collection B
```
1. dataStore.setProcessedData(data, 'dsa', { resourceId: '456' })
2. protocolStore.setCurrentCollection('456')
   - Saves Collection A's protocols to localStorage
   - Loads Collection B's protocols from localStorage
   - If no protocols exist for B, loads defaults
3. User sees only Collection B's protocols ✅
```

#### Returning to Collection A
```
1. dataStore.setProcessedData(data, 'dsa', { resourceId: '123' })
2. protocolStore.setCurrentCollection('123')
3. Protocols for Collection A are loaded from localStorage
4. All previously created protocols are restored ✅
```

## Benefits

### ✅ Complete Isolation
- Each collection has its own set of protocols
- No cross-contamination between collections
- Switching collections is seamless

### ✅ Persistence Per Collection
- Protocols are saved when you leave a collection
- Protocols are restored when you return to a collection
- No need to recreate protocols when switching back

### ✅ Automatic Management
- Collection switching happens automatically when loading data
- No manual intervention required
- Works transparently with existing code

### ✅ Backward Compatible
- Falls back to global storage if no collection ID provided
- Existing protocols are migrated automatically
- No data loss during transition

## Technical Details

### Storage Keys
All protocol-related data is now collection-specific:

```javascript
STORAGE_KEYS = {
    CURRENT_COLLECTION: 'bdsa_current_collection_id',         // Global
    STAIN_PROTOCOLS: 'bdsa_stain_protocols',                  // Per-collection
    REGION_PROTOCOLS: 'bdsa_region_protocols',                // Per-collection
    LAST_SYNC: 'bdsa_protocols_last_sync',                    // Per-collection
    CONFLICTS: 'bdsa_protocols_conflicts',                    // Per-collection
    APPROVED_STAIN: 'bdsa_approved_stain_protocols',          // Per-collection
    APPROVED_REGION: 'bdsa_approved_region_protocols'         // Per-collection
}
```

### Collection ID Sources
Collection ID is determined from (in order of preference):
1. `sourceInfo.resourceId` (DSA folder/collection ID)
2. `sourceInfo.collectionId` (alternative field)
3. `'default'` (fallback for CSV or unknown sources)

### Collection Switching Process
```javascript
setCurrentCollection(newCollectionId) {
    if (currentCollectionId === newCollectionId) return; // No-op
    
    // 1. Save current collection's state
    if (currentCollectionId) {
        saveStainProtocols();      // → bdsa_stain_protocols_{currentId}
        saveRegionProtocols();     // → bdsa_region_protocols_{currentId}
        // ... save all other data
    }
    
    // 2. Update current collection ID
    this.currentCollectionId = newCollectionId;
    saveCurrentCollectionId();
    
    // 3. Load new collection's state
    this.stainProtocols = loadStainProtocols();  // ← bdsa_stain_protocols_{newId}
    this.regionProtocols = loadRegionProtocols(); // ← bdsa_region_protocols_{newId}
    // ... load all other data
    
    // 4. Notify UI
    notify();
}
```

## Example Scenario

### Before (BROKEN)
```
User loads Collection "NACC" with protocols: HE, Tau, aSyn
User loads Collection "ADNI" with protocols: HE, Aβ, GFAP
→ User sees: HE, Tau, aSyn, HE, Aβ, GFAP (mixed!) ❌
```

### After (FIXED)
```
User loads Collection "NACC" (ID: 123)
  → protocolStore.setCurrentCollection('123')
  → Protocols: HE, Tau, aSyn

User loads Collection "ADNI" (ID: 456)
  → protocolStore.setCurrentCollection('456')
  → Saves NACC protocols to localStorage
  → Loads ADNI protocols from localStorage (or defaults if new)
  → Protocols: HE, Aβ, GFAP

User returns to Collection "NACC"
  → protocolStore.setCurrentCollection('123')
  → Loads NACC protocols: HE, Tau, aSyn ✅
```

## Testing

### Manual Testing Checklist
- [ ] Load Collection A, create protocols
- [ ] Load Collection B, verify Collection A protocols are gone
- [ ] Create protocols in Collection B
- [ ] Return to Collection A, verify protocols are restored
- [ ] Check localStorage to see collection-specific keys
- [ ] Load CSV file (uses 'default' collection ID)
- [ ] Switch back to DSA collection

### Console Output
When working correctly, you'll see:
```
📂 Switching collections: 123 → 456
💾 Saving protocols for collection: 123
📂 Loading protocols for collection: 456
✅ Collection switched to: 456 { stainProtocols: 0, regionProtocols: 0 }
```

## Migration Notes

### Existing Users
- First time loading after this update: protocols will be in global storage
- When loading a collection, protocols will migrate to collection-specific storage
- Previous protocols become associated with that collection
- No data loss occurs during migration

### localStorage Keys
Old keys will remain in localStorage but won't be used:
```
bdsa_stain_protocols          ← Old global key (unused)
bdsa_stain_protocols_123      ← New collection-specific key (active)
bdsa_region_protocols         ← Old global key (unused)
bdsa_region_protocols_123     ← New collection-specific key (active)
```

## Related Files

### Modified Files
- `apps/wrangler/src/utils/protocolStore.js` - Collection-aware storage
- `apps/wrangler/src/utils/dataStore.js` - Collection switching trigger

### Key Methods
- `protocolStore.setCurrentCollection(collectionId)` - Switch collections
- `getCollectionKey(baseKey, collectionId)` - Generate collection-specific keys
- `protocolStore.loadStainProtocols()` - Load collection-specific protocols
- `protocolStore.saveStainProtocols()` - Save collection-specific protocols

## Summary

Protocols are now **isolated per collection** with automatic persistence and restoration. When you switch collections, you get a clean slate with only the protocols relevant to that collection. When you return to a previous collection, all your protocols are exactly as you left them.

This ensures data integrity and eliminates confusion from seeing protocols that don't belong to the current collection! 🎉

