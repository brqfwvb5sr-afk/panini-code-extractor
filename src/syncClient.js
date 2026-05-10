const STORAGE_KEY = "panini-collection-counts";

function apiOrigin() {
  const configuredOrigin = import.meta.env.VITE_API_ORIGIN;

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:4174`;
  }

  return "";
}

function cleanCounts(rawCounts) {
  if (!rawCounts || typeof rawCounts !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawCounts)
      .map(([code, count]) => [code.toUpperCase(), Math.max(0, Math.min(99, Number.parseInt(count, 10) || 0))])
      .filter(([, count]) => count > 0),
  );
}

export function readLocalCounts() {
  try {
    return cleanCounts(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

export function writeLocalCounts(counts) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanCounts(counts)));
}

export function createSyncConnection({ onState, onStatus }) {
  const origin = apiOrigin();
  const stateUrl = `${origin}/api/state`;
  const eventsUrl = `${origin}/api/events`;
  let closed = false;
  let events = null;

  async function loadState() {
    try {
      onStatus("syncing");
      const response = await fetch(stateUrl);

      if (!response.ok) {
        throw new Error("State konnte nicht geladen werden.");
      }

      const state = await response.json();

      if (!closed) {
        onState({ counts: cleanCounts(state.counts) });
        onStatus("online");
      }
    } catch {
      if (!closed) {
        onStatus("offline");
      }
    }
  }

  function connectEvents() {
    if (!("EventSource" in window)) {
      onStatus("offline");
      return;
    }

    events = new EventSource(eventsUrl);

    events.addEventListener("state", (event) => {
      if (closed) {
        return;
      }

      const state = JSON.parse(event.data);
      onState({ counts: cleanCounts(state.counts) });
      onStatus("online");
    });

    events.onopen = () => {
      if (!closed) {
        onStatus("online");
      }
    };

    events.onerror = () => {
      if (!closed) {
        onStatus("offline");
      }
    };
  }

  loadState();
  connectEvents();

  return {
    async setCardCount(code, count) {
      const response = await fetch(`${origin}/api/cards/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      if (!response.ok) {
        throw new Error("Änderung konnte nicht synchronisiert werden.");
      }

      const state = await response.json();
      onState({ counts: cleanCounts(state.counts) });
      onStatus("online");
    },
    close() {
      closed = true;

      if (events) {
        events.close();
      }
    },
  };
}
