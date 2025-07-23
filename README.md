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
   - Install required dependencies (this will install everything, including Maestro and DuckDuckGo):
     ```bash
     pip install -r api/requirements.txt
     ```

3. **Start everything with one command:**
   ```bash
   ./start.sh [agents|workflow]
   ```