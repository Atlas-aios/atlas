import type { ACRProjection } from "./acr-projector.js";
import { projectCommittedACTs } from "./acr-projector.js";
import type { ACTStatus, AtlasCognitiveTransaction } from "./acr.js";

export interface ACREventLogEntry {
  sequence: number;
  actId: string;
  traceId: string;
  status: ACTStatus;
  appendedAt: string;
  transaction: Readonly<AtlasCognitiveTransaction>;
}

export interface ACREventLogAppendOptions {
  appendedAt?: string;
}

export interface ACTCommitOptions {
  committedAt?: string;
}

export interface ACREventLog {
  append(
    transaction: AtlasCognitiveTransaction,
    options?: ACREventLogAppendOptions
  ): ACREventLogEntry;
  entries(): readonly ACREventLogEntry[];
}

export function createACREventLog(
  now: () => string = () => new Date().toISOString()
): ACREventLog {
  const entries: ACREventLogEntry[] = [];
  const actIds = new Set<string>();

  return {
    append(
      transaction: AtlasCognitiveTransaction,
      options?: ACREventLogAppendOptions
    ): ACREventLogEntry {
      if (actIds.has(transaction.id)) {
        throw new Error(`ACT ${transaction.id} already exists in the ACR event log`);
      }

      const entry = Object.freeze({
        sequence: entries.length + 1,
        actId: transaction.id,
        traceId: transaction.traceId,
        status: transaction.status,
        appendedAt: options?.appendedAt ?? now(),
        transaction: cloneTransaction(transaction)
      });

      actIds.add(transaction.id);
      entries.push(entry);
      return entry;
    },

    entries(): readonly ACREventLogEntry[] {
      return [...entries];
    }
  };
}

export function commitACT(
  log: ACREventLog,
  transaction: AtlasCognitiveTransaction,
  options: ACTCommitOptions = {}
): ACREventLogEntry {
  if (!transaction.validation.passed) {
    throw new Error(
      `Cannot commit ACT ${transaction.id} because validation failed: ${transaction.validation.errors.join(", ")}`
    );
  }

  const committedAt = options.committedAt ?? new Date().toISOString();
  const committedTransaction: AtlasCognitiveTransaction = {
    ...cloneTransaction(transaction),
    status: "committed",
    committedAt
  };

  return log.append(committedTransaction, { appendedAt: committedAt });
}

export function replayACREventLog(log: ACREventLog): ACRProjection {
  return projectCommittedACTs(log.entries().map((entry) => entry.transaction));
}

export function replayACREventLogUntil(log: ACREventLog, asOf: string): ACRProjection {
  return projectCommittedACTs(
    log
      .entries()
      .filter((entry) => entry.appendedAt <= asOf)
      .map((entry) => entry.transaction)
  );
}

function cloneTransaction(
  transaction: AtlasCognitiveTransaction
): AtlasCognitiveTransaction {
  return {
    ...transaction,
    preconditions: [...transaction.preconditions],
    policyRefs: [...transaction.policyRefs],
    evidenceRefs: transaction.evidenceRefs.map((evidence) => ({ ...evidence })),
    events: transaction.events.map((event) => ({ ...event })),
    validation: {
      passed: transaction.validation.passed,
      errors: [...transaction.validation.errors],
      warnings: [...transaction.validation.warnings]
    }
  };
}
