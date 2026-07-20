# Third-Party Notices

Atlas depends on or can interoperate with third-party software, models, datasets, and hosted services. The Atlas licenses do not replace or supersede those third-party terms.

## JavaScript Tooling

The current direct external packages are development and build tooling. Runtime workspace dependencies are Atlas packages.

| Package             | Current license identifier | Purpose                       |
| ------------------- | -------------------------- | ----------------------------- |
| `@eslint/js`        | MIT                        | lint configuration            |
| `@types/node`       | MIT                        | Node.js type declarations     |
| `eslint`            | MIT                        | linting                       |
| `prettier`          | MIT                        | formatting                    |
| `typescript`        | Apache-2.0                 | compilation and type checking |
| `typescript-eslint` | MIT                        | TypeScript linting            |
| `vitest`            | MIT                        | testing                       |

The transitive dependency inventory in the current lockfile reports permissive license families including MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Python-2.0, and BlueOak-1.0.0. Exact versions are pinned in `pnpm-lock.yaml`; authoritative license texts and copyright notices are distributed with the respective packages.

Before distributing a release bundle, Atlas maintainers must regenerate the dependency inventory from the release lockfile, review exceptions, and include every notice or license text required by the packages actually shipped.

## Models, Datasets, And Hosted Providers

References or adapters for Qwen, NVIDIA Nemotron/NIM, LocateAnything, MiniCPM, InternVL, TurboQuant, Inkling/Tinker, or any other external model, dataset, API, or service do not grant a right to use those assets. Users and distributors must review the terms for the exact provider, model version, weights, dataset, and deployment method they select.

Atlas must not bundle third-party model weights, datasets, or provider credentials unless a release-specific license review confirms redistribution rights and required notices.
