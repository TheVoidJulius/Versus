"use client";

import { FormEvent, useEffect, useState } from "react";
import { models } from "@/data/models";

type Result = {
  modelId: string;
  text?: string;
  error?: string;
  elapsedMs: number;
  mode: "live" | "demo";
};

type Matchup = {
  id: string;
  prompt: string;
  createdAt: string;
  modelIds: [string, string];
  results: [Result, Result];
  vote: "a" | "b" | "tie" | null;
};

const HISTORY_KEY = "versus.matchups.v1";
const prompts = [
  "Explain recursion like I’m a curious 12-year-old.",
  "Give me a practical plan to learn a new skill in 30 days.",
  "Write a TypeScript function that groups words by anagram.",
];

function isResult(value: unknown): value is Result {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return typeof result.modelId === "string"
    && typeof result.elapsedMs === "number"
    && (result.mode === "live" || result.mode === "demo")
    && (typeof result.text === "string" || typeof result.error === "string");
}

function isMatchup(value: unknown): value is Matchup {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && typeof item.prompt === "string"
    && typeof item.createdAt === "string"
    && Array.isArray(item.modelIds)
    && item.modelIds.length === 2
    && item.modelIds.every((id) => typeof id === "string")
    && Array.isArray(item.results)
    && item.results.length === 2
    && item.results.every(isResult)
    && (item.vote === null || item.vote === "a" || item.vote === "b" || item.vote === "tie");
}

