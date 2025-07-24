#!/bin/bash

# Maestro Stop Script
# Safely stops both the API and Builder frontend services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Change to the parent directory (maestro root) for PID file access
cd ..



# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes by port
kill_process_by_port() {
    local port=$1
    local service_name=$2
    
    if check_port "$port"; then
        print_warning "$service_name is still running on port $port, attempting to kill by port..."
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        
        if [ -n "$pids" ]; then
            for pid in $pids; do
                print_status "Killing process $pid on port $port..."
                kill -9 "$pid" 2>/dev/null || true
            done
            
            # Wait a moment and check again
            sleep 2
            if check_port "$port"; then
                print_error "Failed to stop $service_name on port $port"
                return 1
            else
                print_success "$service_name stopped on port $port"
                return 0
            fi
        else
            print_error "Could not find process using port $port"
            return 1
        fi
    else
        print_success "$service_name is not running on port $port"
        return 0
    fi
}

print_status "Stopping Maestro services..."

# Stop services by port (more reliable than PID files)
kill_process_by_port 8001 "API service"
kill_process_by_port 5174 "Builder frontend"
kill_process_by_port 8002 "Editing Agent backend"
kill_process_by_port 8003 "Agent Generation backend"
kill_process_by_port 8004 "Workflow Generation backend"

# Final verification
echo ""
print_status "Verifying services are stopped..."

api_stopped=true
builder_stopped=true
editing_agent_stopped=true
agent_gen_stopped=true
workflow_gen_stopped=true

if check_port 8001; then
    print_error "API service is still running on port 8001"
    api_stopped=false
fi

if check_port 5174; then
    print_error "Builder frontend is still running on port 5174"
    builder_stopped=false
fi

if check_port 8002; then
    print_error "Editing Agent backend is still running on port 8002"
    editing_agent_stopped=false
fi

if check_port 8003; then
    print_error "Agent Generation backend is still running on port 8003"
    agent_gen_stopped=false
fi

if check_port 8004; then
    print_error "Workflow Generation backend is still running on port 8004"
    workflow_gen_stopped=false
fi

if [ "$api_stopped" = true ] && [ "$builder_stopped" = true ] && [ "$editing_agent_stopped" = true ] && [ "$agent_gen_stopped" = true ] && [ "$workflow_gen_stopped" = true ]; then
    print_success "All Maestro services have been stopped successfully!"
else
    print_error "Some services may still be running. You may need to manually stop them."
    exit 1
fi

# Clean up log files if they exist
if [ -f "logs/api.log" ]; then
    print_status "API logs are available at: logs/api.log"
fi

if [ -f "logs/builder.log" ]; then
    print_status "Builder logs are available at: logs/builder.log"
fi

echo ""
echo "To start services again, run: ./start.sh" 