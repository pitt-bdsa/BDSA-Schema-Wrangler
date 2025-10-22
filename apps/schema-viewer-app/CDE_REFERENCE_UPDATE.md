# CDE Reference View Update

## Summary

Added a new **CDE Reference** tab to the BDSA Schema Viewer that displays the schema in a format matching the DigiPath CDEs template structure.

## Changes Made

### 1. New Component: `CdeReferenceView.jsx`
   - Displays schema variables in CDE template format
   - Columns: Collection, Item, Type, Required, Values/Constraints, Description, CDE
   - Shows "TBD" for variables without CDE mappings
   - Search functionality to filter by item name, description, collection, or CDE
   - Export to CSV capability
   - Groups items by schema structure (Case, Slide, Region, General)
   - Vertical scrolling enabled for long content
   - Statistics showing total items, mapped vs TBD count

### 2. Updated `App.jsx`
   - Added new "CDE Reference" tab to navigation
   - Imports and renders `CdeReferenceView` component

### 3. Added Stain Types CDE to `bdsa-schema.json`
   - Added `cde` field to `stainIDs` property
   - CDE reference: `stain_protocol_path_stain`
   - Documents acceptable stain types: TDP-43, aSyn, HE, Silver, Thioflavin, Tau, aBeta, LFB, GFAP, IBA1, NeuN
   - Links to DigiPath CDE pattern: `{region}_path_stain`

### 4. Styling: `CdeReferenceView.css`
   - Clean, professional table layout
   - Color-coded type badges
   - Distinct styling for TBD vs mapped CDEs
   - Warning badge for TBD count in stats
   - Vertical scrolling enabled (max-height: calc(100vh - 200px))
   - Responsive design for mobile/tablet

## Variable Name Verification

To verify that BDSA schema variable names match the DigiPath CDEs template:

### Current Stain-Related Mappings

| BDSA Schema Variable | DigiPath CDE Pattern | Status |
|---------------------|---------------------|--------|
| `stainIDs` | `{region}_path_stain` | ✅ Mapped |
| Individual stain properties (dilution, vendor, etc.) | Nested within stain objects | TBD |

### Acceptable Stain Types

The schema now documents these acceptable stain types (matching DigiPath CDEs):
- TDP-43
- aSyn (Alpha Synuclein)  
- HE (Hematoxylin & Eosin)
- Silver (with techniques: Bielschowsky, Gallyas, Campbell-Switzer)
- Thioflavin
- Tau (with antibodies: AT8, PHF1, CP13, Total Tau, RD3, RD4)
- aBeta (with antibodies: 4G8, 6E10)
- LFB (Luxol Fast Blue)
- GFAP
- IBA1
- NeuN

### Verification Process

1. **Open CDE Reference Tab**: Navigate to the new "CDE Reference" tab
2. **Review TBD Items**: Check the "TBD" count in the stats
3. **Search Functionality**: Use search to find specific variables
4. **Export for Review**: Click "Export CSV" to download for detailed comparison with DigiPath template
5. **Compare Collections**: Review each collection (Clinical, Screening, Pathology) separately

## Features

### TBD Indicator
- Variables without CDE mappings show "TBD" in yellow badge
- Helps identify which fields still need CDE assignment
- TBD count prominently displayed in stats header

### Search & Filter
- Real-time search across all fields
- Filter by: item name, description, collection, or CDE value
- Clear button to reset search

### Export Capability
- Export filtered results to CSV
- CSV format matches DigiPath template structure
- Includes all metadata fields

### Visual Organization
- Items grouped by collection type
- Color-coded type badges (string, number, array, object, boolean)
- Required/nullable status clearly marked
- Constraints displayed inline

## Next Steps

1. **Review TBD Items**: Go through items marked as "TBD" and assign appropriate CDEs
2. **Cross-Reference**: Compare exported CSV with DigiPath CDEs v0.99 template
3. **Update Schema**: Add `cde` fields to remaining schema properties
4. **Document Mappings**: Add comments explaining CDE mappings where applicable
5. **Stain Label Colors**: Consider adding CDE for stain label colors (`{region}_path_stain_label`)

## Usage

1. Start the schema-viewer-app:
   ```bash
   cd apps/schema-viewer-app
   npm run dev
   ```

2. Navigate to the "CDE Reference" tab

3. Use search to find specific variables

4. Export CSV to compare with DigiPath template

5. Review TBD items and update schema with CDE mappings as needed

## File Locations

- Component: `apps/schema-viewer-app/src/components/CdeReferenceView.jsx`
- Styles: `apps/schema-viewer-app/src/components/CdeReferenceView.css`
- App Router: `apps/schema-viewer-app/src/App.jsx`
- Schema: `apps/schema-viewer-app/public/bdsa-schema.json`

