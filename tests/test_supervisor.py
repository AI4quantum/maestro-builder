"""
Tests for the SupervisorAgent class and related functionality.
This module provides comprehensive test coverage for intent classification,
workflow generation, and YAML editing operations.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import json
import yaml
from unittest.mock import Mock, patch, MagicMock
import requests

from api.supervisor import SupervisorAgent, Intent, Classification


class TestSupervisorAgent:
    """Test suite for SupervisorAgent class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.supervisor = SupervisorAgent(timeout_seconds=10)
        
    def test_supervisor_agent_initialization(self):
        """Test SupervisorAgent initialization."""
        agent = SupervisorAgent()
        assert agent.timeout_seconds == 30
        
        agent_custom = SupervisorAgent(timeout_seconds=60)
        assert agent_custom.timeout_seconds == 60

    @patch('requests.post')
    def test_classify_user_intent_generate_workflow(self, mock_post):
        """Test intent classification for workflow generation."""
        # Mock successful supervisor response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": json.dumps({
                "intent": "GENERATE_WORKFLOW",
                "confidence": 0.95,
                "reasoning": "User wants to create a new workflow"
            })
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.classify_user_intent(
            "Create a workflow to process customer data",
            "",
            ""
        )
        
        assert isinstance(result, Classification)
        assert result.intent == Intent.GENERATE_WORKFLOW
        assert result.confidence == 0.95
        assert "new workflow" in result.reasoning
        
        # Verify the request was made correctly
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == self.supervisor.SUPERVISOR_URL
        assert "agent" in call_args[1]["json"]
        assert call_args[1]["json"]["agent"] == "IntentClassifier"

    @patch('requests.post')
    def test_classify_user_intent_edit_yaml(self, mock_post):
        """Test intent classification for YAML editing."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": json.dumps({
                "intent": "EDIT_YAML",
                "confidence": 0.88,
                "reasoning": "User wants to modify existing YAML content"
            })
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.classify_user_intent(
            "Change the timeout to 30 seconds",
            "existing agents yaml",
            "existing workflow yaml"
        )
        
        assert result.intent == Intent.EDIT_YAML
        assert result.confidence == 0.88
        assert "modify existing" in result.reasoning

    @patch('requests.post')
    def test_classify_user_intent_supervisor_failure(self, mock_post):
        """Test handling of supervisor service failure."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            self.supervisor.classify_user_intent("test input", "", "")
        
        assert "Supervisor agent failed with status 500" in str(exc_info.value)

    @patch('requests.post')
    def test_classify_user_intent_invalid_json_response(self, mock_post):
        """Test handling of invalid JSON response from supervisor."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": "This is not valid JSON"
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.classify_user_intent("test input", "", "")
        
        # Should fall back to default
        assert result.intent == Intent.GENERATE_WORKFLOW
        assert result.confidence == 0.5
        assert "parsing error" in result.reasoning

    @patch('requests.post')
    def test_classify_user_intent_network_error(self, mock_post):
        """Test handling of network errors."""
        mock_post.side_effect = requests.RequestException("Network error")
        
        with pytest.raises(Exception) as exc_info:
            self.supervisor.classify_user_intent("test input", "", "")
        
        assert "Failed to communicate with supervisor agent" in str(exc_info.value)

    @patch('requests.post')
    def test_generate_agents_yaml_success(self, mock_post):
        """Test successful agents YAML generation."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": """```yaml
apiVersion: v1
kind: Agent
metadata:
  name: test-agent
spec:
  description: A test agent
```"""
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.generate_agents_yaml("Create a test agent")
        
        assert "apiVersion: v1" in result
        assert "name: test-agent" in result
        assert "description: A test agent" in result

    @patch('requests.post')
    def test_generate_agents_yaml_failure(self, mock_post):
        """Test handling of agents generation failure."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Generation failed"
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            self.supervisor.generate_agents_yaml("test input")
        
        assert "Agents generation failed" in str(exc_info.value)

    @patch('requests.post')
    def test_generate_workflow_yaml_success(self, mock_post):
        """Test successful workflow YAML generation."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": """```yaml
apiVersion: v1
kind: Workflow
metadata:
  name: test-workflow
spec:
  steps:
    - name: step1
      agent: test-agent
```"""
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.generate_workflow_yaml("Create a test workflow")
        
        assert "apiVersion: v1" in result
        assert "kind: Workflow" in result
        assert "name: test-workflow" in result

    @patch('requests.post')
    def test_edit_yaml_success(self, mock_post):
        """Test successful YAML editing."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": """```yaml
apiVersion: v1
kind: Agent
metadata:
  name: updated-agent
spec:
  description: Updated description
  timeout: 30
```"""
        }
        mock_post.return_value = mock_response
        
        original_yaml = """apiVersion: v1
