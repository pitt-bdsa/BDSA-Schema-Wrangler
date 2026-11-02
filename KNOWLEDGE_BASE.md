# BDSA Schema Wrangler — Knowledge Base

Scanned 29 Aug 2026 from the live submodule. This file is the working map of the current code, not the original design notes.

## What it is

An npm-workspace monorepo (`bdsa-schema-wrangler`) vendored into BDSA as a git submodule:

- Path: `bdsa/services/react/src/submodules/wrangler`
- Remote: `https://github.com/pitt-bdsa/BDSA-Schema-Wrangler` (branch `main`)
- Embedded UI: `bdsa/services/react/src/pages/manage/Wrangler.js` → `/manage/wrangler`
- Access: admin-only manage route

It maps local slide metadata (case / stain / region IDs) onto BDSA identifiers and protocols, then writes that mapping back to Girder item metadata. It is **not** the Girder schema editor used by Case Builder.

## Layout

```
wrangler/
├── apps/
│   ├── wrangler/              # Main React app (Vite + AG Grid)
│   ├── schema-viewer-app/     # Read-only schema explorer + FastAPI
│   └── react-sync-app/        # Folder-to-folder DSA copy (separate from item metadata sync)
├── packages/
│   ├── schema-components/     # SchemaViewer (used by SchemaTab + schema-viewer-app)
│   ├── protocol-components/   # Shared protocol UI (not used by wrangler app)
│   ├── shared-components/     # DSAConfigForm, SyncProgress (declared, unused by wrangler src)
│   ├── shared-utils/
│   └── shared-types/
└── scripts/                   # Python helpers (metadata reset, API tests)
```

Wrangler `package.json` lists `@bdsa/*` workspace packages as dependencies, but `apps/wrangler/src` does **not** import them. The wrangler app uses its own `utils/` copies.

## Apps

### `apps/wrangler` (primary)

Tabs in `App.jsx`:

| Tab | Component | Purpose |
|-----|-----------|---------|
| Input Data | `InputDataTab.jsx` | Load CSV/Excel/DSA, grid, regex, column mapping, accessory files, sync |
| BDSA Schema | `SchemaTab.jsx` | Documentation viewer over `bdsa-schema.json` |
| Protocols | `ProtocolsTab.jsx` | CRUD stain/region protocols; auto-sync to DSA folder |
| Case Management | `CaseManagementTab.jsx` | Local→BDSA case IDs, stain/region protocol assignment |
| Protocol Debug | `ProtocolDebugPanel.jsx` | Debug panel (still in production tab list) |

Header hosts `DsaLogin`. Standalone Vite server is port 3000.

### `apps/schema-viewer-app`

Read-only explorer (clinical / region / stain / full / flattened / CDE). Copies schema from wrangler:

```
apps/wrangler/public/bdsa-schema.json   ← source of truth
        ↓  npm run copy-schema (predev / prebuild)
apps/schema-viewer-app/public/bdsa-schema.json
```

Also copied into the parent app as `bdsa/services/react/public/assets/bdsa-schema.json`. Parent mounts this app at `/manage/schema-viewer`.

### `apps/react-sync-app`

Copies items between DSA folders. Syncs referenced stain/region protocols to the target folder **before** copying items.

## Runtime data model

Authoritative in-memory shape after `BdsaInitializer.initializeBdsaStructure`:

```javascript
item = {
  id,           // DSA item id (also _id / dsa_id in places)
  name,         // filename
  BDSA: {
    bdsaLocal: {
      localCaseId,          // string | null
      localStainID,         // string | null
      localRegionId,        // string | null
      localImageType,       // optional, from regex/mapping
      bdsaCaseId,           // string | null  e.g. "BDSA-001-0047"
      bdsaStainProtocol,    // string[] of protocol GUIDs or names
      bdsaRegionProtocol    // string[] of protocol GUIDs or names
    },
    _dataSource: {          // 'regex' | 'column_mapping' | 'manual' | 'case_id_mapping' | ...
      localCaseId, localStainID, localRegionId, bdsaCaseId, ...
    },
    _lastModified: isoString
  }
}
```

Girder persistence (`DsaMetadataManager.syncItemBdsaMetadata`):

