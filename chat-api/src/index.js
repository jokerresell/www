import Anthropic from "@anthropic-ai/sdk";

// Stable system prompt — kept byte-identical between requests so it can be cached.
const SYSTEM_PROMPT = `Jesteś wirtualnym asystentem na stronie internetowej firmy przeprowadzkowej Arber-Gordon z Warszawy. Rozmawiasz z osobami, które planują przeprowadzkę lub transport mebli.

Dane firmy:
- Nazwa: „ARBER-GORDON” s.c. Arkadiusz Bereda, Igor Gordziejew
- Branża: przeprowadzki i transport (Warszawa i okolice, dłuższe trasy po wcześniejszym ustaleniu)
- Telefon: 602 469 964
- E-mail: arber_gordon@interia.pl
- Adres: ul. św. Wincentego 128 lok. 85, 03-291 Warszawa (Targówek)
- NIP 521-353-14-51, REGON 141869875, firma wystawia faktury VAT

Usługi: przeprowadzki mieszkań i domów, przeprowadzki biur i firm, transport mebli i AGD, demontaż i montaż mebli, pakowanie i zabezpieczanie (koce, folia, kartony), transport poza Warszawę.

Jak wygląda współpraca: 1) klient opisuje przeprowadzkę telefonicznie lub przez formularz na stronie (sekcja „Bezpłatna wycena”), 2) firma oddzwania z terminem i ceną, 3) ekipa przyjeżdża, zabezpiecza, przewozi i ustawia rzeczy na miejscu.

Zasady:
- Odpowiadaj krótko (2–4 zdania), uprzejmie, w języku, w którym pisze użytkownik (domyślnie po polsku). Pisz zwykłym tekstem, bez nagłówków i tabel.
- Nie podawaj konkretnych cen ani nie potwierdzaj terminów — cena zależy od ilości rzeczy, odległości, pięter, windy i demontażu mebli. Zaproś do wyceny: telefon 602 469 964 lub formularz na stronie.
- Gdy ktoś opisuje przeprowadzkę, możesz dopytać o brakujące informacje (skąd, dokąd, kiedy, ile rzeczy, piętro/winda) i podsumować je, żeby łatwo przekazał je firmie.
- Nie wymyślaj informacji, których tu nie ma (np. ubezpieczenia, godzin pracy, liczby samochodów). Jeśli nie wiesz — powiedz, że najlepiej zapytać telefonicznie.
- Rozmawiaj tylko o sprawach związanych z przeprowadzkami i firmą. Na inne tematy grzecznie odmów i wróć do tematu.
- Nie proś o dane wrażliwe (PESEL, numery kart itp.).`;

const MAX_TURNS = 20;
const MAX_CHARS = 1500;

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && (allowed.includes(origin) || allowed.includes("*"));
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

// Accept only plain user/assistant text from the browser; merge consecutive turns of the same role.
function sanitizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const messages = [];
  for (const m of input.slice(-MAX_TURNS)) {
    const role = m && m.role === "assistant" ? "assistant" : "user";
    const content = String((m && m.content) || "").slice(0, MAX_CHARS).trim();
    if (!content) continue;
    const prev = messages[messages.length - 1];
    if (prev && prev.role === role) prev.content += "\n\n" + content;
    else messages.push({ role, content });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

// Free: Cloudflare Workers AI (10 000 neurons/day on the Workers Free plan, ~80 replies).
const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function replyWithWorkersAI(env, messages) {
  const out = await env.AI.run(WORKERS_AI_MODEL, {
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 400,
  });
  return String((out && out.response) || "").trim();
}

// Optional, paid: Claude API — used only when the ANTHROPIC_API_KEY secret is set.
async function replyWithClaude(env, messages) {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
  });
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    // Deliberately short chat replies.
    max_tokens: 1024,
    output_config: { effort: "low" },
    // Re-run a safety-classifier decline on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages,
  });
  if (response.stop_reason === "refusal") {
    return "Na to pytanie nie mogę odpowiedzieć. W sprawie przeprowadzki zadzwoń: 602 469 964.";
  }
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get("Origin"), env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, cors);
    }
    const messages = sanitizeMessages(body && body.messages);
    if (!messages) return json({ error: "invalid_messages" }, 400, cors);

    try {
      const reply = env.ANTHROPIC_API_KEY
        ? await replyWithClaude(env, messages)
        : await replyWithWorkersAI(env, messages);
      if (!reply) return json({ error: "empty_reply" }, 502, cors);
      return json({ reply }, 200, cors);
    } catch (err) {
      // The browser falls back to built-in answers on any non-2xx response
      // (e.g. the free daily Workers AI allocation is used up).
      if (err instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429, cors);
      console.error("Chat error", err && err.status, err && err.message);
      return json({ error: "upstream_error" }, 502, cors);
    }
  },
};
