import { useState, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Send, Paperclip, Mic, ChevronDown, Lightbulb } from 'lucide-react'
import { cn } from '../lib/utils'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  streamingEnabled?: boolean
  onToggleStreaming?: (enabled: boolean) => void
}

export function ChatInput({ onSendMessage, disabled = false, streamingEnabled = true, onToggleStreaming }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const suggestions = [
    "Create a simple workflow to test",
    "I want to fetch the current stock prices for Apple and Microsoft, and then analyze which one has performed better over the past week.",
    "Create a workflow to fetch the current weather in San Francisco"
  ]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    if (!disabled) {
      onSendMessage(suggestion)
      setShowSuggestions(false)
    }
  }

  return (
    <div className="w-full font-['Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
      <div className="relative">
        <div className={cn(
          "flex items-end gap-3 p-4 bg-white/90 border border-gray-200 rounded-full shadow-xl transition-shadow backdrop-blur-md",
          disabled ? "opacity-50" : "hover:shadow-lg"
        )}>
          {/* Attachment Button */}
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-xl hover:bg-gray-100 disabled:opacity-50"
            disabled={disabled}
          >
            <Paperclip size={20} />
          </button>



          {/* Suggestions Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => !disabled && setShowSuggestions(!showSuggestions)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-xl hover:bg-gray-100 flex items-center gap-1 disabled:opacity-50"
              title="Show suggestions"
              disabled={disabled}
            >
              <Lightbulb size={22} />
              <ChevronDown size={18} className={cn("transition-transform", showSuggestions && "rotate-180")} />
            </button>
            
            {showSuggestions && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                <div className="p-3">
                  <div className="text-sm font-medium text-gray-500 mb-2 px-2">Suggestions</div>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 mb-1"
                      disabled={disabled}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Streaming Toggle */}
          {onToggleStreaming && (
            <button
              onClick={() => !disabled && onToggleStreaming(!streamingEnabled)}
              className={cn(
                "p-2 rounded-xl transition-all duration-200 flex items-center gap-2",
                streamingEnabled 
                  ? "bg-green-100 text-green-600 hover:bg-green-200" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                disabled && "opacity-50"
              )}
              title={streamingEnabled ? "Disable streaming" : "Enable streaming"}
              disabled={disabled}
            >
              <div className={cn(
                "w-2 h-2 rounded-full transition-colors",
                streamingEnabled ? "bg-green-500" : "bg-gray-400"
              )} />
              <span className="text-xs font-medium">
                {streamingEnabled ? "Live" : "Batch"}
              </span>
            </button>
          )}

          {/* Text Input */}
          <div className="flex-1 min-h-[44px] max-h-32">
            <textarea
              value={message}
              onChange={(e) => {
                if (!disabled) {
                  setMessage(e.target.value)
                  setIsTyping(e.target.value.length > 0)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Processing" : "Ask me to help you build your Maestro workflow"}
              className="w-full h-full min-h-[44px] max-h-32 resize-none bg-transparent border-none outline-none text-base placeholder:text-gray-400 leading-relaxed disabled:opacity-50 font-['Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]"
              rows={1}
              disabled={disabled}
            />
          </div>

          {/* Voice Button */}
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-xl hover:bg-gray-100 disabled:opacity-50"
            disabled={disabled}
          >
            <Mic size={20} />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className={cn(
              "p-2 rounded-full transition-all duration-200 shadow-md",
              message.trim() && !disabled
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 scale-105"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <Send size={20} />
          </button>
        </div>

        {/* Typing Indicator */}
        {isTyping && !disabled && (
          <div className="absolute -top-8 left-4 text-sm text-gray-400 bg-white/90 px-2 py-1 rounded-full shadow-md">
            Press Enter to send, Shift+Enter for new line
          </div>
        )}
      </div>
    </div>
  )
} 