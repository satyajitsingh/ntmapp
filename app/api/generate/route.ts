import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composeEmail, subjectFrom } from "@/utils/format";

/* ---------- validation ---------- */
const bodySchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  participants: z.string().optional(),
  audience: z.enum(["internal", "client", "stakeholder"]),
  tone: z.enum(["concise", "formal", "friendly", "persuasive", "casual"]),
  type: z.enum(["summary", "follow-up", "action-only"]),
  length: z.enum(["short", "medium", "long"]),
  notes: z.string().min(10)
});

/* ---------- tone guidance for extraction step (not the final email) ---------- */
function toneHints(tone: string) {
  switch (tone) {
    case "casual":
      return `
Use a friendly, conversational tone in the *final email*.
Use contractions (we'll, it's, you're, let's).
Keep sentences short and avoid buzzwords.
Open with a light intro (e.g., "Hey folks — quick recap …").
`.trim();
    case "friendly":
      return `Use warm, approachable language without being overly casual.`;
    case "persuasive":
      return `Use confident, motivating language to encourage action and ownership.`;
    case "formal":
      return `Use professional, business-like language with complete sentences.`;
    case "concise":
      return `Be brief and to the point; include only essential information.`;
    default:
      return ``;
  }
}

/* ---------- SYSTEM: extraction-only ---------- */
const SYSTEM_PROMPT = `You turn messy meeting notes into a structured summary.

ONLY EXTRACT structured fields; DO NOT write the final email body.
We will format the final email on the server.

Return JSON with:
- summary: string (2–5 lines max, plain text, no markdown)
- decisions: string[]
- actions: { owner: string, task: string, due: string }[]
- questions: string[]

Notes can be noisy; extract what’s reliable.`;

/* ---------- user template for extraction ---------- */
function userTemplate(p: {
  title?: string;
  date?: string;
  participants?: string;
  audience: string;
  tone: string;
  type: string;
  length: string;
  notes: string;
  toneInstructions: string;
}) {
  return `
MEETING TITLE: ${p.title ?? ""}
DATE: ${p.date ?? ""}
PARTICIPANTS: ${p.participants ?? ""}
AUDIENCE: ${p.audience}
TONE (for final email): ${p.tone}
EMAIL TYPE: ${p.type}
TARGET LENGTH: ${p.length}

TONE GUIDANCE (for awareness only):
${p.toneInstructions || "(none)"}

NOTES:
${p.notes}

CONSTRAINTS:
- You are EXTRACTING ONLY, not writing the final email.
- Keep "summary" as short plain text lines (no bullets needed).
- "actions" should capture owner, task, and due date when available.
- If a field is empty, return an empty array or empty string (do not invent).
`.trim();
}

const EXTRACTION_SCHEMA = `
Return a valid JSON object with keys EXACTLY:
{
  "summary": string,
  "decisions": string[],
  "actions": [{"owner": string, "task": string, "due": string}],
  "questions": string[]
}`.trim();

/* =========================
   Route handler
   ========================= */
export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const p = parsed.data;
  const hasKey = !!process.env.OPENAI_API_KEY;

  /* ---------- Fallback path: no API key ---------- */
  if (!hasKey) {
    try {
      const lines = p.notes.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // naive signal extraction
      const actions = lines
        .filter(l => /\b(to|by|due|assign|owner|review|follow\s*up)\b/i.test(l))
        .slice(0, 50)
        .map(l => {
          const ownerMatch = l.match(/^([A-Z][a-zA-Z]+)/);
          return { owner: ownerMatch ? ownerMatch[1] : "TBD", task: l, due: "" };
        });

      const decisions = lines
        .filter(l => /decided|agree|approved?|keep|choose|conclude|push|move/i.test(l))
        .slice(0, 50);

      const questions = lines
        .filter(l => /\?$/.test(l) || /open|blocker|unknown|pending/i.test(l))
        .slice(0, 50);

      // short plain summary (first few lines glued)
      const summary = lines.slice(0, 8).join(" ");

      // Compose FINAL email with formatter (adds intro, Attendees, sections)
      const body = composeEmail({
        title: p.title,
        date: p.date,
        participants: p.participants,
        audience: p.audience as any,
        tone: p.tone as any,
        type: p.type as any,
        summary,
        decisions,
        actions,
        questions
      });

      // Subject strictly from title + type (short & concise)
      const subject = subjectFrom(p.title, p.type);

      return NextResponse.json({ subject, body, actions });
    } catch (e) {
      return NextResponse.json({ error: "Generation failed." }, { status: 500 });
    }
  }

  /* ---------- OpenAI path: extract -> compose ---------- */
  try {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const toneInstructions = toneHints(p.tone);

    const extraction = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userTemplate({ ...p, toneInstructions }) + "\n\n" + EXTRACTION_SCHEMA }
      ]
    });

    const raw = extraction.choices[0]?.message?.content ?? "{}";
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { summary: "", decisions: [], actions: [], questions: [] };
    }

    const body = composeEmail({
      title: p.title,
      date: p.date,
      participants: p.participants,
      audience: p.audience as any,
      tone: p.tone as any,
      type: p.type as any,
      summary: data.summary ?? "",
      decisions: Array.isArray(data.decisions) ? data.decisions : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
      questions: Array.isArray(data.questions) ? data.questions : []
    });

    const subject = subjectFrom(p.title, p.type);

    return NextResponse.json({ subject, body, actions: data.actions ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
