# Contributing

Atlas uses short-lived branches and review gates for all implementation work.

## Branches

- `main` remains releasable.
- Feature branches use `codex/<topic>` or `feature/<topic>`.
- Architecture and documentation branches use `docs/<topic>`.

## Commits

- Keep commits focused on one implementation slice.
- Use direct commit messages such as `Add foundation workspace tooling`.
- Update `IMPLEMENTATION_CHECKLIST.md` only for work that is implemented, verified, and documented.

## Reviews

- Every pull request must include the checklist items it affects.
- Runtime changes must include tests.
- Security, governance, approval, identity, or secrets changes must call out governance impact.

## Local Verification

Run this before opening or merging a pull request:

```bash
pnpm check
```
