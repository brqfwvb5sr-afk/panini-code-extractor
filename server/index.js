import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_CODES } from "../src/cardCatalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");
const dataDir = join(rootDir, "data");
const stateFile = join(dataDir, "state.json");
const clients = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

let state = loadState();

function cleanCounts(rawCounts) {
  const nextCounts = {};

  if (!rawCounts || typeof rawCounts !== "object") {
    return nextCounts;
  }

  for (const [rawCode, rawCount] of Object.entries(rawCounts)) {
    const code = rawCode.toUpperCase();
    const count = Math.max(0, Math.min(99, Number.parseInt(rawCount, 10) || 0));

    if (CARD_CODES.has(code) && count > 0) {
      nextCounts[code] = count;
    }
  }

  return nextCounts;
}

function loadState() {
  try {
    const parsed = JSON.parse(readFileSync(stateFile, "utf8"));

    return {
      counts: cleanCounts(parsed.counts),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return {
      counts: {},
      updatedAt: new Date().toISOString(),
    };
  }
}

function saveState() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function publicState() {
  return {
    counts: state.counts,
    updatedAt: state.updatedAt,
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 16_384) {
        rejectBody(new Error("Request zu groß."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
  });
}

function sendEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastState() {
  const payload = publicState();

  for (const client of clients) {
    sendEvent(client, "state", payload);
  }
}

function handleEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  clients.add(response);
  sendEvent(response, "state", publicState());

  const keepAlive = setInterval(() => {
    response.write(": ping\n\n");
  }, 25_000);

  request.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(response);
  });
}

async function handleCardUpdate(request, response, code) {
  if (!CARD_CODES.has(code)) {
    sendJson(response, 404, { error: "Unbekannte Karte." });
    return;
  }

  try {
    const body = await readJson(request);
    const count = Math.max(0, Math.min(99, Number.parseInt(body.count, 10) || 0));

    if (count > 0) {
      state.counts[code] = count;
    } else {
      delete state.counts[code];
    }

    state.updatedAt = new Date().toISOString();
    saveState();
    broadcastState();
    sendJson(response, 200, publicState());
  } catch {
    sendJson(response, 400, { error: "Ungültige Anfrage." });
  }
}

async function serveStatic(request, response, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");

  if (requestedPath.includes("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let filePath = resolve(distDir, requestedPath);

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) && !extname(filePath)) {
    filePath = join(distDir, "index.html");
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found. Bitte zuerst npm run build ausführen.");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === "/api/state" && request.method === "GET") {
    sendJson(response, 200, publicState());
    return;
  }

  if (url.pathname === "/api/events" && request.method === "GET") {
    handleEvents(request, response);
    return;
  }

  const cardMatch = url.pathname.match(/^\/api\/cards\/([^/]+)$/);

  if (cardMatch && request.method === "POST") {
    await handleCardUpdate(request, response, decodeURIComponent(cardMatch[1]).toUpperCase());
    return;
  }

  await serveStatic(request, response, url.pathname);
});

const port = Number.parseInt(process.env.PORT || "4174", 10);
const host = process.env.HOST || "0.0.0.0";

server.listen(port, host, () => {
  console.log(`Panini sync server läuft auf http://${host}:${port}`);
});
