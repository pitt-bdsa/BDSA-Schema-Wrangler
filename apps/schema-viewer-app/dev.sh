#!/bin/bash
# Development environment startup script

set -e

echo "🚀 Starting BDSA Schema Viewer in development mode..."
echo ""
echo "Features:"
echo "  ✅ Hot reload enabled"
echo "  ✅ Both FastAPI and Vite running"
echo "  ✅ Running in Docker container"
echo ""
echo "Access the app at: http://localhost:3000"
echo "API docs at: http://localhost:8000/api/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

docker compose -f docker-compose.dev.yml up --build

