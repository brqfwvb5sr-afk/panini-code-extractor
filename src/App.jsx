import { useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

const CODE_REGEX = /\b[A-Z]{3}\s?[-]?\s?\d{1,3}\b/gi;
const NORMALIZED_CODE_REGEX = /^[A-Z]{3}\d{1,3}$/;
const OCR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ";

function normalizeCode(value) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function extractCodes(text) {
  const matches = text.match(CODE_REGEX) ?? [];
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
      reject(new Error("Bild konnte nicht geladen werden."));
    };

    image.src = url;
  });
}

function preprocessImage(image, mode) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const crop =
    mode === "code"
      ? {
          sx: width * 0.42,
          sy: 0,
          sw: width * 0.58,
          sh: height * 0.38,
        }
      : {
          sx: 0,
          sy: 0,
          sw: width,
          sh: height,
        };

  const preferredWidth = mode === "code" ? 1400 : 1800;
  const rawScale = preferredWidth / crop.sw;
  const scale =
    crop.sw < preferredWidth ? clamp(rawScale, 1.2, 3) : clamp(rawScale, 0.35, 1);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.sw * scale));
  canvas.height = Math.max(1, Math.round(crop.sh * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );

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

  const codeArea = preprocessImage(image, "code");
  const codeAreaResult = await worker.recognize(codeArea);
  textParts.push(codeAreaResult.data.text ?? "");

  let codes = extractCodes(textParts.join("\n"));

  if (codes.length === 0) {
    const fullImage = preprocessImage(image, "full");
    const fullImageResult = await worker.recognize(fullImage);
    textParts.push(fullImageResult.data.text ?? "");
    codes = extractCodes(textParts.join("\n"));
  }

  return {
    codes,
    rawText: textParts.join("\n").trim(),
  };
}

export default function App() {
  const fileInputRef = useRef(null);
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
      worker = await createWorker("eng", 1, {
        logger: (message) => {
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
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist: OCR_WHITELIST,
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
      });

      const nextCodes = new Set(codes);
      const nextResults = [];

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
          nextResults.push({
            id: `${file.name}-${file.lastModified}-${index}-${Date.now()}`,
            fileName: file.name,
            codes: [],
            failed: true,
          });
        }
      }

      setCodes([...nextCodes]);
      setFileResults((current) => [...nextResults, ...current]);

      const batchFoundCodes = nextResults.some((result) => result.codes.length > 0);

      if (!batchFoundCodes) {
        setError("Keine Codes gefunden. Versuche ein schärferes Bild mit gutem Licht.");
      }
    } catch (ocrError) {
      setError("OCR konnte nicht gestartet werden. Bitte versuche es erneut.");
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

        <label
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
          <span className="upload-title">Bilder auswählen oder ablegen</span>
          <span className="upload-meta">JPG, PNG, HEIC und weitere Bildformate</span>
        </label>

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
                      ? "Fehler"
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
