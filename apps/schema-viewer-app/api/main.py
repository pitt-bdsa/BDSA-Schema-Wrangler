from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import List, Dict, Any, Optional
import json

app = FastAPI(
    title="BDSA Schema API",
    description="Programmatic access to BDSA JSON schemas for data harmonization",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for the React app assets
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

# Schema files directory
SCHEMAS_DIR = "public"


def flatten_schema(obj, path="", level=0):
    """Recursively flatten schema properties"""
    flattened = []

    if not obj or not isinstance(obj, dict):
        return flattened

    # Handle properties object
    if "properties" in obj:
        for key, value in obj["properties"].items():
            current_path = f"{path}.{key}" if path else key
            item = {
                "path": current_path,
                "level": level,
                "variableName": key,
                "title": value.get("title", key),
                "type": value.get("type"),
                "description": value.get("description"),
                "required": value.get("required"),
                "enum": value.get("enum"),
                "pattern": value.get("pattern"),
                "examples": value.get("examples"),
                "format": value.get("format"),
                "minimum": value.get("minimum"),
                "maximum": value.get("maximum"),
                "minLength": value.get("minLength"),
                "maxLength": value.get("maxLength"),
                "items": value.get("items"),
                "cde": value.get("cde"),
                "cdeName": value.get("cdeName"),
                "_comment": value.get("_comment"),
            }
            flattened.append(item)

            # Recursively process nested objects
            if value.get("type") == "object" and "properties" in value:
                flattened.extend(flatten_schema(value, current_path, level + 1))
            # Handle array items
            if (
                value.get("type") == "array"
                and "items" in value
                and "properties" in value["items"]
            ):
                flattened.extend(
                    flatten_schema(value["items"], f"{current_path}[]", level + 1)
                )

    return flattened


def extract_cde_data(obj, collection="", path="", full_schema=None):
    """Extract CDE-style data from schema"""
    cde_items = []

    if not obj or not isinstance(obj, dict):
        return cde_items

    # Handle properties object
    if "properties" in obj:
        for key, value in obj["properties"].items():
            current_path = f"{path}.{key}" if path else key

            # Determine collection based on schema structure
            if current_path.startswith("bdsaID"):
                item_collection = "Case"
            elif "stainIDs" in current_path or current_path.startswith("stainIDs"):
                item_collection = "Slide"
            elif "regionIDs" in current_path or current_path.startswith("regionIDs"):
                item_collection = "Region"
            elif "clinicalData" in current_path:
                item_collection = "Case"
            else:
                item_collection = collection or "General"

            # Include all meaningful properties (with or without CDE mappings)
            # Skip internal/nested array items structures
            # Skip individual stain types and region types (they're handled as constraints)
            if (
                key != "items"
                and "stainIDs[]." not in current_path
                and not (
                    current_path.startswith("stainIDs.") and current_path != "stainIDs"
                )
                and "regionIDs.regions." not in current_path
                and not (
                    current_path.startswith("regionIDs.")
                    and current_path != "regionIDs"
                )
                and (
                    value.get("type") or value.get("title") or value.get("description")
                )
            ):

                item = {
                    "collection": item_collection,
                    "item": key,
                    "description": value.get("description", value.get("title", "")),
                    "itemType": value.get("type", ""),
                    "itemDescription": value.get("title", ""),
                    "required": "required" if value.get("required") else "nullable",
                    "values": format_values(value, full_schema or obj),
                    "comments": value.get("_comment", ""),
                    "alternateItemNames": "",
                    "alternateDescription": "",
                    "cde": value.get("cde") or value.get("cdeName") or "TBD",
                    "hasCde": bool(value.get("cde") or value.get("cdeName")),
                    "path": current_path,
                }
                cde_items.append(item)

            # Recursively process nested objects
            if value.get("type") == "object" and "properties" in value:
                cde_items.extend(
                    extract_cde_data(
                        value, item_collection, current_path, full_schema or obj
                    )
                )
            # Handle array items
            if (
                value.get("type") == "array"
                and "items" in value
                and "properties" in value["items"]
            ):
                cde_items.extend(
                    extract_cde_data(
                        value["items"],
                        item_collection,
                        f"{current_path}[]",
                        full_schema or obj,
                    )
                )

    return cde_items


def format_values(property, all_schema_data=None):
    """Format property values and constraints"""
    # Special handling for stainIDs - extract allowed stain types
    if property.get("cde") == "stain_protocol_path_stain" and all_schema_data:
        stain_types = extract_stain_types(all_schema_data)
        if stain_types:
            return f"Allowed stain types: {', '.join(stain_types)}"

    # Special handling for regionIDs - extract allowed region types
    if property.get("cde") == "region_protocol_path_region" and all_schema_data:
        region_types = extract_region_types(all_schema_data)
        if region_types:
            return f"Allowed region types: {', '.join(region_types)}"

    if "enum" in property:
        return f"Allowed values: {', '.join(property['enum'])}"
    if "pattern" in property:
        return f"Pattern: {property['pattern']}"
    if "minimum" in property or "maximum" in property:
        min_val = property.get("minimum", "−∞")
        max_val = property.get("maximum", "∞")
        return f"Range: {min_val} to {max_val}"
    if "minLength" in property or "maxLength" in property:
        min_len = property.get("minLength", 0)
        max_len = property.get("maxLength", "∞")
        return f"Length: {min_len} to {max_len}"
    if "examples" in property and property["examples"]:
        return f"Examples: {', '.join(property['examples'])}"

    # Handle array of objects with specific structure
    if (
        property.get("type") == "array"
        and "items" in property
        and property["items"].get("type") == "object"
        and "properties" in property["items"]
    ):

        required_fields = property["items"].get("required", [])
        optional_fields = [
            k
            for k in property["items"]["properties"].keys()
            if k not in required_fields
        ]

        constraint_text = "Array of objects"
        if required_fields:
            constraint_text += (
                f" with required properties: {', '.join(required_fields)}"
            )
        if optional_fields:
            constraint_text += f" and optional properties: {', '.join(optional_fields)}"

        # Add enum constraints for specific fields
        enum_fields = []
        for field_name, field_def in property["items"]["properties"].items():
            if "enum" in field_def:
                enum_fields.append(f"{field_name}: {', '.join(field_def['enum'])}")

        if enum_fields:
            constraint_text += f" ({'; '.join(enum_fields)})"

        return constraint_text

    return property.get("type", "")


def extract_stain_types(schema):
    """Extract allowed stain types from schema"""
    stain_types = []
    if (
        schema.get("properties", {})
        .get("stainIDs", {})
        .get("items", {})
        .get("properties")
    ):
        for stain_type in schema["properties"]["stainIDs"]["items"][
            "properties"
        ].keys():
            if stain_type != "items":
                stain_types.append(stain_type)
    return stain_types


def extract_region_types(schema):
    """Extract allowed region types from schema"""
    region_types = []
    if (
        schema.get("properties", {})
        .get("regionIDs", {})
        .get("properties", {})
        .get("regions", {})
        .get("properties")
    ):
        for region_type in schema["properties"]["regionIDs"]["properties"]["regions"][
            "properties"
        ].keys():
            if region_type != "items":
                region_types.append(region_type)
    return region_types


def extract_schema_section(schema, section_name):
    """Extract a specific section from the schema"""
    section_mapping = {
        "clinical": "clinicalData",
        "region": "regionIDs",
        "stain": "stainIDs",
        "bdsa": None,  # Return full schema
    }

    if section_name == "bdsa":
        return schema

    extract_key = section_mapping.get(section_name)
    if not extract_key:
        return None

    if extract_key in schema.get("properties", {}):
        extracted_data = schema["properties"][extract_key]
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": f"{section_name.title()} Schema",
            "type": extracted_data.get("type", "object"),
            "properties": extracted_data.get(
                "properties", extracted_data.get("items", {}).get("properties", {})
            ),
            "required": extracted_data.get(
                "required", extracted_data.get("items", {}).get("required", [])
            ),
            "description": extracted_data.get(
                "description", f"Extracted from main BDSA schema: {extract_key}"
            ),
        }

    return None


