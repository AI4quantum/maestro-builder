#!/bin/bash

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

# Define all relevant PID files and ports
PID_FILES=(
  "logs/maestro_agents.pid"
  "logs/maestro_workflow.pid"
  "logs/editing_agent.pid"
  "logs/supervisor_agent.pid"
  "logs/api.pid"
  "logs/builder.pid"
)
PORTS=(8000 8001 8002 8003 8004 8005 5174)

CLEAR_LOGS=false
for arg in "$@"; do
  if [[ "$arg" == "--clear-logs" || "$arg" == "-c" ]]; then
    CLEAR_LOGS=true
  fi
done

print_status "Stopping Maestro services..."

# 1. Kill by PID (if PID file exists)
for pidfile in "${PID_FILES[@]}"; do
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      print_status "Killing process with PID $pid from $pidfile..."
      kill "$pid" 2>/dev/null || true
      sleep 2
      if kill -0 "$pid" 2>/dev/null; then
        print_warning "PID $pid did not stop, force killing..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
      fi
    fi
    rm -f "$pidfile"
    print_success "Removed $pidfile."
  else
    print_status "$pidfile does not exist."
  fi
done

# 2. Kill any process listening on relevant ports
for port in "${PORTS[@]}"; do
  pids=$(lsof -ti :$port || true)
  if [ -n "$pids" ]; then
    print_status "Killing processes on port $port (PIDs: $pids)..."
    kill -9 $pids 2>/dev/null || true
    print_success "Killed processes on port $port."
  else
    print_success "No processes found on port $port."
  fi
done


ports_in_use=()
for port in "${PORTS[@]}"; do
  if lsof -i :$port | grep LISTEN >/dev/null 2>&1; then
    ports_in_use+=("$port")
  fi
done

if [ "$CLEAR_LOGS" = true ]; then
  print_status "Clearing all log files..."
  > logs/api.log
  > logs/builder.log
  > logs/maestro_agents.log
  > logs/maestro_workflow.log
  > logs/editing_agent.log
  > logs/supervisor_agent.log
  > logs/maestro.log
  print_success "All log files have been cleared."
fi

if [ ${#ports_in_use[@]} -eq 0 ]; then
  print_success "All Maestro services have been stopped and all relevant ports are free!"
  exit 0
else
  print_error "Some ports are still in use: ${ports_in_use[*]}"
  print_error "You may need to manually investigate and stop these processes."
  exit 1
fi 