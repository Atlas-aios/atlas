export type AtlasEnvironment = "development" | "test" | "staging" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RuntimeConfig {
  env: AtlasEnvironment;
  logLevel: LogLevel;
}

export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  level: LogLevel;
  sink?: (record: LogRecord) => void;
}

const logRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createRuntimeConfig(
  env: Record<string, string | undefined>
): RuntimeConfig {
  return {
    env: parseEnvironment(env["ATLAS_ENV"]),
    logLevel: parseLogLevel(env["ATLAS_LOG_LEVEL"])
  };
}

export function createLogger(options: LoggerOptions): Logger {
  const sink =
    options.sink ?? ((record: LogRecord) => console.log(JSON.stringify(record)));

  const emit = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void => {
    if (logRank[level] < logRank[options.level]) {
      return;
    }

    const baseRecord = {
      level,
      message,
      timestamp: new Date().toISOString()
    };

    sink(context === undefined ? baseRecord : { ...baseRecord, context });
  };

  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context)
  };
}

function parseEnvironment(value: string | undefined): AtlasEnvironment {
  if (
    value === "development" ||
    value === "test" ||
    value === "staging" ||
    value === "production"
  ) {
    return value;
  }

  return "development";
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}
