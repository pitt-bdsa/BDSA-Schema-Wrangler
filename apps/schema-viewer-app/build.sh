#!/bin/bash

# Build script for BDSA Schema Viewer
set -e

echo "🚀 Building BDSA Schema Viewer..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the schema-viewer-app directory.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if schema files exist in the source location
SCHEMA_SOURCE_DIR="../../apps/wrangler/public"
if [ ! -d "$SCHEMA_SOURCE_DIR" ]; then
    echo -e "${RED}❌ Error: Schema source directory not found at $SCHEMA_SOURCE_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Checking schema files...${NC}"
SCHEMA_FILES=("bdsa-schema.json")
for file in "${SCHEMA_FILES[@]}"; do
    if [ ! -f "$SCHEMA_SOURCE_DIR/$file" ]; then
        echo -e "${RED}❌ Error: Required schema file $file not found in $SCHEMA_SOURCE_DIR${NC}"
        echo -e "${RED}   The BDSA schema viewer requires bdsa-schema.json to function.${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Found: $file${NC}"
    fi
done

# Copy latest schema files to ensure they're up-to-date
echo -e "${YELLOW}📋 Copying latest schema files...${NC}"
cp "$SCHEMA_SOURCE_DIR"/*.json ./public/
cp "$SCHEMA_SOURCE_DIR"/assets/BDSA_logo_clear.png ./public/ 2>/dev/null || echo -e "${YELLOW}⚠️ BDSA logo not found, skipping...${NC}"

# Build the Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t bdsa-schema-viewer:latest .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully!${NC}"
    echo -e "${GREEN}🎉 BDSA Schema Viewer is ready to run!${NC}"
    echo ""
    echo "To run the service:"
    echo "  docker compose up -d"
    echo ""
    echo "To run standalone:"
    echo "  docker run -p 8000:8000 bdsa-schema-viewer:latest"
    echo ""
    echo "The service will be available at:"
    echo "  Web Interface: http://localhost:8000"
    echo "  API Documentation: http://localhost:8000/api/docs"
    echo "  OpenAPI Schema: http://localhost:8000/api/openapi.json"
else
    echo -e "${RED}❌ Docker build failed!${NC}"
    exit 1
fi
