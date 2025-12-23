'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * Log entry for AI workflow console
 */
export interface LogEntry {
    id: string
    timestamp: Date
    type: 'info' | 'success' | 'warning' | 'error' | 'loading'
    tag: string  // e.g., 'Fetch', 'Gemini', 'Discovery', 'Logic'
    message: string
}

/**
 * AI workflow state types
 */
export type AIWorkflowStatus = 'idle' | 'analyzing' | 'fetching_html' | 'grouping' | 'success' | 'error'

export interface AIWorkflowState {
    status: AIWorkflowStatus
    logs: LogEntry[]
    currentItem: string | null
    usage?: {
        promptTokenCount: number
        candidatesTokenCount: number
        totalTokenCount: number
        thinkingTokenCount?: number
    }
}


/**
 * Hook return type
 */
export interface UseAIWorkflowReturn {
    state: AIWorkflowState
    addLog: (message: string, type: LogEntry['type'], tag?: string) => void
    updateLastLog: (updates: Partial<Pick<LogEntry, 'type' | 'message'>>) => void
    setCurrentItem: (item: string | null) => void
    setStatus: (status: AIWorkflowStatus) => void
    clearLogs: () => void
    reset: () => void
    setUsage: (usage: AIWorkflowState['usage']) => void
    appendToLastLog: (text: string) => void
}

/**
 * Custom hook for managing AI workflow state.
 * Provides logging, status management, and simulated progress streaming.
 * 
 * @example
 * ```tsx
 * const { state, startSimulatedProgress, stopSimulatedProgress, addLog } = useAIWorkflow()
 * 
 * // Start simulated progress while async action runs
 * startSimulatedProgress(EXTRACT_STEPS)
 * const result = await extractCategoriesAction(url)
 * stopSimulatedProgress()
 * 
 * // Add final result log
 * addLog('Found 4 categories!', 'success', 'Discovery')
 * ```
 */
export function useAIWorkflow(): UseAIWorkflowReturn {
    const [state, setState] = useState<AIWorkflowState>({
        status: 'idle',
        logs: [],
        currentItem: null
    })

    // Store timeout IDs for cleanup
    const timeoutRefs = useRef<NodeJS.Timeout[]>([])
    const isRunningRef = useRef(false)

    /**
     * Add a new log entry
     */
    const addLog = useCallback((
        message: string,
        type: LogEntry['type'] = 'info',
        tag: string = 'System'
    ) => {
        const entry: LogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type,
            tag,
            message
        }

        // Check if previous log was loading and should be marked as done
        setState(prev => {
            const newLogs = [...prev.logs]
            if (newLogs.length > 0) {
                const lastIndex = newLogs.length - 1
                const lastLog = newLogs[lastIndex]

                // If the last log was 'loading', assume it completed successfully as we're moving to a new step
                if (lastLog.type === 'loading') {
                    newLogs[lastIndex] = { ...lastLog, type: 'success' }
                }
            }

            return {
                ...prev,
                logs: [...newLogs, entry]
            }
        })
    }, [])

    /**
     * Update the last log entry (useful for changing loading -> success)
     */
    const updateLastLog = useCallback((updates: Partial<Pick<LogEntry, 'type' | 'message'>>) => {
        setState(prev => {
            if (prev.logs.length === 0) return prev

            const newLogs = [...prev.logs]
            const lastIndex = newLogs.length - 1
            newLogs[lastIndex] = {
                ...newLogs[lastIndex],
                ...updates
            }

            return {
                ...prev,
                logs: newLogs
            }
        })
    }, [])

    /**
     * Appends text to the last log entry's message.
     * Useful for streaming responses where text comes in chunks.
     */
    const appendToLastLog = useCallback((text: string) => {
        setState(prev => {
            if (prev.logs.length === 0) return prev

            const newLogs = [...prev.logs]
            const lastIndex = newLogs.length - 1
            newLogs[lastIndex] = {
                ...newLogs[lastIndex],
                message: newLogs[lastIndex].message + text
            }

            return {
                ...prev,
                logs: newLogs
            }
        })
    }, [])

    /**
     * Set the current item being processed (shown in header)
     */
    const setCurrentItem = useCallback((item: string | null) => {
        setState(prev => ({
            ...prev,
            currentItem: item
        }))
    }, [])

    /**
     * Set the workflow status
     */
    const setStatus = useCallback((status: AIWorkflowStatus) => {
        setState(prev => ({
            ...prev,
            status
        }))
    }, [])

    /**
     * Clear all logs
     */
    const clearLogs = useCallback(() => {
        setState(prev => ({
            ...prev,
            logs: []
        }))
    }, [])

    const reset = useCallback(() => {
        isRunningRef.current = false

        setState({
            status: 'idle',
            logs: [],
            currentItem: null,
            usage: undefined
        })
    }, [])

    const setUsage = useCallback((usage: AIWorkflowState['usage']) => {
        setState(prev => ({ ...prev, usage }))
    }, [])


    return {
        state,
        addLog,
        updateLastLog,
        setCurrentItem,
        setStatus,
        clearLogs,
        reset,
        setUsage,
        appendToLastLog
    }
}
