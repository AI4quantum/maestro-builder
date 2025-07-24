#!/bin/bash

# Maestro Stop Script (PID-based)
# Safely stops all Maestro services using PID files

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

SERVICES=(
  "maestro_agents:logs/maestro_agents.pid"
  "maestro_workflow:logs/maestro_workflow.pid"
  "editing_agent:logs/editing_agent.pid"
  "api:logs/api.pid"
  "builder:logs/builder.pid"
)

print_status "Stopping Maestro services using PID files..."

all_stopped=true
for entry in "${SERVICES[@]}"; do
  name="${entry%%:*}"
  pidfile="${entry#*:}"
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      print_status "Stopping $name (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 2
      if kill -0 "$pid" 2>/dev/null; then
        print_error "$name (PID $pid) did not stop. Killing forcefully."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
      fi
    fi
    
    if kill -0 "$pid" 2>/dev/null; then
      print_error "$name (PID $pid) is still running!"
      all_stopped=false
    else
      print_success "$name stopped."
    fi
    rm -f "$pidfile"

  else
    print_success "$name is not running (no PID file)."
  fi
done

# Kill any orphaned Vite/Node processes
print_status "Killing any orphaned Vite/Node processes..."
pkill -f 'node.*vite' || true
print_success "Orphaned Vite/Node processes (if any) have been killed."

echo ""
if [ "$all_stopped" = true ]; then
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

if [ -f "logs/maestro_agents.log" ]; then
    print_status "Agent Generation logs are available at: logs/maestro_agents.log"
fi

if [ -f "logs/maestro_workflow.log" ]; then
    print_status "Workflow Generation logs are available at: logs/maestro_workflow.log"
fi

if [ -f "logs/editing_agent.log" ]; then
    print_status "Editing Agent logs are available at: logs/editing_agent.log"
fi

echo ""
echo "To start services again, run: ./start.sh" 