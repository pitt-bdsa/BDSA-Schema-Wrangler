from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import List
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