function modelName(id: string) {
  return models.find((model) => model.id === id)?.name ?? "Unknown model";
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [modelA, setModelA] = useState(models[0].id);
  const [modelB, setModelB] = useState(models[1].id);
  const [current, setCurrent] = useState<Matchup | null>(null);
  const [history, setHistory] = useState<Matchup[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [crtMode, setCrtMode] = useState(true);
  const [welcomePhase, setWelcomePhase] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed.filter(isMatchup).slice(0, 10));
      }
    } catch {
      setNotice("Local matchup history could not be loaded in this browser.");
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      setNotice("Matchup history could not be saved. Check browser storage settings.");
    }
  }, [history, storageReady]);

  const compare = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || busy) return;
    setBusy(true);
    setNotice("");
    setCurrent(null);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt, modelIds: [modelA, modelB] }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Comparison failed (${response.status}).`;
        throw new Error(message);
      }
      if (typeof payload !== "object" || payload === null || !("results" in payload) || !Array.isArray(payload.results) || payload.results.length !== 2) {
        throw new Error("The comparison service returned an invalid response.");
      }
      const [firstResult, secondResult]: unknown[] = payload.results;
      if (!isResult(firstResult) || !isResult(secondResult)) {
        throw new Error("The comparison service returned an invalid response.");
      }

      const matchup: Matchup = {
        id: crypto.randomUUID(),
        prompt: cleanPrompt,
        createdAt: new Date().toISOString(),
        modelIds: [modelA, modelB],
        results: [firstResult, secondResult],
        vote: null,
      };
      setCurrent(matchup);
      setHistory((items) => [matchup, ...items.filter((item) => item.id !== matchup.id)].slice(0, 10));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The comparison failed.");
    } finally {
      setBusy(false);
    }
  };

  const vote = (choice: Matchup["vote"]) => {
    if (!current) return;
    const updated = { ...current, vote: choice };
    setCurrent(updated);
    setHistory((items) => items.map((item) => item.id === updated.id ? updated : item));
  };

  const restore = (matchup: Matchup) => {
    setPrompt(matchup.prompt);
    setModelA(matchup.modelIds[0]);
    setModelB(matchup.modelIds[1]);
    setCurrent(matchup);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className={`app-shell arcade-shell ${crtMode ? "crt-on" : ""}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => { setCurrent(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Versus home">
          <span className="brand-mark">V<span>·</span></span>
          <span><strong>VERSUS</strong><small>AI RESPONSE ARENA</small></span>
        </button>
        <div className="topbar-right">
          <button
            className={`crt-toggle ${crtMode ? "enabled" : ""}`}
            type="button"
            aria-pressed={crtMode}
            onClick={() => setCrtMode((enabled) => !enabled)}
          >
            <span className="crt-toggle-light" /> CRT {crtMode ? "ON" : "OFF"}
          </button>
          <span className="topbar-label"><i /> TWO MODELS. ONE PROMPT.</span>
          <span className="avatar">VS</span>
        </div>
      </header>

      <div className="workspace">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span>01</span> PLAYER 01 · MODEL ARENA</p>
            <h1 className="pixel-welcome" aria-live="polite">
              {["WELCOME", "READY PLAYER", "PICK A SIDE"][welcomePhase]}
            </h1>
            <p className="hero-description">Two models enter. One prompt connects them. You decide which answer wins.</p>
            <div className="hero-actions">
              <button
                className="hero-jump"
                type="button"
                onClick={() => {
                  if (welcomePhase === 0) {
                    setWelcomePhase(1);
                    return;
                  }
                  setWelcomePhase(2);
                  document.getElementById("matchup")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {welcomePhase === 0 ? "INSERT COIN · WAKE UP" : welcomePhase === 1 ? "START MATCH" : "CHOOSE AGAIN"} <span>↓</span>
              </button>
              <span className="hero-subtitle">CONVERGING DIGITAL MINDS · BUILD 01</span>
            </div>
          </div>
          <div className="arena-art" aria-hidden="true">
            <div className="pixel-grid-glow" />
            <div className="pixel-ribbons"><i /><i /><i /><i /><i /></div>
            <div className="pixel-heart" />
            <div className="pixel-crystal" />
            <div className="arena-orbit orbit-outer" />
            <div className="arena-orbit orbit-inner" />
            <div className="arena-vs">VS</div>
            <div className="arena-star star-a">✳</div>
            <div className="arena-star star-b">✦</div>
            <div className="arena-tag tag-a">MODEL A</div>
            <div className="arena-tag tag-b">MODEL B</div>
          </div>
          <div className="pixel-frame-top"><span>V-001</span><span>◼ ◼ ◼</span></div>
          <div className="hero-index"><span className="pixel-equalizer"><i /><i /><i /><i /><i /></span> COMPARE / CONTRAST / CHOOSE</div>
        </section>

        <section className="matchup-section" id="matchup" aria-labelledby="matchup-title">
          <div className="section-title-row">
            <div>
              <p className="eyebrow"><span>02</span> SET THE STAGE</p>
              <h2 id="matchup-title">Build your matchup</h2>
            </div>
            <span className="service-status"><i /> Live API keys optional</span>
          </div>

          <form className="composer-card" onSubmit={(event) => void compare(event)}>
            <label className="prompt-label" htmlFor="prompt">YOUR PROMPT <span>Be specific. The models get the same one.</span></label>
            <textarea
              id="prompt"
              maxLength={5000}
              rows={4}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void compare();
                }
              }}
              placeholder="Ask a question, give a task, or test an idea…"
            />
            <div className="prompt-examples">
              <span>NEED A STARTER?</span>
              {prompts.map((sample) => (
                <button key={sample} type="button" onClick={() => setPrompt(sample)}>{sample}</button>
              ))}
            </div>

            <div className="model-selectors">
              <ModelSelect label="MODEL A" value={modelA} onChange={setModelA} accent="blue" />
              <div className="versus-divider"><span>VS</span></div>
              <ModelSelect label="MODEL B" value={modelB} onChange={setModelB} accent="pink" />
            </div>

            <div className="launch-row">
              <span className="privacy-hint"><span>⌑</span> Keys stay on the server · History stays in this browser</span>
              <button className="launch-button" type="submit" disabled={!prompt.trim() || busy}>
                {busy ? <><span className="launch-spinner" /> Comparing…</> : <>Run comparison <span>↗</span></>}
              </button>
            </div>
            {notice && <p className="notice" role="alert">{notice}</p>}
          </form>

          <div className="results-heading">
            <div><p className="eyebrow"><span>03</span> THE FACE-OFF</p><h2>{current ? "The answers are in." : "Your arena is waiting."}</h2></div>
            {current && <span className="result-prompt">“{current.prompt}”</span>}
          </div>

          {busy ? (
            <div className="response-grid" aria-live="polite" aria-label="Comparing model responses">
              <LoadingCard modelName={modelName(modelA)} accent="blue" />
              <LoadingCard modelName={modelName(modelB)} accent="pink" />
            </div>
          ) : current ? (
            <>
              <div className="response-grid">
                {current.results.map((result, index) => (
                  <ResponseCard key={`${current.id}-${result.modelId}-${index}`} result={result} index={index} vote={current.vote} onVote={vote} />
                ))}
              </div>
              {current.results.some((result) => Boolean(result.text)) && <div className="judge-bar">
                <div><span className="judge-icon">✳</span><div><strong>Call the winner</strong><small>Which answer worked better for you?</small></div></div>
                <div className="vote-actions">
                  <button className={current.vote === "a" ? "chosen" : ""} disabled={!current.results[0].text} onClick={() => vote("a")} type="button">A wins</button>
                  <button className={current.vote === "tie" ? "chosen" : ""} disabled={!current.results[0].text || !current.results[1].text} onClick={() => vote("tie")} type="button">It’s a tie</button>
                  <button className={current.vote === "b" ? "chosen" : ""} disabled={!current.results[1].text} onClick={() => vote("b")} type="button">B wins</button>
                </div>
              </div>}
            </>
          ) : (
            <div className="empty-arena">
              <div className="empty-vs">A<span>:</span>B</div>
              <strong>Two answers. One curious human.</strong>
              <p>Write a prompt above and let the matchup begin.</p>
            </div>
          )}
        </section>

        <section className="history-section" aria-labelledby="history-title">
          <div className="section-title-row">
            <div><p className="eyebrow"><span>04</span> THE REMATCHES</p><h2 id="history-title">Recent matchups</h2></div>
            {history.length > 0 && <button className="clear-history" type="button" onClick={() => { setHistory([]); setCurrent(null); }}>Clear history</button>}
          </div>
          {history.length ? (
            <div className="history-list">
              {history.map((item) => (
                <button className="history-item" key={item.id} type="button" onClick={() => restore(item)}>
                  <span className="history-vs">VS</span>
                  <span className="history-copy"><strong>{item.prompt}</strong><small>{modelName(item.modelIds[0])} <i>vs</i> {modelName(item.modelIds[1])}</small></span>
                  <span className={`history-vote ${item.vote ?? ""}`}>{item.vote ? item.vote === "tie" ? "TIE" : `${item.vote.toUpperCase()} WINS` : "REVIEW"}</span>
                  <span className="history-arrow">↗</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="history-empty">Your matchups will show up here. Saved only in this browser.</div>
          )}
        </section>

        <footer className="footer">
          <span><strong>VERSUS</strong> · Compare with curiosity.</span>
          <span>AI responses can be inaccurate. Verify important claims.</span>
        </footer>
      </div>
    </main>
  );
}

function ModelSelect({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accent: "blue" | "pink";
}) {
  const selected = models.find((model) => model.id === value) ?? models[0];
  return (
    <label className={`model-select ${accent}`}>
      <span className="model-select-label">{label}</span>
      <span className="model-selected">
        <span className="model-symbol">{label === "MODEL A" ? "A" : "B"}</span>
        <span className="model-copy"><strong>{selected.name}</strong><small>{selected.descriptor}</small></span>
        <span className="select-chevron">⌄</span>
      </span>
      <select aria-label={`Choose ${label}`} value={value} onChange={(event) => onChange(event.target.value)}>
        {models.map((model) => <option value={model.id} key={model.id}>{model.name} — {model.descriptor}</option>)}
      </select>
    </label>
  );
}

function ResponseCard({
  result,
  index,
  vote,
  onVote,
}: {
  result: Result;
  index: number;
  vote: Matchup["vote"];
  onVote: (vote: Matchup["vote"]) => void;
}) {
  const winner = vote === (index === 0 ? "a" : "b");
  return (
    <article className={`response-card ${index === 0 ? "blue" : "pink"} ${winner ? "winner" : ""}`}>
      <header className="response-card-header">
        <div className="response-model"><span className="response-letter">{index === 0 ? "A" : "B"}</span><div><strong>{modelName(result.modelId)}</strong><small>{models.find((model) => model.id === result.modelId)?.descriptor}</small></div></div>
        <div className="response-badges">
          <span className={`mode-badge ${result.mode}`}>{result.mode === "live" ? "LIVE" : "SAMPLE"}</span>
          {winner && <span className="winner-badge">YOUR PICK ✦</span>}
        </div>
      </header>
      <div className="response-meta"><span>{result.mode === "live" ? "Provider response" : "Local preview · not AI-generated"}</span><span>{(result.elapsedMs / 1000).toFixed(1)}s</span></div>
      {result.error
        ? <p className="response-error" role="alert">{result.error}</p>
        : <p className="response-text">{result.text}</p>}
      <footer className="response-card-footer">
        <span>{result.mode === "demo" ? "Configure API key for live inference" : "Check important details"}</span>
        <button type="button" disabled={!result.text} onClick={() => onVote(index === 0 ? "a" : "b")} aria-label={`Choose answer ${index === 0 ? "A" : "B"}`}>
          {winner ? "✓ Picked" : "Pick this"} <span>↗</span>
        </button>
      </footer>
    </article>
  );
}

function LoadingCard({ modelName: name, accent }: { modelName: string; accent: "blue" | "pink" }) {
  return (
    <article className={`response-card loading-card ${accent}`}>
      <header className="response-card-header"><div className="response-model"><span className="response-letter">···</span><div><strong>{name}</strong><small>Thinking through your prompt</small></div></div><span className="thinking-dot" /></header>
      <div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" />
      <p className="loading-caption">Asking both models in parallel…</p>
    </article>
  );
}
