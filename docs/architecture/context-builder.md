# Context Builder

Atlas stores memory, identity, world state, capabilities, and governance outside the model. The Context Builder is the bridge between that external knowledge and a bounded model call.

The Context Builder does not ask, "What does Atlas remember?" It asks, "What information is needed for this specific decision?"

## Flow

```text
goal or task
-> InformationNeed
-> identity and permission scope
-> graph lookup
-> keyword/BM25 lookup
-> vector lookup
-> world-state lookup
-> governance lookup
-> rerank
-> evidence validation
-> ContextPacket
-> model call
```

## InformationNeed

`InformationNeed` is the retrieval plan. It describes the purpose, question, entities, required sources, permission scope, confidence threshold, model budget, and maximum context tokens.

Purposes:

- `plan`
- `execute`
- `verify`
- `govern`
- `explain`
- `learn`

Source types:

- `identity`
- `swm-graph`
- `world-state`
- `memory`
- `experience`
- `capability-graph`
- `governance`
- `decision`
- `bm25`
- `vector`

## ContextPacket

`ContextPacket` is the bounded answer given to a model or deterministic planner. It contains selected source-backed items and records what was missing or dropped.

It includes:

- information need id
- goal id
- purpose
- question
- token budget
- estimated tokens
- model budget class
- selected context items
- missing sources
- dropped result ids

## Retriever Adapters

Retriever adapters are the source-specific plugins behind the Context Builder. They translate an `InformationNeed` into source-backed `RetrievedContextItem` records.

The core adapter contract is:

```ts
interface ContextRetriever {
  source: RetrievalSource;
  retrieve(informationNeed: InformationNeed): Promise<RetrievedContextItem[]>;
}
```

The Context Builder calls only the retrievers required by the `InformationNeed`. If a task requires identity, governance, and world state, memory and vector search are not queried.

This keeps retrieval cheap and permissioned:

```text
InformationNeed.requiredSources
-> select matching retrievers
-> pass permission scope to each retriever
-> collect source-backed results
-> build ContextPacket
```

First-class retriever roles:

| Retriever        | Role                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| Identity         | resolves users, systems, roles, aliases, and permission context             |
| Governance       | returns applicable policies and audit constraints                           |
| Decision Engine  | returns decision outcomes, constraints, discussion points, and alternatives |
| World State      | returns active blockers, goals, incidents, deadlines, and workload          |
| SWM Graph        | returns semantic entities and relationships                                 |
| Memory           | returns source-backed episodic records                                      |
| Experience       | returns heuristics, playbooks, and anti-patterns                            |
| Capability Graph | returns possible capabilities and composition paths                         |
| BM25             | returns exact text matches for decisions, instructions, and docs            |
| Vector           | returns semantically similar memories, docs, and artifacts                  |

## Store Selection

| Need                          | First Lookup                 | Fallback                           |
| ----------------------------- | ---------------------------- | ---------------------------------- |
| known person/system/project   | Identity Engine exact lookup | fuzzy candidate search             |
| related entities              | SWM graph traversal          | vector search over semantic memory |
| previous similar task         | Experience artifacts         | episodic vector search             |
| exact instruction or decision | keyword/BM25 search          | document/meeting vector search     |
| current blockers              | World State projection       | recent execution memory            |
| allowed authority             | Decision Engine              | Governance policy lookup           |
| available action              | Capability Graph             | capability discovery               |

## Cost Control

The Context Builder should prefer `no_model` retrieval. Models are used only when retrieval requires classification, extraction, summarization, or ambiguity resolution.

Model budget classes:

- `no_model`
- `local_tiny`
- `local_small`
- `local_medium`
- `cloud_efficient`
- `cloud_frontier`

## Governance

The Context Builder must respect permission scope before relevance ranking. A highly relevant memory with the wrong permission scope is not allowed into the packet.

Every selected item must retain source references so plans and decisions can explain their evidence.