@app.get("/")
async def root():
    """Redirect root to the React app"""
    return FileResponse("dist/index.html")


@app.get("/api/schemas", response_model=List[dict], include_in_schema=False)
async def list_schemas():
    """
    List all available BDSA schema files.

    Returns:
        List of schema metadata including name, description, and file path
    """
    schemas = []
    schema_files = [
        {
            "name": "clinical-metadata",
            "title": "Clinical Schema",
            "description": "Schema for clinical data harmonization",
            "file": "clinical-metadata.json",
        },
        {
            "name": "region-metadata",
            "title": "Region Schema",
            "description": "Schema for region annotation data",
            "file": "region-metadata.json",
        },
        {
            "name": "stain-metadata",
            "title": "Stain Schema",
            "description": "Schema for stain protocol data",
            "file": "slide-level-metadata.json",
        },
        {
            "name": "bdsa-schema",
            "title": "BDSA Schema",
            "description": "Main BDSA schema definition",
            "file": "bdsa-schema.json",
        },
    ]

    # Check which files actually exist
    for schema in schema_files:
        file_path = os.path.join(SCHEMAS_DIR, schema["file"])
        if os.path.exists(file_path):
            schema["exists"] = True
            schema["size"] = os.path.getsize(file_path)
        else:
            schema["exists"] = False
            schema["size"] = 0
        schemas.append(schema)

    return schemas


