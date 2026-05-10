import { readState } from "./_store.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    response.status(200).json(await readState());
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message || "State konnte nicht geladen werden.",
    });
  }
}
