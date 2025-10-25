# BDSA Schema Viewer & API

A standalone, containerized service for viewing and programmatically accessing BDSA JSON schemas used for data harmonization.

## Overview

This application combines a React frontend with a FastAPI backend to provide both a clean web interface and a REST API for exploring JSON schemas used in the BDSA (Brain Data Science Archive) project.

**Architecture:**
- **Frontend**: React 18 + Vite (development) or built static files (production)
- **Backend**: FastAPI (Python) serving both the API and static frontend
- **Deployment**: Docker container running FastAPI on port 8000

## Quick Reference

| Mode | Command | Use Case | Hot Reload | Port |
|------|---------|----------|------------|------|
| **Dev (Docker)** | `docker compose -f docker-compose.dev.yml up` | Active development | ✅ Yes | 3000 |
| **Production (Docker)** | `docker compose up` | Deployment/Testing | ❌ No | 8000 |
| **Dev (Local)** | 2 terminals (see below) | Without Docker | ✅ Yes | 3000 |

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

## Quick Start

### Production Mode (Docker - Recommended for Deployment)

The production setup builds the React app and serves it with FastAPI in a single container:

```bash
# Build and run the service
cd apps/schema-viewer-app
docker compose up --build -d

# View logs
docker compose logs -f

# Stop the service
docker compose down
```

Access the application at: **http://localhost:8000**

### Development Mode with Docker (Recommended for Development)

The best development experience combines Docker with hot reload via bind mounts:

```bash
cd apps/schema-viewer-app

# Quick start with helper script
./dev.sh

# Or manually with docker compose
docker compose -f docker-compose.dev.yml up --build

# Run in background
docker compose -f docker-compose.dev.yml up --build -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop
docker compose -f docker-compose.dev.yml down
```

**Features:**
- ✅ Runs in Docker (consistent environment)
- ✅ Auto-reload on code changes (bind mounts)
- ✅ Both FastAPI and Vite running together
- ✅ No need to install dependencies locally

Access the application at: **http://localhost:3000** (Vite dev server with proxy to FastAPI)

### Development Mode without Docker (Local)

For active development without Docker, run the FastAPI backend and Vite dev server separately:

**Terminal 1 - Start the FastAPI backend:**
```bash
cd apps/schema-viewer-app
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --port 8000
```

**Terminal 2 - Start the Vite dev server:**
```bash
cd apps/schema-viewer-app
npm install
npm run dev
```

Access the application at: **http://localhost:3000**

The Vite dev server will proxy `/api/*` requests to the FastAPI backend on port 8000.

### Alternative: Build and Serve Locally

Build the React app and serve it with FastAPI without Docker:

```bash
cd apps/schema-viewer-app

# Build the frontend
npm install
npm run build

# Start the FastAPI server
pip install -r requirements.txt
python -m uvicorn api.main:app --port 8000
```

Access at: **http://localhost:8000**

## Schema Files

The application uses schema files located in the `public/` directory:

- `clinical-metadata.json` - Clinical data schema
- `region-metadata.json` - Region annotation schema  
- `slide-level-metadata.json` - Stain protocol schema (mapped to "stain-metadata")
- `bdsa-schema.json` - Main BDSA schema

These files are served by the FastAPI backend at runtime.

### 📋 Schema Synchronization

**Important:** The `bdsa-schema.json` file is automatically synced from the wrangler app:

- **Source of Truth:** `apps/wrangler/public/bdsa-schema.json`
- **Auto-copied when running:**
  - `npm run dev` (before starting dev server)
  - `npm run build` (before building)
  - `npm run copy-schema` (manual copy)

⚠️ **Do not edit** `bdsa-schema.json` in this app - always edit it in the wrangler app! The schema-viewer-app will automatically get the latest version when you start it.

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

#### Helper Endpoints
```http
GET /api/clinical    # Get clinical schema
GET /api/region      # Get region schema
GET /api/stain       # Get stain schema
GET /api/bdsa        # Get BDSA schema
```

#### Get All Schemas
```http
GET /api/all-schemas
```
Returns all schemas in a single combined document.

#### Health Check
```http
GET /api/health
```
Returns service status and metadata.

### Interactive Documentation

When the FastAPI server is running:

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

# Get all schemas at once
curl http://localhost:8000/api/all-schemas

