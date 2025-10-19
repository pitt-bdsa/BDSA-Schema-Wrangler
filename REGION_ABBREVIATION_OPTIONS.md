# BDSA Schema Abbreviation Options

This document compares different abbreviation options for stain types and brain regions in the BDSA schema. Please review and provide feedback on which style to adopt.

## Current Status
- **Option A (Short)**: Currently in `schema-viewer-app` and documented in `SCHEMA_ABBREVIATIONS.md`
- **Option B (Longer)**: Currently in `wrangler/public/bdsa-schema.json` (the source schema)

---

## Stain Abbreviations

### Comparison Table

| # | Stain Name | Option A (Short) | Option B (Longer) | Status |
|---|------------|------------------|-------------------|--------|
| 1 | TDP-43 | TDP | TDP | ✅ Same in both |
| 2 | Alpha Synuclein | aSyn | aSyn | ✅ Same in both |
| 3 | Hematoxylin and Eosin | HE | HE | ✅ Same in both |
| 4 | Silver Stain | Silver | Silver | ✅ Same in both |
| 5 | Thioflavin | ThioS | ThioS | ✅ Same in both |
| 6 | Tau | Tau | Tau | ✅ Same in both |
| 7 | Amyloid Beta | Aβ | Aβ | ✅ Same in both |
| 8 | Luxol Fast Blue | LFB | LFB | ✅ Same in both |
| 9 | Glial Fibrillary Acidic Protein | GFAP | GFAP | ✅ Same in both |
| 10 | Ionized Calcium-Binding Adapter Molecule 1 | IBA1 | IBA1 | ✅ Same in both |
| 11 | Neuronal Nuclei | NeuN | NeuN | ✅ Same in both |

**Summary**: All 11 stain abbreviations match perfectly! ✅

### Stain Abbreviation Analysis

**Good news**: All stain abbreviations are already consistent across both schemas. These are well-established, standard abbreviations used in neuropathology:
- Many use established acronyms (GFAP, IBA1, NeuN, LFB)
- Some use chemical names (ThioS for Thioflavin S)
- Protein abbreviations follow scientific conventions (TDP, aSyn, Aβ)

**No action needed for stains** - they're already standardized!

---

## Brain Region Abbreviations

## Comparison Table

| # | Region Name | Option A (Short) | Option B (Longer) | Notes |
|---|------------|------------------|-------------------|-------|
| 1 | Olfactory Bulb | OB | OB | ✅ Same in both |
| 2 | Parietal Lobe | PL | Par | |
| 3 | Temporal Pole | TP | TempPole | |
| 4 | Frontal Lobe | FL | Frntl | |
| 5 | Temporal Lobe | TL | Temp | |
| 6 | Hippocampus | HP | Hipp | |
| 7 | Anterior Cingulate | ACg | ACg | ✅ Same in both |
| 8 | Posterior Cingulate | PCg | PCg | ✅ Same in both |
| 9 | Amygdala | Amy | Amyg | |
| 10 | Thalamus | Thal | Thal | ✅ Same in both |
| 11 | White Matter | WM | WM | ✅ Same in both |
| 12 | Midbrain | MB | MidBrn | |
| 13 | Pons | Pons | Pons | ✅ Same in both |
| 14 | Medulla | Med | Med | ✅ Same in both |
| 15 | Cerebellum | Cb | Cblm | |
| 16 | Basal Ganglia | BG | BG | ✅ Same in both |
| 17 | Occipital Lobe | OL | Occ | |
| 18 | Primary Motor Cortex | M1 | M1 | ✅ Same in both |
| 19 | Insula | Ins | Ins | ✅ Same in both |
| 20 | Frontal Pole | FP | FtlPole | |
| 21 | Spinal Cord | SC | SpnCd | |
| 22 | Hypothalamus | Hyp | Hyp | ✅ Same in both |

**Summary**: 11 regions match, 11 regions differ

## Considerations

### Option A (Short) - Pros
- Very concise (mostly 2-3 characters)
- Easier to use in tight UI spaces
- Shorter filenames when used in naming conventions
- Common in literature (e.g., HP for hippocampus)
- More consistent length across all regions

