import { useState, useEffect, useRef } from 'react'
import { FileText, Copy, Download, Eye, EyeOff, Check, Save, GitCompare, CheckCircle, AlertCircle } from 'lucide-react'
import type { YamlFile } from '../App'
import { cn } from '../lib/utils'
import Prism from 'prismjs'
import 'prismjs/components/prism-yaml'
import 'prismjs/themes/prism.css'
// @ts-ignore
import DiffMatchPatch from 'diff-match-patch'
import { apiService } from '../services/api'
import type { ValidateYamlResponse } from '../services/api'

interface YamlPanelProps {
  yamlFiles: YamlFile[]
  isLoading?: boolean
  activeTab: 'agents.yaml' | 'workflow.yaml'
  setActiveTab: (tab: 'agents.yaml' | 'workflow.yaml') => void
  onDirectEdit?: (fileName: string, newContent: string) => void
}

interface DiffLine {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

function computeDiffLines(oldText: string, newText: string): DiffLine[] {
  const dmp = new DiffMatchPatch()
  const diff = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diff)

  const lines: DiffLine[] = []
  diff.forEach(([op, data]: [number, string]) => {
    const split = data.split('\n')
    // Remove last empty string if data ends with \n
    if (split.length > 1 && split[split.length - 1] === '') split.pop()
    split.forEach((line: string) => {
      if (op === DiffMatchPatch.DIFF_INSERT) lines.push({ type: 'insert', text: line })
      else if (op === DiffMatchPatch.DIFF_DELETE) lines.push({ type: 'delete', text: line })
      else lines.push({ type: 'equal', text: line })
    })
  })
  return lines
}

// Function to decode escaped characters in YAML content
function decodeEscaped(content: string) {
  return content.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"')
}

