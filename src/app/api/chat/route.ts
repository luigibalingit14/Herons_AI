import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = { message?: unknown; notebookId?: unknown; mode?: unknown; sourceId?: unknown };
const modes = ["chat", "flashcards", "quiz", "study_guide", "brief"] as const;
const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Normalize JSON responses that local/remote models may wrap in Markdown or prose. */
function stripCodeFences(text: string): string {
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

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }

  if (typeof body.message !== "string" || !body.message.trim() || typeof body.notebookId !== "string")
    return jsonError("message and notebookId are required.");

  const mode = modes.includes(body.mode as typeof modes[number])
    ? (body.mode as typeof modes[number])
    : "chat";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Authentication required.", 401);

  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id,title")
    .eq("id", body.notebookId)
    .eq("user_id", user.id)
    .single();
  if (!notebook) return jsonError("Notebook not found.", 404);

  const selectedSourceId =
    typeof body.sourceId === "string" && body.sourceId.trim() && body.sourceId.trim() !== "all"
      ? body.sourceId.trim()
      : null;

  let sourcesQuery = supabase
    .from("sources")
    .select("id,title,content")
    .eq("notebook_id", notebook.id)
    .eq("user_id", user.id)
    .eq("status", "ready");

  if (selectedSourceId) {
    sourcesQuery = sourcesQuery.eq("id", selectedSourceId);
  } else {
    sourcesQuery = sourcesQuery.limit(20);
  }

  const { data: sources } = await sourcesQuery;

  if (selectedSourceId && (!sources || sources.length === 0)) {
    return jsonError("Selected source was not found or is not ready yet.", 404);
  }

  if (mode !== "chat" && !sources?.length)
    return jsonError("Add and process at least one source before using Studio.");

  const isSingleSource = Boolean(selectedSourceId && sources?.length === 1);
  const context = (sources ?? [])
    .map(s => `SOURCE: ${s.title}\n${(s.content ?? "").slice(0, isSingleSource ? 12000 : 5000)}`)
    .join("\n\n");

  const studioInstructions: Record<string, string> = {
    flashcards:
      "Return ONLY valid JSON array of objects with question and answer string fields. Create 8 useful flashcards.",
    quiz:
      "Return ONLY valid JSON array of objects with question, options (array of 4 strings), and answer (exactly one option) fields. Create 5 questions.",
    study_guide:
      "Return a well-structured Markdown study guide with headings, key concepts, and source-grounded explanations.",
    brief: "Return a concise Markdown brief with a summary and 5 key takeaways.",
  };

  const prompt =
    mode === "chat"
      ? isSingleSource
        ? `Answer strictly from the selected source "${sources![0].title}". Do not use outside facts. If the source does not contain the answer, say so clearly.\n\n${context}\n\nQuestion: ${body.message}`
        : `Answer only from these notebook sources. Cite source names and say when the sources do not contain the answer.\n\n${context || "No sources are ready yet."}\n\nQuestion: ${body.message}`
      : isSingleSource
      ? `You are creating ${mode} study material strictly from the selected source "${sources![0].title}". Do not invent facts. ${studioInstructions[mode]}\n\nSource:\n${context}\n\nUser request: ${body.message}`
      : `You are creating ${mode} study material from the notebook sources below. Do not invent facts. ${studioInstructions[mode]}\n\nSources:\n${context}\n\nUser request: ${body.message}`;

  const generated = await generate(prompt);
  if (!generated)
    return jsonError("All configured AI providers failed. Check your server environment.", 502);

  // Strip markdown code fences for JSON modes (flashcards, quiz)
  if (mode === "flashcards" || mode === "quiz") {
    generated.message = stripCodeFences(generated.message);
  }

  if (mode === "chat") {
    let { data: chat } = await supabase
      .from("chats")
      .select("id")
      .eq("notebook_id", notebook.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!chat) {
      const created = await supabase
        .from("chats")
        .insert({ notebook_id: notebook.id, user_id: user.id, title: "Research chat" })
        .select("id")
        .single();
      chat = created.data;
    }

    if (chat)
      await supabase.from("messages").insert([
        {
          chat_id: chat.id,
          notebook_id: notebook.id,
          user_id: user.id,
          role: "user",
          content: body.message,
        },
        {
          chat_id: chat.id,
          notebook_id: notebook.id,
          user_id: user.id,
          role: "assistant",
          content: generated.message,
          model_used: generated.model,
          tokens_used: generated.tokens,
          cost_usd: 0,
          citations: (sources ?? []).map(s => ({ title: s.title })),
        },
      ]);
  }

  return NextResponse.json({
    message: generated.message,
    tokens_used: generated.tokens,
    cost_usd: 0,
    citations: (sources ?? []).map(s => ({ title: s.title })),
  });
}

/* ─── Multi-provider AI generation with fallback chain ─── */
async function generate(
  prompt: string
): Promise<{ message: string; model: string; tokens: number } | null> {
  const errors: string[] = [];

  // ── 1. OpenRouter (primary, with an optional backup key) ──
  const openRouterKeys = [process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_2]
    .filter((key): key is string => Boolean(key?.trim()));
  if (openRouterKeys.length > 0) {
    const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
    for (let keyIndex = 0; keyIndex < openRouterKeys.length; keyIndex += 1) {
      const key = openRouterKeys[keyIndex];
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            "X-Title": "Herons AI",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (r.ok) {
          const d = await r.json();
          const message = d.choices?.[0]?.message?.content;
          if (typeof message === "string")
            return { message, model: `openrouter/${model}`, tokens: d.usage?.total_tokens ?? 0 };
        } else {
          errors.push(`OpenRouter key ${keyIndex + 1} ${r.status}: ${await r.text().catch(() => "")}`);
        }
      } catch (e) {
        errors.push(`OpenRouter key ${keyIndex + 1} error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // ── 2. Gemini (uses ?key= query param, NOT Bearer auth) ──
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const d = await r.json();
        const message = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof message === "string")
          return { message, model, tokens: d.usageMetadata?.totalTokenCount ?? 0 };
      } else {
        errors.push(`Gemini ${r.status}: ${await r.text().catch(() => "")}`);
      }
    } catch (e) {
      errors.push(`Gemini error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 3. Groq ──
  if (process.env.GROQ_API_KEY) {
    const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const d = await r.json();
        const message = d.choices?.[0]?.message?.content;
        if (typeof message === "string")
          return { message, model: `groq/${model}`, tokens: d.usage?.total_tokens ?? 0 };
      } else {
        errors.push(`Groq ${r.status}: ${await r.text().catch(() => "")}`);
      }
    } catch (e) {
      errors.push(`Groq error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 4. Ollama (local fallback — longer timeout for local inference) ──
  if (process.env.OLLAMA_BASE_URL) {
    const model = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
    try {
      const r = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal: AbortSignal.timeout(120000),
      });
      if (r.ok) {
        const d = await r.json();
        if (typeof d.response === "string")
          return { message: d.response, model: `ollama/${model}`, tokens: 0 };
      } else {
        errors.push(`Ollama ${r.status}: ${await r.text().catch(() => "")}`);
      }
    } catch (e) {
      errors.push(`Ollama error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length) console.error("[generate] All providers failed:", errors);
  return null;
}
