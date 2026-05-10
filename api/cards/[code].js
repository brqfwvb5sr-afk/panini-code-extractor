import { setCardCount } from "../_store.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const code = String(request.query.code || "").toUpperCase();
    const count = request.body?.count;

    response.status(200).json(await setCardCount(code, count));
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message || "Änderung konnte nicht gespeichert werden.",
    });
  }
}
