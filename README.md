# Maestro Builder

A modern web-based interface for building Maestro agents and workflows using AI assistance.

---

## 🚀 Quick Start

1. **Clone the repo and enter the directory:**
   ```bash
   git clone <your-repo-url>
   cd maestro-builder
   ```

2. **Set up your Python virtual environment:**
   - Make sure you have Python 3.11:
     ```bash
     python3 --version
     ```
   - Create and activate the virtual environment (must be at the top level of the project):
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   - Install required dependencies:
     ```bash
     uv run pip install -r api/requirements.txt
     ```

3. **Install frontend dependencies:**
   ```bash
   uv run npm install
   ```

4. **Start everything with one command:**
   ```bash
   ./start.sh
   ```

This will start:
- API backend (http://localhost:8001)
- Builder frontend (http://localhost:5174)
- Editing Agent backend (http://localhost:8002)
- Agent Generation backend (http://localhost:8003)
- Workflow Generation backend (http://localhost:8004)

To stop all services, run:
```bash
./stop.sh
```

Log files:
- API: logs/api.log
- Builder: logs/builder.log
- Editing Agent: logs/editing_agent.log
- Agent Generation: logs/maestro_agents.log
- Workflow Generation: logs/maestro_workflow.log