# Check service health
curl http://localhost:8000/api/health
```

## Development

### Project Structure

```
schema-viewer-app/
├── api/
│   └── main.py              # FastAPI backend
├── src/
│   ├── components/
│   │   ├── SchemaViewer.jsx
│   │   └── SchemaViewer.css
│   ├── App.jsx              # Main React component
│   ├── App.css
│   ├── main.jsx             # React entry point
│   └── index.css
├── public/                  # Schema JSON files
│   ├── clinical-metadata.json
│   ├── region-metadata.json
│   ├── slide-level-metadata.json
│   └── bdsa-schema.json
├── dist/                    # Built React app (generated)
├── Dockerfile               # Multi-stage Docker build
├── docker-compose.yml       # Docker Compose configuration
├── vite.config.js          # Vite configuration (with proxy)
├── requirements.txt         # Python dependencies
└── package.json            # Node dependencies
```

### Adding New Schema Types

1. Add the schema JSON file to `public/`
2. Update the `schema_mapping` in `api/main.py` (lines 101-106 and 148-153)
3. Update the `schemas` array in `src/App.jsx` (lines 8-13)
4. Rebuild the Docker image or restart the dev servers

### Customizing the UI

- **Main Layout**: Modify `src/App.css`
- **Schema Viewer**: Modify `src/components/SchemaViewer.css`
- **Component Logic**: Update `src/components/SchemaViewer.jsx`

## Configuration

### Environment Variables

- `NODE_ENV` - Set to `production` for production builds (optional)

### Port Configuration

**Development:**
- FastAPI backend: `8000` (configurable in uvicorn command)
- Vite dev server: `3000` (configurable in `vite.config.js`)

**Production (Docker):**
- Container exposes port `8000`
- Map to different host port in `docker-compose.yml`:
  ```yaml
  ports:
    - "8080:8000"  # Maps host port 8080 to container port 8000
  ```

### Vite Proxy Configuration

The `vite.config.js` includes a proxy to forward API requests during development:

```javascript
server: {
    proxy: {
        '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true
        }
    }
}
```

This ensures that requests to `/api/*` are forwarded to the FastAPI backend.

## Docker

### Development vs Production Dockerfiles

**Dockerfile.dev (Development):**
- Single-stage build with Node.js and Python
- Installs all dependencies
- Uses bind mounts for source code (configured in docker-compose.dev.yml)
- Runs both FastAPI (--reload) and Vite dev server
- Exposes ports 3000 (Vite) and 8000 (FastAPI)

**Dockerfile (Production):**
- Multi-stage build for optimization
- Stage 1: Builds React app with Node.js
- Stage 2: Python container with FastAPI serving built static files
- Smaller final image size
- Exposes only port 8000

### Docker Compose Commands

**Development:**
```bash
# Start development environment
docker compose -f docker-compose.dev.yml up

# Start in background
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Rebuild after package.json or requirements.txt changes
docker compose -f docker-compose.dev.yml up --build

# Stop
docker compose -f docker-compose.dev.yml down
```

**Production:**
```bash
# Start the service
docker compose up -d

# Start with rebuild
docker compose up --build -d

# View logs
docker compose logs -f bdsa-schema-viewer

# Stop the service
docker compose down

# Check status
docker compose ps
```

### Volume Mounts (Development Mode)

The development Docker Compose uses bind mounts for hot reload:

- `./src` → Container source code (React components)
- `./api` → Container API code (FastAPI)
- `./public` → Schema JSON files
- `vite.config.js`, `package.json` → Configuration files

Named volumes for dependencies (to avoid conflicts):
- `node_modules` → Node.js packages
- `python_packages` → Python site-packages

### Health Checks

The Docker container includes health checks that ping `/api/health`:
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3
- Start period: 40 seconds

## Troubleshooting

### Common Issues

#### "Unexpected token '<', '<!doctype'... is not valid JSON"

This error means the React app is receiving HTML instead of JSON. This happens when:
- The FastAPI backend isn't running (development mode)
- The Vite proxy isn't configured correctly
- **Solution**: Ensure both FastAPI and Vite are running in development mode, or use Docker

#### Schema Files Not Loading

- Check that schema files exist in the `public/` directory
- Verify the FastAPI backend is serving files correctly: `curl http://localhost:8000/api/health`

#### Port Conflicts

- Change the port mapping in `docker-compose.yml` or Vite configuration
- Check if ports 3000 or 8000 are already in use: `lsof -i :8000`

#### Docker Build Fails

- Ensure Docker is running: `docker ps`
- Check disk space: `docker system df`
- Clear old images: `docker system prune`

### Development Mode Not Working

If API requests fail in development mode:

1. Verify FastAPI is running on port 8000
2. Check the Vite proxy configuration in `vite.config.js`
3. Ensure both terminals are in the correct directory
4. Try accessing the API directly: `curl http://localhost:8000/api/health`

### Viewing Logs

**Docker Compose:**
```bash
docker compose logs -f bdsa-schema-viewer
```

**Docker Directly:**
```bash
docker logs -f <container-name-or-id>
```

**Development Mode:**
- FastAPI logs appear in Terminal 1
- Vite logs appear in Terminal 2

## Workflow Recommendations

### For Development (Frequent Changes)
**Use Docker Compose development mode** (`docker-compose.dev.yml`):
- ✅ Consistent environment (Docker)
- ✅ Hot reload for React and FastAPI
- ✅ No local dependency installation needed
- ✅ Changes to source files update instantly
- ✅ Faster iteration cycle

```bash
docker compose -f docker-compose.dev.yml up
```

### For Testing Production Build
**Use Docker Compose production mode** (`docker-compose.yml`):
- Test the exact environment that will be deployed
- Verify build process works correctly
- Test health checks and container behavior

```bash
docker compose up --build
```

### For Deployment
**Use Docker Compose production mode** (`docker-compose.yml`):
- Consistent deployment across environments
- Easy to manage and monitor
- Built-in health checks and restart policies
- Optimized production build

## Dependencies

### Frontend
- React 18.2.0
- Vite 5.2.0
- ESLint (for linting)

### Backend
- FastAPI
- Uvicorn (ASGI server)
- Python 3.11+

See `package.json` and `requirements.txt` for complete dependency lists.

## License

This project is part of the BDSA Schema Wrangler suite.