export function YamlPanel({ yamlFiles, isLoading = false, activeTab, setActiveTab, onDirectEdit }: YamlPanelProps) {
  const allFileNames = ['agents.yaml', 'workflow.yaml']
  const activeFile = allFileNames.indexOf(activeTab)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [copiedFile, setCopiedFile] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidateYamlResponse | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const prevYamlRef = useRef<{ [name: string]: string }>({})
  const lastUpdateRef = useRef<{ [name: string]: string }>({})

  // Highlight syntax when content changes
  useEffect(() => {
    Prism.highlightAll()
  }, [yamlFiles, activeFile, showDiff])

  // Always keep both files in the panel
  const filesToShow: YamlFile[] = allFileNames.map(name =>
    yamlFiles.find(f => f.name === name) || { name, content: '', language: 'yaml' as const }
  )

  // Ensure line numbers are properly aligned after content changes
  useEffect(() => {
    if (showLineNumbers && filesToShow.some(f => f.content.trim())) {
      const codeBlocks = document.querySelectorAll('code.language-yaml')
      codeBlocks.forEach(block => {
        Prism.highlightElement(block)
      })
    }
  }, [filesToShow.map(f => f.content).join(''), showLineNumbers])

  // Track changes for diff - store the previous version before updating
  useEffect(() => {
    filesToShow.forEach(file => {
      const currentContent = file.content.trim()
      const lastContent = lastUpdateRef.current[file.name] || ''

      // If content changed and we had previous content, store it for diff
      if (currentContent !== lastContent && lastContent !== '') {
        prevYamlRef.current[file.name] = lastContent
      }

      // Update the last known content
      if (currentContent !== '') {
        lastUpdateRef.current[file.name] = currentContent
      }
    })
  }, [filesToShow.map(f => f.content).join('')])

  const handleCopy = async (content: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedFile(fileName)
      setTimeout(() => setCopiedFile(null), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const handleDownload = (file: YamlFile) => {
    const blob = new Blob([file.content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderLineNumbers = (content: string) => {
    const decodedContent = decodeEscaped(content)
    const lines = decodedContent.split('\n')
    
    if (!decodedContent.trim()) {
      return (
        <pre className="text-sm font-mono p-4 overflow-x-auto overflow-y-auto bg-white font-['Courier_New'] whitespace-pre leading-6">
          <code className="language-yaml whitespace-pre leading-6">{decodedContent}</code>
        </pre>
      )
    }
    
    return (
      <div 
        className="relative bg-white overflow-auto"
        style={{ 
          display: 'grid',
          gridTemplateColumns: '3rem 1fr',
          fontFamily: 'Courier New, monospace',
          fontSize: '0.875rem',
          lineHeight: '1.5rem'
        }}
      >
        <div 
          className="bg-gray-50 border-r border-gray-100 text-right text-xs text-gray-400 font-mono"
          style={{ 
            padding: '0 0.5rem',
            lineHeight: '1.5rem'
          }}
        >
          {lines.map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
        
        <div style={{ overflow: 'auto' }}>
          <pre 
            className="font-mono whitespace-pre bg-white m-0"
            style={{ 
              padding: '0 1rem',
              lineHeight: '1.5rem',
              fontSize: '0.875rem',
              fontFamily: 'Courier New, monospace'
            }}
          >
            <code className="language-yaml">{decodedContent}</code>
          </pre>
        </div>
      </div>
    )
  }

  const renderDiff = (oldContent: string, newContent: string) => {
    if (oldContent === newContent || oldContent === '') {
      return (
        <pre className="text-sm font-mono p-4 overflow-x-auto bg-white font-['Courier_New'] whitespace-pre">
          <code className="language-yaml whitespace-pre">{decodeEscaped(newContent)}</code>
        </pre>
      )
    }

    const lines = computeDiffLines(oldContent, newContent)

    return (
      <div>
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-medium">
          Showing changes (green = added, red = removed)
        </div>
        <div className="text-sm font-mono px-4 py-0 overflow-y-auto flex-1 min-h-0 bg-white font-['Courier_New'] whitespace-pre">
          {lines.map((line, idx) => {
            const lineStyle = line.type === 'insert'
              ? { backgroundColor: '#dcfce7', color: '#166534' }
              : line.type === 'delete'
              ? { backgroundColor: '#fee2e2', color: '#991b1b' }
              : { color: '#1f2937' }

            return (
              <div
                key={idx}
                style={lineStyle}
                className="w-full leading-6"
              >
                {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '} {decodeEscaped(line.text)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const handleValidate = async () => {
    const activeYamlFile = filesToShow[activeFile]
    if (!activeYamlFile.content.trim()) {
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      const fileType = activeYamlFile.name === 'agents.yaml' ? 'agents' : 'workflow'
      const result = await apiService.validateYaml(activeYamlFile.content, fileType)
      setValidationResult(result)
    } catch (error) {
      console.error('Validation error:', error)
      setValidationResult({
        is_valid: false,
        message: 'Validation failed',
        errors: ['An unexpected error occurred during validation']
      })
    } finally {
      setIsValidating(false)
    }
  }

  const hasContent = filesToShow.some(file => file.content.trim() !== '')

  const activeYamlFile = filesToShow[activeFile];

  const handleYamlClick = () => {
    if (activeYamlFile.content.trim() !== '') {
      const textarea = document.createElement('textarea')
      textarea.value = decodeEscaped(activeYamlFile.content)
      textarea.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        padding: 16px;
        border: 2px solid #3b82f6;
        border-radius: 8px;
        background: white;
        z-index: 1000;
        resize: none;
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: auto;
      `
      
      const yamlContainer = document.querySelector('.yaml-content-container')
      if (yamlContainer) {
        yamlContainer.appendChild(textarea)
        textarea.focus()
        textarea.select()
        
        // Ctrl+S or Enter
        const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey && e.key === 's') || e.key === 'Enter') {
            e.preventDefault()
            if (onDirectEdit) {
              const encodedContent = textarea.value.replace(/\n/g, '\\n').replace(/'/g, "\\'").replace(/"/g, '\\"')
              onDirectEdit(activeYamlFile.name, encodedContent)
            }
            yamlContainer.removeChild(textarea)
            document.removeEventListener('keydown', handleKeyDown)
          }
        }
        
        // escape to cancel
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            yamlContainer.removeChild(textarea)
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keydown', handleEscape)
          }
        }
        
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keydown', handleEscape)
        
        // save/cancel buttons
        const buttonContainer = document.createElement('div')
        buttonContainer.style.cssText = `
          position: absolute;
          bottom: 8px;
          right: 8px;
          display: flex;
          gap: 8px;
          z-index: 1001;
        `
        
        const saveButton = document.createElement('button')
        saveButton.textContent = 'Save'
        saveButton.style.cssText = `
          padding: 4px 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        `
        saveButton.onclick = () => {
          if (onDirectEdit) {
            // When saving, need to re-encode to match format
            const encodedContent = textarea.value.replace(/\n/g, '\\n').replace(/'/g, "\\'").replace(/"/g, '\\"')
            onDirectEdit(activeYamlFile.name, encodedContent)
          }
          yamlContainer.removeChild(textarea)
          yamlContainer.removeChild(buttonContainer)
          document.removeEventListener('keydown', handleKeyDown)
          document.removeEventListener('keydown', handleEscape)
        }
        
        const cancelButton = document.createElement('button')
        cancelButton.textContent = 'Cancel'
        cancelButton.style.cssText = `
          padding: 4px 12px;
          background: #6b7280;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        `
        cancelButton.onclick = () => {
          yamlContainer.removeChild(textarea)
          yamlContainer.removeChild(buttonContainer)
          document.removeEventListener('keydown', handleKeyDown)
          document.removeEventListener('keydown', handleEscape)
        }
        
        buttonContainer.appendChild(saveButton)
        buttonContainer.appendChild(cancelButton)
        yamlContainer.appendChild(buttonContainer)
      }
    }
  }

  return (
    <div className="w-2/5 h-full border-l border-gray-100 bg-gradient-to-br from-white via-blue-50 to-indigo-50 flex flex-col font-['Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] shadow-2xl rounded-l-2xl">
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white/80 backdrop-blur-md rounded-tl-2xl">
        <h2 className="text-lg font-bold text-gray-900 tracking-wide">Generated Files</h2>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Updating</span>
            </div>
          )}
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="p-2 rounded-xl hover:bg-blue-100 hover:text-blue-700 transition-colors shadow-sm"
            title={showDiff ? 'Show full YAML' : 'Show diff'}
          >
            <GitCompare size={18} className={showDiff ? 'text-blue-600' : ''} />
          </button>
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="p-2 rounded-xl hover:bg-gray-100 hover:text-gray-700 transition-colors shadow-sm"
            title={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
          >
            {showLineNumbers ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-100 bg-white/70 backdrop-blur-md px-4 pt-2">
        {filesToShow.map((file, index) => {
          const hasFileContent = file.content.trim() !== ''
          return (
            <button
              key={file.name}
              onClick={() => setActiveTab(file.name as 'agents.yaml' | 'workflow.yaml')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 text-sm rounded-full transition-all duration-200 relative shadow-sm",
                activeFile === index
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold scale-105 shadow-md"
                  : "bg-white/80 text-gray-500 hover:text-blue-700 hover:bg-blue-50 border border-gray-200",
                hasFileContent && "text-green-600"
              )}
            >
              <FileText size={16} />
              <span>{file.name}</span>
              {hasFileContent && (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {filesToShow.length > 0 && hasContent ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white/80 backdrop-blur-md rounded-t-xl">
              <span className="text-xs text-gray-500 font-medium">
                {filesToShow[activeFile].name}
                {filesToShow[activeFile].content.trim() !== '' && (
                  <span className="ml-2 text-green-600">• Generated</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(filesToShow[activeFile].content, filesToShow[activeFile].name)}
                  className={cn(
                    "p-2 rounded-xl transition-colors flex items-center gap-1 shadow-sm",
                    copiedFile === filesToShow[activeFile].name
                      ? "bg-green-100 text-green-700"
                      : "hover:bg-white hover:text-gray-700"
                  )}
                  title="Copy to clipboard"
                >
                  {copiedFile === filesToShow[activeFile].name ? (
                    <>
                      <Check size={16} />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
                <button
                  onClick={() => handleDownload(filesToShow[activeFile])}
                  className="p-2 rounded-xl hover:bg-white hover:text-gray-700 transition-colors shadow-sm"
                  title="Download file"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => handleDownload(filesToShow[activeFile])}
                  className="p-2 rounded-xl hover:bg-white hover:text-gray-700 transition-colors shadow-sm"
                  title="Save file"
                >
                  <Save size={16} />
                </button>
                <button
                  onClick={handleYamlClick}
                  className="p-2 rounded-xl hover:bg-blue-100 hover:text-blue-700 transition-colors shadow-sm"
                  title="Directly edit YAML"
                >
                  <span className="text-xs font-semibold">Edit</span>
                </button>
                <button
                  onClick={handleValidate}
                  disabled={isValidating || !filesToShow[activeFile].content.trim()}
                  className={cn(
                    "p-2 rounded-xl transition-colors shadow-sm",
                    isValidating || !filesToShow[activeFile].content.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-purple-100 hover:text-purple-700"
                  )}
                  title={!filesToShow[activeFile].content.trim() ? "No content to validate" : "Validate YAML"}
                >
                  {isValidating ? (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Validating</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <CheckCircle size={16} />
                      <span className="text-xs">Validate</span>
                    </div>
                  )}
                </button>
              </div>
            </div>

            {validationResult && (
              <div className={cn(
                "p-4 border-b border-gray-100",
                validationResult.is_valid 
                  ? "bg-green-50 border-green-200" 
                  : "bg-red-50 border-red-200"
              )}>
                <div className="flex items-start gap-3">
                  {validationResult.is_valid ? (
                    <CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      validationResult.is_valid ? "text-green-800" : "text-red-800"
                    )}>
                      {validationResult.message}
                    </p>
                    {validationResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-700 mb-1">Errors:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {validationResult.errors.map((error, index) => (
                            <li key={index} className="bg-white/50 px-2 py-1 rounded">
                              {error}
                            </li>
                          ))}
                        </ul>
                        {validationResult.errors.some(error => error.includes('file_path')) && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-xs text-blue-800 font-medium mb-1">💡 Suggestion:</p>
                            <p className="text-xs text-blue-700">
                              Code agents require a 'file_path' field. Add <code className="bg-gray-100 px-1 rounded">file_path: ./your_agent_name.py</code> to the spec section, 
                              or use <code className="bg-gray-100 px-1 rounded">framework: beeai</code> instead.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto bg-white/90 rounded-b-xl shadow-xl p-4 mt-2 yaml-content-container relative">
              {filesToShow[activeFile].content.trim() === '' ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center max-w-sm">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText size={24} className="text-gray-400" />
                    </div>
                    <h3 className="text-xs font-medium text-gray-900 mb-2">No content yet</h3>
                    <p className="text-xs text-gray-500">Ask the AI to generate content for this file</p>
                  </div>
                </div>
              ) : showDiff ? (
                <div onClick={handleYamlClick} style={{ cursor: 'pointer' }} key={`diff-${filesToShow[activeFile].content.length}`}>
                  {renderDiff(prevYamlRef.current[filesToShow[activeFile].name] || '', filesToShow[activeFile].content)}
                </div>
              ) : showLineNumbers ? (
                <div onClick={handleYamlClick} style={{ cursor: 'pointer' }} key={`line-numbers-${filesToShow[activeFile].content.length}`} className="overflow-auto">
                  {renderLineNumbers(filesToShow[activeFile].content)}
                </div>
              ) : (
                <div onClick={handleYamlClick} style={{ cursor: 'pointer' }} key={`regular-${filesToShow[activeFile].content.length}`}>
                  <pre className="text-sm font-mono p-4 overflow-x-auto bg-gray-50 font-['Courier_New'] whitespace-pre">
                    <code className="language-yaml whitespace-pre">{decodeEscaped(filesToShow[activeFile].content)}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-gray-400" />
              </div>
              <h3 className="text-xs font-medium text-gray-900 mb-2">No YAML files generated yet</h3>
              <p className="text-xs text-gray-500">Start a conversation to generate files</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}