kind: Agent
metadata:
  name: original-agent
spec:
  description: Original description"""
        
        result = self.supervisor.edit_yaml(
            original_yaml, 
            "agents.yaml", 
            "Change timeout to 30 seconds"
        )
        
        assert "timeout: 30" in result
        assert "Updated description" in result

    def test_extract_yaml_from_output_with_yaml_markers(self):
        """Test YAML extraction from output with yaml markers."""
        output = """Here's the generated YAML:

```yaml
apiVersion: v1
kind: Agent
metadata:
  name: test
```

That's the result."""
        
        result = self.supervisor._extract_yaml_from_output(output)
        expected = """apiVersion: v1
kind: Agent
metadata:
  name: test"""
        
        assert result == expected

    def test_extract_yaml_from_output_with_generic_markers(self):
        """Test YAML extraction from output with generic markers."""
        output = """```
apiVersion: v1
kind: Agent
metadata:
  name: test
```"""
        
        result = self.supervisor._extract_yaml_from_output(output)
        expected = """apiVersion: v1
kind: Agent
metadata:
  name: test"""
        
        assert result == expected

    def test_extract_yaml_from_output_without_markers(self):
        """Test YAML extraction when there are no code markers."""
        output = """apiVersion: v1
kind: Agent
metadata:
  name: test

Some additional text here."""
        
        result = self.supervisor._extract_yaml_from_output(output)
        expected = """apiVersion: v1
kind: Agent
metadata:
  name: test"""
        
        assert result == expected

    def test_parse_agents_yaml_to_info_valid_yaml(self):
        """Test parsing agents YAML to info with valid YAML."""
        agents_yaml = """apiVersion: v1
kind: Agent
metadata:
  name: agent1
spec:
  description: First agent
---
apiVersion: v1
kind: Agent
metadata:
  name: agent2
spec:
  description: Second agent"""
        
        result = self.supervisor.parse_agents_yaml_to_info(agents_yaml)
        
        assert len(result) == 2
        assert result[0]["name"] == "agent1"
        assert result[0]["description"] == "First agent"
        assert result[1]["name"] == "agent2"
        assert result[1]["description"] == "Second agent"

    def test_parse_agents_yaml_to_info_invalid_yaml(self):
        """Test parsing agents YAML with invalid YAML (fallback to regex)."""
        invalid_yaml = """name: agent1
description: |
  First agent description
name: agent2
description: |
  Second agent description"""
        
        result = self.supervisor.parse_agents_yaml_to_info(invalid_yaml)
        
        assert len(result) == 2
        assert result[0]["name"] == "agent1"
        assert result[1]["name"] == "agent2"

    def test_build_workflow_prompt(self):
        """Test building workflow prompt from agents info."""
        agents_info = [
            {"name": "agent1", "description": "First agent"},
            {"name": "agent2", "description": "Second agent"}
        ]
        user_input = "Process customer data"
        
        result = self.supervisor.build_workflow_prompt(agents_info, user_input)
        
        assert "agent1: agent1 – First agent" in result
        assert "agent2: agent2 – Second agent" in result
        assert "prompt: Process customer data" in result

    @patch.object(SupervisorAgent, 'generate_agents_yaml')
    @patch.object(SupervisorAgent, 'generate_workflow_yaml')
    @patch.object(SupervisorAgent, 'parse_agents_yaml_to_info')
    @patch.object(SupervisorAgent, 'build_workflow_prompt')
    def test_process_complete_workflow_generation(
        self, mock_build_prompt, mock_parse_agents, 
        mock_gen_workflow, mock_gen_agents
    ):
        """Test complete workflow generation process."""
        # Set up mocks
        mock_gen_agents.return_value = "agents yaml content"
        mock_parse_agents.return_value = [{"name": "agent1", "description": "desc1"}]
        mock_build_prompt.return_value = "workflow prompt"
        mock_gen_workflow.return_value = "workflow yaml content"
        
        agents_yaml, workflow_yaml = self.supervisor.process_complete_workflow_generation(
            "Create a data processing workflow"
        )
        
        assert agents_yaml == "agents yaml content"
        assert workflow_yaml == "workflow yaml content"
        
        # Verify the call chain
        mock_gen_agents.assert_called_once_with("Create a data processing workflow")
        mock_parse_agents.assert_called_once_with("agents yaml content")
        mock_build_prompt.assert_called_once_with(
            [{"name": "agent1", "description": "desc1"}],
            "Create a data processing workflow"
        )
        mock_gen_workflow.assert_called_once_with("workflow prompt")

    def test_build_success_response_generation(self):
        """Test building success response for generation intent."""
        result = self.supervisor.build_success_response(
            Intent.GENERATE_WORKFLOW, 
            "Create a workflow"
        )
        
        assert "Successfully generated both agents.yaml and workflow.yaml" in result
        assert "Create a workflow" in result
        assert "agents.yaml" in result
        assert "workflow.yaml" in result

    def test_build_success_response_editing(self):
        """Test building success response for edit intent."""
        result = self.supervisor.build_success_response(
            Intent.EDIT_YAML, 
            "Change timeout", 
            "agents.yaml"
        )
        
        assert "Successfully edited agents.yaml" in result
        assert "Change timeout" in result


