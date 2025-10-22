# Multi-stage build for BDSA Schema Viewer with FastAPI backend
FROM node:18-alpine AS frontend-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Note: Schema files are already copied to ./public/ during the build process
# The build script copies them from ../../apps/reactAgain/public/ before running docker build

# Build the application
RUN npm run build

# Production stage with Python and FastAPI
FROM python:3.11-alpine

# Install system dependencies
RUN apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the built frontend from the builder stage
COPY --from=frontend-builder /app/dist ./dist

# Copy the API code
COPY api ./api

# Copy schema files (these should already be in public/ from the build script)
COPY public ./public

# Expose port 8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

# Start FastAPI server
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
