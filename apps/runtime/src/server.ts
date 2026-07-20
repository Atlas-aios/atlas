import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

import {
  createOpenAiCompatiblePlanningProvider,
  createNvidiaNimPlanningProvider,
  type CreateOpenAiCompatiblePlanningProviderInput,
  type CreateNvidiaNimPlanningProviderInput
} from "@atlas-aios/brain";

import {
  createAtlasRuntime,
  createFileRuntimePersistence,
  type CreateAtlasRuntimeOptions,
  type RuntimeBrainConfig
} from "./index.js";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
type RuntimeNvidiaFetcher = CreateNvidiaNimPlanningProviderInput["fetcher"];
type RuntimeLocalModelFetcher = CreateOpenAiCompatiblePlanningProviderInput["fetcher"];

export interface StartAtlasRuntimeServerOptions {
  port: number;
  hostname?: string;
  runtime?: CreateAtlasRuntimeOptions;
}

export interface RunningAtlasRuntimeServer {
  url: string;
  close(): Promise<void>;
}

export function createRuntimeBrainConfigFromEnvironment(
  environment: RuntimeEnvironment,
  nvidiaFetcher: RuntimeNvidiaFetcher = fetchNvidiaNim,
  localModelFetcher: RuntimeLocalModelFetcher = fetchLocalOpenAiCompatibleModel
): RuntimeBrainConfig {
  const allowRemoteModels = environment.ATLAS_ALLOW_REMOTE_MODELS === "true";
  const allowFreeHostedEndpoints =
    environment.ATLAS_ALLOW_FREE_HOSTED_MODEL_ENDPOINTS === "true";
  const apiKey = environment.NVIDIA_API_KEY;
  const canConfigureNvidia =
    allowRemoteModels &&
    allowFreeHostedEndpoints &&
    apiKey !== undefined &&
    apiKey.length > 0;
  const localModelId = environment.ATLAS_LOCAL_MODEL_ID;
  const canConfigureLocal = localModelId !== undefined && localModelId.length > 0;

  return {
    allowRemoteModels,
    allowFreeHostedEndpoints,
    providers: {
      ...(canConfigureLocal
        ? {
            "qwen-local-default": createOpenAiCompatiblePlanningProvider({
              baseUrl:
                environment.ATLAS_LOCAL_MODEL_BASE_URL ?? "http://127.0.0.1:11434/v1",
              model: localModelId,
              fetcher: localModelFetcher,
              ...(environment.ATLAS_LOCAL_MODEL_API_KEY === undefined
                ? {}
                : { apiKey: environment.ATLAS_LOCAL_MODEL_API_KEY })
            })
          }
        : {}),
      ...(canConfigureNvidia
        ? {
            "nvidia-nemotron-super-remote": createNvidiaNimPlanningProvider({
              apiKey,
              fetcher: nvidiaFetcher
            })
          }
        : {})
    }
  };
}

export async function startAtlasRuntimeServer(
  options: StartAtlasRuntimeServerOptions
): Promise<RunningAtlasRuntimeServer> {
  const runtime = createAtlasRuntime(options.runtime);
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = await toWebRequest(incoming, options.hostname ?? "127.0.0.1");
      const response = await runtime.handle(request);
      await writeWebResponse(outgoing, response);
    } catch {
      outgoing.statusCode = 500;
      outgoing.setHeader("content-type", "application/json");
      outgoing.end(JSON.stringify({ error: "runtime_error" }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, options.hostname ?? "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  const url = `http://${address.address}:${address.port}`;

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

async function toWebRequest(
  incoming: IncomingMessage,
  hostname: string
): Promise<Request> {
  const url = `http://${incoming.headers.host ?? hostname}${incoming.url ?? "/"}`;
  const method = incoming.method ?? "GET";
  const headers = new Headers();

  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }

  return new Request(url, {
    method,
    headers,
    body: await readIncomingBody(incoming)
  });
}

async function readIncomingBody(incoming: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function writeWebResponse(
  outgoing: ServerResponse,
  response: Response
): Promise<void> {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => {
    outgoing.setHeader(name, value);
  });
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

async function fetchNvidiaNim(url: string, init: Parameters<RuntimeNvidiaFetcher>[1]) {
  const response = await fetch(url, init);

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json()
  };
}

async function fetchLocalOpenAiCompatibleModel(
  url: string,
  init: Parameters<RuntimeLocalModelFetcher>[1]
) {
  const response = await fetch(url, init);

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json()
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ATLAS_RUNTIME_PORT ?? 3000);
  const server = await startAtlasRuntimeServer({
    port,
    runtime: {
      brain: createRuntimeBrainConfigFromEnvironment(process.env),
      ...(process.env.ATLAS_RUNTIME_API_KEY === undefined
        ? {}
        : {
            auth: {
              apiKey: process.env.ATLAS_RUNTIME_API_KEY,
              requireIdentity: process.env.ATLAS_RUNTIME_REQUIRE_IDENTITY === "true"
            }
          }),
      ...(process.env.ATLAS_RUNTIME_STATE_PATH === undefined
        ? {}
        : {
            persistence: createFileRuntimePersistence(
              process.env.ATLAS_RUNTIME_STATE_PATH
            )
          })
    }
  });
  console.log(`Atlas runtime listening at ${server.url}`);
}
