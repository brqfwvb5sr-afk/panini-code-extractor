import React, { useEffect, useMemo, useRef, useState } from "react";
import { CARDS, GROUPS, TOTAL_CARDS } from "./cardCatalog.js";
import { createSyncConnection, readLocalCounts, writeLocalCounts } from "./syncClient.js";

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "missing", label: "Fehlende" },
  { id: "duplicates", label: "Doppelte" },
];

function clampCount(value) {
  return Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0));
}

function countFor(counts, code) {
  return counts[code] ?? 0;
}

function applyCount(counts, code, count) {
  const next = { ...counts };

  if (count > 0) {
    next[code] = count;
  } else {
    delete next[code];
  }

  return next;
}

function statusLabel(status) {
  if (status === "online") {
    return "Live";
  }

  if (status === "syncing") {
    return "Sync";
  }

  return "Offline";
}

function matchesSearch(group, card, query) {
  if (!query) {
    return true;
  }

  const haystack = `${group.code} ${group.name} ${(group.aliases ?? []).join(" ")} ${card.code} ${card.number}`.toUpperCase();
  return haystack.includes(query);
}

function matchesMode(count, mode) {
  if (mode === "missing") {
    return count === 0;
  }

  if (mode === "duplicates") {
    return count > 1;
  }

  return true;
}

