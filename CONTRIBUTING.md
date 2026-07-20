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

## Contribution Licensing

Atlas uses AGPL-3.0-only plus separate commercial licensing. Preserving that structure requires the copyright holder to have appropriate rights to contributions.

External contributions are not accepted for merge until the project publishes and the contributor signs the applicable contributor license agreement. Opening an issue, discussion, or pull request does not by itself transfer copyright or grant Atlas commercial relicensing rights.

Do not submit code, documentation, model output, datasets, or other material unless you have the right to contribute it and can identify any third-party license or attribution requirements.

## Local Verification

Run this before opening or merging a pull request:

```bash
pnpm check
```
