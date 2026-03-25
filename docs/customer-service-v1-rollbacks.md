# Customer Service v1 Rollback Switches

These thresholds are evaluated from observability dashboards (7-day rolling window).
When a threshold is breached, enable the matching runtime switch the same day.

## Thresholds

1. `False Allow > 0.5%` or any high-risk unauthorized access:
- Enable `CS_DISABLE_SENSITIVE_AUTO_EXECUTE=1`
- Sensitive flows are blocked from auto execution and remain on verification guidance.

2. `Hallucination Proxy > 2%`:
- Enable `CS_FORCE_SENSITIVE_FACTS_ONLY=1`
- Sensitive replies render facts-only summaries from validated `uiBlocks`.

3. `Task Completion < 60%` and `Re-prompt Rate > 25%`:
- Enable `CS_TRACK_A_ONLY=1`
- Planner stays on deterministic routing and disables LLM clarification path.

## Notes

- Switches are read at runtime through `/src/lib/customer-service/feature-flags.ts`.
- Keep all external error copy generic while using decision-trace logs for root-cause analysis.
