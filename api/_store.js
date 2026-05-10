import { CARD_CODES } from "../src/cardCatalog.js";

const COUNTS_KEY = process.env.PANINI_REDIS_KEY || "panini:collection:counts";
const UPDATED_AT_KEY = process.env.PANINI_UPDATED_AT_KEY || "panini:collection:updatedAt";

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

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

function hgetallToObject(result) {
  if (!result) {
    return {};
  }

  if (!Array.isArray(result)) {
    return cleanCounts(result);
  }

  const counts = {};

  for (let index = 0; index < result.length; index += 2) {
    counts[result[index]] = result[index + 1];
  }

  return cleanCounts(counts);
}

async function redisCommand(command) {
  const config = redisConfig();

  if (!config) {
    const error = new Error("Cloud-Speicher ist nicht eingerichtet.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.error) {
    const error = new Error(body.error || "Redis-Anfrage fehlgeschlagen.");
    error.statusCode = response.status || 500;
    throw error;
  }

  return body.result;
}

export async function readState() {
  const [countsResult, updatedAtResult] = await Promise.all([
    redisCommand(["HGETALL", COUNTS_KEY]),
    redisCommand(["GET", UPDATED_AT_KEY]),
  ]);

  return {
    counts: hgetallToObject(countsResult),
    updatedAt: updatedAtResult || new Date().toISOString(),
  };
}

export async function setCardCount(code, count) {
  if (!CARD_CODES.has(code)) {
    const error = new Error("Unbekannte Karte.");
    error.statusCode = 404;
    throw error;
  }

  const cleanCount = Math.max(0, Math.min(99, Number.parseInt(count, 10) || 0));
  const updatedAt = new Date().toISOString();

  if (cleanCount > 0) {
    await redisCommand(["HSET", COUNTS_KEY, code, String(cleanCount)]);
  } else {
    await redisCommand(["HDEL", COUNTS_KEY, code]);
  }

  await redisCommand(["SET", UPDATED_AT_KEY, updatedAt]);

  return readState();
}
