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

## Store Selection

| Need                          | First Lookup                 | Fallback                           |
| ----------------------------- | ---------------------------- | ---------------------------------- |
| known person/system/project   | Identity Engine exact lookup | fuzzy candidate search             |
| related entities              | SWM graph traversal          | vector search over semantic memory |
| previous similar task         | Experience artifacts         | episodic vector search             |
| exact instruction or decision | keyword/BM25 search          | document/meeting vector search     |
| current blockers              | World State projection       | recent execution memory            |
| allowed authority             | Governance policy lookup     | human approval                     |
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
