"""
Maestro Builder API
A FastAPI application to support the Maestro Builder frontend application.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from api.ai_agent import MaestroBuilderAgent
from api.database import Database
import uuid
import requests
import subprocess
import tempfile
import os
import yaml
import re

# Initialize FastAPI app
app = FastAPI(
    title="Maestro Builder API",
    description="API for the Maestro Builder application",
    version="1.0.0",
)

# CORS settings for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agent + database
ai_agent = MaestroBuilderAgent()
db = Database()


# ---------------------------------------
# Models
# ---------------------------------------
class ChatMessage(BaseModel):
    content: str
    role: str = "user"
    chat_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    yaml_files: List[Dict[str, str]]
    chat_id: str


class ChatHistory(BaseModel):
    id: str
    name: str
    created_at: datetime
    last_message: str
    message_count: int


class YamlFile(BaseModel):
    name: str
    content: str


class ChatSession(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    messages: List[Dict[str, Any]]
    yaml_files: Dict[str, str]


class EditYamlRequest(BaseModel):
    yaml: str
    instruction: str
    file_type: str  # 'agents' or 'workflow'

class EditYamlResponse(BaseModel):
    edited_yaml: str

class ValidateYamlRequest(BaseModel):
    yaml_content: str
    file_type: str

class ValidateYamlResponse(BaseModel):
    is_valid: bool
    message: str
    errors: List[str] = []

# ---------------------------------------
# Routes
# ---------------------------------------


@app.get("/")
async def root():
    return {"message": "Maestro Builder API", "version": "1.0.0"}


@app.post("/api/chat_builder_agent", response_model=ChatResponse)
async def chat_builder_agent(message: ChatMessage):
    try:
        resp = requests.post(
            "http://localhost:8003/chat",
            json={"prompt": message.content, "agent": "TaskInterpreter"},
        )
        if resp.status_code != 200:
            raise Exception(resp.text)

        full_output = resp.json().get("response", "")
        extracted_yaml = ""
        if "```yaml" in full_output:
            extracted_yaml = (
                full_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
            )
        elif "```" in full_output:
            extracted_yaml = full_output.split("```", 1)[-1].split("```", 1)[0].strip()

        return {
            "response": full_output,
            "yaml_files": [{"name": "agents.yaml", "content": extracted_yaml}],
            "chat_id": str(uuid.uuid4()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Builder Agent failed: {e}")


@app.post("/api/chat_builder_workflow", response_model=ChatResponse)
async def chat_builder_workflow(message: ChatMessage):
    try:
        resp = requests.post(
            "http://localhost:8004/chat",
            json={"prompt": message.content, "agent": "WorkflowYAMLBuilder"},
        )
        if resp.status_code != 200:
            raise Exception(resp.text)

        full_output = resp.json().get("response", "")
        extracted_yaml = ""
        if "```yaml" in full_output:
            extracted_yaml = (
                full_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
            )
        elif "```" in full_output:
            extracted_yaml = full_output.split("```", 1)[-1].split("```", 1)[0].strip()

        return {
            "response": full_output,
            "yaml_files": [{"name": "workflow.yaml", "content": extracted_yaml}],
            "chat_id": str(uuid.uuid4()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow Builder failed: {e}")


@app.post("/api/chat_builder_complete", response_model=ChatResponse)
async def chat_builder_complete(message: ChatMessage):
    """
    Generate both agents.yaml and workflow.yaml from a single user prompt.
    First generates agents, then parses them to create a workflow prompt.
    """
    try:
        agents_resp = requests.post(
            "http://localhost:8003/chat",
            json={"prompt": message.content, "agent": "TaskInterpreter"},
        )
        if agents_resp.status_code != 200:
            raise Exception(f"Agents generation failed: {agents_resp.text}")

        agents_output = agents_resp.json().get("response", "")
        agents_yaml = ""
        if "```yaml" in agents_output:
            agents_yaml = (
                agents_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
            )
        elif "```" in agents_output:
            agents_yaml = agents_output.split("```", 1)[-1].split("```", 1)[0].strip()
        else:

            yaml_match = re.search(r'apiVersion:.*?(?=\n\n|\Z)', agents_output, re.DOTALL)
            if yaml_match:
                agents_yaml = yaml_match.group(0).strip()

        agents_info = []
        try:
            agent_blocks = agents_yaml.split('---')
            for block in agent_blocks:
                if block.strip():
                    agent_data = yaml.safe_load(block)
                    if agent_data and 'metadata' in agent_data and 'name' in agent_data['metadata']:
                        name = agent_data['metadata']['name']
                        description = agent_data.get('spec', {}).get('description', '')
                        agents_info.append({
                            'name': name,
                            'description': description
                        })
        except yaml.YAMLError:

            name_matches = re.findall(r'name:\s*(\w+)', agents_yaml)
            desc_matches = re.findall(r'description:\s*\|\s*\n\s*(.+?)(?=\n\s*\w+:|$)', agents_yaml, re.DOTALL)
            
            for i, name in enumerate(name_matches):
                description = desc_matches[i] if i < len(desc_matches) else ""
                agents_info.append({
                    'name': name,
                    'description': description.strip()
                })

        workflow_prompt = f"Create a workflow that uses the following agents:\n\n"
        for i, agent in enumerate(agents_info, 1):
            workflow_prompt += f"agent{i}: {agent['name']} – {agent['description']}\n"
        workflow_prompt += f"\nprompt: {message.content}"


        workflow_resp = requests.post(
            "http://localhost:8004/chat",
            json={"prompt": workflow_prompt, "agent": "WorkflowYAMLBuilder"},
        )
        if workflow_resp.status_code != 200:
            raise Exception(f"Workflow generation failed: {workflow_resp.text}")

        workflow_output = workflow_resp.json().get("response", "")
        workflow_yaml = ""
        if "```yaml" in workflow_output:
            workflow_yaml = (
                workflow_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
            )
        elif "```" in workflow_output:
            workflow_yaml = workflow_output.split("```", 1)[-1].split("```", 1)[0].strip()
        else:
            yaml_match = re.search(r'apiVersion:.*?(?=\n\n|\Z)', workflow_output, re.DOTALL)
            if yaml_match:
                workflow_yaml = yaml_match.group(0).strip()

        clean_response = f"""✅ Successfully generated both agents.yaml and workflow.yaml from your prompt!