```
PUT {baseUrl}/api/v1/item/{itemId}/metadata
body: { BDSA: { bdsaLocal: { ..., lastUpdated, source: 'BDSA-Schema-Wrangler' } } }
```

On write, protocol **GUIDs are resolved to names**. Wrangler tracks `STAIN_xxxxxx` / `REGION_xxxxxx` internally; DSA stores human-readable names.

Folder metadata also gets `bdsaWranglerTouch` so the folder browser can show “wrangler-touched” collections. Protocols, case-ID mappings, regex rules, and column mappings can be stored on the resource folder via `DsaFolderMetadataSync.js`.

## DataStore

Singleton `apps/wrangler/src/utils/dataStore.js` (~1015 lines). Facade over focused modules:

| Module | Responsibility |
|--------|----------------|
| `CsvLoader` / `ExcelLoader` / `DsaLoader` | Ingest |
| `BdsaInitializer` | Ensure `BDSA.bdsaLocal` exists |
| `ColumnMapper` | Column mapping + filename regex |
| `CaseManager` | Case ID maps + bidirectional conflicts |
| `ProtocolMapper` | Add/remove protocol GUIDs on a slide |
| `ProtocolCaseGenerator` | Group slides into cases for mapping UI |
| `SuggestionEngine` | Suggest protocols from existing mappings |
| `DsaSync` | Batch PUT of modified items |
| `StorageManager` | localStorage (currently skipped for large datasets) |
| `StatisticsManager` | Status / snapshot / counts |
| `protocolStore` | Collection-scoped protocol catalog |

State that lives on the store:

- `processedData[]`, `dataSource`, `dataSourceInfo`, `modifiedItems: Set`
- `caseIdMappings: Map`, `caseIdConflicts`, `bdsaCaseIdConflicts`
- `caseProtocolMappings`, `columnMappings`
- `girderToken`, `dsaConfig`, sync flags/progress
- `subscribe` / `notify` for UI; separate `subscribeToSync` for sync events

`createBdsaTrackingProxy` exists but is **disabled** (AG Grid incompatibility). Dirty tracking is therefore explicit: callers must `modifiedItems.add(item.id)`.

`setProcessedData` clears mappings, modified items, protocol mappings, and last sync results, then sets `protocolStore.setCurrentCollection(resourceId)`.

There are two `subscribeToSync` method definitions; the later one wins.

## JSON Schema (`bdsa-schema.json`)

Draft 2020-12. Describes a **canonical BDSA case record**, not `BDSA.bdsaLocal`.

**Required at root:** `bdsaID`, `stainID`, `regionIDs` — note the mismatch: properties define `stainIDs` (plural), not `stainID`.

**`bdsaID`:** pattern `^BDSA\d+\.\d+$` (example `BDSA1.33`). Wrangler-generated IDs in Case Management use a different `BDSA-001-0047` style.

**`stainIDs`:** array of objects with `minProperties: 1`, `maxProperties: 1`. Keys:

| Type | Abbrev | Notable required / enums |
|------|--------|--------------------------|
| TDP-43 | TDP | required `phospho-specific` yes/no; chromogen |
| aSyn | aSyn | required `phospho-specific`; chromogen |
| HE | HE | dilution, vendor |
| Silver | Silver | required `technique` Bielschowsky/Gallyas/Campbell-Switzer |
| Thioflavin | ThioS | (no properties) |
| Tau | Tau | required `antibody` AT8/PHF1/CP13/Total Tau/RD3/RD4 |
| aBeta | Aβ | required `antibody` 4G8/6E10 |
| LFB | LFB | dilution, vendor |
| GFAP | GFAP | chromogen |
| IBA1 | IBA1 | chromogen |
| NeuN | NeuN | chromogen |
| LFB-PAS | LFB-PAS | dilution, vendor |

Dilution patterns are not uniform (`^1:\d+$` vs `^\d+:\d+$` on Tau/aBeta).

**`regionIDs`:** object with `regions` (23 types with abbreviations + landmark enums), `hemisphere` (`left`/`right` only), `sliceOrientation`, `damage`, `sliceThickness`, `landmarks`.

**Also:** `slideComments`, `slideIndex`, `otherCaseIdentifiers`, `clinicalData` (NACC fields NPSEX, NACCDAGE, EDUC, HISPANIC, NACCUDSD, RACE, NPPMIH, NPADNC).

