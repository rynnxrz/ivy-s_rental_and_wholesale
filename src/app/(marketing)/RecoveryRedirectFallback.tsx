"use client"

import { useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function getRecoveryHashParams() {
  if (typeof window === "undefined" || !window.location.hash) return null
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(rawHash)
  return params.get("type") === "recovery" ? params : null
}

export function RecoveryRedirectFallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const queryType = searchParams?.get("type")
    const code = searchParams?.get("code")
    const tokenHash = searchParams?.get("token_hash")
    const token = searchParams?.get("token")
    const queryLooksLikeRecovery =
      queryType === "recovery" && Boolean(code || tokenHash || token)

    if (queryLooksLikeRecovery) {
      const callback = new URL("/auth/callback", window.location.origin)
      callback.searchParams.set("type", "recovery")
      callback.searchParams.set("next", "/reset-password")
      if (code) callback.searchParams.set("code", code)
      if (tokenHash) callback.searchParams.set("token_hash", tokenHash)
      if (token && !tokenHash) callback.searchParams.set("token_hash", token)
      window.location.replace(callback.toString())
      return
    }

    const hashParams = getRecoveryHashParams()
    if (!hashParams) return

    const accessToken = hashParams.get("access_token")
    const refreshToken = hashParams.get("refresh_token")
    if (!accessToken || !refreshToken) {
      router.replace("/forgot-password")
      return
    }

    let cancelled = false
    ;(async () => {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (cancelled) return
      router.replace(error ? "/forgot-password" : "/reset-password")
      router.refresh()
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams, supabase])

  return null
}