Your request: "{message.content}"

I've created:
• **agents.yaml** - Contains the agent definitions
• **workflow.yaml** - Contains the workflow that uses those agents

Both files are now available in the YAML panel on the right. You can switch between tabs to view each file."""

        return {
            "response": clean_response,
            "yaml_files": [
                {"name": "agents.yaml", "content": agents_yaml},
                {"name": "workflow.yaml", "content": workflow_yaml}
            ],
            "chat_id": str(uuid.uuid4()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Complete Builder failed: {e}")


@app.get("/api/get_yamls/{chat_id}", response_model=List[YamlFile])
async def get_yamls(chat_id: str):
    try:
        yaml_files = db.get_yaml_files(chat_id)
        if not yaml_files:
            raise HTTPException(
                status_code=404, detail="Chat session not found or no YAML files"
            )
        return [
            YamlFile(name=name, content=content) for name, content in yaml_files.items()
        ]
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving YAML files: {str(e)}"
        )


@app.get("/api/chat_history", response_model=List[ChatHistory])
async def get_chat_history():
    try:
        sessions = db.get_all_chat_sessions()
        history = []
        for session in sessions:
            messages = db.get_messages(session["id"], limit=1)
            last_message = messages[-1]["content"] if messages else ""
            history.append(
                ChatHistory(
                    id=session["id"],
                    name=session["name"],
                    created_at=datetime.fromisoformat(session["created_at"]),
                    last_message=last_message,
                    message_count=session["message_count"],
                )
            )
        return history
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving chat history: {str(e)}"
        )


@app.get("/api/chat_session/{chat_id}", response_model=ChatSession)
async def get_chat_session(chat_id: str):
    try:
        session = db.get_chat_session(chat_id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        messages = db.get_messages(chat_id)
        yaml_files = db.get_yaml_files(chat_id)

        return ChatSession(
            id=session["id"],
            name=session["name"],
            created_at=datetime.fromisoformat(session["created_at"]),
            updated_at=datetime.fromisoformat(session["updated_at"]),
            message_count=session["message_count"],
            messages=messages,
            yaml_files=yaml_files,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving chat session: {str(e)}"
        )


@app.post("/api/chat_sessions")
async def create_chat_session(name: Optional[str] = None):
    try:
        chat_id = db.create_chat_session(name=name)
        return {"chat_id": chat_id}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error creating chat session: {str(e)}"
        )


@app.delete("/api/delete_all_chats")
async def delete_all_chat_sessions():
    try:
        success = db.delete_all_chat_sessions()
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to delete all chat sessions"
            )
        return {"message": "All chat sessions deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting all chat sessions: {str(e)}"
        )


@app.delete("/api/chat_sessions/{chat_id}")
async def delete_chat_session(chat_id: str):
    try:
        success = db.delete_chat_session(chat_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat session not found")
        return {"message": "Chat session deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting chat session: {str(e)}"
        )


@app.post("/api/edit_yaml", response_model=EditYamlResponse)
async def edit_yaml(request: EditYamlRequest):
    try:
        # Build the prompt for the editing agent
        prompt = f"Current YAML file (type: {request.file_type}):\n{request.yaml}\n\nUser instruction: {request.instruction}\n\nPlease apply the requested edit and return only the updated YAML file."
        resp = requests.post(
            "http://localhost:8002/chat",
            json={"prompt": prompt},
        )
        if resp.status_code != 200:
            raise Exception(resp.text)
        edited_yaml = resp.json().get("response", "")
        # Remove markdown formatting if present
        if "```yaml" in edited_yaml:
            edited_yaml = (
                edited_yaml.split("```yaml", 1)[-1].split("```", 1)[0].strip()
            )
        elif "```" in edited_yaml:
            edited_yaml = edited_yaml.split("```", 1)[-1].split("```", 1)[0].strip()
        return {"edited_yaml": edited_yaml}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Editing Agent failed: {e}")


@app.post("/api/validate_yaml", response_model=ValidateYamlResponse)
async def validate_yaml(request: ValidateYamlRequest):
    try:
        # fix double-escaped characters
        import codecs
        unescaped_content = codecs.decode(request.yaml_content, 'unicode_escape')
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
            temp_file.write(unescaped_content)
            temp_file_path = temp_file.name
        
        try:
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            result = subprocess.run(
                ['maestro', 'validate', temp_file_path],
                capture_output=True,
                text=True,
                cwd=project_root
            )
            os.unlink(temp_file_path)
            
            if result.returncode == 0:
                return ValidateYamlResponse(
                    is_valid=True,
                    message="YAML file is valid!",
                    errors=[]
                )
            else:
                error_output = result.stderr.strip() or result.stdout.strip()
                import re
                def strip_ansi_codes(text):
                    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
                    return ansi_escape.sub('', text)
                
                cleaned_error_output = strip_ansi_codes(error_output)
                error_lines = [line for line in cleaned_error_output.split('\n') if line.strip()]
                
                if not error_lines:
                    error_lines = ["Validation failed but no specific error message was provided"]
                if "'file_path'" in cleaned_error_output:
                    error_lines.append("Note: Code agents require a 'file_path' field that specifies where the code should be saved.")
                    error_lines.append("Add 'file_path: ./your_agent_name.py' to the spec section.")
                    error_lines.append("Alternatively, consider using 'framework: beeai' for agents that don't need file paths.")
                
                return ValidateYamlResponse(
                    is_valid=False,
                    message="YAML validation failed",
                    errors=error_lines
                )
                
        except FileNotFoundError:
            os.unlink(temp_file_path)
            return ValidateYamlResponse(
                is_valid=False,
                message="Maestro CLI not found. Please ensure maestro is installed and available in PATH.",
                errors=["Maestro CLI not found"]
            )
        except Exception as e:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            return ValidateYamlResponse(
                is_valid=False,
                message=f"Validation error: {str(e)}",
                errors=[str(e)]
            )
            
    except Exception as e:
        return ValidateYamlResponse(
            is_valid=False,
            message=f"Failed to validate YAML: {str(e)}",
            errors=[str(e)]
        )


class SupervisorRequest(BaseModel):
    content: str
    chat_id: Optional[str] = None

class SupervisorResponse(BaseModel):
    intent: str
    confidence: float
    reasoning: str
    response: str
    yaml_files: List[Dict[str, str]]
    chat_id: str

@app.post("/api/supervisor", response_model=SupervisorResponse)
async def supervisor_route(request: SupervisorRequest):
    """
    Main entry point that uses the supervisor agent to route requests to either
    workflow generation or YAML editing based on user intent.
    """
    try:
        agents_yaml_content = ""
        workflow_yaml_content = ""
        
        if request.chat_id:
            try:
                yaml_files = db.get_yaml_files(request.chat_id)
                for file in yaml_files:
                    if file['name'] == 'agents.yaml':
                        agents_yaml_content = file['content']
                    elif file['name'] == 'workflow.yaml':
                        workflow_yaml_content = file['content']
            except Exception as e:
                print(f"Warning: Could not fetch YAML files for context: {e}")
        
        supervisor_prompt = f"""Analyze the user's input and classify their intent as either workflow generation or YAML editing.

