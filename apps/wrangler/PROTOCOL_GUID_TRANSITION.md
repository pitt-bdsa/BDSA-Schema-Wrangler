# Protocol GUID Transition Status

## Current Status: ⚠️ **Partial Implementation**

The protocol GUID system has been implemented in the protocol store, but the **item metadata still needs to be migrated** to use GUIDs instead of names.

## What's Been Done ✅

### 1. Protocol Store Uses GUIDs
- **Protocol creation**: New protocols get GUIDs like `STAIN_a7f9c2`, `REGION_5m2n8q`
- **Protocol storage**: GUIDs are stored with protocol objects
- **Auto-migration**: Old name-based IDs are automatically converted to GUIDs
- **Collection-aware**: Protocols are isolated per collection using collection-specific storage

### 2. UI Now Passes GUIDs
- **StainProtocolMapping.jsx**: Updated to pass `protocol.id` instead of `protocol.name`
- **RegionProtocolMapping.jsx**: Updated to pass `protocol.id` instead of `protocol.name`
- **Protocol buttons**: Now use `protocol.id` when applying protocols to slides

## What Still Needs Work ⚠️

### 1. Item Metadata Uses Names (Not GUIDs)
**Current behavior:**
- Items store protocol references in arrays: `bdsaStainProtocol`, `bdsaRegionProtocol`
- These arrays currently contain protocol **NAMES**, not **GUIDs**
- Example: `["HE", "Tau"]` instead of `["STAIN_a7f9c2", "STAIN_3k8p1x"]`

**Why this is a problem:**
- If you rename a protocol, items still reference the old name
- The GUID system doesn't help because items aren't using GUIDs
- Protocol references break when protocols are renamed

### 2. UI Checks Still Use Names
**Locations that check protocol arrays by name:**

- **StainProtocolMapping.jsx line 610**:
  ```javascript
  .filter(protocol => !(slide.bdsaStainProtocol || []).includes(protocol.name))
  ```

- **RegionProtocolMapping.jsx line 589**:
  ```javascript
  .filter(protocol => !(slide.bdsaRegionProtocol || []).includes(protocol.name))
  ```

These filters check if `protocol.name` is in the array, but soon the array will contain `protocol.id` (GUIDs).

### 3. Suggestion Engine Returns Names
**SuggestionEngine.js** returns protocol names in the `suggested` field:
```javascript
return {
    suggested: "HE",  // ← This is a protocol NAME, not a GUID
    confidence: 1.0,
    reason: "..."
}
```

When auto-apply suggestions run, they try to apply protocol names, not GUIDs.

### 4. Protocol Display Logic
Many places display protocols by checking names in arrays:
```javascript
const isApplied = slide.bdsaStainProtocol.includes(protocolName);
```

This needs to become:
```javascript
const isApplied = slide.bdsaStainProtocol.includes(protocolId);
```

## Migration Strategy 🔄

### Phase 1: Update Item Storage to Use GUIDs (Current)

**What's happening now:**
- UI passes `protocol.id` (GUID) to `addProtocolMapping()`
- `ProtocolMapper` stores whatever it receives in the item arrays
- **NEW items will get GUIDs**, old items still have names

**Example of mixed state:**
```javascript
// Old item (before fix)
item.BDSA.bdsaLocal.bdsaStainProtocol = ["HE", "Tau"]

// New item (after fix)
item.BDSA.bdsaLocal.bdsaStainProtocol = ["STAIN_a7f9c2", "STAIN_3k8p1x"]
```

### Phase 2: Update UI Checks to Handle Both (NEEDED)

Update all places that check protocols to handle both names and GUIDs:

```javascript
// OLD (only works with names):
.filter(protocol => !slide.bdsaStainProtocol.includes(protocol.name))

// NEW (works with both):
.filter(protocol => {
    const protocolRefs = slide.bdsaStainProtocol || [];
    return !protocolRefs.includes(protocol.id) && 
           !protocolRefs.includes(protocol.name); // backward compat
})
```

### Phase 3: Update Suggestion Engine (NEEDED)

Modify `SuggestionEngine.js` to:
1. Look up protocols by name to find their GUIDs
2. Return GUIDs in the `suggested` field
3. Keep protocol name in a separate field for display

```javascript
// NEEDED UPDATE:
const protocolObj = protocolStore.getStainProtocolByName(mostCommonProtocol);
return {
    suggested: protocolObj?.id,  // ← GUID
    suggestedName: mostCommonProtocol,  // ← Name for display
    confidence: confidence,
    // ...
}
```

### Phase 4: Data Migration Utility (FUTURE)

