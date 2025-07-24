import { useEffect, useRef } from 'react'
import { Bot, User, Code, FileText, Loader2 } from 'lucide-react'
import type { Message } from '../App'
import { cn } from '../lib/utils'

interface ChatCanvasProps {
  messages: Message[]
  isLoading?: boolean
}

export function ChatCanvas({ messages, isLoading = false }: ChatCanvasProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user'
    const isYaml = message.content.includes('```yaml')

    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-4 px-4 py-6 transition-colors font-['Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md",
          isUser 
            ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white" 
            : "bg-gray-200 text-gray-600"
        )}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 flex flex-col items-start">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-xs text-gray-900 tracking-wide">
              {isUser ? 'You' : 'Maestro AI'}
            </span>
            <span className="text-xs text-gray-400">
              {formatTime(message.timestamp)}
            </span>
          </div>

          {/* YAML or Text Content */}
          {isYaml ? (
            <div className="mt-2 p-4 bg-white border border-gray-200 rounded-2xl shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-600">
                  Generated YAML
                </span>
              </div>
              <pre className="text-sm bg-gray-50 p-4 rounded-xl overflow-x-auto border font-mono whitespace-pre-wrap break-words">
                <code className="text-gray-800">
                  {message.content.replace(/```yaml\n?|\n?```/g, '')}
                </code>
              </pre>
            </div>
          ) : (
            <div className={cn(
              "text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words bg-white/80 rounded-2xl px-5 py-3 shadow-md",
              isUser ? "bg-gradient-to-br from-blue-50 to-indigo-50 text-right" : "bg-white/80 text-left"
            )}>
              {message.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md shadow-md rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
            <Code size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-wide text-gray-900">Maestro AI Builder</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bot size={32} className="text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-2">Start building your Maestro agents and workflows</h3>
              <p className="text-xs text-gray-500">Ask me to help you create agents and workflows</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map(renderMessage)}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-4 p-6 bg-gray-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium text-xs text-gray-900">Maestro AI</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}