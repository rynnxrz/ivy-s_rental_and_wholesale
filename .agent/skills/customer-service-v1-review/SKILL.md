---
name: customer-service-v1-review
description: Review Ask Ivy / customer-service changes against the Ivy customer-facing v1 plan. Use when touching `src/lib/customer-service/`, `src/app/api/customer-service/`, `src/components/customer-service/CustomerServiceWidget.tsx`, page-level Ask Ivy mount points, or the Supabase session/message migration. Check plan/execute separation, identity gating, tool allowlists, session restore safety, trace coverage, and customer-safe fallback behavior.
---

# Customer Service V1 Review

Use this skill when reviewing changes for the customer-facing AI concierge flow.
Focus on keeping the implementation low-risk, customer-safe, and aligned with the v1 rollout plan.

## Quick Start

1. Read [references/review-checklist.md](references/review-checklist.md).
2. Inspect touched files in:
   - `src/lib/customer-service/`
   - `src/app/api/customer-service/`
   - `src/components/customer-service/CustomerServiceWidget.tsx`
   - the page files that mount `CustomerServiceWidget`
   - `supabase/migrations/`
3. If official API guidance matters, use `openai-docs` to verify current docs for:
   - [Function Calling](https://developers.openai.com/api/docs/guides/function-calling)
   - [Agent Builder Safety](https://developers.openai.com/api/docs/guides/agent-builder-safety)
   - [Conversation State](https://developers.openai.com/api/docs/guides/conversation-state)
   - [Trace Grading](https://developers.openai.com/api/docs/guides/trace-grading)
   - [Evals](https://developers.openai.com/api/docs/guides/evals)
4. If UI behavior matters, use `playwright` against the local app.
5. Use `pdf` only when the diff touches PDF routes, PDF links, or PDF rendering behavior.

## Non-Negotiables

- Keep v1 single-agent. Do not introduce multi-agent orchestration.
- Preserve the customer-safe contract:
  - `plan` decides and returns structure.
  - `execute` performs sensitive tool work only after approval.
  - product questions may answer directly from injected page context or safe public catalog facts.
- Keep AI fail-closed for cloud deployments via `src/lib/ai/settings.ts`.
- Restrict tools to the v1 whitelist:
  - `getCatalogFacts`
  - `getRequestStatusByEmailAndFingerprint`
  - `getInvoiceContextByInvoiceId`
  - `getLoanFormFaq`
  - `getPublicPdfLink`
- Never expose admin-only data, hidden notes, full addresses, unpublished media, stack traces, SQL errors, table names, or schema details to the customer.
- Only allow order lookup when there is enough proof:
  - page-bound invoice or reservation context, or
  - user-provided `email + fingerprint`
- Keep `decisionId` trace continuity across planning, approval, tool calls, reply generation, and feedback.

## Review Areas

## 1. Intent And Policy

- Check that intent routing prioritizes sensitive intents before page-type shortcuts.
- Flag any heuristic that treats "current page type" as enough reason to ignore an explicit order or invoice request.
- Confirm confirmation rules match the plan:
  - no confirmation for plain product Q&A
  - confirmation before order, invoice, loan-form, or PDF lookups
- Do not allow `execute` to invent new tool steps that were not in the approved plan.

## 2. Data Safety

- Verify tool outputs are read-only and formatted for customer consumption.
- Flag any tool result that returns internal fields or raw backend errors.
- Check session restore and feedback routes for ownership or exposure risks.
- Treat `error.message` passthrough to the client as a bug unless it is rewritten into branded fallback copy.

## 3. State And Observability

- Confirm `customer_service_sessions` persists:
  - status
  - pending plan
  - page context
  - identity snapshot
  - decision id
- Confirm `customer_service_messages` records user, assistant, and tool messages with stable ordering.
- Verify `ai_decisions`, `ai_decision_events`, and `ai_feedback` still capture the end-to-end trace.

## 4. UI Regression Checks

- The widget should only mount on the approved customer pages.
- Confirmation cards must show the steps that will run.
- Refreshing after a pending confirmation should restore the plan and message history.
- `Useful / Not useful` must remain available on assistant replies.
- Customer-visible failures should stay branded and actionable, never raw.

## High-Risk Smells

- `pageType === 'catalog_item'` or similar is used as a proxy for product intent.
- The API returns raw `error.message` and the widget renders it directly.
- A session restore endpoint returns full history by session id alone.
- A tool is added outside the whitelist or runs without the required confirmation gate.
- A new cloud path bypasses `assertAiRuntimeAllowed()`.

## Validation

- Run targeted linting for the touched customer-service files.
- Use `playwright` to cover the happy paths and the identity/fallback cases in [references/review-checklist.md](references/review-checklist.md).
- If the change affects PDF links or payment-confirmation rendering, verify the PDF route or rendered PDF with the `pdf` skill before signing off.
