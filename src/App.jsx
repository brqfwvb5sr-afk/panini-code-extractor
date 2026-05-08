import React, { useMemo, useRef, useState } from "react";

const CODE_REGEX = /\b([A-Z0-9]{2,3})\s?[-]?\s?([0-9OQDILSB]{1,3})\b/gi;
const NORMALIZED_CODE_REGEX = /^(?:[A-Z]{3}|CC)\d{1,3}$/;
const OCR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ";
const WORLD_CUP_2026_CODES = [
  "ALG",
  "ARG",
  "AUS",
  "AUT",
  "BEL",
  "BIH",
  "BRA",
  "CAN",
  "CIV",
  "COD",
  "COL",
  "CPV",
  "CRO",
  "CUW",
  "CZE",
  "ECU",
  "EGY",
  "ENG",
  "ESP",
  "FRA",
  "GER",
  "GHA",
  "HAI",
  "IRN",
  "IRQ",
  "JOR",
  "JPN",
  "KOR",
  "KSA",
  "MAR",
  "MEX",
  "NED",
  "NOR",
  "NZL",
  "PAN",
  "PAR",
  "POR",
  "QAT",
  "RSA",
  "SCO",
  "SEN",
  "SUI",
  "SWE",
  "TUN",
  "TUR",
  "URU",
  "USA",
  "UZB",
];
const SPECIAL_CODE_PREFIXES = ["FWC", "CC"];
const VALID_CODE_PREFIXES = new Set([...WORLD_CUP_2026_CODES, ...SPECIAL_CODE_PREFIXES]);
const ASSET_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const TESSERACT_OPTIONS = {
  workerPath: `${ASSET_BASE}/tesseract/worker.min.js`,
  corePath: `${ASSET_BASE}/tesseract/core`,
  langPath: `${ASSET_BASE}/tesseract/lang`,
};

function expandCountryCandidates(value) {
  const replacements = {
    0: ["O", "Q"],
    1: ["I", "L"],
    2: ["Z"],
    5: ["S"],
    6: ["G"],
    8: ["B"],
  };
  const chars = value.toUpperCase().split("");
  const candidates = [""];

  for (const char of chars) {
    const options = replacements[char] ?? [char];
    const nextCandidates = [];

    for (const candidate of candidates) {
      for (const option of options) {
        nextCandidates.push(`${candidate}${option}`);
      }
    }

    candidates.splice(0, candidates.length, ...nextCandidates);
  }

  return candidates;
}

function normalizePrefix(value) {
  const direct = value.toUpperCase();

  if (VALID_CODE_PREFIXES.has(direct)) {
    return direct;
  }

  return expandCountryCandidates(direct).find((candidate) => VALID_CODE_PREFIXES.has(candidate)) ?? "";
}

function normalizeNumber(value) {
  return value
    .replace(/[OQD]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");
}

function normalizeCode(value) {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();

  for (const prefixLength of [3, 2]) {
    if (compact.length <= prefixLength) {
      continue;
    }

    const prefix = normalizePrefix(compact.slice(0, prefixLength));
    const number = normalizeNumber(compact.slice(prefixLength));
    const code = prefix ? `${prefix}${number}` : "";

    if (NORMALIZED_CODE_REGEX.test(code)) {
      return code;
    }
  }

  return "";
}

function extractCodes(text) {
  const matches = [...text.matchAll(CODE_REGEX)].map((match) => match[0]);
  const normalized = matches
    .map(normalizeCode)
    .filter((code) => NORMALIZED_CODE_REGEX.test(code));

  return [...new Set(normalized)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bildformat konnte nicht gelesen werden. Bitte JPG, PNG oder WebP verwenden."));
    };

    image.src = url;
  });
}

const FULL_IMAGE_ATTEMPTS = [0, 90, 270, 180].map((rotation) => ({
  label: rotation === 0 ? "Ganzes Bild" : `Ganzes Bild ${rotation} Grad`,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  preferredWidth: 2400,
  rotation,
}));

