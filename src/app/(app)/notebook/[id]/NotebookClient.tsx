"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type Source = {
  id: string;
  title: string;
  type: string;
  status: string;
  file_path?: string | null;
  file_size?: number | null;
  error_message?: string | null;
};
type Message = {
  id: string;
  role: string;
  content: string;
  model_used?: string | null;
  citations?: { title: string }[] | null;
};
type StudioMode = "flashcards" | "quiz" | "study_guide" | "brief";
type Flashcard = { question: string; answer: string };
type QuizQuestion = { question: string; options: string[]; answer: string };
type SavedMaterial = {
  id: string;
  type: string;
  title: string;
  content: { raw?: string } | unknown;
  metadata?: { model?: string } | null;
  created_at: string;
};

const studioOptions: [StudioMode, string, string][] = [
  ["flashcards", "Flashcards", "Turn key ideas into quick question-and-answer study cards."],
  ["quiz", "Quiz", "Test your understanding with an interactive knowledge check."],
  ["study_guide", "Study Guide", "Build a structured reference guide from the notebook."],
  ["brief", "Quick Brief", "Get a concise summary of the most important points."],
];

const modeLabels: Record<string, string> = {
  flashcards: "Flashcards",
  quiz: "Quiz",
  study_guide: "Study Guide",
  brief: "Quick Brief",
};

const modeIcons: Record<string, string> = {
  flashcards: "auto_awesome",
  quiz: "auto_awesome",
  study_guide: "menu_book",
  brief: "description",
};

/** Normalize JSON responses that local/remote models may wrap in Markdown or prose. */
function stripFences(text: string): string {
  let cleaned = text.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    const openMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*)/i);
    if (openMatch) {
      cleaned = openMatch[1].trim();
    }
  }

  const firstBracket = cleaned.indexOf("[");
  const firstBrace = cleaned.indexOf("{");
  let start = -1;
  if (firstBracket !== -1 && firstBrace !== -1) {
    start = Math.min(firstBracket, firstBrace);
  } else {
    start = Math.max(firstBracket, firstBrace);
  }

  const lastBracket = cleaned.lastIndexOf("]");
  const lastBrace = cleaned.lastIndexOf("}");
  const end = Math.max(lastBracket, lastBrace);

  if (start !== -1 && end !== -1 && end >= start) {
    return cleaned.slice(start, end + 1).trim();
  }

  return cleaned;
}

