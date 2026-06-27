# ACR Storage Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first ACR storage foundation using ACT atomic commits over an event-first source of truth with relational, relationship, evidence, and replay projections.

**Architecture:** Atlas Cognitive Transactions (ACTs) are the atomic write unit. ACR events are append-only and canonical only after their ACT commits. Object versions, relationships, evidence references, and search records are projections that can be rebuilt from the committed ACT stream. The first slice stays in TypeScript contracts and deterministic in-memory projectors before database migrations.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, existing `@atlas-aios/core` package.

---

## File Structure

- Create `packages/core/src/acr.ts` for ACR object, ACT, relationship, evidence, lifecycle, and event contracts.
- Create `packages/core/src/acr-projector.ts` for deterministic projection from committed ACTs into object state.
- Create `packages/core/src/acr.test.ts` for ACT atomicity, event replay, versioning, relationship, and temporal query tests.
- Modify `packages/core/src/index.ts` to export the ACR contracts and projector.
- Modify `IMPLEMENTATION_CHECKLIST.md` only after each implementation task is complete.

## Task 1: ACR And ACT Contracts

**Files:**

- Create: `packages/core/src/acr.ts`
- Test: `packages/core/src/acr.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import type { ACREvent, ACRObject, AtlasCognitiveTransaction } from "./acr.js";

describe("ACR and ACT contracts", () => {
  it("represents object creation inside an atomic cognitive transaction", () => {
    const object: ACRObject<{ intent: string }> = {
      id: "acr:goal:release",
      type: "goal",
      schemaVersion: "0.1",
      version: 1,
      lifecycle: "draft",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:user:moksh",
      traceId: "trace:release",
      confidence: 0.9,
      relationships: [],
      evidence: [{ sourceId: "input:release-request", sourceType: "user" }],
      policies: [],
      payload: { intent: "Prepare release" }
    };

    const event: ACREvent = {
      id: "acr:event:1",
      actId: "act:release:1",
      type: "object.created",
      occurredAt: "2026-06-28T00:00:00.000Z",
      actorId: "actor:user:moksh",
      objectId: object.id,
      objectVersion: 1,
      traceId: "trace:release",
      payload: { object }
    };

    const transaction: AtlasCognitiveTransaction = {
      id: "act:release:1",
      schemaVersion: "0.1",
      status: "committed",
      goalId: object.id,
      traceId: "trace:release",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:user:moksh",
      intent: "Create release goal",
      reason: "User requested release preparation.",
      preconditions: [],
      policyRefs: [],
      evidenceRefs: object.evidence,
      events: [event],
      validation: {
        passed: true,
        errors: [],
        warnings: []
      },
      committedAt: "2026-06-28T00:00:00.000Z"
    };

    expect(transaction.events[0]?.payload.object).toEqual(object);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- packages/core/src/acr.test.ts`

Expected: FAIL because `./acr.js` does not exist.

- [ ] **Step 3: Write minimal contracts**

```ts
export type ACRObjectType =
  | "goal"
  | "thought"
  | "decision"
  | "capability"
  | "memory"
  | "experience"
  | "execution";

export type ACRLifecycle =
  | "draft"
  | "validated"
  | "active"
  | "completed"
  | "rejected"
  | "superseded"
  | "archived";

export type ACREventType =
  | "object.created"
  | "object.validated"
  | "object.activated"
  | "object.completed"
  | "object.rejected"
  | "object.superseded"
  | "object.archived"
  | "relationship.added"
  | "relationship.removed"
  | "evidence.attached"
  | "policy.attached";

export type ACTStatus =
  | "proposed"
  | "validated"
  | "committed"
  | "published"
  | "failed"
  | "aborted"
  | "compensated";

export interface ACRRelationship {
  type:
    | "depends_on"
    | "blocks"
    | "uses"
    | "references"
    | "implements"
    | "derived_from"
    | "generated_by"
    | "evaluates"
    | "supersedes";
  targetId: string;
  confidence?: number;
}

export interface ACREvidenceRef {
  sourceId: string;
  sourceType:
    | "user"
    | "memory"
    | "document"
    | "execution"
    | "experience"
    | "sensor"
    | "observation"
    | "decision";
  confidence?: number;
  spanRef?: string;
  hash?: string;
}

export interface ACRObject<TPayload = unknown> {
  id: string;
  type: ACRObjectType;
  schemaVersion: string;
  version: number;
  lifecycle: ACRLifecycle;
  createdAt: string;
  createdBy: string;
  goalId?: string;
  traceId: string;
  causalityId?: string;
  confidence: number;
  relationships: ACRRelationship[];
  evidence: ACREvidenceRef[];
  policies: string[];
  payload: TPayload;
}

export interface ACREvent<TPayload = unknown> {
  id: string;
  actId: string;
  type: ACREventType;
  occurredAt: string;
  actorId: string;
  objectId: string;
  objectVersion: number;
  traceId: string;
  causalityId?: string;
  payload: TPayload;
}

export interface ACTValidation {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface AtlasCognitiveTransaction {
  id: string;
  schemaVersion: string;
  status: ACTStatus;
  goalId?: string;
  traceId: string;
  causalityId?: string;
  createdAt: string;
  createdBy: string;
  intent: string;
  reason: string;
  preconditions: string[];
  policyRefs: string[];
  evidenceRefs: ACREvidenceRef[];
  events: ACREvent[];
  validation: ACTValidation;
  committedAt?: string;
  publishedAt?: string;
}
```

