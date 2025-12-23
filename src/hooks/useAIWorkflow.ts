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
}

/**
 * Simulated progress step
 */
export interface SimulatedStep {
    delay: number    // Delay in ms before showing this step
    message: string
    tag: string
    type?: LogEntry['type']
}

/**
 * Preset step sequences for common operations
 */
export const EXTRACT_STEPS: SimulatedStep[] = [
    { delay: 300, message: 'Fetching HTML content...', tag: 'Fetch' },
    { delay: 800, message: 'Parsing DOM structure...', tag: 'Logic' },
    { delay: 1500, message: 'Gemini is analyzing navigation...', tag: 'Gemini' },
    { delay: 2500, message: 'Cross-referencing category labels...', tag: 'Gemini' },
    { delay: 4000, message: 'Matching naming patterns...', tag: 'Logic' },
    { delay: 6000, message: 'Finalizing category structure...', tag: 'Discovery' },
]

export const SCAN_STEPS: SimulatedStep[] = [
    { delay: 300, message: 'Initializing scan batch...', tag: 'System' },
    { delay: 800, message: 'Fetching category pages...', tag: 'Fetch' },
    { delay: 1500, message: 'Gemini parsing product listings...', tag: 'Gemini' },
    { delay: 2800, message: 'Extracting product names & prices...', tag: 'Discovery' },
    { delay: 4200, message: 'Identifying color variants...', tag: 'Logic' },
    { delay: 5500, message: 'Grouping related products...', tag: 'Logic' },
]

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
    startSimulatedProgress: (steps: SimulatedStep[]) => void
    stopSimulatedProgress: () => void
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

        setState(prev => ({
            ...prev,
            logs: [...prev.logs, entry]
        }))
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

    /**
     * Reset to initial state
     */
    const reset = useCallback(() => {
        // Clear any running timeouts
        timeoutRefs.current.forEach(t => clearTimeout(t))
        timeoutRefs.current = []
        isRunningRef.current = false

        setState({
            status: 'idle',
            logs: [],
            currentItem: null
        })
    }, [])

    /**
     * Start simulated progress - outputs preset messages at timed intervals.
     * This creates a "fake real-time" effect while the actual async operation runs.
     * Call stopSimulatedProgress() when the operation completes.
     */
    const lastSimulatedIdRef = useRef<string | null>(null)

    /**
     * Start simulated progress - outputs preset messages at timed intervals.
     * This creates a "fake real-time" effect while the actual async operation runs.
     * Call stopSimulatedProgress() when the operation completes.
     */
    const startSimulatedProgress = useCallback((steps: SimulatedStep[]) => {
        // Clear any previous timeouts
        timeoutRefs.current.forEach(t => clearTimeout(t))
        timeoutRefs.current = []
        isRunningRef.current = true
        lastSimulatedIdRef.current = null

        steps.forEach((step, index) => {
            const timeoutId = setTimeout(() => {
                if (!isRunningRef.current) return

                setState(prev => {
                    let newLogs = [...prev.logs]

                    // Mark previous simulated step as success
                    if (lastSimulatedIdRef.current) {
                        const lastIndex = newLogs.findIndex(l => l.id === lastSimulatedIdRef.current)
                        if (lastIndex !== -1 && newLogs[lastIndex].type === 'loading') {
                            newLogs[lastIndex] = {
                                ...newLogs[lastIndex],
                                type: 'success'
                            }
                        }
                    }

                    // Add new simulated step
                    const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    const entry: LogEntry = {
                        id: newId,
                        timestamp: new Date(),
                        type: step.type || 'loading',
                        tag: step.tag,
                        message: step.message
                    }

                    lastSimulatedIdRef.current = newId
                    return {
                        ...prev,
                        logs: [...newLogs, entry]
                    }
                })
            }, step.delay)
            timeoutRefs.current.push(timeoutId)
        })
    }, [])

    /**
     * Stop simulated progress and clear pending timeouts.
     * Call this when the actual async operation completes.
     */
    const stopSimulatedProgress = useCallback(() => {
        isRunningRef.current = false
        timeoutRefs.current.forEach(t => clearTimeout(t))
        timeoutRefs.current = []
    }, [])

    return {
        state,
        addLog,
        updateLastLog,
        setCurrentItem,
        setStatus,
        clearLogs,
        reset,
        startSimulatedProgress,
        stopSimulatedProgress
    }
}
