const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

const isEnabled = (value: string | undefined) => {
    if (!value) return false
    return TRUE_VALUES.has(value.trim().toLowerCase())
}

export function isCustomerServiceTrackAOnlyEnabled() {
    return isEnabled(process.env.CS_TRACK_A_ONLY)
}

export function isCustomerServiceSensitiveAutoExecutionDisabled() {
    return isEnabled(process.env.CS_DISABLE_SENSITIVE_AUTO_EXECUTE)
}

export function isCustomerServiceSensitiveFactsOnlyEnabled() {
    return isEnabled(process.env.CS_FORCE_SENSITIVE_FACTS_ONLY)
}

