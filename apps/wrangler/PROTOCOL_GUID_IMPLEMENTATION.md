# Protocol GUID Implementation - Complete Strategy

## Design Principle 🎯

**GUIDs are for internal tracking only. DSA always stores human-readable protocol names.**

### Why This Approach?

- **GUIDs internally** = Stable references that survive protocol renames
- **Names externally** = Human-readable metadata in DSA
- **Best of both worlds** = Flexibility + Clarity

## Architecture

### Internal Storage (Wrangler App)
```javascript
// In wrangler app processedData
item.BDSA.bdsaLocal.bdsaStainProtocol = [
    "STAIN_a7f9c2",    // GUID for "HE"
    "STAIN_3k8p1x"     // GUID for "Tau"
]
```

### External Storage (DSA Metadata)
```json
{
  "meta": {
    "BDSA": {
      "bdsaLocal": {
        "bdsaStainProtocol": ["HE", "Tau"],
        "bdsaRegionProtocol": ["Hippocampus", "Frontal Lobe"]
      }
    }
  }
}
```

### UI Display
```javascript
// Show protocol names (looked up from GUIDs)
const displayName = protocolStore.getProtocolName(protocolGuid, 'stain');
// Result: "HE" (not "STAIN_a7f9c2")
```

## Implementation Flow

### 1. Protocol Creation
```javascript
// User creates protocol "HE"
protocolStore.addStainProtocol({
    name: "Hematoxylin and Eosin",
    // ... other properties
});

// Protocol store generates GUID
{
    id: "STAIN_a7f9c2",        // ← GUID (stable, never changes)
    name: "Hematoxylin and Eosin", // ← Name (can be renamed)
    abbreviation: "HE",
    // ...
}
```

### 2. Protocol Assignment
```javascript
// User applies protocol to slide
// UI passes protocol.id (GUID)
dataStore.addProtocolMapping(caseId, slideId, "STAIN_a7f9c2", 'stain');

// Stored in item
item.BDSA.bdsaLocal.bdsaStainProtocol.push("STAIN_a7f9c2");
```

### 3. DSA Sync (GUID → Name Resolution)
```javascript
// Before syncing to DSA, resolve GUIDs to names
const resolveProtocolToNames = (protocolRefs, protocolType, protocolStore) => {
    return protocolRefs.map(ref => {
        const isGuid = /^(STAIN|REGION)_[a-z0-9]{6}$/.test(ref);
        
        if (isGuid) {
            const protocol = protocolStore.find(p => p.id === ref);
            return protocol ? protocol.name : ref; // Name or fallback
        }
        return ref; // Already a name
    });
};

// Result sent to DSA
{
    bdsaStainProtocol: ["Hematoxylin and Eosin", "Tau"]  // Names, not GUIDs!
}
```

### 4. Loading from DSA (Name → GUID Resolution)
```javascript
// When loading from DSA (future implementation)
const resolveProtocolToIds = (protocolNames, protocolType, protocolStore) => {
    return protocolNames.map(name => {
        const protocol = protocolStore.getProtocolByName(name, protocolType);
        return protocol ? protocol.id : name; // GUID or fallback
    });
};

// Result in wrangler app
item.BDSA.bdsaLocal.bdsaStainProtocol = [
    "STAIN_a7f9c2",  // GUID resolved from "Hematoxylin and Eosin"
    "STAIN_3k8p1x"   // GUID resolved from "Tau"
];
```

### 5. Protocol Rename Scenario
```javascript
// User renames protocol
protocolStore.updateStainProtocol("STAIN_a7f9c2", {
    name: "H&E"  // Changed from "Hematoxylin and Eosin"
});

// Internal references stay the same (GUID doesn't change)
item.BDSA.bdsaLocal.bdsaStainProtocol = ["STAIN_a7f9c2"];  // ✅ Still valid!

// Next sync to DSA resolves to new name
bdsaLocal: {
    bdsaStainProtocol: ["H&E"]  // ✅ Updated name synced to DSA
}
```

## Current Implementation Status

### ✅ Completed

1. **Protocol Store with GUIDs**
   - GUIDs generated for new protocols
   - Format: `STAIN_xxxxxx`, `REGION_xxxxxx`
   - Auto-migration from old name-based IDs

2. **UI Passes GUIDs**
   - `StainProtocolMapping.jsx` uses `protocol.id`
   - `RegionProtocolMapping.jsx` uses `protocol.id`
   - Protocol buttons pass GUIDs

3. **GUID → Name Resolution on Sync**
   - `DsaMetadataManager.js` resolves GUIDs to names
   - DSA receives protocol names (human-readable)
   - Backward compatible (handles both GUIDs and names)

4. **Collection-Aware Storage**
   - Protocols isolated per collection
   - Switching collections loads correct protocols

### ⚠️ Partial/In Progress

5. **UI Protocol Checks**
   - Some checks still use `protocol.name`
   - Need to handle both GUIDs and names
   - Filter logic needs updating

6. **Suggestion Engine**
   - Currently returns protocol names
   - Needs to return GUIDs for internal use
   - Keep names for display

### ❌ Not Yet Implemented

7. **Name → GUID Resolution (Loading from DSA)**
   - When loading data, convert names to GUIDs
   - Ensures internal consistency
   - Future enhancement