class TestIntentClassificationEdgeCases:
    """Test edge cases for intent classification."""
    
    def setup_method(self):
        self.supervisor = SupervisorAgent()

    @patch('requests.post')
    def test_malformed_json_response(self, mock_post):
        """Test handling of malformed JSON in supervisor response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": '{"intent": "INVALID_INTENT", "confidence": "not_a_number"}'
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.classify_user_intent("test", "", "")
        
        # Should fall back to default intent
        assert result.intent == Intent.GENERATE_WORKFLOW
        assert result.confidence == 0.5

    @patch('requests.post')
    def test_missing_fields_in_response(self, mock_post):
        """Test handling of missing fields in supervisor JSON response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": '{"intent": "GENERATE_WORKFLOW"}'  # missing confidence and reasoning
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.classify_user_intent("test", "", "")
        
        assert result.intent == Intent.GENERATE_WORKFLOW
        assert result.confidence == 1.0  # default value
        assert result.reasoning == ""  # default value

    @patch('requests.post')
    def test_empty_yaml_extraction(self, mock_post):
        """Test YAML extraction when no YAML content is found."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": "No YAML content here, just plain text."
        }
        mock_post.return_value = mock_response
        
        result = self.supervisor.generate_agents_yaml("test")
        
        # Should return the stripped text as fallback
        assert result == "No YAML content here, just plain text."


class TestSupervisorIntegration:
    """Integration tests that test multiple components together."""
    
    def setup_method(self):
        self.supervisor = SupervisorAgent()

    def test_yaml_parsing_with_real_yaml_structure(self):
        """Test YAML parsing with realistic agent definitions."""
        agents_yaml = """apiVersion: v1
kind: Agent
metadata:
  name: DataProcessor
spec:
  description: |
    Processes incoming data streams and validates format
  framework: langchain
---
apiVersion: v1
kind: Agent
metadata:
  name: EmailSender
spec:
  description: |
    Sends notification emails to stakeholders
  framework: custom"""
        
        result = self.supervisor.parse_agents_yaml_to_info(agents_yaml)
        
        assert len(result) == 2
        assert result[0]["name"] == "DataProcessor"
        assert "Processes incoming data" in result[0]["description"]
        assert result[1]["name"] == "EmailSender"
        assert "notification emails" in result[1]["description"]

    def test_workflow_prompt_building_realistic_scenario(self):
        """Test workflow prompt building with realistic agent data."""
        agents_info = [
            {
                "name": "DataValidator", 
                "description": "Validates incoming data against schema"
            },
            {
                "name": "DataTransformer", 
                "description": "Transforms data to required format"
            },
            {
                "name": "DatabaseWriter", 
                "description": "Writes processed data to database"
            }
        ]
        
        user_input = "Create a pipeline to process customer orders"
        
        prompt = self.supervisor.build_workflow_prompt(agents_info, user_input)
        
        assert "agent1: DataValidator – Validates incoming data against schema" in prompt
        assert "agent2: DataTransformer – Transforms data to required format" in prompt
        assert "agent3: DatabaseWriter – Writes processed data to database" in prompt
        assert "prompt: Create a pipeline to process customer orders" in prompt


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

