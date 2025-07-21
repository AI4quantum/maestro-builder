#!/bin/bash

# Maestro Start Script
# Starts both the API and Builder frontend services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "Current working directory: $SCRIPT_DIR"

mkdir -p logs

check_port() {
    local port=$1
    lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
}

wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$name is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_error "$name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Warn if services are already running
check_port 8001 && print_warning "API already running on port 8001"
(check_port 5174) && print_warning "Builder frontend already running on port 5174"

# Mode selection for Maestro backend
MODE=$1
if [ "$MODE" = "workflow" ]; then
  MAESTRO_CMD="maestro serve ./meta-agents-v2/workflow_file_generation/agents.yaml ./meta-agents-v2/workflow_file_generation/workflow.yaml"
elif [ "$MODE" = "agents" ] || [ -z "$MODE" ]; then
  MAESTRO_CMD="maestro serve ./meta-agents-v2/agents_file_generation/agents.yaml ./meta-agents-v2/agents_file_generation/workflow.yaml"
else
  echo "Usage: ./start.sh [agents|workflow]"
  exit 1
fi

print_status "Starting Maestro backend: $MAESTRO_CMD"
nohup $MAESTRO_CMD > logs/maestro.log 2>&1 &
MAESTRO_PID=$!
print_success "Maestro backend started with PID: $MAESTRO_PID"

### ───────────── Start API ─────────────

print_status "Starting Maestro API service..."

if [ ! -d "api" ]; then
    print_error "API directory not found. Expected to be at ./api"
    exit 1
fi

cd api

if ! command -v python3 &>/dev/null; then
    print_error "Python 3 is required but not installed."
    exit 1
fi

if [ ! -d ".venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r "$SCRIPT_DIR/api/requirements.txt"
else
    print_status "Using existing virtual environment..."
    source .venv/bin/activate
fi

mkdir -p storage

print_status "Starting API server on http://localhost:8001"
cd "$SCRIPT_DIR"
PYTHONPATH="$SCRIPT_DIR" nohup bash -c "source /Users/gliu/Desktop/work/maestro-builder/.venv/bin/activate && python -m api.main" >> "$SCRIPT_DIR/logs/api.log" 2>&1 &

print_success "API service started"

cd "$SCRIPT_DIR"

### ───────────── Start Builder ─────────────

print_status "Starting Maestro Builder frontend..."

if [ ! -f "index.html" ]; then
    print_error "Expected to find Builder frontend at project root (index.html not found)"
    exit 1
fi

if ! command -v node &>/dev/null; then
    print_error "Node.js is required but not installed."
    exit 1
fi

if ! command -v npm &>/dev/null; then
    print_error "npm is required but not installed."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
fi

print_status "Starting Builder frontend on http://localhost:5174"
nohup npm run dev > "$SCRIPT_DIR/logs/builder.log" 2>&1 &

print_success "Builder frontend started"

### ───────────── Wait for Services ─────────────

print_status "Waiting for services to be ready..."

if wait_for_service "http://localhost:8001/api/health" "API service"; then
    print_success "API is ready at http://localhost:8001"
    print_status "API docs: http://localhost:8001/docs"
else
    print_error "API service failed to start"
    exit 1
fi

if wait_for_service "http://localhost:5174" "Builder frontend"; then
    print_success "Builder frontend is ready at http://localhost:5174"
else
    print_error "Builder frontend failed to start"
    exit 1
fi

### ───────────── Summary ─────────────

print_success "All Maestro services are now running!"
echo ""
echo "Services:"
echo "  - API: http://localhost:8001"
echo "  - API Docs: http://localhost:8001/docs"
echo "  - Builder Frontend: http://localhost:5174"
echo ""
echo "Logs:"
echo "  - API: logs/api.log"
echo "  - Builder: logs/builder.log"
echo ""
echo "To stop all services, run: ./stop.sh"
echo "To view logs: tail -f logs/api.log | tail -f logs/builder.log"