### Option A (Short) - Cons
- May be less immediately recognizable
- Some abbreviations could be ambiguous without context (PL, FL, TL, OL)

### Option B (Longer) - Pros
- More recognizable at a glance
- Less ambiguous (TempPole vs TP, Frntl vs FL)
- Clearer for people less familiar with neuroanatomy
- More self-documenting in code

### Option B (Longer) - Cons
- Variable length (2-8 characters)
- Takes more space in UIs and filenames
- Less consistent across regions (some very short, some longer)
- May not match standard neuroanatomy abbreviations

## Use Cases to Consider

1. **File Naming**: `BDSA1.33_HP_HE_001.svs` vs `BDSA1.33_Hipp_HE_001.svs`
2. **UI Tables**: Column headers with limited space
3. **Protocol Names**: `HP_HE_Protocol_001` vs `Hipp_HE_Protocol_001`
4. **Data Export**: CSV column headers
5. **Literature Alignment**: How do published papers abbreviate these regions?
6. **International Collaboration**: Which is more universally understood?

## Alternative: Hybrid Approach?

Consider a third option that takes the best of both:
- Keep very short, standard abbreviations where they exist (M1, WM, BG)
- Use slightly longer but still compact forms for others (Hipp, Temp, Cblm)
- Aim for 2-4 characters consistently

## Recommendations Needed

Please provide feedback on:

1. **Overall preference**: Option A (short), Option B (longer), or hybrid?
2. **Specific concerns**: Are any particular abbreviations problematic?
3. **Context**: Which abbreviations are you most comfortable with from your work?
4. **Standards**: Do any medical/neuroanatomy standards we should follow?

## Voting Template

Copy and fill out:

```
Reviewer: [Your Name]
Date: [Date]

=== STAINS ===
Stain abbreviations: [ ] All good as-is (recommended)
Comments on stains:
[Any concerns about stain abbreviations?]

=== REGIONS ===
Overall Preference: [ ] Option A (Short)  [ ] Option B (Longer)  [ ] Hybrid

Specific preferences (if different from overall):
- Parietal Lobe: [ ] PL  [ ] Par
- Temporal Pole: [ ] TP  [ ] TempPole
- Frontal Lobe: [ ] FL  [ ] Frntl
- Temporal Lobe: [ ] TL  [ ] Temp
- Hippocampus: [ ] HP  [ ] Hipp
- Amygdala: [ ] Amy  [ ] Amyg
- Midbrain: [ ] MB  [ ] MidBrn
- Cerebellum: [ ] Cb  [ ] Cblm
- Occipital Lobe: [ ] OL  [ ] Occ
- Frontal Pole: [ ] FP  [ ] FtlPole
- Spinal Cord: [ ] SC  [ ] SpnCd

Comments on regions:
[Your thoughts here]
```

## Next Steps

Once consensus is reached:

### For Stains (if any changes)
- Currently all consistent - no action needed unless team wants changes

### For Regions (choose one option)
1. Update the source schema in `apps/wrangler/public/bdsa-schema.json` with chosen abbreviations
2. Run the schema-viewer build script to sync changes: `cd apps/schema-viewer-app && ./build.sh`
3. Update `SCHEMA_ABBREVIATIONS.md` documentation
4. Update any code that may reference these abbreviations
5. Test both wrangler and schema-viewer apps
6. Announce the standardization to the team

## Implementation Impact

### Files that will need updates:
- `apps/wrangler/public/bdsa-schema.json` (source of truth)
- `apps/schema-viewer-app/public/bdsa-schema.json` (auto-synced via build.sh)
- `apps/schema-viewer-app/SCHEMA_ABBREVIATIONS.md` (documentation)

### Files that might reference abbreviations:
- `apps/wrangler/src/components/RegionProtocolMapping.jsx`
- `apps/wrangler/src/components/StainProtocolMapping.jsx`
- `apps/wrangler/src/utils/protocolStore.js`
- Any UI components displaying abbreviations
- Any filename generation code

### Testing checklist:
- [ ] Schema viewer displays correct abbreviations
- [ ] Wrangler protocol mappings work correctly
- [ ] File naming conventions use correct abbreviations
- [ ] Metadata sync preserves abbreviations
- [ ] Documentation matches implementation

