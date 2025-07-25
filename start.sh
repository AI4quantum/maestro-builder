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

# Start Maestro Agent Generation backend (port 8003)
AGENTS_CMD="maestro serve ./meta-agents-v2/agents_file_generation/agents.yaml ./meta-agents-v2/agents_file_generation/workflow.yaml --port 8003"
print_status "Starting Maestro Agent Generation backend: $AGENTS_CMD"
nohup $AGENTS_CMD > logs/maestro_agents.log 2>&1 &
AGENTS_PID=$!
echo $AGENTS_PID > logs/maestro_agents.pid
print_success "Maestro Agent Generation backend started with PID: $AGENTS_PID (port 8003)"

# Start Maestro Workflow Generation backend (port 8004)
WORKFLOW_CMD="maestro serve ./meta-agents-v2/workflow_file_generation/agents.yaml ./meta-agents-v2/workflow_file_generation/workflow.yaml --port 8004"
print_status "Starting Maestro Workflow Generation backend: $WORKFLOW_CMD"
nohup $WORKFLOW_CMD > logs/maestro_workflow.log 2>&1 &
WORKFLOW_PID=$!
echo $WORKFLOW_PID > logs/maestro_workflow.pid
print_success "Maestro Workflow Generation backend started with PID: $WORKFLOW_PID (port 8004)"

# Start Editing Agent backend (port 8002)
EDITING_AGENT_CMD="maestro serve ./meta-agents-v2/editing_agent/agents.yaml ./meta-agents-v2/editing_agent/workflow.yaml --port 8002"
print_status "Starting Editing Agent backend: $EDITING_AGENT_CMD"
nohup $EDITING_AGENT_CMD > logs/editing_agent.log 2>&1 &
EDITING_AGENT_PID=$!
echo $EDITING_AGENT_PID > logs/editing_agent.pid
print_success "Editing Agent backend started with PID: $EDITING_AGENT_PID (port 8002)"

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

# Check if Python virtual environment is active
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${RED}[ERROR]${NC} Python virtual environment is not active. Please activate it with 'source .venv/bin/activate' before running this script."
    exit 1
fi

REQUIREMENTS_FILE="$SCRIPT_DIR/api/requirements.txt"
VENV_DIR="$SCRIPT_DIR/.venv"
REQUIREMENTS_MARKER="$VENV_DIR/.requirements_installed"

if [ ! -d "$VENV_DIR" ]; then
    print_error "Python virtual environment not found at $VENV_DIR. Please create it and install dependencies before running this script."
    exit 1
else
    print_status "Using existing virtual environment at $VENV_DIR..."
    source "$VENV_DIR/bin/activate"
fi

mkdir -p storage

PYTHONPATH="$SCRIPT_DIR" nohup bash -c "source \"$VENV_DIR/bin/activate\" && python -m api.main" >> "$SCRIPT_DIR/logs/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$SCRIPT_DIR/logs/api.pid"

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
BUILDER_PID=$!
echo $BUILDER_PID > "$SCRIPT_DIR/logs/builder.pid"

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
echo "  - Agent Generation Backend: http://localhost:8003"
echo "  - Workflow Generation Backend: http://localhost:8004"
echo "  - Editing Agent Backend: http://localhost:8002"
echo "  - API: http://localhost:8001"
echo "  - API Docs: http://localhost:8001/docs"
echo "  - Builder Frontend: http://localhost:5174"
echo ""
echo "Logs:"
echo "  - Agent Generation: logs/maestro_agents.log"
echo "  - Workflow Generation: logs/maestro_workflow.log"
echo "  - Editing Agent: logs/editing_agent.log"
echo "  - API: logs/api.log"
echo "  - Builder: logs/builder.log"
echo ""
echo "To stop all services, run: ./stop.sh"
echo "To view logs: tail -f logs/api.log | tail -f logs/builder.log | tail -f logs/maestro_agents.log | tail -f logs/maestro_workflow.log | tail -f logs/editing_agent.log"
