# BDSA Schema Abbreviations

## Overview
Standard abbreviations have been added to all stain types and brain regions in the BDSA schema. These abbreviations provide a consistent, concise way to reference these elements across the system.

## Stain Abbreviations

| Full Name | Abbreviation | Schema Key |
|-----------|--------------|------------|
| TDP-43 | TDP | `TDP-43` |
| Alpha Synuclein | aSyn | `aSyn` |
| Hematoxylin and Eosin | HE | `HE` |
| Silver Stain | Silver | `Silver` |
| Thioflavin | ThioS | `Thioflavin` |
| Tau | Tau | `Tau` |
| Amyloid Beta | Aβ | `aBeta` |
| Luxol Fast Blue | LFB | `LFB` |
| Glial Fibrillary Acidic Protein | GFAP | `GFAP` |
| Ionized Calcium-Binding Adapter Molecule 1 | IBA1 | `IBA1` |
| Neuronal Nuclei | NeuN | `NeuN` |

## Brain Region Abbreviations

| Full Name | Abbreviation | Schema Key |
|-----------|--------------|------------|
| Olfactory Bulb | OB | `Olfactory Bulb` |
| Parietal Lobe | PL | `Parietal Lobe` |
| Temporal Pole | TP | `Temporal Pole` |
| Frontal Lobe | FL | `Frontal Lobe` |
| Temporal Lobe | TL | `Temporal Lobe` |
| Hippocampus | HP | `Hippocampus` |
| Anterior Cingulate | ACg | `Anterior Cingulate` |
| Posterior Cingulate | PCg | `Posterior Cingulate` |
| Amygdala | Amy | `Amygdala` |
| Thalamus | Thal | `Thalamus` |
| White Matter | WM | `White Matter` |
| Midbrain | MB | `Midbrain` |
| Pons | Pons | `Pons` |
| Medulla | Med | `Medulla` |
| Cerebellum | Cb | `Cerebellum` |
| Basal Ganglia | BG | `Basal Ganglia` |
| Occipital Lobe | OL | `Occipital Lobe` |
| Primary Motor Cortex | M1 | `Primary Motor Cortex` |
| Insula | Ins | `Insula` |
| Frontal Pole | FP | `Frontal Pole` |
| Spinal Cord | SC | `Spinal Cord` (Lower, Middle, Upper) |
| Hypothalamus | Hyp | `Hypothalamus` |

## Schema Structure

### Stain Abbreviation Example
```json
{
  "TDP-43": {
    "type": "object",
    "title": "TDP-43",
    "abbreviation": "TDP",
    "properties": {
      // ... stain properties
    }
  }
}
```

### Region Abbreviation Example
```json
{
  "Hippocampus": {
    "type": "array",
    "title": "Hippocampus",
    "abbreviation": "HP",
    "items": {
      // ... region sub-types
    }
  }
}
```

## Usage

### Accessing Abbreviations Programmatically

#### For Stains:
```javascript
const schema = require('./bdsa-schema.json');
const stainItems = schema.properties.stainIDs.items.properties;

Object.entries(stainItems).forEach(([key, stain]) => {
  console.log(`${stain.title}: ${stain.abbreviation}`);
});
// Output: TDP-43: TDP
//         Alpha Synuclein: aSyn
//         etc.
```

#### For Regions:
```javascript
const regionItems = schema.properties.regionIDs.properties.regions.properties;

Object.entries(regionItems).forEach(([key, region]) => {
  console.log(`${region.title}: ${region.abbreviation}`);
});
// Output: Olfactory Bulb: OB
//         Parietal Lobe: PL
//         etc.
```

## Benefits

### 1. **Consistent Naming**
- Standard abbreviations across all tools and documentation
- No ambiguity about how to abbreviate region or stain names

### 2. **Concise Display**
- Useful for UI elements with limited space
- Better for table columns and compact views
- Easier to read in filename conventions

### 3. **Data Harmonization**
- Facilitates integration with other systems
- Common vocabulary for cross-institutional collaboration
- Matches conventions used in neuropathology literature

### 4. **File Naming**
- Can be used in slide naming conventions
- Example: `BDSA1.33_HP_HE_001.svs`
  - `HP` = Hippocampus (region abbreviation)
  - `HE` = Hematoxylin and Eosin (stain abbreviation)

## Implementation Notes

### JSON Schema Field
The `abbreviation` field is added as a custom property to each stain and region definition:

```json
{
  "abbreviation": "HP"
}
```

This field is:
- **Not a standard JSON Schema keyword** (it's a custom annotation)
- **Available for use by applications** consuming the schema
- **Ignored by standard JSON Schema validators** (treated as annotation)

### Future Enhancements

Potential uses for these abbreviations:

1. **Protocol Naming**
   - When creating protocols in the wrangler app, use abbreviations as defaults
   - Example protocol name: `HP_HE_Protocol_001`

2. **CDE Mapping**
   - Link abbreviations to Common Data Elements
   - Include in CDE reference views

3. **Data Export**
   - Use abbreviations in CSV headers
   - Simplify column names in exported data

4. **Search and Filter**
   - Allow users to search by abbreviation
   - Quick filters like "Show all HP slides" (Hippocampus)

5. **Visualization**
   - Use abbreviations in charts and graphs
   - Region/stain heatmaps with concise labels

## Validation

To validate that all stains and regions have abbreviations:

```javascript
const schema = require('./bdsa-schema.json');

// Check stains
const stains = schema.properties.stainIDs.items.properties;
const stainsWithoutAbbr = Object.entries(stains)
  .filter(([key, stain]) => !stain.abbreviation)
  .map(([key]) => key);

if (stainsWithoutAbbr.length > 0) {
  console.error('Stains missing abbreviations:', stainsWithoutAbbr);
}

// Check regions
const regions = schema.properties.regionIDs.properties.regions.properties;
const regionsWithoutAbbr = Object.entries(regions)
  .filter(([key, region]) => !region.abbreviation)
  .map(([key]) => key);

if (regionsWithoutAbbr.length > 0) {
  console.error('Regions missing abbreviations:', regionsWithoutAbbr);
}
```

## Update History

- **2024-10**: Initial addition of abbreviations to all stains and regions
  - All 11 stain types now have abbreviations
  - All 22 brain regions now have abbreviations
  - Full names updated for clarity (e.g., "HE" → "Hematoxylin and Eosin")