const FOCUSED_ATTEMPTS = [
  { label: "linker Bereich", crop: { x: 0, y: 0, width: 0.38, height: 1 } },
  { label: "rechter Bereich", crop: { x: 0.62, y: 0, width: 0.38, height: 1 } },
  { label: "oberer Bereich", crop: { x: 0, y: 0, width: 1, height: 0.42 } },
  { label: "unterer Bereich", crop: { x: 0, y: 0.58, width: 1, height: 0.42 } },
  { label: "oben links", crop: { x: 0, y: 0, width: 0.55, height: 0.55 } },
  { label: "oben rechts", crop: { x: 0.45, y: 0, width: 0.55, height: 0.55 } },
].flatMap((attempt) =>
  [0, 90, 270, 180].map((rotation) => ({
    ...attempt,
    label: rotation === 0 ? attempt.label : `${attempt.label} ${rotation} Grad`,
    preferredWidth: 1800,
    rotation,
  })),
);

function preprocessImage(image, attempt) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const crop = attempt.crop;
  const sx = Math.round(width * crop.x);
  const sy = Math.round(height * crop.y);
  const sw = Math.round(width * crop.width);
  const sh = Math.round(height * crop.height);
  const isQuarterTurn = Math.abs(attempt.rotation % 180) === 90;
  const targetWidth = isQuarterTurn ? sh : sw;
  const targetHeight = isQuarterTurn ? sw : sh;
  const rawScale = attempt.preferredWidth / targetWidth;
  const scale =
    targetWidth < attempt.preferredWidth ? clamp(rawScale, 1.1, 3.2) : clamp(rawScale, 0.35, 1);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetWidth * scale));
  canvas.height = Math.max(1, Math.round(targetHeight * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((attempt.rotation * Math.PI) / 180);
  context.drawImage(image, sx, sy, sw, sh, -(sw * scale) / 2, -(sh * scale) / 2, sw * scale, sh * scale);
  context.restore();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrast = clamp((gray - 128) * 1.75 + 128, 0, 255);
    const cleaned = contrast > 236 ? 255 : contrast < 46 ? 0 : contrast;

    data[index] = cleaned;
    data[index + 1] = cleaned;
    data[index + 2] = cleaned;
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);

  return canvas;
}

async function recognizeFile(file, worker) {
  const image = await loadImage(file);
  const textParts = [];
  const codes = new Set();

  for (const attempt of FULL_IMAGE_ATTEMPTS) {
    const canvas = preprocessImage(image, attempt);
    const result = await worker.recognize(canvas, {}, { text: true, blocks: false, hocr: false, tsv: false });
    const text = result.data.text ?? "";

    textParts.push(text);
    extractCodes(text).forEach((code) => codes.add(code));
  }

  if (codes.size < 2) {
    for (const attempt of FOCUSED_ATTEMPTS) {
      const canvas = preprocessImage(image, attempt);
      const result = await worker.recognize(canvas, {}, { text: true, blocks: false, hocr: false, tsv: false });
      const text = result.data.text ?? "";

      textParts.push(text);
      extractCodes(text).forEach((code) => codes.add(code));

      if (codes.size >= 2) {
        break;
      }
    }
  }

  return {
    codes: [...codes],
    rawText: textParts.join("\n").trim(),
  };
}

async function createOcrWorker(onProgress) {
  const { createWorker } = await import("tesseract.js");

  return createWorker("eng", 1, {
    ...TESSERACT_OPTIONS,
    errorHandler: (workerError) => {
      console.error(workerError);
    },
    logger: onProgress,
  });
}

