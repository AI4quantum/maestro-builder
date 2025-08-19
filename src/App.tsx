import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatCanvas } from './components/ChatCanvas'
import { YamlPanel } from './components/YamlPanel'
import { ChatInput } from './components/ChatInput'
import { apiService, type ChatHistory, type StreamEvent } from './services/api'
import axios from 'axios'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface YamlFile {
  name: string
  content: string
  language: 'yaml'
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your Maestro AI Builder assistant. I can help you create both agents.yaml and workflow.yaml files from a single prompt. Just describe what you want to build, and I\'ll generate both files automatically. What would you like to build today?',
      timestamp: new Date()
    }
  ])
  
  const [yamlFiles, setYamlFiles] = useState<YamlFile[]>([
    {
      name: 'agents.yaml',
      content: '# Agents configuration will be generated here\nagents:\n  # Your agents will appear here',
      language: 'yaml'
    },
    {
      name: 'workflow.yaml',
      content: '# Workflow configuration will be generated here\nworkflow:\n  # Your workflow will appear here',
      language: 'yaml'
    }
  ])

  const [isLoading, setIsLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([])
  const [activeYamlTab, setActiveYamlTab] = useState<'agents.yaml' | 'workflow.yaml'>('agents.yaml');
  const [streamingEnabled, setStreamingEnabled] = useState(true);

  // Load chat history on component mount
  useEffect(() => {
    loadChatHistory()
  }, [])

  const loadChatHistory = async () => {
    try {
      const history = await apiService.getChatHistory()
      setChatHistory(history)
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const loadChatSession = async (chatId: string) => {
    try {
      setIsLoading(true)
      const session = await apiService.getChatSession(chatId)
      
      if (session) {
        const sessionMessages: Message[] = session.messages.map(msg => ({
          id: msg.id.toString(),
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }))

        // Convert YAML files to app format, ensuring both files are always present
        const sessionYamlFiles: YamlFile[] = [
          {
            name: 'agents.yaml',
            content: session.yaml_files['agents.yaml'] || '# Agents configuration will be generated here\nagents:\n  # Your agents will appear here',
            language: 'yaml'
          },
          {
            name: 'workflow.yaml',
            content: session.yaml_files['workflow.yaml'] || '# Workflow configuration will be generated here\nworkflow:\n  # Your workflow will appear here',
            language: 'yaml'
          }
        ]

        setMessages(sessionMessages)
        setYamlFiles(sessionYamlFiles)
        setCurrentChatId(chatId)
        apiService.setCurrentChatId(chatId)
      }
    } catch (error) {
      console.error('Error loading chat session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNewChat = async () => {
    try {
      const chatId = await apiService.createChatSession()
      setCurrentChatId(chatId)
      apiService.setCurrentChatId(chatId)
      
      // Reset to initial state with empty YAML files
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I\'m your Maestro AI Builder assistant. I can help you create both agents.yaml and workflow.yaml files from a single prompt. Just describe what you want to build, and I\'ll generate both files automatically. What would you like to build today?',
          timestamp: new Date()
        }
      ])
      
      // Set YAML files to empty state
      setYamlFiles([
        {
          name: 'agents.yaml',
          content: '# Agents configuration will be generated here\n# This file will contain your Maestro agent definitions\nagents:\n  # Your agents will appear here as you chat with the AI',
          language: 'yaml'
        },
        {
          name: 'workflow.yaml',
          content: '# Workflow configuration will be generated here\n# This file will contain your Maestro workflow definitions\nworkflow:\n  # Your workflow will appear here as you chat with the AI',
          language: 'yaml'
        }
      ])
      
      // Refresh chat history
      await loadChatHistory()
    } catch (error) {
      console.error('Error creating new chat:', error)
    }
  }

  const deleteChat = async (chatId: string) => {
    try {
      const success = await apiService.deleteChatSession(chatId)
      if (success) {
        // If we deleted the current chat, create a new one
        if (currentChatId === chatId) {
          await createNewChat()
        }
        // Refresh chat history
        await loadChatHistory()
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const deleteAllChats = async () => {
    try {
      console.log('Starting delete all chats...')
      const success = await apiService.deleteAllChatSessions()
      console.log('Delete all chats result:', success)
      
      if (success) {
        console.log('Creating new chat after deletion...')
        // Create a new chat since all chats were deleted
        await createNewChat()
        console.log('Refreshing chat history...')
        // Refresh chat history (should be empty now)
        await loadChatHistory()
        console.log('Delete all chats completed successfully')
      } else {
        console.error('Failed to delete all chats - API returned false')
      }
    } catch (error) {
      console.error('Error deleting all chats:', error)
    }
  }

  const handleSendMessage = async (content: string, useStreaming: boolean = true) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Create a dedicated live log/status message
    const assistantLogId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantLogId,
      role: 'assistant',
      content: 'Starting…',
      timestamp: new Date()
    }])

    const mergeYaml = (incoming: { name: string; content: string }) => {
      setYamlFiles(prev => {
        const exists = prev.find(f => f.name === incoming.name)
        if (exists) {
          return prev.map(f => f.name === incoming.name ? { ...f, content: incoming.content } : f)
        }
        return [...prev, { name: incoming.name, content: incoming.content, language: 'yaml' }]
      })
    }

    // Start log streaming scoped to this run
    const closeAgentsLogs = apiService.streamLogs('agents', false, data => {
      if (data.type === 'log' && data.line) {
        const line = data.line as string
        setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: m.content ? `${m.content}\n${line}` : line } : m))
      }
    })
    const closeWorkflowLogs = apiService.streamLogs('workflow', false, data => {
      if (data.type === 'log' && data.line) {
        const line = data.line as string
        setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: m.content ? `${m.content}\n${line}` : line } : m))
      }
    })

    try {
      if (useStreaming) {
        await apiService.streamGenerateMessage(content, {
        onEvent: async (event: StreamEvent) => {
          if (event.type === 'status') {
            setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: m.content ? `${m.content}\n… ${event.message}` : `… ${event.message}` } : m))
          }
          if (event.type === 'chat_id') {
            if (event.chat_id !== currentChatId) {
              setCurrentChatId(event.chat_id)
              await loadChatHistory()
            }
          }
          if (event.type === 'agents_yaml' || event.type === 'workflow_yaml') {
            mergeYaml(event.file)
          }
          if (event.type === 'ai_output') {
            const line = event.line
            setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: m.content ? `${m.content}\n${line}` : line } : m))
          }
          if (event.type === 'final') {
            // Add a new assistant message with final content
            let parsedText = event.response
            try {
              const parsedJSON = JSON.parse(parsedText as string)
              if ((parsedJSON as any).final_prompt) parsedText = (parsedJSON as any).final_prompt
            } catch {}
            setMessages(prev => [...prev, { id: String(Date.now() + 2), role: 'assistant', content: parsedText, timestamp: new Date() }])
            // Ensure YAML files reflect final payload
            event.yaml_files.forEach(file => mergeYaml(file))
            if (event.chat_id !== currentChatId) {
              setCurrentChatId(event.chat_id)
              await loadChatHistory()
            }
          }
          if (event.type === 'error') {
            setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: `${m.content}\nError: ${event.message}` } : m))
          }
        },
        onError: (err: Error) => {
          console.error('Streaming error:', err)
        },
        onComplete: () => {
          setIsLoading(false)
          // Close scoped log streams
          closeAgentsLogs()
          closeWorkflowLogs()
        }
      }, currentChatId || undefined)
      } else {
        const response = await apiService.sendGenerateMessage(content, currentChatId || undefined)
        response.yaml_files.forEach(file => mergeYaml(file))
        setMessages(prev => [...prev, { 
          id: String(Date.now() + 2), 
          role: 'assistant', 
          content: response.response, 
          timestamp: new Date() 
        }])
        if (response.chat_id !== currentChatId) {
          setCurrentChatId(response.chat_id)
          await loadChatHistory()
        }
        setIsLoading(false)
        closeAgentsLogs()
        closeWorkflowLogs()
      }
    } catch (error) {
      console.error('Error processing message:', error)
      setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: `${m.content}\nSorry, I encountered an error while processing your request. Please try again.` } : m))
      setIsLoading(false)
      closeAgentsLogs()
      closeWorkflowLogs()
    }
  }

  // Helper to get the currently active YAML file (default to agents.yaml)
  const getCurrentYamlFile = () => {
    // For now, just use agents.yaml (can be improved to track active tab)
    return yamlFiles.find(f => f.name === 'agents.yaml') || yamlFiles[0]
  }

  // Handler for editing YAML
  const handleEditYaml = async (instruction: string) => {
    const currentYamlFile = getCurrentYamlFile();
    if (!currentYamlFile) return;
    setIsLoading(true);
    // Add the edit instruction as a user message
    const userEditMessage = {
      id: Date.now().toString(),
      role: 'user' as 'user',
      content: `[Edit YAML] ${instruction}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userEditMessage]);

    try {
      const response = await axios.post('/api/edit_yaml', {
        yaml: currentYamlFile.content,
        instruction,
        file_type: currentYamlFile.name.includes('workflow') ? 'workflow' : 'agents',
      });
      const editedYaml = response.data.edited_yaml;
      // Add the editing agent's response as an assistant message
      const assistantEditMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as 'assistant',
        content: editedYaml,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantEditMessage]);

      setYamlFiles(yamlFiles.map(f =>
        f.name === currentYamlFile.name
          ? { ...f, content: editedYaml }
          : f
      ));
    } catch (error) {
      console.error('Error editing YAML:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectYamlEdit = (fileName: string, newContent: string) => {
    setYamlFiles(prev => prev.map(f =>
      f.name === fileName
        ? { ...f, content: newContent }
        : f
    ));
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar 
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onLoadChat={loadChatSession}
        onCreateChat={createNewChat}
        onDeleteChat={deleteChat}
        onDeleteAllChats={deleteAllChats}
      />

      {/* Main Chat Area */}
      <div className="w-3/5 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1">
          <ChatCanvas messages={messages} isLoading={isLoading} />
        </div>
        {/* Chat Input */}
        <div className="border-t border-gray-100 p-6 shrink-0">
          <ChatInput 
          onSendMessage={handleSendMessage}
          onEditYaml={handleEditYaml}
          disabled={isLoading}
          streamingEnabled={streamingEnabled}
          onToggleStreaming={setStreamingEnabled}
        />
        </div>
      </div>

      {/* Right Panel - YAML */}
      <YamlPanel 
        yamlFiles={yamlFiles} 
        isLoading={isLoading} 
        activeTab={activeYamlTab} 
        setActiveTab={setActiveYamlTab}
        onDirectEdit={handleDirectYamlEdit}
      />
    </div>
  )
}

export default App