export default function App() {
  const syncRef = useRef(null);
  const [counts, setCounts] = useState(() => readLocalCounts());
  const [syncStatus, setSyncStatus] = useState("syncing");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [openGroups, setOpenGroups] = useState(() => new Set(["SUI"]));

  useEffect(() => {
    const connection = createSyncConnection({
      onState: (state) => setCounts(state.counts ?? {}),
      onStatus: setSyncStatus,
    });

    syncRef.current = connection;

    return () => {
      connection.close();
      syncRef.current = null;
    };
  }, []);

  useEffect(() => {
    writeLocalCounts(counts);
  }, [counts]);

  const normalizedQuery = query.trim().toUpperCase();

  const stats = useMemo(() => {
    let collected = 0;
    let totalCopies = 0;
    let duplicateCards = 0;
    let duplicateCopies = 0;

    for (const card of CARDS) {
      const count = countFor(counts, card.code);

      if (count > 0) {
        collected += 1;
        totalCopies += count;
      }

      if (count > 1) {
        duplicateCards += 1;
        duplicateCopies += count - 1;
      }
    }

    return {
      collected,
      completion: Math.round((collected / TOTAL_CARDS) * 100),
      missing: TOTAL_CARDS - collected,
      totalCopies,
      duplicateCards,
      duplicateCopies,
    };
  }, [counts]);

  const visibleGroups = useMemo(
    () =>
      GROUPS.map((group) => {
        const visibleCards = group.cards.filter((card) => {
          const count = countFor(counts, card.code);
          return matchesSearch(group, card, normalizedQuery) && matchesMode(count, mode);
        });

        return { ...group, visibleCards };
      }).filter((group) => group.visibleCards.length > 0),
    [counts, mode, normalizedQuery],
  );

  function setCardCount(code, nextCount) {
    const cleanCount = clampCount(nextCount);

    setCounts((current) => applyCount(current, code, cleanCount));
    syncRef.current?.setCardCount(code, cleanCount).catch(() => {
      setSyncStatus("offline");
    });
  }

  function toggleOwned(code) {
    const current = countFor(counts, code);
    setCardCount(code, current > 0 ? 0 : 1);
  }

  function toggleGroup(code) {
    setOpenGroups((current) => {
      const next = new Set(current);

      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }

      return next;
    });
  }

  function expandVisibleGroups() {
    setOpenGroups(new Set(visibleGroups.map((group) => group.code)));
  }

  function collapseGroups() {
    setOpenGroups(new Set());
  }

  return (
    <main className="app-shell">
      <section className="top-panel">
        <header className="app-header">
          <div>
            <p className="eyebrow">Panini 2026</p>
            <h1>Sammlung</h1>
          </div>
          <span className={`sync-pill sync-${syncStatus}`}>{statusLabel(syncStatus)}</span>
        </header>

        <div className="overview-card">
          <div className="overview-copy">
            <span>Fortschritt</span>
            <strong>{stats.completion}%</strong>
          </div>
          <div className="overview-progress" aria-label={`${stats.completion}% komplett`}>
            <span style={{ width: `${stats.completion}%` }} />
          </div>
          <div className="overview-meta">
            <span>{stats.collected} gesammelt</span>
            <span>{stats.missing} offen</span>
          </div>
        </div>

        <label className="search-field">
          <span>Suchen</span>
          <input
            type="search"
            inputMode="search"
            placeholder="SUI15, MAR, FWC..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="segmented-control" aria-label="Ansicht">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={mode === filter.id ? "is-active" : ""}
              onClick={() => setMode(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="stats-grid" aria-label="Sammlungsstatus">
          <div>
            <strong>{stats.collected}</strong>
            <span>gesammelt</span>
          </div>
          <div>
            <strong>{stats.missing}</strong>
            <span>fehlen</span>
          </div>
          <div>
            <strong>{stats.duplicateCopies}</strong>
            <span>doppelt</span>
          </div>
        </div>

        <div className="fold-actions">
          <button type="button" onClick={expandVisibleGroups}>
            Alle öffnen
          </button>
          <button type="button" onClick={collapseGroups}>
            Alle schließen
          </button>
        </div>
      </section>

      <section className="group-list" aria-label="Kartenliste">
        {visibleGroups.map((group) => {
          const isOpen = normalizedQuery ? true : openGroups.has(group.code);
          const groupCollected = group.cards.filter((card) => countFor(counts, card.code) > 0).length;
          const groupDuplicates = group.cards.reduce((total, card) => total + Math.max(0, countFor(counts, card.code) - 1), 0);
          const groupCompletion = Math.round((groupCollected / group.total) * 100);

          return (
            <article className="group-card" key={group.code}>
              <button
                type="button"
                className="group-header"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.code)}
              >
                <span className={`chevron ${isOpen ? "is-open" : ""}`}>›</span>
                <span className="group-code">{group.code}</span>
                <span className="group-main">
                  <span className="group-name">{group.name}</span>
                  <span className="group-progress" aria-hidden="true">
                    <span style={{ width: `${groupCompletion}%` }} />
                  </span>
                </span>
                <span className="group-meta">
                  <strong>
                    {groupCollected}/{group.total}
                  </strong>
                  <small>{groupDuplicates > 0 ? `+${groupDuplicates}` : `${groupCompletion}%`}</small>
                </span>
              </button>

              {isOpen && (
                <div className="sticker-list">
                  {group.visibleCards.map((card) => {
                    const count = countFor(counts, card.code);
                    const duplicateCount = Math.max(0, count - 1);

                    return (
                      <div className="sticker-row" key={card.code}>
                        <button
                          type="button"
                          className={`owned-toggle ${count > 0 ? "is-owned" : ""}`}
                          aria-label={`${card.code} ${count > 0 ? "als fehlend markieren" : "als vorhanden markieren"}`}
                          aria-pressed={count > 0}
                          onClick={() => toggleOwned(card.code)}
                        >
                          {count > 0 ? "✓" : ""}
                        </button>

                        <div className="sticker-info">
                          <strong>{card.code}</strong>
                          <span>{group.name}</span>
                        </div>

                        {duplicateCount > 0 && <span className="duplicate-badge">+{duplicateCount}</span>}

                        <div className="stepper" aria-label={`${card.code} Anzahl`}>
                          <button type="button" onClick={() => setCardCount(card.code, count - 1)} disabled={count === 0}>
                            −
                          </button>
                          <span>{count}</span>
                          <button type="button" onClick={() => setCardCount(card.code, count + 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}

        {visibleGroups.length === 0 && (
          <div className="empty-state">
            <strong>Nichts gefunden</strong>
            <span>Suche oder Filter ändern.</span>
          </div>
        )}
      </section>
    </main>
  );
}