Create a utility to migrate existing item metadata:
```javascript
// Pseudo-code for migration utility
function migrateItemProtocolReferences(items) {
    items.forEach(item => {
        // Migrate stain protocols
        if (item.BDSA?.bdsaLocal?.bdsaStainProtocol) {
            item.BDSA.bdsaLocal.bdsaStainProtocol = 
                item.BDSA.bdsaLocal.bdsaStainProtocol.map(ref => {
                    const protocol = protocolStore.getStainProtocolByName(ref);
                    return protocol ? protocol.id : ref; // fallback to name if not found
                });
        }
        
        // Migrate region protocols similarly
        // ...
    });
}
```

## Testing Checklist

### Current Functionality (Should Still Work)
- [ ] Create new protocol → gets GUID ✅
- [ ] Apply protocol to slide → stores GUID (for new applications)
- [ ] Display protocol names in UI → still shows names ✅
- [ ] Collection switching → protocols isolated ✅

### Broken/Incomplete Functionality  
- [ ] Protocol applied to slide → UI might not show it's applied (name vs GUID mismatch) ⚠️
- [ ] Auto-suggestions → might apply names instead of GUIDs ⚠️
- [ ] Rename protocol → items still reference old name (partially fixed) ⚠️
- [ ] Filter available protocols → might not correctly filter already-applied ones ⚠️

## Immediate Action Items

### 1. Update Protocol Checks (HIGH PRIORITY)
Files to update:
- `StainProtocolMapping.jsx` (line 610, and others)
- `RegionProtocolMapping.jsx` (line 589, and others)
- Any component that checks `includes(protocol.name)`

### 2. Update Suggestion Engine (HIGH PRIORITY)
Files to update:
- `SuggestionEngine.js` - return GUIDs instead of names
- Both mapping components to handle GUID-based suggestions

### 3. Add Protocol Lookup Helper (MEDIUM PRIORITY)
Create a helper to get protocol name from GUID:
```javascript
// In protocolStore.js
getProtocolName(protocolId, protocolType) {
    const protocols = protocolType === 'stain' ? 
        this.stainProtocols : this.regionProtocols;
    const protocol = protocols.find(p => p.id === protocolId);
    return protocol ? protocol.name : protocolId; // fallback to ID
}
```

### 4. Display Logic Updates (MEDIUM PRIORITY)
Update all display logic to show protocol names even when storing GUIDs:
```javascript
// Display the protocol name by looking up the GUID
const displayName = protocolStore.getProtocolName(protocolId, 'stain');
```

## Current Behavior Summary

### ✅ What Works:
- Protocols have GUIDs
- New protocol assignments use GUIDs
- Collection isolation works
- Protocol renaming updates the protocol store

### ⚠️ What's Broken/Incomplete:
- UI checks for already-applied protocols use names
- Suggestions return names not GUIDs
- Mixed data: old items have names, new items have GUIDs
- Display logic assumes protocol refs are always names

### ❌ What Doesn't Work Yet:
- Renaming a protocol doesn't update item references (the whole point of GUIDs!)
- Auto-suggestions might apply wrong protocols
- Protocol filtering might be incorrect

## Recommendation

**Option 1: Complete the GUID Implementation (RECOMMENDED)**
1. Update all UI checks to handle both names and GUIDs
2. Update suggestion engine to return GUIDs
3. Create migration utility for existing data
4. Test thoroughly before rollout

**Option 2: Revert to Names (NOT RECOMMENDED)**
- Simpler short-term
- Doesn't solve the rename problem
- Loses all GUID benefits

## Files to Update

### High Priority:
1. `apps/wrangler/src/components/StainProtocolMapping.jsx` - Protocol checks
2. `apps/wrangler/src/components/RegionProtocolMapping.jsx` - Protocol checks
3. `apps/wrangler/src/utils/SuggestionEngine.js` - Return GUIDs

### Medium Priority:
4. `apps/wrangler/src/utils/protocolStore.js` - Add lookup helpers
5. `apps/wrangler/src/utils/ProtocolCaseGenerator.js` - Handle GUID display
6. `apps/wrangler/src/components/ProtocolArrayCellRenderer.jsx` - Display names from GUIDs

### Low Priority (Future):
7. Create data migration utility
8. Add admin tools to fix broken references
9. Update documentation

## Conclusion

The GUID system is **partially implemented**. The protocol store works great, but the **item metadata transition is incomplete**. We need to:

1. ✅ **Done**: Protocol store uses GUIDs
2. ✅ **Done**: UI passes GUIDs when applying protocols  
3. ⚠️ **In Progress**: Items store GUIDs (new ones do, old ones don't)
4. ❌ **Not Done**: UI checks for applied protocols by GUID
5. ❌ **Not Done**: Suggestion engine returns GUIDs
6. ❌ **Not Done**: Display logic handles GUIDs properly

**Bottom line:** The foundation is there, but we need to complete the transition to get the full benefit of GUIDs!

