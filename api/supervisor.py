"""
Supervisor Agent Module

This module contains the supervisor agent logic that classifies user intent
and routes requests to appropriate handlers (workflow generation or YAML editing).
"""

import json
import re
import yaml
import requests
from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Tuple


class Intent(str, Enum):
    GENERATE_WORKFLOW = "GENERATE_WORKFLOW"
    EDIT_YAML = "EDIT_YAML"


@dataclass
class Classification:
    intent: Intent
    confidence: float
    reasoning: str


class SupervisorAgent:
    """
    Supervisor agent that classifies user intent and coordinates workflow generation
    or YAML editing based on the classification.
    """
    
    SUPERVISOR_URL = "http://localhost:8005/chat"
    AGENTS_GENERATION_URL = "http://localhost:8003/chat"
    WORKFLOW_GENERATION_URL = "http://localhost:8004/chat"
    EDITING_URL = "http://localhost:8001/api/edit_yaml"
    
    def __init__(self, timeout_seconds: int = 30, logger_callback=None):
        self.timeout_seconds = timeout_seconds
        self.logger_callback = logger_callback
    
    def _log(self, message: str, level: str = "info"):
        """Log a message using the provided callback or print to console."""
        if self.logger_callback:
            self.logger_callback(message, level)
        else:
            print(f"[{level.upper()}] {message}")

    def classify_user_intent(
        self,
        user_input: str,
        agents_yaml_content: str = "",
        workflow_yaml_content: str = "",
    ) -> Classification:
        """
        Classify user intent using the supervisor agent.
        
        Args:
            user_input: The user's request
            agents_yaml_content: Current agents YAML content for context
            workflow_yaml_content: Current workflow YAML content for context
            
        Returns:
            Classification object with intent, confidence, and reasoning
            
        Raises:
            Exception: If supervisor agent fails or returns invalid response
        """
        self._log("🔍 Starting to classify user prompt...")
        self._log(f"📝 User input: {user_input[:100]}{'...' if len(user_input) > 100 else ''}")
        
        supervisor_prompt = self._build_classification_prompt(
            user_input, agents_yaml_content, workflow_yaml_content
        )
        
        try:
            self._log("🤖 Sending request to supervisor agent for intent classification...")
            resp = requests.post(
                self.SUPERVISOR_URL,
                json={"prompt": supervisor_prompt, "agent": "IntentClassifier"},
                timeout=self.timeout_seconds,
            )
            
            if resp.status_code != 200:
                self._log(f"❌ Supervisor agent failed with status {resp.status_code}", "error")
                raise Exception(
                    f"Supervisor agent failed with status {resp.status_code}: {resp.text}"
                )

            supervisor_response = resp.json().get("response", "")
            classification = self._parse_classification_response(supervisor_response)
            
            self._log(f"✅ Intent classified as: {classification.intent.value} (confidence: {classification.confidence:.2f})")
            self._log(f"💭 Reasoning: {classification.reasoning}")
            
            return classification
            
        except requests.RequestException as e:
            self._log(f"❌ Failed to communicate with supervisor agent: {str(e)}", "error")
            raise Exception(f"Failed to communicate with supervisor agent: {str(e)}")

    def _build_classification_prompt(
        self, user_input: str, agents_yaml_content: str, workflow_yaml_content: str
    ) -> str:
        """Build the prompt for intent classification."""
        return f"""You are an intent classifier. Determine if the user wants to GENERATE_WORKFLOW or EDIT_YAML.

User input: {user_input}

Current YAML files (if any):
Agents YAML:
{agents_yaml_content}

Workflow YAML:
{workflow_yaml_content}

Return ONLY valid JSON (no prose, no markdown) with the following schema:
{{
  "intent": "GENERATE_WORKFLOW" | "EDIT_YAML",
  "confidence": number,  // 0.0 to 1.0
  "reasoning": string
}}

Example valid responses:
{{"intent":"GENERATE_WORKFLOW","confidence":0.92,"reasoning":"User is asking to create a new flow"}}
{{"intent":"EDIT_YAML","confidence":0.87,"reasoning":"User wants to modify existing YAML"}}"""

    def _parse_classification_response(self, supervisor_response: str) -> Classification:
        """Parse the JSON response from the supervisor agent."""
        try:
            parsed = json.loads(supervisor_response)
            raw_intent = str(parsed.get("intent", "")).upper()
            
            # Validate intent value
            intent = (
                Intent(raw_intent)
                if raw_intent in (Intent.GENERATE_WORKFLOW.value, Intent.EDIT_YAML.value)
                else Intent.GENERATE_WORKFLOW
            )
            
            confidence = float(parsed.get("confidence", 1.0))
            reasoning = str(parsed.get("reasoning", ""))
            
            return Classification(intent=intent, confidence=confidence, reasoning=reasoning)
            
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # Fallback to default intent if parsing fails
            return Classification(
                intent=Intent.GENERATE_WORKFLOW,
                confidence=0.5,
                reasoning=f"Defaulted due to supervisor parsing error: {str(e)}",
            )

    def generate_agents_yaml(self, user_input: str) -> str:
        """
        Generate agents YAML from user input.
        
        Args:
            user_input: The user's request
            
        Returns:
            Generated agents YAML content
            
        Raises:
            Exception: If agents generation fails
        """
        self._log("🏗️ Starting agents YAML generation...")
        self._log("📡 Connecting to agents generation service (port 8003)...")
        
        try:
            resp = requests.post(
                self.AGENTS_GENERATION_URL,
                json={"prompt": user_input, "agent": "TaskInterpreter"},
                timeout=120,  # Longer timeout for generation
            )
            
            if resp.status_code != 200:
                self._log(f"❌ Agents generation failed with status {resp.status_code}", "error")
                raise Exception(f"Agents generation failed: {resp.text}")
            
            self._log("✅ Agents generation completed successfully")
            self._log("🔄 Extracting YAML content from response...")
            
            agents_output = resp.json().get("response", "")
            agents_yaml = self._extract_yaml_from_output(agents_output)
            
            self._log(f"📄 Generated agents YAML ({len(agents_yaml)} characters)")
            
            return agents_yaml
            
        except requests.RequestException as e:
            self._log(f"❌ Failed to communicate with agents generation service: {str(e)}", "error")
            raise Exception(f"Failed to communicate with agents generation service: {str(e)}")

    def generate_workflow_yaml(self, workflow_prompt: str) -> str:
        """
        Generate workflow YAML from workflow prompt.
        
        Args:
            workflow_prompt: The constructed workflow prompt
            
        Returns:
            Generated workflow YAML content
            
        Raises:
            Exception: If workflow generation fails
        """
        self._log("⚙️ Starting workflow YAML generation...")
        self._log("📡 Connecting to workflow generation service (port 8004)...")
        
        try:
            resp = requests.post(
                self.WORKFLOW_GENERATION_URL,
                json={"prompt": workflow_prompt, "agent": "WorkflowYAMLBuilder"},
                timeout=120,  # Longer timeout for generation
            )
            
            if resp.status_code != 200:
                self._log(f"❌ Workflow generation failed with status {resp.status_code}", "error")
                raise Exception(f"Workflow generation failed: {resp.text}")
            
            self._log("✅ Workflow generation completed successfully")
            self._log("🔄 Extracting YAML content from response...")
            
            workflow_output = resp.json().get("response", "")
            workflow_yaml = self._extract_yaml_from_output(workflow_output)
            
            self._log(f"📄 Generated workflow YAML ({len(workflow_yaml)} characters)")
            
            return workflow_yaml
            
        except requests.RequestException as e:
            self._log(f"❌ Failed to communicate with workflow generation service: {str(e)}", "error")
            raise Exception(f"Failed to communicate with workflow generation service: {str(e)}")

    def edit_yaml(self, yaml_content: str, file_to_edit: str, instruction: str) -> str:
        """
        Edit existing YAML content based on user instruction.
        
        Args:
            yaml_content: Current YAML content
            file_to_edit: Name of the file being edited
            instruction: User's editing instruction
            
        Returns:
            Edited YAML content
            
        Raises:
            Exception: If YAML editing fails
        """
        self._log(f"✏️ Starting YAML editing for {file_to_edit}...")
        self._log("📡 Connecting to editing service (port 8002)...")
        
        try:
            resp = requests.post(
                "http://localhost:8002/chat",
                json={
                    "prompt": f"Current YAML file (type: {file_to_edit.split('.')[0]}):\n{yaml_content}\n\nUser instruction: {instruction}\n\nPlease apply the requested edit and return only the updated YAML file."
                },
                timeout=self.timeout_seconds,
            )
            
            if resp.status_code != 200:
                self._log(f"❌ YAML editing failed with status {resp.status_code}", "error")
                raise Exception(f"YAML editing failed: {resp.text}")
            
            self._log("✅ YAML editing completed successfully")
            self._log("🔄 Extracting edited YAML content...")
            
            edited_output = resp.json().get("response", "")
            edited_yaml = self._extract_yaml_from_output(edited_output)
            
            self._log(f"📄 Edited YAML ready ({len(edited_yaml)} characters)")
            
            return edited_yaml
            
        except requests.RequestException as e:
            self._log(f"❌ Failed to communicate with editing service: {str(e)}", "error")
            raise Exception(f"Failed to communicate with editing service: {str(e)}")

    def _extract_yaml_from_output(self, text: str) -> str:
        """Extract YAML content from model output."""
        if "```yaml" in text:
            return text.split("```yaml", 1)[-1].split("```", 1)[0].strip()
        if "```" in text:
            return text.split("```", 1)[-1].split("```", 1)[0].strip()
        
        # Try to find YAML content starting with apiVersion
        yaml_match = re.search(r"apiVersion:.*?(?=\n\n|\Z)", text, re.DOTALL)
        return yaml_match.group(0).strip() if yaml_match else text.strip()

    def parse_agents_yaml_to_info(self, agents_yaml: str) -> List[Dict[str, str]]:
        """
        Parse agents YAML to extract agent information for workflow generation.
        
        Args:
            agents_yaml: The agents YAML content
            
        Returns:
            List of dictionaries with agent name and description
        """
        agents_info: List[Dict[str, str]] = []
        
        try:
            agent_blocks = agents_yaml.split("---")
            for block in agent_blocks:
                if block.strip():
                    agent_data = yaml.safe_load(block)
                    if (
                        agent_data
                        and "metadata" in agent_data
                        and "name" in agent_data["metadata"]
                    ):
                        name = agent_data["metadata"]["name"]
                        description = agent_data.get("spec", {}).get("description", "")
                        agents_info.append({"name": name, "description": description})
                        
        except yaml.YAMLError:
            name_matches = re.findall(r"name:\s*(\w+)", agents_yaml)
            desc_matches = re.findall(
                r"description:\s*\|\s*\n\s*(.+?)(?=\n\s*\w+:|$)", agents_yaml, re.DOTALL
            )
            for i, name in enumerate(name_matches):
                description = desc_matches[i] if i < len(desc_matches) else ""
                agents_info.append({"name": name, "description": description.strip()})
                
        return agents_info

    def build_workflow_prompt(self, agents_info: List[Dict[str, str]], user_input: str) -> str:
        """
        Build workflow generation prompt from agents info and user input.
        
        Args:
            agents_info: List of agent information dictionaries
            user_input: Original user request
            
        Returns:
            Constructed workflow prompt
        """
        workflow_prompt = "Create a workflow that uses the following agents:\n\n"
        for i, agent in enumerate(agents_info, 1):
            workflow_prompt += f"agent{i}: {agent['name']} – {agent['description']}\n"
        workflow_prompt += f"\nprompt: {user_input}"
        return workflow_prompt

    def process_complete_workflow_generation(self, user_input: str) -> Tuple[str, str]:
        """
        Process complete workflow generation (both agents and workflow).
        
        Args:
            user_input: User's request
            
        Returns:
            Tuple of (agents_yaml, workflow_yaml)
            
        Raises:
            Exception: If any step of the generation process fails
        """
        self._log("🚀 Starting complete workflow generation process...")
        
        agents_yaml = self.generate_agents_yaml(user_input)
        self._log("🔍 Parsing generated agents for workflow creation...")
        agents_info = self.parse_agents_yaml_to_info(agents_yaml)
        self._log(f"📋 Found {len(agents_info)} agents to include in workflow")
        
        self._log("📝 Building workflow generation prompt...")
        workflow_prompt = self.build_workflow_prompt(agents_info, user_input)
        workflow_yaml = self.generate_workflow_yaml(workflow_prompt)
        
        self._log("🎉 Complete workflow generation finished successfully!")
        
        return agents_yaml, workflow_yaml

    def build_success_response(self, intent: Intent, user_request: str, file_edited: str = None) -> str:
        """
        Build success response message based on the operation performed.
        
        Args:
            intent: The intent that was processed
            user_request: Original user request
            file_edited: Name of file that was edited (for edit operations)
            
        Returns:
            Success message string
        """
        if intent == Intent.EDIT_YAML and file_edited:
            return f"Successfully edited {file_edited} based on your request: {user_request}"
        
        return (
            "✅ Successfully generated both agents.yaml and workflow.yaml from your prompt!\n\n"
            f"Your request: \"{user_request}\"\n\n"
            "I've created:\n"
            "• **agents.yaml** - Contains the agent definitions\n"
            "• **workflow.yaml** - Contains the workflow that uses those agents\n\n"
            "Both files are now available in the YAML panel on the right. You can switch between tabs to view each file."
        )