8. **Full Protocol Object Storage**
   - Planned: Store entire protocol with each item
   - Not implemented yet (intentional)
   - Will add after current system stabilizes

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    WRANGLER APP                         │
│                                                         │
│  Protocol Store:                                        │
│  ┌──────────────────────────────────────────┐         │
│  │ STAIN_a7f9c2 → { name: "HE", ... }       │         │
│  │ STAIN_3k8p1x → { name: "Tau", ... }      │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  Item Data:                                            │
│  ┌──────────────────────────────────────────┐         │
│  │ bdsaStainProtocol: [                     │         │
│  │   "STAIN_a7f9c2",  ← GUIDs stored        │         │
│  │   "STAIN_3k8p1x"                          │         │
│  │ ]                                         │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│                    ↓ DSA SYNC                          │
│              (Resolve GUID → Name)                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────┐
│                    DSA METADATA                         │
│                                                         │
│  {                                                      │
│    "meta": {                                           │
│      "BDSA": {                                         │
│        "bdsaLocal": {                                  │
│          "bdsaStainProtocol": [                        │
│            "HE",      ← Names stored (human-readable)  │
│            "Tau"                                        │
│          ]                                              │
│        }                                               │
│      }                                                 │
│    }                                                   │
│  }                                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Benefits

### ✅ Internal Flexibility
- Rename protocols without breaking item references
- GUIDs provide stable, unchanging identifiers
- Protocol refactoring is safe

### ✅ External Clarity  
- DSA metadata shows human-readable names
- No confusing GUIDs in exported data
- Compatible with other systems expecting names

### ✅ Backward Compatible
- Handles both GUIDs and names gracefully
- Existing name-based references still work
- Smooth migration path

### ✅ Future-Proof
- Ready for full protocol object storage
- Extensible to more complex protocol definitions
- Collection-aware from the start

## Testing Scenarios

### Scenario 1: Create and Apply Protocol
```
1. Create protocol "HE" → Gets GUID "STAIN_a7f9c2"
2. Apply to slide → Stores "STAIN_a7f9c2" in item
3. Sync to DSA → DSA receives "HE" (name)
✅ DSA metadata shows: ["HE"]
```

### Scenario 2: Rename Protocol
```
1. Protocol "HE" has GUID "STAIN_a7f9c2"
2. Item references "STAIN_a7f9c2"
3. Rename protocol to "H&E"
4. Sync to DSA → Resolves GUID → DSA receives "H&E"
✅ DSA metadata shows: ["H&E"] (updated!)
✅ Item reference still valid (GUID unchanged)
```

### Scenario 3: Load from DSA (Future)
```
1. DSA has: ["H&E", "Tau"]
2. Load into wrangler
3. Resolve names to GUIDs → ["STAIN_a7f9c2", "STAIN_3k8p1x"]
4. Internal storage uses GUIDs
✅ Consistent with locally created items
```

### Scenario 4: Mixed References (Transition Period)
```
1. Old item: bdsaStainProtocol = ["HE", "Tau"] (names)
2. New item: bdsaStainProtocol = ["STAIN_a7f9c2", "STAIN_3k8p1x"] (GUIDs)
3. Sync both → Resolver handles both:
   - Names pass through as-is
   - GUIDs resolve to names
✅ Both items sync correctly to DSA
```

## Console Output Examples

### Protocol Application
```
✅ Using protocol ID (GUID) for storage: STAIN_a7f9c2
✅ Applied protocol STAIN_a7f9c2 to 3 slides
```

### DSA Sync
```
✅ Resolved protocol GUID STAIN_a7f9c2 → Hematoxylin and Eosin
✅ Resolved protocol GUID STAIN_3k8p1x → Tau
📤 Syncing to DSA: ["Hematoxylin and Eosin", "Tau"]
```

## Next Steps

### Immediate (Current Sprint)
- [x] Protocol store uses GUIDs
- [x] UI passes GUIDs when applying
- [x] GUID → Name resolution on sync
- [ ] Update UI checks to handle both GUIDs and names
- [ ] Update suggestion engine to return GUIDs

### Short Term
- [ ] Implement Name → GUID resolution when loading from DSA
- [ ] Add protocol lookup helpers to UI components
- [ ] Complete display logic for GUID-based storage
- [ ] Comprehensive testing of rename scenarios

### Future Enhancements
- [ ] Store full protocol objects with items
- [ ] Protocol versioning based on GUIDs
- [ ] Protocol change history tracking
- [ ] Advanced protocol metadata

## Key Files

### Core Implementation
- `apps/wrangler/src/utils/protocolStore.js` - GUID generation & storage
- `apps/wrangler/src/utils/DsaMetadataManager.js` - GUID → Name resolution
- `apps/wrangler/src/utils/ProtocolMapper.js` - Protocol assignment

### UI Components
- `apps/wrangler/src/components/StainProtocolMapping.jsx` - Stain UI
- `apps/wrangler/src/components/RegionProtocolMapping.jsx` - Region UI

### Documentation
- `apps/wrangler/PROTOCOL_GUID_MIGRATION.md` - Migration guide
- `apps/wrangler/PROTOCOL_GUID_TRANSITION.md` - Transition status
- `apps/wrangler/PROTOCOL_GUID_IMPLEMENTATION.md` - This document

## Conclusion

The GUID system is **properly designed** with a clear separation:
- **Internal**: GUIDs for stability and rename-safety
- **External**: Names for human readability

The foundation is solid, and the core implementation is complete. The DSA will never see confusing GUIDs - it always receives clean, human-readable protocol names! 🎉