@app.get("/api/schemas/{schema_name}")
async def get_schema(schema_name: str):
    """
    Get a specific BDSA schema by name.

    Args:
        schema_name: The name of the schema (clinical-metadata, region-metadata, stain-metadata, bdsa-schema)

    Returns:
        The complete JSON schema
    """
    schema_mapping = {
        "clinical-metadata": "clinical-metadata.json",
        "region-metadata": "region-metadata.json",
        "stain-metadata": "slide-level-metadata.json",
        "bdsa-schema": "bdsa-schema.json",
    }

    if schema_name not in schema_mapping:
        available = ", ".join(schema_mapping.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Schema '{schema_name}' not found. Available schemas: {available}",
        )

    file_path = os.path.join(SCHEMAS_DIR, schema_mapping[schema_name])

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"Schema file '{schema_mapping[schema_name]}' not found",
        )

    try:
        with open(file_path, "r") as f:
            schema_data = json.load(f)
        return schema_data
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500, detail=f"Invalid JSON in schema file: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error reading schema file: {str(e)}"
        )


@app.get("/api/schemas/{schema_name}/download")
async def download_schema(schema_name: str):
    """
    Download a specific BDSA schema as a file.

    Args:
        schema_name: The name of the schema to download

    Returns:
        The schema file for download
    """
    schema_mapping = {
        "clinical-metadata": "clinical-metadata.json",
        "region-metadata": "region-metadata.json",
        "stain-metadata": "slide-level-metadata.json",
        "bdsa-schema": "bdsa-schema.json",
    }

    if schema_name not in schema_mapping:
        available = ", ".join(schema_mapping.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Schema '{schema_name}' not found. Available schemas: {available}",
        )

    file_path = os.path.join(SCHEMAS_DIR, schema_mapping[schema_name])

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"Schema file '{schema_mapping[schema_name]}' not found",
        )

    return FileResponse(
        path=file_path,
        filename=schema_mapping[schema_name],
        media_type="application/json",
    )


# Helper endpoints for easy access to specific schemas
@app.get("/api/clinical")
async def get_clinical_schema():
    """Get the clinical metadata schema (helper endpoint)"""
    return await get_schema("clinical-metadata")


@app.get("/api/region")
async def get_region_schema():
    """Get the region metadata schema (helper endpoint)"""
    return await get_schema("region-metadata")


@app.get("/api/stain")
async def get_stain_schema():
    """Get the stain metadata schema (helper endpoint)"""
    return await get_schema("stain-metadata")


@app.get("/api/bdsa")
async def get_bdsa_schema():
    """Get the main BDSA schema (helper endpoint)"""
    return await get_schema("bdsa-schema")


@app.get("/api/schemas/{schema_name}/flattened")
async def get_flattened_schema(schema_name: str):
    """
    Get the flattened view of a specific BDSA schema.

    Args:
        schema_name: The name of the schema to flatten

    Returns:
        Flattened schema data with all properties expanded
    """
    schema_data = await get_schema(schema_name)
    flattened_data = flatten_schema(schema_data)

    return {
        "schema_name": schema_name,
        "total_variables": len(flattened_data),
        "required_fields": len(
            [item for item in flattened_data if item.get("required")]
        ),
        "flattened_data": flattened_data,
        "metadata": {
            "generated_at": "2024-01-01T00:00:00Z",
            "description": f"Flattened view of {schema_name} schema",
        },
    }


@app.get("/api/schemas/{schema_name}/cde-reference")
async def get_cde_reference(
    schema_name: str,
    search: Optional[str] = Query(None, description="Search term to filter CDE items"),
):
    """
    Get the CDE Reference view of a specific BDSA schema.

    Args:
        schema_name: The name of the schema to process
        search: Optional search term to filter results

    Returns:
        CDE-formatted data suitable for comparison with DigiPath CDEs template
    """
    schema_data = await get_schema(schema_name)
    cde_data = extract_cde_data(schema_data)

    # Apply search filter if provided
    if search:
        search_lower = search.lower()
        cde_data = [
            item
            for item in cde_data
            if (
                search_lower in item["item"].lower()
                or search_lower in item["description"].lower()
                or search_lower in item["collection"].lower()
                or search_lower in item["cde"].lower()
            )
        ]

    # Group by collection
    grouped_data = {}
    for item in cde_data:
        collection = item["collection"]
        if collection not in grouped_data:
            grouped_data[collection] = []
        grouped_data[collection].append(item)

    return {
        "schema_name": schema_name,
        "total_items": len(cde_data),
        "mapped_cdes": len([item for item in cde_data if item["hasCde"]]),
        "tbd_items": len([item for item in cde_data if not item["hasCde"]]),
        "collections": list(grouped_data.keys()),
        "cde_data": grouped_data,
        "flat_cde_data": cde_data,
        "search_term": search,
        "metadata": {
            "generated_at": "2024-01-01T00:00:00Z",
            "description": f"CDE Reference view of {schema_name} schema",
            "format": "DigiPath CDEs template compatible",
        },
    }