export function NotebookClient({
  notebook,
  initialSources,
  initialMessages,
  initialStudyMaterials,
}: {
  notebook: { id: string; title: string; description?: string | null };
  initialSources: Source[];
  initialMessages: Message[];
  initialStudyMaterials: SavedMaterial[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [messages, setMessages] = useState(initialMessages);
  const [savedMaterials, setSavedMaterials] = useState(initialStudyMaterials);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [studioBusy, setStudioBusy] = useState<StudioMode | null>(null);
  const [studioResult, setStudioResult] = useState<{
    mode: StudioMode;
    content: string;
    model: string;
    savedId?: string | null;
  } | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fileInput] = [useRef<HTMLInputElement>(null)];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const readySources = sources.filter(s => s.status === "ready");
  const selectedSource = readySources.find(s => s.id === selectedSourceId) ?? null;

  /* ─── Execute Chat Prompt ─── */
  const executeSend = async (text: string, targetSourceId: string | null) => {
    if (!text.trim() || busy) return;
    setInput("");
    setBusy(true);
    setError("");
    setShowSourceModal(false);
    setPendingPrompt("");

    if (targetSourceId) {
      setSelectedSourceId(targetSourceId);
    }

    const targetSource = readySources.find(s => s.id === targetSourceId) ?? null;

    setMessages(m => [...m, { id: `local-${Date.now()}`, role: "user", content: text }]);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          notebookId: notebook.id,
          mode: "chat",
          sourceId: targetSource?.id || null,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(body.error ?? "Generation failed.");
      } else {
        setMessages(m => [
          ...m,
          {
            id: `local-${Date.now()}-a`,
            role: "assistant",
            content: body.message,
            model_used: body.model,
            citations: body.citations ?? (targetSource ? [{ title: targetSource.title }] : []),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ─── Validate & Prompt ─── */
  const handlePromptSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || busy) return;

    const text = input.trim();

    if (readySources.length === 0) {
      setError("Please add and process at least one ready source before prompting.");
      return;
    }

    // If only 1 ready source, scope to it directly
    if (readySources.length === 1) {
      setSelectedSourceId(readySources[0].id);
      void executeSend(text, readySources[0].id);
      return;
    }

    // If a source is already selected, proceed directly with that source
    if (selectedSourceId) {
      void executeSend(text, selectedSourceId);
      return;
    }

    // If no source is selected and multiple sources exist, prompt user to select a source
    // to prevent mindless token drain across all sources
    setPendingPrompt(text);
    setShowSourceModal(true);
  };

  /* ─── Studio Generate ─── */
  const generateStudio = async (mode: StudioMode, label: string) => {
    if (studioBusy) return;
    if (!sources.some(source => source.status === "ready")) {
      setError("Add and process a ready source before using Studio.");
      return;
    }
    setStudioBusy(mode);
    setError("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: `Create ${label} for this notebook${selectedSource ? ` strictly focusing on "${selectedSource.title}"` : ""}.`,
        notebookId: notebook.id,
        mode,
        sourceId: selectedSource?.id || null,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Studio generation failed.");
    } else {
      if (mode === "flashcards" || mode === "quiz") {
        try {
          const rawParsed = JSON.parse(stripFences(body.message));
          const parsed = Array.isArray(rawParsed)
            ? rawParsed
            : ((rawParsed && typeof rawParsed === "object"
                ? Object.values(rawParsed).find(Array.isArray)
                : null) as unknown[]) ?? [];
          if (!Array.isArray(parsed) || !parsed.length) throw new Error("The generated material was empty.");
          if (
            mode === "flashcards" &&
            !parsed.every(
              (item: Record<string, unknown>) => item && typeof item.question === "string" && typeof item.answer === "string"
            )
          )
            throw new Error("Flashcards response was invalid.");
          if (
            mode === "quiz" &&
            !parsed.every(
              (item: Record<string, unknown>) =>
                item &&
                typeof item.question === "string" &&
                Array.isArray(item.options) &&
                item.options.length >= 2 &&
                typeof item.answer === "string"
            )
          )
            throw new Error("Quiz response was invalid.");
          if (mode === "flashcards") {
            setFlashcards(parsed as Flashcard[]);
            setFlashcardIndex(0);
            setFlashcardFlipped(false);
          } else {
            setQuiz(parsed as QuizQuestion[]);
            setQuizIndex(0);
            setQuizSelected(null);
            setQuizScore(0);
            setQuizComplete(false);
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : "Studio returned invalid JSON.");
          setStudioBusy(null);
          return;
        }
      }

      // Save to Supabase
      const { createClient } = await import("@/lib/supabase/client");
      const client = createClient();
      const userId = (await client.auth.getUser()).data.user?.id;
      let newSavedId: string | null = null;

      if (userId) {
        const saved = await client
          .from("study_materials")
          .insert({
            notebook_id: notebook.id,
            user_id: userId,
            type: mode,
            title: selectedSource ? `${label} (${selectedSource.title})` : label,
            content: { raw: body.message },
            tokens_used: body.tokens_used ?? 0,
            metadata: { model: body.model ?? "AI" },
          })
          .select("id,type,title,content,metadata,created_at")
          .single();

        if (saved.error) {
          console.error("[generateStudio] Error saving study material:", saved.error);
          setError(`Generated successfully, but could not save it: ${saved.error.message}`);
        } else if (saved.data) {
          newSavedId = saved.data.id;
          setSavedMaterials(prev => [saved.data as SavedMaterial, ...prev]);
        }
      }

      setStudioResult({ mode, content: body.message, model: body.model, savedId: newSavedId });
    }
    setStudioBusy(null);
  };

  /* ─── Open a saved material ─── */
  const openSavedMaterial = (material: SavedMaterial) => {
    const mode = material.type as StudioMode;
    let raw = "";

    if (typeof material.content === "string") {
      raw = material.content;
    } else if (material.content && typeof material.content === "object") {
      const c = material.content as Record<string, unknown>;
      if (typeof c.raw === "string") {
        raw = c.raw;
      } else {
        raw = JSON.stringify(material.content);
      }
    }

    if (mode === "flashcards" || mode === "quiz") {
      try {
        const rawParsed =
          Array.isArray(material.content)
            ? material.content
            : typeof material.content === "object" &&
              material.content !== null &&
              !("raw" in (material.content as Record<string, unknown>))
            ? material.content
            : JSON.parse(stripFences(raw));

        const parsed = Array.isArray(rawParsed)
          ? rawParsed
          : ((rawParsed && typeof rawParsed === "object"
              ? Object.values(rawParsed).find(Array.isArray)
              : null) as unknown[]) ?? [];

        if (mode === "flashcards") {
          setFlashcards(parsed as Flashcard[]);
          setFlashcardIndex(0);
          setFlashcardFlipped(false);
        } else {
          setQuiz(parsed as QuizQuestion[]);
          setQuizIndex(0);
          setQuizSelected(null);
          setQuizScore(0);
          setQuizComplete(false);
        }
      } catch {
        setError("Could not parse saved material.");
        return;
      }
    }

    const modelName = material.metadata?.model ?? "Saved Material";
    setStudioResult({ mode, content: raw, model: modelName, savedId: material.id });
  };

  /* ─── Delete a saved material ─── */
  const deleteSavedMaterial = async (id: string, title?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete "${title ?? "this study material"}"? This cannot be undone.`)) return;
    setError("");

    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    const { error: deleteError } = await client
      .from("study_materials")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(`Could not delete: ${deleteError.message}`);
      return;
    }
    setSavedMaterials(prev => prev.filter(m => m.id !== id));
    setStudioResult(curr => (curr?.savedId === id ? null : curr));
  };

  /* ─── File Upload ─── */
  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    setUploading(true);
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      setError("Your session expired. Please sign in again.");
      setUploading(false);
      return;
    }
    for (const file of selected) {
      if (file.size > 50 * 1024 * 1024) {
        setError(`${file.name} is larger than the 50 MB limit.`);
        continue;
      }
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["pdf", "docx", "txt"].includes(extension)) {
        setError(`${file.name} is not supported. Use PDF, DOCX, or TXT.`);
        continue;
      }
      const path = `${user.id}/${notebook.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await client.storage.from("sources").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upload.error) {
        setError(`Could not upload ${file.name}: ${upload.error.message}`);
        continue;
      }
      const inserted = await client
        .from("sources")
        .insert({
          notebook_id: notebook.id,
          user_id: user.id,
          type: extension,
          title: file.name,
          file_path: path,
          file_size: file.size,
          status: "processing",
        })
        .select("id,title,type,status,file_size,error_message")
        .single();
      if (inserted.error || !inserted.data) {
        await client.storage.from("sources").remove([path]);
        setError(
          `Could not save ${file.name}: ${inserted.error?.message ?? "source record was not created."}`
        );
        continue;
      }
      setSources(current => [...current, inserted.data as Source]);
      const processed = await fetch("/api/sources/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: inserted.data.id }),
      });
      if (!processed.ok) {
        const result = await processed.json().catch(() => ({}));
        setSources(current =>
          current.map(source =>
            source.id === inserted.data.id
              ? {
                  ...source,
                  status: "error",
                  error_message: result.error ?? `Could not process ${file.name}.`,
                }
              : source
          )
        );
        setError(result.error ?? `Could not process ${file.name}.`);
      } else {
        setSources(current =>
          current.map(source =>
            source.id === inserted.data.id ? { ...source, status: "ready" } : source
          )
        );
      }
    }
    setUploading(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void uploadFiles(event.dataTransfer.files);
  };

  const removeSource = async (source: Source) => {
    if (!window.confirm(`Delete "${source.title}"?`)) return;
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    if (source.file_path) {
      const removed = await client.storage.from("sources").remove([source.file_path]);
      if (removed.error) {
        setError(`Could not delete ${source.title}: ${removed.error.message}`);
        return;
      }
    }
    const deleted = await client
      .from("sources")
      .delete()
      .eq("id", source.id)
      .eq("notebook_id", notebook.id);
    if (deleted.error) {
      setError(`Could not delete ${source.title}: ${deleted.error.message}`);
      return;
    }
    setSources(current => current.filter(item => item.id !== source.id));
    if (selectedSourceId === source.id) {
      setSelectedSourceId(null);
    }
  };

  /* ─── Render ─── */
  return (
    <main className="workspace">
      {/* ── Sources Panel ── */}
      <aside className="panel card">
        <div className="panel-header">
          <div>
            <h2>Sources</h2>
            <small className="muted">
              {readySources.length} of {sources.length} ready
            </small>
          </div>
          <button
            className="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            aria-label="Add source"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 12px" }}
          >
            <MaterialIcon name="upload" size={18} />
          </button>
        </div>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          multiple
          onChange={event => {
            if (event.target.files) void uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div
          className={`drop-zone ${uploading ? "uploading" : ""}`}
          onDragOver={event => event.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInput.current?.click()}
        >
          <MaterialIcon name="upload" size={26} />
          <strong>{uploading ? "Uploading and processing…" : "Drop files here"}</strong>
          <small className="muted">PDF, DOCX, or TXT · up to 50 MB</small>
        </div>
        <p className="muted">Add PDFs, documents, or notes to ground your research.</p>
        <div className="card" style={{ padding: 12, marginTop: 16 }}>
          <button className="button secondary" style={{ marginTop: 8, width: "100%" }}>
            Add text
          </button>
        </div>

        {readySources.length > 0 && (
          <div className="sources-filter-row">
            <button
              type="button"
              className={`source-filter-pill ${selectedSourceId === null ? "active" : ""}`}
              onClick={() => setSelectedSourceId(null)}
              title="Query across all ready sources"
            >
              <span>All Sources ({readySources.length})</span>
            </button>
          </div>
        )}

        {sources.map(s => {
          const isReady = s.status === "ready";
          const isSelected = selectedSourceId === s.id;
          return (
            <div
              className={`source-item ${isReady ? "clickable" : ""} ${isSelected ? "selected" : ""}`}
              key={s.id}
              onClick={() => {
                if (!isReady) return;
                setSelectedSourceId(isSelected ? null : s.id);
              }}
              title={
                !isReady
                  ? "Source is not ready yet"
                  : isSelected
                  ? "Selected source. Click to switch back to All Sources."
                  : "Click to select and focus prompts on this source."
              }
              role={isReady ? "button" : undefined}
              tabIndex={isReady ? 0 : undefined}
              onKeyDown={e => {
                if (isReady && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setSelectedSourceId(isSelected ? null : s.id);
                }
              }}
            >
              <MaterialIcon name="description" size={18} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <strong
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.title}
                  </strong>
                  {isSelected && <span className="focused-source-badge">Active</span>}
                </div>
                <small className="muted">
                  {s.type.toUpperCase()} · {s.status}
                  {s.file_size ? ` · ${(s.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
                </small>
                {s.error_message && (
                  <small className="error" style={{ display: "block", marginTop: 5 }}>
                    {s.error_message}
                  </small>
                )}
              </div>
              <span className={`dot ${s.status}`} />
              <button
                className="icon-button"
                aria-label={`Delete ${s.title}`}
                onClick={e => {
                  e.stopPropagation();
                  void removeSource(s);
                }}
              >
                <MaterialIcon name="delete" size={17} />
              </button>
            </div>
          );
        })}
      </aside>

      {/* ── Chat Panel ── */}
      <section className="panel card chat-panel">
        <div className="panel-header">
          <div>
            <h1>{notebook.title}</h1>
            <span className="muted">
              {selectedSource
                ? `Focus: ${selectedSource.title}`
                : readySources.length
                ? `Chatting with all ${readySources.length} sources`
                : "Chat with your sources"}
            </span>
          </div>
          <MaterialIcon name="auto_awesome" size={20} />
        </div>
        <div className="messages">
          {!messages.length && (
            <div style={{ textAlign: "center", padding: "18vh 15px" }}>
              <MaterialIcon name="auto_awesome" size={38} />
              <h2>Ask better questions</h2>
              <p className="muted">
                Add sources, select a specific PDF to save tokens, or query across all sources.
              </p>
            </div>
          )}
          {messages.map(m => (
            <article className={`bubble ${m.role}`} key={m.id}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
              <div className="bubble-footer">
                {m.citations && m.citations.length > 0 && (
                  <span className="bubble-citation" title={m.citations.map(c => c.title).join(", ")}>
                    <MaterialIcon name="description" size={13} />
                    {m.citations.length === 1
                      ? `Source: ${m.citations[0].title}`
                      : `Sources (${m.citations.length}): ${m.citations.map(c => c.title).join(", ")}`}
                  </span>
                )}
                {m.model_used && <small className="muted">{m.model_used}</small>}
              </div>
            </article>
          ))}

          {busy && (
            <article className="bubble assistant thinking-bubble">
              <div className="thinking-indicator">
                <div className="thinking-avatar">
                  <MaterialIcon name="auto_awesome" size={16} />
                </div>
                <div className="thinking-content">
                  <div className="thinking-dots">
                    <span className="dot-bounce dot-1" />
                    <span className="dot-bounce dot-2" />
                    <span className="dot-bounce dot-3" />
                  </div>
                  <span className="thinking-status">
                    {selectedSource
                      ? `Consulting "${selectedSource.title}"…`
                      : readySources.length > 1
                      ? `Synthesizing across ${readySources.length} sources…`
                      : "Herons AI is thinking…"}
                  </span>
                </div>
              </div>
            </article>
          )}

          <div ref={messagesEndRef} />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {/* ── Source Scope Bar & Quick Chips ── */}
        <div className="composer-scope-container">
          {readySources.length > 1 && (
            <div className="source-chips-bar">
              <div className="source-chips-scroll">
                <button
                  type="button"
                  className={`source-chip ${selectedSourceId === null ? "active" : ""}`}
                  onClick={() => setSelectedSourceId(null)}
                  title="Prompt across all ready sources"
                >
                  <span>All Sources ({readySources.length})</span>
                </button>
                {readySources.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`source-chip ${selectedSourceId === s.id ? "active" : ""}`}
                    onClick={() => setSelectedSourceId(s.id === selectedSourceId ? null : s.id)}
                    title={`Select "${s.title}" to focus prompt`}
                  >
                    <MaterialIcon name="description" size={13} />
                    <span className="source-chip-title">{s.title}</span>
                    {selectedSourceId === s.id && (
                      <span
                        className="source-chip-remove"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedSourceId(null);
                        }}
                        title="Clear focus"
                      >
                        ✕
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`scope-indicator ${selectedSource ? "scoped" : "all-scoped"}`}>
            {selectedSource ? (
              <div className="scope-indicator-content">
                <span className="scope-tag-focused">Focused Source</span>
                <span className="scope-title" title={selectedSource.title}>
                  {selectedSource.title}
                </span>
                <span className="scope-hint" style={{ color: "var(--yellow)" }}>
                  (Saves tokens)
                </span>
                <button
                  type="button"
                  className="scope-clear-btn"
                  onClick={() => setSelectedSourceId(null)}
                  title="Switch to All Sources"
                >
                  Switch to All
                </button>
              </div>
            ) : (
              <div className="scope-indicator-content">
                <span className="scope-tag-all">Scope: All Sources</span>
                <span className="scope-hint">
                  {readySources.length > 1
                    ? "Select a PDF to target a specific document and save tokens"
                    : readySources.length === 1
                    ? "1 document ready"
                    : "No ready sources"}
                </span>
              </div>
            )}
          </div>
        </div>

        <form className="composer" onSubmit={handlePromptSubmit}>
          <textarea
            className="input"
            disabled={busy}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePromptSubmit();
              }
            }}
            placeholder={
              selectedSource
                ? `Ask about "${selectedSource.title}"… (Enter to send)`
                : readySources.length
                ? "Ask a question… (Enter to send)"
                : "Add sources first to chat…"
            }
          />
          <button
            type="submit"
            className={`button ${busy ? "loading-btn" : ""}`}
            disabled={busy || !input.trim()}
            aria-label={busy ? "Generating response…" : "Send"}
          >
            {busy ? (
              <span className="button-spinner" />
            ) : (
              <MaterialIcon name="send" size={18} />
            )}
          </button>
        </form>
      </section>

      {/* ── Studio Panel ── */}
      <aside className="panel card">
        <div className="panel-header">
          <div>
            <h2>Studio</h2>
            <small className="muted">
              {selectedSource ? `Focus: ${selectedSource.title}` : "All sources"}
            </small>
          </div>
          <MaterialIcon name="auto_awesome" size={18} />
        </div>

        {/* Studio generation buttons */}
        {studioOptions.map(([mode, label, subtitle]) => (
          <button
            className="material-item"
            disabled={studioBusy !== null}
            onClick={() => void generateStudio(mode, label)}
            style={{
              width: "100%",
              textAlign: "left",
              cursor: studioBusy ? "wait" : "pointer",
              opacity: studioBusy && studioBusy !== mode ? 0.65 : 1,
            }}
            key={mode}
          >
            <MaterialIcon name={(modeIcons[mode] ?? "auto_awesome") as "auto_awesome"} size={17} />
            <span>
              <strong>{studioBusy === mode ? "Generating…" : label}</strong>
              <small className="muted" style={{ display: "block" }}>
                {subtitle}
              </small>
            </span>
          </button>
        ))}

        {/* ── Saved Materials ── */}
        {savedMaterials.length > 0 && (
          <>
            <div className="panel-header" style={{ marginTop: 20, marginBottom: 8 }}>
              <h3 style={{ fontSize: 14, color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                Saved Materials
              </h3>
              <small className="muted">{savedMaterials.length}</small>
            </div>
            {savedMaterials.map(mat => (
              <div
                className="material-item saved-material"
                key={mat.id}
                onClick={() => openSavedMaterial(mat)}
                style={{ cursor: "pointer", position: "relative" }}
              >
                <MaterialIcon name={(modeIcons[mat.type] ?? "auto_awesome") as "auto_awesome"} size={17} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    }}
                  >
                    {mat.title}
                  </strong>
                  <small className="muted" style={{ display: "block" }}>
                    {modeLabels[mat.type] ?? mat.type} ·{" "}
                    {new Date(mat.created_at).toLocaleDateString()}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Delete ${mat.title}`}
                  onClick={e => void deleteSavedMaterial(mat.id, mat.title, e)}
                  title="Delete this material"
                >
                  <MaterialIcon name="delete" size={16} />
                </button>
              </div>
            ))}
          </>
        )}
      </aside>

      {/* ── Studio Result Modal ── */}
      {studioResult && (
        <div className="modal-backdrop" onClick={() => setStudioResult(null)}>
          <div className="modal card" onClick={event => event.stopPropagation()}>
            <div className="panel-header">
              <h2>
                {studioOptions.find(([mode]) => mode === studioResult.mode)?.[1]}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {studioResult.savedId && (
                  <button
                    type="button"
                    className="button secondary"
                    style={{ padding: "5px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}
                    onClick={() => void deleteSavedMaterial(studioResult.savedId!, "this material")}
                    title="Delete this material"
                  >
                    <MaterialIcon name="delete" size={15} /> Delete
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={() => setStudioResult(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Flashcards */}
            {studioResult.mode === "flashcards" && flashcards.length > 0 ? (
              <>
                <button
                  className={`flashcard ${flashcardFlipped ? "flipped" : ""}`}
                  onClick={() => setFlashcardFlipped(value => !value)}
                  aria-label="Flip flashcard"
                >
                  <span className="flashcard-label">
                    {flashcardFlipped ? "ANSWER" : "QUESTION"}
                  </span>
                  <strong>
                    {flashcardFlipped
                      ? flashcards[flashcardIndex].answer
                      : flashcards[flashcardIndex].question}
                  </strong>
                  <small>
                    Click to {flashcardFlipped ? "see the question" : "reveal the answer"}
                  </small>
                </button>
                <div className="flashcard-navigation">
                  <button
                    className="button secondary"
                    disabled={flashcardIndex === 0}
                    onClick={() => {
                      setFlashcardIndex(index => index - 1);
                      setFlashcardFlipped(false);
                    }}
                  >
                    Previous
                  </button>
                  <span className="muted">
                    {flashcardIndex + 1} / {flashcards.length}
                  </span>
                  <button
                    className="button secondary"
                    disabled={flashcardIndex === flashcards.length - 1}
                    onClick={() => {
                      setFlashcardIndex(index => index + 1);
                      setFlashcardFlipped(false);
                    }}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : /* Quiz */
            studioResult.mode === "quiz" && quiz.length > 0 ? (
              <div className="quiz-viewer">
                {quizComplete ? (
                  <div className="quiz-complete">
                    <span className="flashcard-label">QUIZ COMPLETE</span>
                    <strong>
                      {quizScore} / {quiz.length}
                    </strong>
                    <p className="muted">
                      Great work. Review the material and try again to improve your score.
                    </p>
                    <button
                      className="button"
                      onClick={() => {
                        setQuizIndex(0);
                        setQuizSelected(null);
                        setQuizScore(0);
                        setQuizComplete(false);
                      }}
                    >
                      Restart quiz
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="quiz-progress">
                      <span>
                        Question {quizIndex + 1} of {quiz.length}
                      </span>
                      <strong>{quizScore} correct</strong>
                    </div>
                    <h3>{quiz[quizIndex].question}</h3>
                    <div className="quiz-options">
                      {quiz[quizIndex].options.map(option => (
                        <button
                          className={`quiz-option ${
                            quizSelected === option
                              ? option === quiz[quizIndex].answer
                                ? "correct"
                                : "incorrect"
                              : ""
                          } ${
                            quizSelected && option === quiz[quizIndex].answer ? "correct" : ""
                          }`}
                          disabled={quizSelected !== null}
                          onClick={() => {
                            setQuizSelected(option);
                            if (option === quiz[quizIndex].answer)
                              setQuizScore(score => score + 1);
                          }}
                          key={option}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {quizSelected && (
                      <div
                        className={`quiz-feedback ${
                          quizSelected === quiz[quizIndex].answer ? "correct" : "incorrect"
                        }`}
                      >
                        {quizSelected === quiz[quizIndex].answer ? "Correct!" : "Not quite."}
                        {quizSelected !== quiz[quizIndex].answer && (
                          <span> Correct answer: {quiz[quizIndex].answer}</span>
                        )}
                      </div>
                    )}
                    {quizSelected && (
                      <button
                        className="button"
                        onClick={() => {
                          if (quizIndex < quiz.length - 1) {
                            setQuizIndex(index => index + 1);
                            setQuizSelected(null);
                          } else {
                            setQuizComplete(true);
                          }
                        }}
                      >
                        {quizIndex < quiz.length - 1 ? "Next question" : "See your score"}
                      </button>
                    )}
                    {quizSelected && quizIndex === quiz.length - 1 && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setQuizIndex(0);
                          setQuizSelected(null);
                          setQuizScore(0);
                          setQuizComplete(false);
                        }}
                      >
                        Restart quiz
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Markdown documents: study_guide, brief */
              <div className={`document-viewer ${studioResult.mode}`}>
                <ReactMarkdown>{studioResult.content}</ReactMarkdown>
              </div>
            )}

            <small className="muted">Generated by {studioResult.model}</small>
          </div>
        </div>
      )}

      {/* ── Mindful Prompt Source Modal ── */}
      {showSourceModal && (
        <div className="modal-backdrop" onClick={() => setShowSourceModal(false)}>
          <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="panel-header">
              <div>
                <h2>Select a Source for Your Prompt</h2>
                <small className="muted">
                  Choose a PDF to save tokens and focus your research, or proceed with all sources.
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowSourceModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {pendingPrompt && (
              <div className="modal-prompt-preview">
                &ldquo;{pendingPrompt}&rdquo;
              </div>
            )}

            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
              Available sources ({readySources.length}):
            </p>

            <div className="modal-source-grid">
              {readySources.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="modal-source-card"
                  onClick={() => void executeSend(pendingPrompt, s.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <MaterialIcon name="description" size={20} />
                    <div style={{ minWidth: 0, textAlign: "left" }}>
                      <strong>{s.title}</strong>
                      <small className="muted">
                        {s.type.toUpperCase()}
                        {s.file_size ? ` · ${(s.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
                      </small>
                    </div>
                  </div>
                  <span className="button secondary" style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}>
                    Focus & Send
                  </span>
                </button>
              ))}
            </div>

            <div className="modal-source-actions">
              <button
                type="button"
                className="button secondary"
                style={{ width: "100%", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={() => void executeSend(pendingPrompt, null)}
              >
                <MaterialIcon name="menu_book" size={16} />
                <span>Proceed with All Sources ({readySources.length} documents)</span>
              </button>
              <button
                type="button"
                className="button secondary"
                style={{ width: "100%", padding: "10px", background: "transparent", border: "0", color: "var(--muted)" }}
                onClick={() => setShowSourceModal(false)}
              >
                Cancel and edit prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
