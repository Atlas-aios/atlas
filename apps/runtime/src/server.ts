import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

import {
  createAtlasRuntime,
  createFileRuntimePersistence,
  type CreateAtlasRuntimeOptions
} from "./index.js";

export interface StartAtlasRuntimeServerOptions {
  port: number;
  hostname?: string;
  runtime?: CreateAtlasRuntimeOptions;
}

export interface RunningAtlasRuntimeServer {
  url: string;
  close(): Promise<void>;
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ATLAS_RUNTIME_PORT ?? 3000);
  const server = await startAtlasRuntimeServer({
    port,
    runtime: {
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
