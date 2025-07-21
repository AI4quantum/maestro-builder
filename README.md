# Maestro Builder

A modern web-based interface for building Maestro agents and workflows using AI assistance.

---

## 🚀 Quick Start

1. **Clone the repo and enter the directory:**
   ```bash
   git clone <your-repo-url>
   cd maestro-builder
   ```

2. Set up your environment variables:**
   - Create a `.env` file （should be the same as maestro one):


3. **Start everything with one command:**
   ```bash
   ./start.sh [agents|workflow]
   ```
   - Use `agents` for agent file generation (default if omitted)
   - Use `workflow` for workflow file generation

   This will:
   - Start the Maestro backend (with your chosen config)
   - Start the API server (http://localhost:8001)
   - Start the frontend (http://localhost:5174)

4. **Open your browser:**  
   Go to [http://localhost:5174](http://localhost:5174) to use the Maestro Builder UI.

5. **To stop all services:**
   ```bash
   ./stop.sh
   ```

---

## 🛠️ What’s Happening Under the Hood?

- **Maestro backend** is started with the correct config for your use case and runs at [http://localhost:8000](http://localhost:8000). This backend is responsible for agent/workflow orchestration and is started by the `maestro serve ...` command.
- **API server** runs at [http://localhost:8001](http://localhost:8001) (docs at `/docs`).
- **Frontend** runs at [http://localhost:5174](http://localhost:5174).
- All logs are saved in the `logs/` directory (`maestro.log`, `api.log`, `builder.log`).

---

## 🧑‍💻 Development & Testing

- **Run tests:**  
  ```bash
  pytest tests/
  ```
- **Install dependencies:**  
  ```bash
  pip install -r api/requirements.txt
  pip install pytest requests
  pip install git+https://github.com/AI4quantum/maestro.git@v0.3.0
  pip install "beeai-framework[duckduckgo]"
  ```
- **Frontend dev server:**  
  ```bash
  npm install
  npm run dev
  ```

---

## 📝 Configuration
- **YAML config files:**  
  - Agent and workflow YAMLs are in `meta-agents-v2/agents_file_generation/` and `meta-agents-v2/workflow_file_generation/`.

---

## 🗂️ Project Structure

```
maestro-builder/
├── api/                # FastAPI backend
├── src/                # React frontend
├── meta-agents-v2/     # Example YAML configs
├── tests/              # Unit and integration tests
├── start.sh            # One-command startup
├── stop.sh             # One-command shutdown
└── logs/               # All service logs
```

---

## 🧩 Troubleshooting

- **Internal Server Error?**  
  Check `logs/api.log` and `logs/maestro.log` for Python tracebacks.
- **Frontend not loading?**  
  Make sure `npm install` completed and check `logs/builder.log`.
- **Maestro backend not responding?**  
  Check `logs/maestro.log` and ensure the correct mode was chosen.

---

## 🤝 Contributing

1. Fork the repo and create a feature branch.
2. Make your changes and add tests if needed.
3. Open a pull request!

---

## 📄 License

This project is part of the Maestro framework and follows the same license terms.
