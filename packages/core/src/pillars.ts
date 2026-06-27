export type PillarId =
  | "brain"
  | "capability-kernel"
  | "agoe"
  | "swm"
  | "world-state"
  | "memory"
  | "experience"
  | "capability-graph"
  | "identity"
  | "self-model"
  | "learning-governance"
  | "cognitive-loop";

export type PersistenceOwner =
  | "postgres"
  | "vector-store"
  | "object-store"
  | "event-log"
  | "none";

export interface PillarBoundary {
  id: PillarId;
  name: string;
  primaryPackage: string;
  owns: string[];
  consumes: string[];
  persistence: PersistenceOwner[];
  emits: string[];
  observes: string[];
}

export const PILLAR_BOUNDARIES: PillarBoundary[] = [
  {
    id: "brain",
    name: "Brain Engines",
    primaryPackage: "@atlas-aios/brain",
    owns: ["reasoning", "planning", "plan explanation", "context assembly"],
    consumes: [
      "Capability Kernel",
      "Semantic World Model",
      "World State",
      "Memory",
      "Experience Engine",
      "Self Model",
      "Identity Engine",
      "Learning & Governance System"
    ],
    persistence: ["postgres", "event-log"],
    emits: ["brain.plan.created", "brain.clarification.requested"],
    observes: ["planning latency", "approval rate", "plan acceptance rate"]
  },
  {
    id: "capability-kernel",
    name: "Capability Kernel",
    primaryPackage: "@atlas-aios/capability-kernel",
    owns: ["capability resolution", "provider ranking", "approval gate detection"],
    consumes: [
      "Capability Graph",
      "Experience Engine",
      "Learning & Governance System",
      "Self Model"
    ],
    persistence: ["postgres", "event-log"],
    emits: ["capability.resolved", "capability.resolution.blocked"],
    observes: ["resolution latency", "fallback rate", "provider confidence"]
  },
  {
    id: "agoe",
    name: "Autonomous Goal Ownership Engine",
    primaryPackage: "@atlas-aios/agoe",
    owns: ["goal lifecycle", "goal decomposition", "goal recovery", "waiting states"],
    consumes: ["Brain Engines", "World State", "Learning & Governance System"],
    persistence: ["postgres", "event-log"],
    emits: ["goal.created", "goal.updated", "goal.blocked", "goal.completed"],
    observes: ["goal age", "blocked goals", "completion rate"]
  },
  {
    id: "swm",
    name: "Semantic World Model",
    primaryPackage: "@atlas-aios/swm",
    owns: ["entities", "relationships", "ontology", "semantic provenance"],
    consumes: ["Identity Engine", "Memory", "Knowledge ingestion outputs"],
    persistence: ["postgres", "vector-store", "event-log"],
    emits: ["swm.entity.updated", "swm.relationship.updated"],
    observes: ["entity confidence", "relationship confidence", "ontology drift"]
  },
  {
    id: "world-state",
    name: "World State",
    primaryPackage: "@atlas-aios/world-state",
    owns: ["operational snapshots", "active goals", "blockers", "deadlines"],
    consumes: ["AGOE", "Execution Engine", "Memory", "Observability"],
    persistence: ["postgres", "event-log"],
    emits: ["world-state.updated", "world-state.blocker.detected"],
    observes: ["state freshness", "active workload", "incident count"]
  },
  {
    id: "memory",
    name: "Memory",
    primaryPackage: "@atlas-aios/memory",
    owns: ["immutable events", "conversation records", "execution records"],
    consumes: ["Cognitive Loop", "Execution Engine", "Learning & Governance System"],
    persistence: ["postgres", "vector-store", "object-store", "event-log"],
    emits: ["memory.event.recorded", "memory.source.linked"],
    observes: ["recording latency", "retrieval quality", "source coverage"]
  },
  {
    id: "experience",
    name: "Experience Engine",
    primaryPackage: "@atlas-aios/experience",
    owns: ["heuristics", "playbooks", "anti-patterns", "decision patterns"],
    consumes: ["Memory", "Learning & Governance System", "Self Model"],
    persistence: ["postgres", "vector-store", "event-log"],
    emits: ["experience.artifact.created", "experience.artifact.reviewed"],
    observes: ["artifact confidence", "reuse count", "staleness"]
  },
  {
    id: "capability-graph",
    name: "Capability Graph",
    primaryPackage: "@atlas-aios/capability-graph",
    owns: ["capability ontology", "capability composition", "capability confidence"],
    consumes: ["Knowledge ingestion outputs", "Learning & Governance System"],
    persistence: ["postgres", "vector-store", "event-log"],
    emits: ["capability.discovered", "capability-graph.updated"],
    observes: ["graph coverage", "graph confidence", "unresolved capability requests"]
  },
  {
    id: "identity",
    name: "Identity Engine",
    primaryPackage: "@atlas-aios/identity",
    owns: ["identity resolution", "aliases", "roles", "delegation context"],
    consumes: ["Semantic World Model", "Memory", "Learning & Governance System"],
    persistence: ["postgres", "event-log"],
    emits: ["identity.resolved", "identity.merge.requested"],
    observes: ["identity confidence", "unsafe assumption blocks", "merge reversals"]
  },
  {
    id: "self-model",
    name: "Self Model",
    primaryPackage: "@atlas-aios/self-model",
    owns: ["capability confidence", "known limitations", "granted authority"],
    consumes: ["Memory", "Experience Engine", "Learning & Governance System"],
    persistence: ["postgres", "event-log"],
    emits: ["self-model.updated", "self-model.limitation.recorded"],
    observes: ["confidence calibration", "known failure modes", "authority drift"]
  },
  {
    id: "learning-governance",
    name: "Learning & Governance System",
    primaryPackage: "@atlas-aios/governance",
    owns: [
      "policy decisions",
      "critic reports",
      "defender reports",
      "judge validation"
    ],
    consumes: ["Memory", "Experience Engine", "Execution Engine", "Self Model"],
    persistence: ["postgres", "object-store", "event-log"],
    emits: ["governance.decision.created", "learning.report.created"],
    observes: ["approval latency", "policy denials", "unsafe proposal rate"]
  },
  {
    id: "cognitive-loop",
    name: "Cognitive Loop",
    primaryPackage: "@atlas-aios/cognitive-loop",
    owns: [
      "loop phases",
      "attention allocation",
      "curiosity triggers",
      "bounded cycles"
    ],
    consumes: [
      "Brain Engines",
      "AGOE",
      "World State",
      "Memory",
      "Experience Engine",
      "Self Model"
    ],
    persistence: ["postgres", "event-log"],
    emits: ["cognitive-loop.cycle.started", "cognitive-loop.cycle.completed"],
    observes: ["cycle duration", "attention allocation", "idle recovery"]
  }
];

export function getPillarBoundary(id: PillarId): PillarBoundary {
  const boundary = PILLAR_BOUNDARIES.find((pillar) => pillar.id === id);

  if (boundary === undefined) {
    throw new Error(`Unknown Atlas pillar: ${id}`);
  }

  return boundary;
}
