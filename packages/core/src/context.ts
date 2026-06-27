import type { AtlasId } from "./index.js";

export type InformationNeedPurpose =
  | "plan"
  | "execute"
  | "verify"
  | "govern"
  | "explain"
  | "learn";

export type RetrievalSource =
  | "identity"
  | "swm-graph"
  | "world-state"
  | "memory"
  | "experience"
  | "capability-graph"
  | "governance"
  | "bm25"
  | "vector";

export type ModelBudgetClass =
  | "no_model"
  | "local_tiny"
  | "local_small"
  | "local_medium"
  | "cloud_efficient"
  | "cloud_frontier";

export interface InformationNeed {
  id: AtlasId;
  goalId: AtlasId;
  purpose: InformationNeedPurpose;
  question: string;
  entities: string[];
  requiredSources: RetrievalSource[];
  permissionScope: string[];
  maxContextTokens: number;
  minConfidence: number;
  modelBudgetClass?: ModelBudgetClass;
}

export interface RetrievedContextItem {
  id: AtlasId;
  source: RetrievalSource;
  summary: string;
  content: string;
  confidence: number;
  relevance: number;
  estimatedTokens: number;
  permissionScope: string[];
  sourceRefs: string[];
}

export interface ContextPacketItem {
  id: AtlasId;
  source: RetrievalSource;
  summary: string;
  content: string;
  confidence: number;
  relevance: number;
  estimatedTokens: number;
  sourceRefs: string[];
}

export interface ContextPacket {
  informationNeedId: AtlasId;
  goalId: AtlasId;
  purpose: InformationNeedPurpose;
  question: string;
  tokenBudget: number;
  estimatedTokens: number;
  modelBudgetClass: ModelBudgetClass;
  items: ContextPacketItem[];
  missingSources: RetrievalSource[];
  droppedResultIds: AtlasId[];
}

export interface BuildContextPacketInput {
  informationNeed: InformationNeed;
  results: RetrievedContextItem[];
}

export interface ContextRetriever {
  source: RetrievalSource;
  retrieve(informationNeed: InformationNeed): Promise<RetrievedContextItem[]>;
}

export interface BuildContextPacketFromRetrieversInput {
  informationNeed: InformationNeed;
  retrievers: ContextRetriever[];
}

export function buildContextPacket(input: BuildContextPacketInput): ContextPacket {
  const allowedResults = input.results
    .filter((result) => result.confidence >= input.informationNeed.minConfidence)
    .filter((result) =>
      hasPermissionOverlap(
        result.permissionScope,
        input.informationNeed.permissionScope
      )
    )
    .sort(compareRetrievedContextItems);

  const items: ContextPacketItem[] = [];
  const droppedResultIds = new Set<AtlasId>();
  let estimatedTokens = 0;

  for (const result of allowedResults) {
    if (
      estimatedTokens + result.estimatedTokens >
      input.informationNeed.maxContextTokens
    ) {
      droppedResultIds.add(result.id);
      continue;
    }

    estimatedTokens += result.estimatedTokens;
    items.push({
      id: result.id,
      source: result.source,
      summary: result.summary,
      content: result.content,
      confidence: result.confidence,
      relevance: result.relevance,
      estimatedTokens: result.estimatedTokens,
      sourceRefs: result.sourceRefs
    });
  }

  for (const result of input.results) {
    if (!items.some((item) => item.id === result.id)) {
      droppedResultIds.add(result.id);
    }
  }

  const presentSources = new Set(items.map((item) => item.source));
  const missingSources = input.informationNeed.requiredSources.filter(
    (source) => !presentSources.has(source)
  );

  return {
    informationNeedId: input.informationNeed.id,
    goalId: input.informationNeed.goalId,
    purpose: input.informationNeed.purpose,
    question: input.informationNeed.question,
    tokenBudget: input.informationNeed.maxContextTokens,
    estimatedTokens,
    modelBudgetClass: input.informationNeed.modelBudgetClass ?? "no_model",
    items,
    missingSources,
    droppedResultIds: Array.from(droppedResultIds)
  };
}

export async function buildContextPacketFromRetrievers(
  input: BuildContextPacketFromRetrieversInput
): Promise<ContextPacket> {
  const retrieversBySource = new Map(
    input.retrievers.map((retriever) => [retriever.source, retriever])
  );
  const selectedRetrievers = input.informationNeed.requiredSources
    .map((source) => retrieversBySource.get(source))
    .filter((retriever): retriever is ContextRetriever => retriever !== undefined);

  const resultGroups = await Promise.all(
    selectedRetrievers.map((retriever) => retriever.retrieve(input.informationNeed))
  );

  return buildContextPacket({
    informationNeed: input.informationNeed,
    results: resultGroups.flat()
  });
}

function compareRetrievedContextItems(
  left: RetrievedContextItem,
  right: RetrievedContextItem
): number {
  const leftScore = scoreRetrievedContextItem(left);
  const rightScore = scoreRetrievedContextItem(right);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.estimatedTokens - right.estimatedTokens;
}

function scoreRetrievedContextItem(item: RetrievedContextItem): number {
  return item.relevance * 0.7 + item.confidence * 0.3;
}

function hasPermissionOverlap(left: string[], right: string[]): boolean {
  return left.some((scope) => right.includes(scope));
}
