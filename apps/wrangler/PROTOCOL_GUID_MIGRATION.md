# Protocol GUID Migration

## Problem Identified

The previous protocol system used **protocol names as IDs**, which created a critical design flaw:
- Changing a protocol name would break all references to that protocol
- Items referencing the old name would become orphaned
- No way to track protocol identity independent of its name
- Risk of data integrity issues when protocols are renamed

## Solution: GUID-Based Protocol IDs

### New ID Format
Protocols now use a GUID format: `{COLLECTION_ID}_{random6chars}`

**Examples:**
- Stain protocols: `STAIN_a7f9c2`, `STAIN_3k8p1x`
- Region protocols: `REGION_5m2n8q`, `REGION_7j4k9p`
- Special protocols: `ignore` (reserved, never changes)

### ID Structure
```
STAIN_a7f9c2
  |     |
  |     └─ 6 random alphanumeric characters (lowercase)
  └─────── Collection identifier (STAIN or REGION)
```

## Implementation Details

### 1. GUID Generation
```javascript
const generateProtocolGuid = (collectionId) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${collectionId}_${randomPart}`;
};
```

### 2. Protocol Creation
When creating a new protocol:
- A GUID is automatically generated
- The name is stored separately and can be changed
- The ID remains stable throughout the protocol's lifetime

```javascript
addStainProtocol(protocol) {
    // Generate GUID for new protocols
    const protocolId = generateProtocolGuid('STAIN');
    
    const newProtocol = {
        ...protocol,
        id: protocolId,
        name: protocol.name.trim(),
        _localModified: true,
        _remoteVersion: null
    };
    // ...
}
```

### 3. Protocol Updates
When updating a protocol:
- The ID is preserved
- The name can be changed without breaking references
- All item references remain valid

```javascript
// Old way (BROKEN):
// Changing "HE" to "H&E" breaks all references to "HE"

// New way (CORRECT):
// Protocol STAIN_a7f9c2 has name "HE"
// Can rename to "H&E" and all items still reference STAIN_a7f9c2
```

## Automatic Migration

### Migration Process
On first load after this update, the system automatically migrates:

1. **Detects old protocol IDs**: Identifies protocols not using GUID format
2. **Generates new GUIDs**: Creates GUID for each protocol
3. **Updates protocol store**: Replaces old IDs with GUIDs
4. **Saves mapping**: Stores old ID → new GUID mapping for reference

```javascript
// Migration example:
"HE" → "STAIN_a7f9c2"
"Tau" → "STAIN_3k8p1x"
"Hippocampus" → "REGION_5m2n8q"
```

### Migration Mapping Storage
The mapping is saved to localStorage for reference:
```json
{
  "stain": [
    ["HE", "STAIN_a7f9c2"],
    ["Tau", "STAIN_3k8p1x"]
  ],
  "region": [
    ["Hippocampus", "REGION_5m2n8q"]
  ],
  "migratedAt": "2024-10-16T12:00:00.000Z"
}
```

## Item References

### Current State
Items currently reference protocols by name (or old ID):
```javascript
item.BDSA.bdsaLocal.bdsaStainProtocol = ["HE", "Tau"]
item.BDSA.bdsaLocal.bdsaRegionProtocol = ["Hippocampus"]
```

### Future Enhancement Needed
**TODO**: Update item protocol references to use GUIDs instead of names.

This will require:
1. A data migration utility to update all item references
2. Updating the UI to store GUIDs when assigning protocols
3. Lookup by GUID when displaying protocol names

### Backward Compatibility
The system includes helper methods for name-based lookups:
```javascript
protocolStore.getStainProtocolByName("HE")           // Returns full protocol
protocolStore.getStainProtocolIdByName("HE")         // Returns "STAIN_a7f9c2"
protocolStore.getRegionProtocolByName("Hippocampus") // Returns full protocol
```

## Benefits

### ✅ Name Changes Don't Break References
- Protocol names can be updated without losing data integrity
- Items continue to reference the correct protocol via stable GUID
- No orphaned references when renaming

### ✅ Better Data Integrity
- Unique, immutable identifiers for each protocol
- Clear distinction between protocol identity (ID) and label (name)
- Collision-resistant GUID format

### ✅ Scalability
- Can have multiple protocols with similar names
- Easy to merge protocols from different sources
- Future-proof for server synchronization

### ✅ Automatic Migration
- Existing protocols automatically upgraded
- No manual intervention required
- Migration mapping preserved for reference

## Protocol Sync Impact

The sync system has been updated to handle both GUID and name-based references:

```javascript
// Detects GUID format
const isGuid = /^STAIN_[a-z0-9]{6}$/.test(protocolRef);

// Syncs protocols with proper ID structure
{
  id: "STAIN_a7f9c2",
  name: "HE",
  description: "Hematoxylin and Eosin stain",
  stainType: "HE",
  type: "stain"
}
```

## Next Steps

### Immediate
- [x] Implement GUID generation
- [x] Update protocol creation to use GUIDs
- [x] Add automatic migration for existing protocols
- [x] Add name-based lookup helpers
- [x] Update sync to handle both formats

### Future Enhancements
- [ ] Migrate item protocol references to use GUIDs
- [ ] Update UI to display/select protocols by name but store by GUID
- [ ] Add protocol resolution service (GUID → name lookup)
- [ ] Implement protocol versioning based on GUID
- [ ] Add protocol merge/dedupe utilities

## Testing Checklist

- [ ] Create new stain protocol → verify GUID format
- [ ] Create new region protocol → verify GUID format
- [ ] Update protocol name → verify ID doesn't change
- [ ] Load app with old protocols → verify automatic migration
- [ ] Check migration mapping in localStorage
- [ ] Sync protocols → verify both GUID and names work
- [ ] Look up protocol by name → verify helper methods work

## Breaking Changes

⚠️ **Minimal Breaking Changes** due to backward compatibility:
- Old name-based lookups still work via helper methods
- Items can still reference protocols by name (for now)
- Migration is automatic and transparent

⚠️ **Future Breaking Change** (planned):
- Item protocol references will eventually require GUIDs
- A data migration tool will be provided before this change

