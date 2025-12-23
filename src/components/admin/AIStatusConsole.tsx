'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Loader2, Check, AlertTriangle, XCircle, Info, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LogEntry, AIWorkflowState } from '@/hooks/useAIWorkflow'

/**
 * Props for AIStatusConsole component
 */
export interface AIStatusConsoleProps {
    /** The workflow state from useAIWorkflow hook */
    state: AIWorkflowState
    /** Whether the console is visible */
    isOpen?: boolean
    /** Optional className for custom styling */
    className?: string
    /** Title shown in the header */
    title?: string
    /** Maximum height of the console (default: 300px) */
    maxHeight?: number
}

/**
 * Tag color mappings for visual distinction
 */
const TAG_COLORS: Record<string, string> = {
    Fetch: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Gemini: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    Discovery: 'bg-green-500/20 text-green-300 border-green-500/30',
    Logic: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    System: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    Error: 'bg-red-500/20 text-red-300 border-red-500/30',
    Thinking: 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50',
}

/**
 * Get the appropriate icon for a log entry type
 */
function LogIcon({ type }: { type: LogEntry['type'] }) {
    switch (type) {
        case 'loading':
            return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
        case 'success':
            return <Check className="h-3.5 w-3.5 text-green-400" />
        case 'warning':
            return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        case 'error':
            return <XCircle className="h-3.5 w-3.5 text-red-400" />
        case 'info':
        default:
            return <Info className="h-3.5 w-3.5 text-slate-400" />
    }
}

/**
 * Format timestamp for display (HH:MM:SS)
 */
function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

/**
 * Get tag color class, with fallback for unknown tags
 */
function getTagColor(tag: string): string {
    return TAG_COLORS[tag] || TAG_COLORS.System
}

/**
 * A terminal-style console for displaying AI workflow logs.
 * 
 * Features:
 * - Dark background resembling a terminal
 * - Auto-scrolling to latest log
 * - Timestamped log entries with status icons
 * - Colored tag badges for easy categorization
 * - Current processing item display in header
 * 
 * @example
 * ```tsx
 * const { state, addLog } = useAIWorkflow()
 * 
 * return (
 *   <AIStatusConsole
 *     state={state}
 *     isOpen={isScanning}
 *     title="AI Console"
 *   />
 * )
 * ```
 */
export function AIStatusConsole({
    state,
    isOpen = true,
    className,
    title = 'AI Console',
    maxHeight = 300
}: AIStatusConsoleProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new logs are added or updated
    useEffect(() => {
        if (scrollRef.current && !isCollapsed) {
            // Use requestAnimationFrame to ensure DOM is updated
            const scroll = () => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                }
            }
            requestAnimationFrame(scroll)
        }
    }, [state.logs, isCollapsed, state.logs.map(l => l.message).join('')]) // Watch message changes for appending

    // Auto-collapse on success after a short delay
    useEffect(() => {
        if (state.status === 'success') {
            const timer = setTimeout(() => {
                setIsCollapsed(true)
            }, 1500)
            return () => clearTimeout(timer)
        } else if (state.status === 'analyzing' || state.status === 'idle') {
            setIsCollapsed(false)
        }
    }, [state.status])

    if (!isOpen) return null

    return (
        <Card className={cn('overflow-hidden border-slate-700 transition-all duration-300 ease-in-out', className)}>
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="py-3 px-4 bg-slate-800 border-b border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors flex items-center justify-between group"
            >
                <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-md transition-colors",
                        state.status === 'success' ? "bg-green-500/10 text-green-400" : "bg-slate-700 text-slate-400"
                    )}>
                        {state.status === 'success' ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div>
                        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                            {title}
                        </CardTitle>
                        {isCollapsed && state.status === 'success' && (
                            <p className="text-xs text-green-400 font-medium mt-0.5 animate-in fade-in">
                                Analysis complete
                            </p>
                        )}
                        {isCollapsed && state.status !== 'success' && state.currentItem && (
                            <p className="text-xs text-slate-400 mt-0.5 max-w-[300px] truncate">
                                {state.currentItem}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isCollapsed && state.currentItem && (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5 mr-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                            </span>
                            <span className="hidden sm:inline">{state.currentItem}</span>
                        </span>
                    )}
                    <ChevronDown className={cn(
                        "h-4 w-4 text-slate-400 transition-transform duration-300",
                        isCollapsed ? "" : "rotate-180"
                    )} />
                </div>
            </div>

            {/* Terminal Content */}
            <div
                className={cn(
                    "transition-[max-height,opacity] duration-300 ease-in-out",
                    isCollapsed ? "max-h-0 opacity-0" : "opacity-100"
                )}
                style={{ maxHeight: isCollapsed ? 0 : `${maxHeight}px` }}
            >
                <CardContent className="p-0">
                    <div
                        ref={scrollRef}
                        className="bg-slate-900 font-mono text-xs overflow-y-auto custom-scrollbar"
                        style={{ maxHeight: `${maxHeight}px`, minHeight: '120px' }}
                    >
                        {state.logs.length === 0 ? (
                            <div className="flex items-center justify-center h-[120px] text-slate-500">
                                <span>Waiting for AI operations...</span>
                            </div>
                        ) : (
                            <div className="p-3 space-y-2">
                                {state.logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="flex items-start gap-3 leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-200 group/log"
                                    >
                                        {/* Timestamp */}
                                        <span className="text-slate-600 font-medium shrink-0 text-[10px] pt-1 w-[42px]">
                                            {formatTimestamp(log.timestamp)}
                                        </span>

                                        {/* Status Icon */}
                                        <div className="shrink-0 pt-0.5">
                                            <LogIcon type={log.type} />
                                        </div>

                                        {/* Tag Badge */}
                                        <span
                                            className={cn(
                                                'px-2 py-0.5 rounded-[4px] text-[10px] font-semibold border shrink-0 min-w-[64px] text-center tracking-wide',
                                                getTagColor(log.tag)
                                            )}
                                        >
                                            {log.tag}
                                        </span>

                                        {/* Message */}
                                        <span
                                            className={cn(
                                                'text-slate-300 text-[11px]',
                                                log.type === 'error' && 'text-red-300',
                                                log.type === 'warning' && 'text-amber-300',
                                                log.type === 'success' && 'text-green-300',
                                                log.type === 'loading' && 'text-blue-200'
                                            )}
                                        >
                                            {log.message}
                                        </span>
                                    </div>
                                ))}
                                {/* Computation Report */}
                                {state.usage && (
                                    <div className="mt-4 pt-3 border-t border-slate-800/50 text-[10px] font-mono text-slate-500 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse"></div>
                                            <span>[System] Computation complete.</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <span>Reasoned through <span className="text-indigo-400 font-semibold">{state.usage.thinkingTokenCount || 0}</span> tokens</span>
                                            <span className="text-slate-600">Total: {state.usage.totalTokenCount || 0}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Spacer for scroll */}
                                <div className="h-4" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </div>
        </Card>
    )
}

export default AIStatusConsole