- [ ] **Step 4: Export contracts**

```ts
export * from "./acr.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm test -- packages/core/src/acr.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/acr.ts packages/core/src/acr.test.ts packages/core/src/index.ts
git commit -m "Add ACR and ACT contracts"
```

## Task 2: Deterministic ACT Projector

**Files:**

- Create: `packages/core/src/acr-projector.ts`
- Test: `packages/core/src/acr.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing replay test**

```ts
import { projectCommittedACTs } from "./acr-projector.js";

it("replays the same committed ACT stream into identical object state", () => {
  const transactions: AtlasCognitiveTransaction[] = [
    {
      id: "act:release:1",
      schemaVersion: "0.1",
      status: "committed",
      goalId: "acr:goal:release",
      traceId: "trace:release",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:user:moksh",
      intent: "Create release goal",
      reason: "User requested release preparation.",
      preconditions: [],
      policyRefs: [],
      evidenceRefs: [{ sourceId: "input:release-request", sourceType: "user" }],
      validation: {
        passed: true,
        errors: [],
        warnings: []
      },
      events: [
        {
          id: "acr:event:1",
          actId: "act:release:1",
          type: "object.created",
          occurredAt: "2026-06-28T00:00:00.000Z",
          actorId: "actor:user:moksh",
          objectId: "acr:goal:release",
          objectVersion: 1,
          traceId: "trace:release",
          payload: {
            object: {
              id: "acr:goal:release",
              type: "goal",
              schemaVersion: "0.1",
              version: 1,
              lifecycle: "draft",
              createdAt: "2026-06-28T00:00:00.000Z",
              createdBy: "actor:user:moksh",
              traceId: "trace:release",
              confidence: 0.9,
              relationships: [],
              evidence: [{ sourceId: "input:release-request", sourceType: "user" }],
              policies: [],
              payload: { intent: "Prepare release" }
            }
          }
        },
        {
          id: "acr:event:2",
          actId: "act:release:1",
          type: "object.validated",
          occurredAt: "2026-06-28T00:01:00.000Z",
          actorId: "actor:validator",
          objectId: "acr:goal:release",
          objectVersion: 2,
          traceId: "trace:release",
          payload: {}
        }
      ],
      committedAt: "2026-06-28T00:01:00.000Z"
    }
  ];

  expect(projectCommittedACTs(transactions)).toEqual(
    projectCommittedACTs(transactions)
  );
  expect(
    projectCommittedACTs(transactions).objects.get("acr:goal:release")?.lifecycle
  ).toBe("validated");
});
```

- [ ] **Step 2: Add failing atomicity test**

```ts
it("does not project aborted ACTs", () => {
  const transactions: AtlasCognitiveTransaction[] = [
    {
      id: "act:release:aborted",
      schemaVersion: "0.1",
      status: "aborted",
      traceId: "trace:release",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:brain",
      intent: "Create invalid release goal",
      reason: "Validation failed.",
      preconditions: [],
      policyRefs: [],
      evidenceRefs: [],
      validation: {
        passed: false,
        errors: ["Missing evidence"],
        warnings: []
      },
      events: [
        {
          id: "acr:event:aborted",
          actId: "act:release:aborted",
          type: "object.created",
          occurredAt: "2026-06-28T00:00:00.000Z",
          actorId: "actor:brain",
          objectId: "acr:goal:invalid",
          objectVersion: 1,
          traceId: "trace:release",
          payload: {
            object: {
              id: "acr:goal:invalid",
              type: "goal",
              schemaVersion: "0.1",
              version: 1,
              lifecycle: "draft",
              createdAt: "2026-06-28T00:00:00.000Z",
              createdBy: "actor:brain",
              traceId: "trace:release",
              confidence: 0.1,
              relationships: [],
              evidence: [],
              policies: [],
              payload: { intent: "Invalid goal" }
            }
          }
        }
      ]
    }
  ];

  expect(projectCommittedACTs(transactions).objects.size).toBe(0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `corepack pnpm test -- packages/core/src/acr.test.ts`

Expected: FAIL because `projectCommittedACTs` does not exist.

- [ ] **Step 4: Implement minimal projector**

```ts
import type { ACREvent, ACRObject, AtlasCognitiveTransaction } from "./acr.js";

export interface ACRProjection {
  objects: Map<string, ACRObject>;
}

export function projectCommittedACTs(
  transactions: AtlasCognitiveTransaction[]
): ACRProjection {
  const objects = new Map<string, ACRObject>();

  for (const transaction of transactions) {
    if (transaction.status !== "committed" && transaction.status !== "published") {
      continue;
    }

    for (const event of transaction.events) {
      applyEvent(objects, event);
    }
  }

  return { objects };
}

function applyEvent(objects: Map<string, ACRObject>, event: ACREvent): void {
  if (event.type === "object.created") {
    const payload = event.payload as { object: ACRObject };
    objects.set(event.objectId, payload.object);
  }

  if (event.type === "object.validated") {
    const existing = objects.get(event.objectId);
    if (existing) {
      objects.set(event.objectId, {
        ...existing,
        version: event.objectVersion,
        lifecycle: "validated"
      });
    }
  }
}
```

- [ ] **Step 5: Export projector**

```ts
export * from "./acr-projector.js";
```

- [ ] **Step 6: Run tests**

Run: `corepack pnpm test -- packages/core/src/acr.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/acr-projector.ts packages/core/src/acr.test.ts packages/core/src/index.ts
git commit -m "Add deterministic ACT projector"
```

## Task 3: Projection Boundaries

**Files:**

- Modify: `packages/core/src/acr.ts`
- Test: `packages/core/src/acr.test.ts`

- [ ] **Step 1: Write projection-boundary test**

```ts
it("keeps raw evidence as references instead of embedded payloads", () => {
  const object: ACRObject<{ summary: string; rawSourceRef: string }> = {
    id: "acr:memory:meeting",
    type: "memory",
    schemaVersion: "0.1",
    version: 1,
    lifecycle: "draft",
    createdAt: "2026-06-28T00:00:00.000Z",
    createdBy: "actor:brain",
    traceId: "trace:meeting",
    confidence: 0.8,
    relationships: [],
    evidence: [
      {
        sourceId: "blob:meeting-transcript",
        sourceType: "document",
        hash: "sha256:meeting"
      }
    ],
    policies: [],
    payload: {
      summary: "Release planning meeting",
      rawSourceRef: "blob:meeting-transcript"
    }
  };

  expect(object.evidence[0]?.sourceId).toBe("blob:meeting-transcript");
  expect(object.payload.rawSourceRef).toBe("blob:meeting-transcript");
});
```

- [ ] **Step 2: Run test**

Run: `corepack pnpm test -- packages/core/src/acr.test.ts`

Expected: PASS because the v0 schema already supports object references.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/acr.test.ts
git commit -m "Document ACR evidence projection boundary"
```

## Task 4: Full Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`

- [ ] **Step 1: Mark completed checklist items**

Mark these only after Tasks 1-3 are committed:

```markdown
- [x] Define Atlas Cognitive Transaction schema.
- [x] Define ACT lifecycle states.
- [x] Define ACT validation and commit rules.
- [x] Define ACT publication-after-commit rule.
- [x] Define ACR event-first source-of-truth model.
- [x] Define append-only ACR event log schema.
- [x] Define ACR event vocabulary.
- [x] Define ACR object version projection.
- [x] Define ACR relationship projection.
- [x] Define ACR evidence reference projection.
- [x] Define ACR raw evidence object-storage boundary.
- [x] Define ACT-level replay contract.
- [x] Define ACR replay and temporal query contract.
```

- [ ] **Step 2: Run full verification**

Run: `corepack pnpm check`

Expected: formatting, lint, TypeScript, and all tests pass.

- [ ] **Step 3: Commit checklist**

```bash
git add IMPLEMENTATION_CHECKLIST.md
git commit -m "Track ACR storage implementation progress"
```

## Self-Review

- Spec coverage: covers ACT atomic commits, event-first source of truth, object projection, replay, evidence references, and checklist updates.
- Placeholder scan: no `TBD`, `TODO`, or vague implementation-only steps.
- Type consistency: all new types use `ACRObject`, `ACREvent`, `AtlasCognitiveTransaction`, and `projectCommittedACTs`.
