# BDSA Schema Viewer & API

A standalone, containerized service for viewing and programmatically accessing BDSA JSON schemas used for data harmonization.

## Overview

This application provides both a clean, web-based interface and a REST API to view and explore the JSON schemas used in the BDSA (Brain Data Science Archive) project. It's designed to run as a standalone service that can be easily deployed and accessed by researchers and developers.

## Features

### Web Interface
- **Multiple Schema Types**: View clinical, region, stain, and BDSA schemas
- **Interactive Navigation**: Easy switching between different schema types
- **Detailed Property View**: Hierarchical display of schema properties with descriptions, types, and constraints
- **Responsive Design**: Works on desktop and mobile devices

### REST API
- **Programmatic Access**: Download schemas via REST API endpoints
- **OpenAPI Documentation**: Interactive API documentation at `/api/docs`
- **Multiple Formats**: Get schemas as JSON or download as files
- **Health Monitoring**: Built-in health check endpoints
- **CORS Enabled**: Cross-origin requests supported

### Deployment
- **Containerized**: Ready for Docker deployment
- **Single Service**: Both web UI and API in one container

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and run the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Using Docker Directly

```bash
# Build the image
./build.sh

# Run the container
docker run -p 3000:3000 bdsa-schema-viewer:latest
```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Schema Files

The application automatically includes the latest schema files from the main BDSA Schema Wrangler project:

- `clinical-metadata.json` - Clinical data schema
- `region-metadata.json` - Region annotation schema  
- `slide-level-metadata.json` - Stain protocol schema
- `bdsa-schema.json` - Main BDSA schema

These files are copied during the Docker build process to ensure they're always up-to-date.

## Configuration

### Environment Variables

- `NODE_ENV` - Set to `production` for production builds

### Nginx Configuration

The production build uses Nginx with optimized settings for:
- Gzip compression
- Static asset caching
- Client-side routing support
- Security headers

## Deployment

### Docker Deployment

The application is designed to run as a containerized service:

```bash
# Build and deploy
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f bdsa-schema-viewer
```

### Health Checks

The service includes health checks that verify the application is responding correctly:

- HTTP endpoint check at `/`
- 30-second intervals
- 3 retry attempts

### Port Configuration

Default port: `8000`

To change the port, modify the `docker-compose.yml` file:

```yaml
ports:
  - "8080:8000"  # Maps host port 8080 to container port 8000
```

## API Documentation

### Available Endpoints

#### List All Schemas
```http
GET /api/schemas
```
Returns metadata about all available schema files.

#### Get Specific Schema
```http
GET /api/schemas/{schema_name}
```
Returns the complete JSON schema. Available schema names:
- `clinical-metadata` - Clinical data schema
- `region-metadata` - Region annotation schema  
- `stain-metadata` - Stain protocol schema
- `bdsa-schema` - Main BDSA schema

#### Download Schema File
```http
GET /api/schemas/{schema_name}/download
```
Downloads the schema as a JSON file.

#### Health Check
```http
GET /api/health
```
Returns service status and metadata.

### Interactive Documentation

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI Schema**: http://localhost:8000/api/openapi.json

### Example Usage

```bash
# List all available schemas
curl http://localhost:8000/api/schemas

# Get clinical metadata schema
curl http://localhost:8000/api/schemas/clinical-metadata

# Download schema file
curl -O http://localhost:8000/api/schemas/clinical-metadata/download

# Check service health
curl http://localhost:8000/api/health
```

## Development

### Project Structure

```
schema-viewer-app/
├── src/
│   ├── components/
│   │   ├── SchemaViewer.jsx
│   │   └── SchemaViewer.css
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── public/          # Schema JSON files (copied during build)
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── build.sh
└── package.json
```

### Adding New Schema Types

1. Add the schema file to `../../apps/reactAgain/public/`
2. Update the `schemas` array in `src/App.jsx`
3. Rebuild the Docker image

### Customizing the UI

- Modify `src/App.css` for main layout styles
- Modify `src/components/SchemaViewer.css` for schema-specific styles
- Update `src/components/SchemaViewer.jsx` for component behavior

## Troubleshooting

### Common Issues

1. **Schema files not loading**: Check that the source schema files exist in `../../apps/reactAgain/public/`
2. **Docker build fails**: Ensure Docker is running and you have sufficient disk space
3. **Port conflicts**: Change the port mapping in `docker-compose.yml`

### Logs

View application logs:

```bash
# Docker Compose
docker-compose logs -f bdsa-schema-viewer

# Docker directly
docker logs -f <container-id>
```

## License

This project is part of the BDSA Schema Wrangler suite.
