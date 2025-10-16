# BDSA Schema API Endpoints

## Overview

The BDSA Schema API now provides comprehensive access to both raw schema data and processed views, making it easy to integrate with other tools and applications.

## Base URL

```
http://localhost:8000/api
```

## Available Endpoints

### 1. Raw Schema Access

#### List All Schemas
```http
GET /api/schemas
```
Returns metadata about all available schema files.

#### Get Specific Schema
```http
GET /api/schemas/{schema_name}
```
Get the complete JSON schema for a specific schema.

**Parameters:**
- `schema_name`: One of `clinical-metadata`, `region-metadata`, `stain-metadata`, `bdsa-schema`

#### Download Schema
```http
GET /api/schemas/{schema_name}/download
```
Download a schema file directly.

### 2. Processed Views (NEW!)

#### Flattened Schema View
```http
GET /api/schemas/{schema_name}/flattened
```
Get a flattened view of the schema with all properties expanded.

**Response Example:**
```json
{
  "schema_name": "bdsa-schema",
  "total_variables": 82,
  "required_fields": 12,
  "flattened_data": [
    {
      "path": "bdsaID",
      "level": 0,
      "variableName": "bdsaID",
      "title": "BDSA ID",
      "type": "string",
      "description": "Unique BDSA case identifier...",
      "pattern": "^BDSA\\d+\\.\\d+$",
      "cde": "case_identifier_bdsa"
    }
  ],
  "metadata": {
    "generated_at": "2024-01-01T00:00:00Z",
    "description": "Flattened view of bdsa-schema schema"
  }
}
```

#### CDE Reference View
```http
GET /api/schemas/{schema_name}/cde-reference?search={search_term}
```
Get CDE-formatted data suitable for comparison with DigiPath CDEs template.

**Parameters:**
- `search` (optional): Filter results by item name, description, collection, or CDE

**Response Example:**
```json
{
  "schema_name": "bdsa-schema",
  "total_items": 82,
  "mapped_cdes": 9,
  "tbd_items": 73,
  "collections": ["Case", "Slide", "Region", "General"],
  "cde_data": {
    "Case": [
      {
        "collection": "Case",
        "item": "bdsaID",
        "description": "Unique BDSA case identifier...",
        "itemType": "string",
        "required": "required",
        "values": "Pattern: ^BDSA\\d+\\.\\d+$",
        "cde": "case_identifier_bdsa",
        "hasCde": true
      }
    ]
  },
  "flat_cde_data": [...],
  "search_term": null,
  "metadata": {
    "generated_at": "2024-01-01T00:00:00Z",
    "description": "CDE Reference view of bdsa-schema schema",
    "format": "DigiPath CDEs template compatible"
  }
}
```

#### Schema Section Extraction
```http
GET /api/schemas/{schema_name}/sections/{section_name}
```
Extract a specific section from the schema.

**Parameters:**
- `section_name`: One of `clinical`, `region`, `stain`, `bdsa`

**Response Example:**
```json
{
  "schema_name": "bdsa-schema",
  "section_name": "stain",
  "section_data": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Stain Schema",
    "type": "array",
    "properties": {
      "TDP-43": {...},
      "aSyn": {...}
    },
    "description": "Extracted from main BDSA schema: stainIDs"
  },
  "metadata": {
    "generated_at": "2024-01-01T00:00:00Z",
    "description": "Extracted stain section from bdsa-schema schema"
  }
}
```

### 3. Convenience Endpoints (NEW!)

#### BDSA Schema Specific Endpoints
```http
GET /api/bdsa/flattened
GET /api/bdsa/cde-reference?search={search_term}
GET /api/bdsa/sections/{section_name}
```

These are convenience endpoints specifically for the main BDSA schema.

### 4. Helper Endpoints

#### Individual Schema Access
```http
GET /api/clinical    # Clinical schema
GET /api/region      # Region schema  
GET /api/stain       # Stain schema
GET /api/bdsa        # Main BDSA schema
```

#### Combined Access
```http
GET /api/all-schemas
```
Get all schemas as a single combined document.

#### Health Check
```http
GET /api/health
```
Service status and available schemas count.

## Usage Examples

### Get Flattened BDSA Schema
```bash
curl http://localhost:8000/api/bdsa/flattened
```

### Search CDE Reference for Stain-Related Items
```bash
curl "http://localhost:8000/api/bdsa/cde-reference?search=stain"
```

### Get Only the Region Section
```bash
curl http://localhost:8000/api/bdsa/sections/region
```

### Get All CDE Items with TBD Status
```bash
curl "http://localhost:8000/api/bdsa/cde-reference" | jq '.flat_cde_data[] | select(.cde == "TBD")'
```

### Export CDE Reference as CSV (using jq)
```bash
curl "http://localhost:8000/api/bdsa/cde-reference" | jq -r '
  ["Collection", "Item", "Description", "Type", "Required", "Values", "CDE"] as $headers |
  $headers, 
  (.flat_cde_data[] | [.collection, .item, .description, .itemType, .required, .values, .cde]) |
  @csv
' > cde_reference.csv
```

## Integration Examples

### Python Integration
```python
import requests
import json

# Get CDE reference data
response = requests.get("http://localhost:8000/api/bdsa/cde-reference")
cde_data = response.json()

# Find TBD items
tbd_items = [item for item in cde_data['flat_cde_data'] if item['cde'] == 'TBD']
print(f"Found {len(tbd_items)} items needing CDE mapping")

# Get specific section
region_section = requests.get("http://localhost:8000/api/bdsa/sections/region")
region_schema = region_section.json()['section_data']
```

### JavaScript/Node.js Integration
```javascript
const fetch = require('node-fetch');

// Get flattened schema
const flattened = await fetch('http://localhost:8000/api/bdsa/flattened')
  .then(res => res.json());

// Search CDE reference
const stainItems = await fetch('http://localhost:8000/api/bdsa/cde-reference?search=stain')
  .then(res => res.json());

console.log(`Found ${stainItems.total_items} stain-related items`);
```

## Response Formats

### Flattened View
- **Purpose**: Complete property expansion for analysis
- **Use Case**: Schema validation, property enumeration
- **Structure**: Array of property objects with full metadata

### CDE Reference View
- **Purpose**: DigiPath CDEs template compatibility
- **Use Case**: CDE mapping, data harmonization
- **Structure**: Grouped by collection with CDE status

### Section Extraction
- **Purpose**: Focused schema subsets
- **Use Case**: Specific domain analysis
- **Structure**: Standalone schema for the section

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `404`: Schema or section not found
- `500`: Server error (invalid JSON, file read error)

Error responses include detailed messages:
```json
{
  "detail": "Schema 'invalid-schema' not found. Available schemas: clinical-metadata, region-metadata, stain-metadata, bdsa-schema"
}
```

## Performance Considerations

- **Caching**: Consider implementing caching for frequently accessed processed views
- **Pagination**: Large schemas may benefit from pagination (not currently implemented)
- **Filtering**: Use the search parameter to reduce response size

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8000/api/docs`
- **ReDoc**: `http://localhost:8000/api/redoc`

## Development

To add new processed views:

1. Create processing function in `main.py`
2. Add corresponding endpoint
3. Update this documentation
4. Add convenience endpoint if needed

The processing functions are modular and can be easily extended for new view types.
