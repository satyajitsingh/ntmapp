import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composeEmail, subjectFrom } from "@/utils/format";

// ----- request validation (now includes "casual") -----
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

// ----- prompt helpers -----
function toneHints(tone: string) {
  switch (tone) {
    case "casual":
      return `
Use a friendly, conversational tone.
Use contractions like "we'll", "it's", "you're", "let's".
Prefer short sentences and plain language.
Avoid stiff corporate phrasing and buzzwords.
Open with a light intro (e.g., "Hey folks, just a quick recap from today’s chat…").
`.trim();
    case "friendly":
      return `Use warm, approachable language without being overly casual.`;
    case "persuasive":
      return `Use confident, motivating language to encourage action and ownership.`;
    case "formal":
      return `Use professional, businesslike language with complete sentences.`;
    case "concise":
      return `Be brief and to the point; include only essential information.`;
    default:
      return ``;
  }
}

const SYSTEM_PROMPT = `You turn messy meeting notes into ready-to-send plain-text emails.
Follow the requested tone, audience, and email type.
Always extract: decisions, action items (owner, due date), and open questions.
Return content suitable for email clients (no markdown).`;

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
TONE: ${p.tone}
EMAIL TYPE: ${p.type}
TARGET LENGTH: ${p.length}

TONE GUIDANCE:
${p.toneInstructions || "(none)"}

NOTES:
${p.notes}

CONSTRAINTS:
- Subject line ≤ 80 chars.
- Start with a 2–3 line executive summary (match tone).
- Separate sections: Decisions, Action Items (Owner • Task • Due), Open Questions.
- End with a clear request to confirm or correct.
`.trim();
}

const EXTRACTION_SCHEMA = `
Return a valid JSON object with keys:
- summary: string
- decisions: string[]
- actions: { owner: string, task: string, due: string }[]
- questions: string[]
Do not include any other keys.`.trim();

// ----- route handler -----
export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const p = parsed.data;
  const hasKey = !!process.env.OPENAI_API_KEY;

  // Fallback: works without any API key (naive extraction)
  if (!hasKey) {
    try {
      const lines = p.notes
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      // crude heuristics to pull actions/decisions/questions
      const actions = lines
        .filter((l) => /\b(to|by|due|assign|owner|review)\b/i.test(l))
        .slice(0, 12)
        .map((l) => {
          // try to infer owner as first capitalized token
          const ownerMatch = l.match(/^([A-Z][a-zA-Z]+)/);
          return { owner: ownerMatch ? ownerMatch[1] : "TBD", task: l, due: "" };
        });

      const decisions = lines
        .filter((l) => /decided|agree|approved?|keep|choose|conclude|push|move/i.test(l))
        .slice(0, 12);

      const questions = lines
        .filter((l) => /\?$/.test(l) || /open|blocker|unknown|pending/i.test(l))
        .slice(0, 12);

      const summary = (() => {
        const gist = lines.slice(0, 3).join(" ");
        if (p.tone === "casual") {
          return `Hey folks — quick recap: ${gist} ...`;
        }
        return `Quick summary: ${gist} ...`;
      })();

      const body = composeEmail({
        title: p.title,
        audience: p.audience as any,
        tone: p.tone as any,
        type: p.type as any,
        summary,
        decisions,
        actions,
        questions
      });
      const subject = subjectFrom(p.title, summary);
      return NextResponse.json({ subject, body, actions });
    } catch (e) {
      return NextResponse.json({ error: "Generation failed." }, { status: 500 });
    }
  }

  // With OpenAI: two-step extraction -> composition, with tone-aware guidance
  try {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const toneInstructions = toneHints(p.tone);

    // Step 1: extract structured info
    const extraction = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: userTemplate({ ...p, toneInstructions }) + "\n\n" + EXTRACTION_SCHEMA
        }
      ]
    });

    const raw = extraction.choices[0]?.message?.content ?? "{}";
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }

    // Step 2: compose final email with our deterministic formatter
    const body = composeEmail({
      title: p.title,
      audience: p.audience as any,
      tone: p.tone as any,
      type: p.type as any,
      summary: data.summary ?? "",
      decisions: Array.isArray(data.decisions) ? data.decisions : [],
      actions: Array.isArray(data.actions) ? data.actions : [],
      questions: Array.isArray(data.questions) ? data.questions : []
    });

    const subject = subjectFrom(p.title, data.summary);
    return NextResponse.json({ subject, body, actions: data.actions ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
