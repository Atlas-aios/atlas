/* global Buffer, URL, console, process */

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.ATLAS_ADMIN_PORT ?? 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = createServer(async (request, response) => {
  const requestPath =
    request.url === "/" ? "/index.html" : (request.url ?? "/index.html");
  const filePath = join(root, requestPath);

  try {
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader(
      "content-type",
      contentTypes[extname(filePath)] ?? "application/octet-stream"
    );
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end(Buffer.from("not found"));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Atlas admin listening at http://127.0.0.1:${port}`);
});