export default function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [codes, setCodes] = useState([]);
  const [fileResults, setFileResults] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");

  const sortedCodes = useMemo(
    () => [...codes].sort((first, second) => first.localeCompare(second, "de", { numeric: true })),
    [codes],
  );

  async function processFiles(fileList) {
    const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      setError("Bitte lade mindestens eine Bilddatei hoch.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setCopyState("");

    let worker;

    try {
      worker = await createOcrWorker((message) => {
        if (message.status && message.status !== "recognizing text") {
          setProgress((current) =>
            current
              ? {
                  ...current,
                  phase: message.status,
                  percent: Math.round((message.progress || 0) * 100),
                }
              : current,
          );
        }

        if (message.status === "recognizing text") {
          setProgress((current) =>
            current
              ? {
                  ...current,
                  phase: "OCR läuft",
                  percent: Math.round(message.progress * 100),
                }
              : current,
          );
        }
      });

      await worker.setParameters({
        tessedit_char_whitelist: OCR_WHITELIST,
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
      });

      const nextCodes = new Set(codes);
      const nextResults = [];
      const fileErrors = [];

      for (const [index, file] of imageFiles.entries()) {
        setProgress({
          current: index + 1,
          total: imageFiles.length,
          fileName: file.name,
          phase: "Bild wird vorbereitet",
          percent: 0,
        });

        try {
          const result = await recognizeFile(file, worker);
          result.codes.forEach((code) => nextCodes.add(code));
          nextResults.push({
            id: `${file.name}-${file.lastModified}-${index}-${Date.now()}`,
            fileName: file.name,
            codes: result.codes,
            failed: false,
          });
        } catch (fileError) {
          fileErrors.push(`${file.name}: ${fileError.message || "OCR-Fehler"}`);
          nextResults.push({
            id: `${file.name}-${file.lastModified}-${index}-${Date.now()}`,
            fileName: file.name,
            codes: [],
            failed: true,
            error: fileError.message || "OCR-Fehler",
          });
        }
      }

      setCodes([...nextCodes]);
      setFileResults((current) => [...nextResults, ...current]);

      const batchFoundCodes = nextResults.some((result) => result.codes.length > 0);

      if (fileErrors.length > 0) {
        setError(fileErrors.join(" "));
      } else if (!batchFoundCodes) {
        setError("Keine Codes gefunden. Versuche ein schärferes Bild mit gutem Licht.");
      }
    } catch (ocrError) {
      console.error(ocrError);
      setError("OCR konnte nicht gestartet werden. Bitte Seite neu laden und erneut versuchen.");
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setIsProcessing(false);
      setProgress(null);
    }
  }

  function handleFileInput(event) {
    processFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);

    if (!isProcessing) {
      processFiles(event.dataTransfer.files);
    }
  }

  function reset() {
    setCodes([]);
    setFileResults([]);
    setError("");
    setCopyState("");
    setProgress(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  async function copyCodes() {
    if (sortedCodes.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sortedCodes.join("\n"));
      setCopyState("Kopiert");
    } catch (clipboardError) {
      setCopyState("Kopieren nicht möglich");
    }
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <header className="app-header">
          <div>
            <p className="eyebrow">Panini OCR</p>
            <h1>Code Extractor</h1>
          </div>
          <div className="counter" aria-label={`${sortedCodes.length} eindeutige Codes`}>
            <span>{sortedCodes.length}</span>
            <small>Codes</small>
          </div>
        </header>

        <div
          className={`upload-zone ${isDragging ? "is-dragging" : ""} ${isProcessing ? "is-disabled" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={isProcessing}
            onChange={handleFileInput}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={isProcessing}
            onChange={handleFileInput}
          />
          <span className="upload-title">Bilder auswählen oder ablegen</span>
          <span className="upload-meta">JPG, PNG, WebP und andere browserlesbare Bildformate</span>
          <div className="upload-actions">
            <button type="button" className="upload-button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              Bilder auswählen
            </button>
            <button type="button" className="upload-button camera-button" onClick={() => cameraInputRef.current?.click()} disabled={isProcessing}>
              Kamera öffnen
            </button>
          </div>
        </div>

        {progress && (
          <div className="progress-card" aria-live="polite">
            <div className="progress-line">
              <span>
                {progress.current}/{progress.total} · {progress.fileName}
              </span>
              <strong>{progress.percent}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p>{progress.phase}</p>
          </div>
        )}

        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}

        <div className="toolbar">
          <button type="button" className="primary-button" onClick={copyCodes} disabled={sortedCodes.length === 0}>
            Codes kopieren
          </button>
          <button type="button" className="secondary-button" onClick={reset} disabled={isProcessing}>
            Zurücksetzen
          </button>
        </div>

        {copyState && <p className="copy-state">{copyState}</p>}
      </section>

      <section className="results-grid">
        <article className="card">
          <div className="section-heading">
            <h2>Gefundene Codes</h2>
            <span>{sortedCodes.length} eindeutig</span>
          </div>

          {sortedCodes.length > 0 ? (
            <ul className="code-list">
              {sortedCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">Noch keine Codes erkannt.</div>
          )}
        </article>

        <article className="card">
          <div className="section-heading">
            <h2>Bilder</h2>
            <span>{fileResults.length}</span>
          </div>

          {fileResults.length > 0 ? (
            <ul className="file-list">
              {fileResults.map((result) => (
                <li key={result.id}>
                  <span>{result.fileName}</span>
                  <strong>
                    {result.failed
                      ? result.error || "Fehler"
                      : result.codes.length > 0
                        ? `${result.codes.length} Code${result.codes.length === 1 ? "" : "s"}`
                        : "Keine Codes"}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">Keine Bilder verarbeitet.</div>
          )}
        </article>
      </section>
    </main>
  );
}