### How wrangler consumes the schema

1. `SchemaTab.jsx` fetches `/bdsa-schema.json` and extracts `clinicalData` / `regionIDs` / `stainIDs` for `SchemaViewer`.
2. `schemaValidator.js` loads the same file, reads `stainIDs.items.properties` and `regionIDs.properties`, and exposes options + `validateStainProtocol` / `validateRegionProtocol`.
3. `generateStainFormFields()` exists on the validator but **is unused**. `ProtocolFormFields.jsx` is hardcoded (always shows antibody + technique as required; leftover red debug chrome on slice thickness).

When wrangler runs **inside BDSA**, public assets live at `/assets/bdsa-schema.json` (and behind `assetPrefix` `./react`). `fetch('/bdsa-schema.json')` is the standalone-Vite path and can 404 when embedded.

## Protocols

`protocolStore.js`: collection-scoped localStorage keys, default IGNORE protocol, GUID ids `STAIN_xxxxxx` / `REGION_xxxxxx`, migration from name-based ids. `setCurrentCollection` saves the previous collection then loads the new one.

Assignment: `ProtocolMapper` writes GUID arrays onto `BDSA.bdsaLocal.bdsaStainProtocol` / `bdsaRegionProtocol`. Mapping UI is `StainProtocolMapping.jsx` / `RegionProtocolMapping.jsx` under Case Management.

## Two schema systems (do not conflate)

| System | Where | Names | Used by |
|--------|-------|-------|---------|
| Static JSON Schema | `apps/wrangler/public/bdsa-schema.json` | one file with stainIDs / regionIDs / clinicalData | Wrangler protocol forms + schema viewers |
| Girder `BdsaSchema` | `girder_bdsa.models.bdsaschema` | `slide`, `clinical`, `region`, `stain` (drafts, versions, contentHash) | `/manage/schema`, Case Builder, StainSetup, RegionSetup, DefinitionEditor |

These do not share a loader. Editing one does not update the other.

## Typical user flow

1. Log into DSA (`DsaLogin` / `dsaAuthStore`).
2. Load a folder/collection (`InputDataTab` → `DsaLoader`; CSV/Excel also supported).
3. Map columns and/or apply filename regex → fill `localCaseId` / `localStainID` / `localRegionId`.
4. Optionally attach an accessory CSV/Excel matched on filename.
5. Generate/resolve BDSA case IDs (institution prefix).
6. Define stain/region protocols (schema-driven options, hardcoded form).
7. Assign protocols to slides.
8. Sync modified items → Girder `meta.BDSA.bdsaLocal`.

## Known debt (current code)

- Dual schema systems (wrangler JSON vs Girder BdsaSchema).
- Embedded schema fetch path likely wrong (`/bdsa-schema.json` vs `/assets/bdsa-schema.json`).
- Root `required: stainID` vs property `stainIDs`.
- Protocol forms not generated from schema; debug styling left in slice thickness.
- Tracking Proxy disabled; `modifiedItems` is easy to get wrong.
- `saveToStorage` skipped to avoid localStorage quota.
- Heavy `console.log` in DataStore, ColumnMapper, DsaSync.
- `InputDataTab.jsx` (~1294 lines) and `dataStore.js` (~1015) still central.
- Workspace `@bdsa/*` packages unused by wrangler src.
- `schemaValidator.test.js` is Jest-style; shared tests use Vitest; wrangler app Jest is not wired into `test:shared`.

## Where to edit

- **JSON Schema fields / stain types / regions:** `apps/wrangler/public/bdsa-schema.json`, then copies, plus `schemaValidator.js` if paths change, plus `ProtocolFormFields.jsx` (will not auto-update).
- **bdsaLocal contract / sync payload:** `BdsaInitializer.js`, `ColumnMapper.js`, `CaseManager.js`, `ProtocolMapper.js`, `DsaMetadataManager.js`.
- **Protocol catalog / GUIDs:** `protocolStore.js`, `ProtocolsTab.jsx`.
- **Case Builder / published schemas:** **not this repo** — Girder `BdsaSchema` and `bdsa/services/react/src/pages/manage/Schema*.js` / definition wizards.