@app.get("/api/schemas/{schema_name}/sections/{section_name}")
async def get_schema_section(schema_name: str, section_name: str):
    """
    Get a specific section from a BDSA schema.

    Args:
        schema_name: The name of the schema
        section_name: The section to extract (clinical, region, stain, bdsa)

    Returns:
        Extracted schema section
    """
    schema_data = await get_schema(schema_name)
    section_data = extract_schema_section(schema_data, section_name)

    if not section_data:
        available_sections = ["clinical", "region", "stain", "bdsa"]
        raise HTTPException(
            status_code=404,
            detail=f"Section '{section_name}' not found. Available sections: {', '.join(available_sections)}",
        )

    return {
        "schema_name": schema_name,
        "section_name": section_name,
        "section_data": section_data,
        "metadata": {
            "generated_at": "2024-01-01T00:00:00Z",
            "description": f"Extracted {section_name} section from {schema_name} schema",
        },
    }


# Convenience endpoints for BDSA schema sections
@app.get("/api/bdsa/flattened")
async def get_bdsa_flattened():
    """Get flattened view of BDSA schema (convenience endpoint)"""
    return await get_flattened_schema("bdsa-schema")


@app.get("/api/bdsa/cde-reference")
async def get_bdsa_cde_reference(
    search: Optional[str] = Query(None, description="Search term to filter CDE items")
):
    """Get CDE Reference view of BDSA schema (convenience endpoint)"""
    return await get_cde_reference("bdsa-schema", search)


@app.get("/api/bdsa/sections/{section_name}")
async def get_bdsa_section(section_name: str):
    """Get a specific section from BDSA schema (convenience endpoint)"""
    return await get_schema_section("bdsa-schema", section_name)


@app.get("/api/all-schemas")
async def get_all_schemas():
    """
    Get all BDSA schemas as a single combined document.

    Returns:
        A JSON object containing all schemas organized by type
    """
    try:
        all_schemas = {}

        # Load each schema
        schema_files = {
            "clinical": "clinical-metadata.json",
            "region": "region-metadata.json",
            "stain": "slide-level-metadata.json",
            "bdsa": "bdsa-schema.json",
        }

        for schema_type, filename in schema_files.items():
            file_path = os.path.join(SCHEMAS_DIR, filename)
            if os.path.exists(file_path):
                with open(file_path, "r") as f:
                    all_schemas[schema_type] = json.load(f)
            else:
                all_schemas[schema_type] = None

        return {
            "description": "Combined BDSA Schema Collection",
            "version": "1.0.0",
            "schemas": all_schemas,
            "metadata": {
                "total_schemas": len(
                    [s for s in all_schemas.values() if s is not None]
                ),
                "available_schemas": [
                    k for k, v in all_schemas.items() if v is not None
                ],
                "generated_at": "2024-01-01T00:00:00Z",  # You could add actual timestamp here
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error loading combined schemas: {str(e)}"
        )


@app.get("/api/health", include_in_schema=False)
async def health_check():
    """
    Health check endpoint.

    Returns:
        Service status and available schemas count
    """
    schema_count = 0
    for file in os.listdir(SCHEMAS_DIR):
        if file.endswith(".json"):
            schema_count += 1

    return {
        "status": "healthy",
        "service": "BDSA Schema API",
        "version": "1.0.0",
        "available_schemas": schema_count,
        "schemas_directory": SCHEMAS_DIR,
    }


# Serve static files (JS, CSS, etc.) with proper MIME types
@app.get("/assets/{filename}", include_in_schema=False)
async def serve_assets(filename: str):
    """Serve static assets with proper MIME types"""
    file_path = f"dist/assets/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        raise HTTPException(status_code=404, detail="File not found")


# Catch-all route for React app (must be last)
@app.get("/{path:path}")
async def serve_react_app(path: str):
    """Serve the React app for all other routes"""
    # Don't serve HTML for API routes or asset requests
    if path.startswith("api/") or path.startswith("assets/"):
        raise HTTPException(status_code=404, detail="Not found")

    # Serve public files like logos
    if path in ["BDSA_logo_clear.png", "BDSA_logo.png"]:
        file_path = f"public/{path}"
        if os.path.exists(file_path):
            return FileResponse(file_path)

    return FileResponse("dist/index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
