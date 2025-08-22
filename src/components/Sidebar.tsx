import { useState } from 'react'
import { ChevronLeft, ChevronRight, Settings, FileText, Bot, Workflow, History, Star, Plus, Trash2, MessageSquare, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ChatHistory } from '../services/api'

interface SidebarProps {
  chatHistory: ChatHistory[]
  currentChatId: string | null
  onLoadChat: (chatId: string) => Promise<void>
  onCreateChat: () => Promise<void>
  onDeleteChat: (chatId: string) => Promise<void>
  onDeleteAllChats: () => Promise<void>
}

export function Sidebar({ chatHistory, currentChatId, onLoadChat, onCreateChat, onDeleteChat, onDeleteAllChats }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength)
  }

  const handleDeleteAll = async () => {
    await onDeleteAllChats()
    setShowDeleteAllConfirm(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowDeleteAllConfirm(false)
    } else if (e.key === 'Escape') {
      setShowDeleteAllConfirm(false)
    }
  }

  return (
    <>
    <div className={cn(
      "h-full border-r border-gray-100 bg-white/80 backdrop-blur-md shadow-xl transition-all duration-300 flex-shrink-0 font-['Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]",
      isCollapsed ? "w-16" : "w-72"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white/60 backdrop-blur-md rounded-t-2xl">
        {!isCollapsed && (
          <h2 className="text-sm font-semibold text-gray-900 tracking-wide">Chat History</h2>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
            title={isCollapsed ? "Expand menu" : "Collapse menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          {!isCollapsed && chatHistory.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="p-2 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"
              title="Delete all chats"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-gray-100 bg-white/60 backdrop-blur-md">
        <button
          onClick={onCreateChat}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 text-sm rounded-full transition-all duration-200 shadow-md",
            "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 font-semibold tracking-wide"
          )}
        >
          <Plus size={18} />
          {!isCollapsed && <span className="truncate">New Chat</span>}
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {chatHistory.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={24} className="text-gray-400 mx-auto mb-2" />
              {!isCollapsed && (
                <p className="text-xs text-gray-500">No chat history yet</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "group relative rounded-xl transition-all duration-200 shadow-sm",
                    currentChatId === chat.id ? "bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300" : "hover:bg-gray-50 border border-transparent"
                  )}
                >
                  <button
                    onClick={() => onLoadChat(chat.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 text-left rounded-xl",
                      currentChatId === chat.id
                        ? "text-blue-800 font-semibold"
                        : "text-gray-700 hover:text-gray-900"
                    )}
                  >
                    <MessageSquare size={18} />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">{chat.name}</div>
                        <div className="truncate text-gray-500">
                          {truncateText(chat.last_message, 30)}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {formatDate(chat.created_at)} 2 {chat.message_count} messages
                        </div>
                      </div>
                    )}
                  </button>
                  
                  {/* Delete button */}
                  {!isCollapsed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(chat.id)
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-100"
                      title="Delete chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-white/60 backdrop-blur-md rounded-b-2xl">
        <button
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 text-sm rounded-full transition-all duration-200 shadow-sm",
            "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <Settings size={18} />
          {!isCollapsed && <span className="truncate">Settings</span>}
        </button>
      </div>
    </div>

    {/* Delete All Confirmation Dialog */}
    {showDeleteAllConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div 
          className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-2xl border border-gray-200 backdrop-blur-sm"
          onKeyDown={handleKeyPress}
          tabIndex={0}
          style={{ backgroundColor: 'white' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete All Chats</h3>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>
          
          <p className="text-sm text-gray-700 mb-6 leading-relaxed">
            Are you sure you want to delete all chat history? This will permanently remove all conversations and generated YAML files.
          </p>
          
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteAllConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAll}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete All
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
} 