User input: {request.content}

Current YAML files (if any):
Agents YAML:
{agents_yaml_content}

Workflow YAML:
{workflow_yaml_content}

Please classify the user's intent and return a JSON response with intent, confidence, and reasoning."""

        print(f"Calling supervisor agent with prompt: {supervisor_prompt[:100]}...")
        resp = requests.post(
            "http://localhost:8005/chat",
            json={
                "prompt": supervisor_prompt,
                "agent": "IntentClassifier"
            },
            timeout=30
        )
        
        print(f"Supervisor agent response status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"Supervisor agent error: {resp.text}")
            raise Exception(f"Supervisor agent failed with status {resp.status_code}")
        
        supervisor_response = resp.json().get("response", "")
        print(f"Supervisor agent response: {supervisor_response[:200]}...")
        
        def extract_intent_from_response(response_text):
            """Extract intent from supervisor response, handling any format"""
            print(f"Processing supervisor response: {response_text[:200]}...")
            if "GENERATE_WORKFLOW" in response_text:
                return "GENERATE_WORKFLOW"
            elif "EDIT_YAML" in response_text:
                return "EDIT_YAML"
            else:
                return "GENERATE_WORKFLOW"
        
        intent = extract_intent_from_response(supervisor_response)
        print(f"Extracted intent: {intent}")
        
        # Route to appropriate endpoint based on intent
        if intent == "EDIT_YAML":
            if not agents_yaml_content and not workflow_yaml_content:
                intent = "GENERATE_WORKFLOW"
            
            if intent == "EDIT_YAML":
                file_to_edit = "agents.yaml" if agents_yaml_content else "workflow.yaml"
                yaml_content = agents_yaml_content if agents_yaml_content else workflow_yaml_content
                edit_resp = requests.post(
                    "http://localhost:8001/api/edit_yaml",
                    json={
                        "yaml": yaml_content,
                        "instruction": request.content,
                        "file_type": file_to_edit.split('.')[0]  # 'agents' or 'workflow'
                    },
                    timeout=30
                )
                
                if edit_resp.status_code == 200:
                    edit_data = edit_resp.json()
                    return SupervisorResponse(
                        intent=intent,
                        confidence=1.0,
                        reasoning="Successfully routed to editing",
                        response=f"Successfully edited {file_to_edit} based on your request: {request.content}",
                        yaml_files=[{
                            "name": file_to_edit,
                            "content": edit_data["edited_yaml"]
                        }],
                        chat_id=request.chat_id or str(uuid.uuid4())
                    )
                else:
                    intent = "GENERATE_WORKFLOW"
        
        if intent == "GENERATE_WORKFLOW":
            print("Routing to workflow generation...")
            try:
                print("Calling agent generation on port 8003...")
                agents_resp = requests.post(
                    "http://localhost:8003/chat",
                    json={"prompt": request.content, "agent": "TaskInterpreter"},
                    timeout=120
                )
                print(f"Agent generation response status: {agents_resp.status_code}")
                if agents_resp.status_code != 200:
                    print(f"Agent generation error: {agents_resp.text}")
                    raise Exception(f"Agents generation failed: {agents_resp.text}")

                agents_output = agents_resp.json().get("response", "")
                print(f"Agent generation output length: {len(agents_output)}")
                agents_yaml = ""
                if "```yaml" in agents_output:
                    agents_yaml = (
                        agents_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
                    )
                elif "```" in agents_output:
                    agents_yaml = agents_output.split("```", 1)[-1].split("```", 1)[0].strip()
                else:
                    yaml_match = re.search(r'apiVersion:.*?(?=\n\n|\Z)', agents_output, re.DOTALL)
                    if yaml_match:
                        agents_yaml = yaml_match.group(0).strip()
                agents_info = []
                try:
                    agent_blocks = agents_yaml.split('---')
                    for block in agent_blocks:
                        if block.strip():
                            agent_data = yaml.safe_load(block)
                            if agent_data and 'metadata' in agent_data and 'name' in agent_data['metadata']:
                                name = agent_data['metadata']['name']
                                description = agent_data.get('spec', {}).get('description', '')
                                agents_info.append({
                                    'name': name,
                                    'description': description
                                })
                except yaml.YAMLError:
                    name_matches = re.findall(r'name:\s*(\w+)', agents_yaml)
                    desc_matches = re.findall(r'description:\s*\|\s*\n\s*(.+?)(?=\n\s*\w+:|$)', agents_yaml, re.DOTALL)
                    
                    for i, name in enumerate(name_matches):
                        description = desc_matches[i] if i < len(desc_matches) else ""
                        agents_info.append({
                            'name': name,
                            'description': description.strip()
                        })

                workflow_prompt = f"Create a workflow that uses the following agents:\n\n"
                for i, agent in enumerate(agents_info, 1):
                    workflow_prompt += f"agent{i}: {agent['name']} – {agent['description']}\n"
                workflow_prompt += f"\nprompt: {request.content}"

                print("Calling workflow generation on port 8004...")
                workflow_resp = requests.post(
                    "http://localhost:8004/chat",
                    json={"prompt": workflow_prompt, "agent": "WorkflowYAMLBuilder"},
                    timeout=120
                )
                print(f"Workflow generation response status: {workflow_resp.status_code}")
                if workflow_resp.status_code != 200:
                    print(f"Workflow generation error: {workflow_resp.text}")
                    raise Exception(f"Workflow generation failed: {workflow_resp.text}")

                workflow_output = workflow_resp.json().get("response", "")
                print(f"Workflow generation output length: {len(workflow_output)}")
                workflow_yaml = ""
                if "```yaml" in workflow_output:
                    workflow_yaml = (
                        workflow_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
                    )
                elif "```" in workflow_output:
                    workflow_yaml = workflow_output.split("```", 1)[-1].split("```", 1)[0].strip()
                else:
                    yaml_match = re.search(r'apiVersion:.*?(?=\n\n|\Z)', workflow_output, re.DOTALL)
                    if yaml_match:
                        workflow_yaml = yaml_match.group(0).strip()
                
                print(f"Extracted workflow YAML length: {len(workflow_yaml)}")

                clean_response = f"""✅ Successfully generated both agents.yaml and workflow.yaml from your prompt!

Your request: "{request.content}"

I've created:
• **agents.yaml** - Contains the agent definitions
• **workflow.yaml** - Contains the workflow that uses those agents

Both files are now available in the YAML panel on the right. You can switch between tabs to view each file."""

                return SupervisorResponse(
                    intent=intent,
                    confidence=1.0,
                    reasoning="Successfully routed to workflow generation",
                    response=clean_response,
                    yaml_files=[
                        {"name": "agents.yaml", "content": agents_yaml},
                        {"name": "workflow.yaml", "content": workflow_yaml}
                    ],
                    chat_id=request.chat_id or str(uuid.uuid4())
                )
            except Exception as e:
                raise Exception(f"Workflow generation failed: {str(e)}")
        
    except Exception as e:
        print(f"Error in supervisor routing: {str(e)}")
        try:
            agents_resp = requests.post(
                "http://localhost:8003/chat",
                json={"prompt": request.content, "agent": "TaskInterpreter"},
                timeout=120
            )
            if agents_resp.status_code != 200:
                raise Exception(f"Agents generation failed: {agents_resp.text}")

            agents_output = agents_resp.json().get("response", "")
            agents_yaml = ""
            if "```yaml" in agents_output:
                agents_yaml = (
                    agents_output.split("```yaml", 1)[-1].split("```", 1)[0].strip()
                )
            elif "```" in agents_output:
                agents_yaml = agents_output.split("```", 1)[-1].split("```", 1)[0].strip()
            else:
                yaml_match = re.search(r'apiVersion:.*?(?=\n\n|\Z)', agents_output, re.DOTALL)
                if yaml_match:
                    agents_yaml = yaml_match.group(0).strip()

            clean_response = f"""✅ Successfully generated agents.yaml from your prompt!

Your request: "{request.content}"

I've created:
• **agents.yaml** - Contains the agent definitions

The file is now available in the YAML panel on the right."""

            return SupervisorResponse(
                intent="GENERATE_WORKFLOW",
                confidence=1.0,
                reasoning=f"Error in supervisor routing: {str(e)}, falling back to agent generation only",
                response=clean_response,
                yaml_files=[
                    {"name": "agents.yaml", "content": agents_yaml}
                ],
                chat_id=request.chat_id or str(uuid.uuid4())
            )
        except Exception as fallback_error:
            raise HTTPException(status_code=500, detail=f"Supervisor routing failed: {str(e)}, fallback also failed: {str(fallback_error)}")


@app.get("/api/health")
async def health_check():
    try:
        sessions = db.get_all_chat_sessions()
        return {
            "status": "healthy",
            "database": "connected",
            "sessions_count": len(sessions),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
