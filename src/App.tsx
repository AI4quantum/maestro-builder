import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatCanvas } from './components/ChatCanvas'
import { YamlPanel } from './components/YamlPanel'
import { ChatInput } from './components/ChatInput'
import { apiService, type ChatHistory } from './services/api'

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
      content: 'Hello! I\'m your Maestro AI Builder assistant. I can help you create workflows and edit YAML files. Just describe what you want to build or what changes you want to make, and I\'ll handle it automatically. What would you like to do today?',
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
          content: 'Hello! I\'m your Maestro AI Builder assistant. I can help you create workflows and edit YAML files. Just describe what you want to build or what changes you want to make, and I\'ll handle it automatically. What would you like to do today?',
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
      const success = await apiService.deleteAllChatSessions()
      
      if (success) {
        // Create a new chat since all chats were deleted
        await createNewChat()
        // Refresh chat history (should be empty now)
        await loadChatHistory()
      } else {
        console.error('Failed to delete all chats - API returned false')
      }
    } catch (error) {
      console.error('Error deleting all chats:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
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


    let stopStatusPolling: (() => void) | undefined
    const startPollingForRequest = (requestChatId: string) => {
      stopStatusPolling = apiService.startStatusPolling(requestChatId, (updates) => {
        updates.forEach(update => {
          setMessages(prev => prev.map(m => 
            m.id === assistantLogId 
              ? { ...m, content: m.content ? `${m.content}\n${update.message}` : update.message } 
              : m
          ))
        })
      })
    }
    try {
      const { requestId } = await apiService.sendMessageAsync(content, currentChatId || undefined);
      startPollingForRequest(requestId);
      let apiResponse: any = null;
      let attempts = 0;
      const maxAttempts = 120;
      
      while (attempts < maxAttempts && !apiResponse) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        apiResponse = await apiService.getAsyncResult(requestId);
        attempts++;
      }
      
      if (!apiResponse) {
        throw new Error('Request timed out after 2 minutes');
      }

      // Parse AI response (final_prompt if available)
      let parsedText = apiResponse.response
      try {
        const parsedJSON = JSON.parse(parsedText)
        if (parsedJSON.final_prompt) {
          parsedText = parsedJSON.final_prompt
        }
      } catch (e) {
        // Not JSON — ignore
      }

      // Don't strip YAML code blocks from the response text since we want to show the full response
      // The YAML files are handled separately in the yaml_files array

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: parsedText,
        role: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      // Update YAML files from API response, ensuring both files are updated
      const updatedYamlFiles = yamlFiles.map(file => {
        const apiFile = apiResponse.yaml_files.find((apiFile: any) => apiFile.name === file.name)
        if (apiFile) {
          return {
            ...file,
            content: apiFile.content
          }
        }
        return file
      })
      setYamlFiles(updatedYamlFiles)

      // Update chat ID if it changed
      if (apiResponse.chat_id !== currentChatId) {
        setCurrentChatId(apiResponse.chat_id)
        await loadChatHistory()
      }

      setIsLoading(false)
      if (stopStatusPolling) {
        setTimeout(() => {
          if (stopStatusPolling) {
            stopStatusPolling()
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Error processing message:', error)
      setMessages(prev => prev.map(m => m.id === assistantLogId ? { ...m, content: `${m.content}\nSorry, I encountered an error while processing your request. Please try again.` } : m))
      setIsLoading(false)
      if (stopStatusPolling) {
        stopStatusPolling()
      }
    }
  }


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
