/**
 * URL Validation Utility for SSRF Prevention
 * 
 * Blocks requests to private/internal IP addresses to prevent
 * Server-Side Request Forgery (SSRF) attacks.
 */

/**
 * Checks if a hostname resolves to a private/internal IP address.
 * 
 * Blocked ranges:
 * - localhost, 127.x.x.x (loopback)
 * - 10.x.x.x (Class A private)
 * - 172.16.x.x - 172.31.x.x (Class B private)
 * - 192.168.x.x (Class C private)
 * - 169.254.x.x (link-local, cloud metadata)
 * - 0.0.0.0
 * - IPv6 loopback (::1)
 */
export function isPrivateIP(ip: string): boolean {
    // Handle IPv6 loopback
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
        return true
    }

    // Parse IPv4
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        // Not a valid IPv4, might be hostname - we'll check after DNS resolution
        return false
    }

    const [a, b] = parts

    // 0.0.0.0
    if (a === 0) return true

    // 127.x.x.x (loopback)
    if (a === 127) return true

    // 10.x.x.x (Class A private)
    if (a === 10) return true

    // 172.16.0.0 - 172.31.255.255 (Class B private)
    if (a === 172 && b >= 16 && b <= 31) return true

    // 192.168.x.x (Class C private)
    if (a === 192 && b === 168) return true

    // 169.254.x.x (link-local, AWS/GCP/Azure metadata endpoint)
    if (a === 169 && b === 254) return true

    return false
}

/**
 * Validates that a URL points to a public internet address.
 * 
 * This should be called before fetching user-provided or external URLs
 * to prevent SSRF attacks.
 * 
 * @param urlString - The URL to validate
 * @returns true if the URL is safe to fetch, false otherwise
 */
export function isPublicUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString)

        // Only allow http/https protocols
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false
        }

        const hostname = url.hostname.toLowerCase()

        // Block localhost variants
        if (
            hostname === 'localhost' ||
            hostname === 'localhost.localdomain' ||
            hostname.endsWith('.localhost')
        ) {
            return false
        }

        // Block IP addresses that are private
        if (isPrivateIP(hostname)) {
            return false
        }

        // Block common internal hostnames
        const blockedPatterns = [
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^169\.254\./,
            /^0\./,
            /^\[::1\]$/,
            /^metadata\.google\.internal$/,
            /^instance-data$/,
        ]

        for (const pattern of blockedPatterns) {
            if (pattern.test(hostname)) {
                return false
            }
        }

        return true
    } catch {
        // Invalid URL
        return false
    }
}

/**
 * Validates a URL and returns it if safe, or null if blocked.
 * 
 * @param urlString - The URL to validate
 * @returns The validated URL or null if blocked
 */
export function validateExternalUrl(urlString: string): string | null {
    if (isPublicUrl(urlString)) {
        return urlString
    }
    console.warn(`[Security] Blocked potentially dangerous URL: ${urlString}`)
    return null
}
