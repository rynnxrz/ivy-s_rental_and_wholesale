# Customer Service V1 Review Checklist

## Files To Inspect First

- `src/lib/customer-service/policy.ts`
- `src/lib/customer-service/planner.ts`
- `src/lib/customer-service/executor.ts`
- `src/lib/customer-service/tool-registry.ts`
- `src/lib/customer-service/session-store.ts`
- `src/app/api/customer-service/plan/route.ts`
- `src/app/api/customer-service/execute/route.ts`
- `src/app/api/customer-service/feedback/route.ts`
- `src/app/api/customer-service/session/[sessionId]/route.ts`
- `src/components/customer-service/CustomerServiceWidget.tsx`
- page files that mount `CustomerServiceWidget`
- the matching Supabase migration

## Expected Customer Flows

### Product Q&A

- On `/catalog/[id]`, ask about material, price, or suitability.
- Expect a direct answer with no confirmation gate.
- Flag any regression where the assistant asks for identity or executes sensitive tools.

### Request Summary

- On `/request/summary`, ask what items, dates, or estimated total are currently selected.
- Expect an answer from injected page/store context.

### Order Status

- On a generic customer page, ask "Where is my order?" without proof.
- Expect a request for `email + fingerprint`, not a lookup.
- After both are provided, expect a plan and confirmation before the lookup runs.

### Invoice / PDF / Loan Form

- On `/payment-confirmation/[invoiceId]`, ask about amount due, PDF location, or loan-form meaning.
- Expect a confirmation card before the tool call runs.
- Expect only customer-safe fields in the answer.

### Restore

- Create a pending confirmation, refresh, then reopen the widget.
- Expect the pending plan and prior messages to restore cleanly.

### Failures

- Break a dependency on purpose, or test in an environment where the migration is missing.
- Expect branded fallback copy.
- Flag any raw backend message such as table names, schema cache errors, stack traces, or SQL text.

## Useful Commands

```bash
npm run lint -- src/lib/customer-service src/app/api/customer-service src/components/customer-service
```

```bash
command -v npx
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
```

```bash
bash "$PWCLI" open http://127.0.0.1:3000/catalog
bash "$PWCLI" snapshot
```

## Review Notes

- Treat missing migrations as a rollout blocker, not just a local inconvenience.
- Review diffs against the plan, not only against type safety.
- Prefer a small number of concrete findings with file and line references over broad stylistic feedback.
