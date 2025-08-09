import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { composeEmail, subjectFrom } from "@/utils/format";
import { SYSTEM_PROMPT, USER_TEMPLATE, EXTRACTION_SCHEMA } from "@/lib/prompt";

const bodySchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  participants: z.string().optional(),
  audience: z.enum(["internal", "client", "stakeholder"]),
  tone: z.enum(["concise", "formal", "friendly", "persuasive"]),
  type: z.enum(["summary", "follow-up", "action-only"]),
  length: z.enum(["short", "medium", "long"]),
  notes: z.string().min(10)
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const p = parsed.data;
  const hasKey = !!process.env.OPENAI_API_KEY;

  try {
    if (!hasKey) {
      // Fallback: naive extractor to make the demo work without an API key.
      const lines = p.notes.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const actions = lines
        .filter(l => /\b(to|by|due|assign|owner|review)\b/i.test(l))
        .slice(0, 8)
        .map(l => {
          const ownerMatch = l.match(/^(\w+)/);
          return { owner: ownerMatch ? ownerMatch[1] : "TBD", task: l, due: "" };
        });
      const decisions = lines.filter(l => /decided|agree|keep|choose|approve/i.test(l)).slice(0, 8);
      const questions = lines.filter(l => /\?$/.test(l) || /open|blocker|unknown/i.test(l)).slice(0, 8);
      const summary = `Quick summary: ${lines.slice(0, 3).join(" ")} ...`;

      const body = composeEmail({
        title: p.title,
        audience: p.audience,
        tone: p.tone,
        type: p.type,
        summary,
        decisions,
        actions,
        questions
      });
      const subject = subjectFrom(p.title, summary);
      return NextResponse.json({ subject, body, actions });
    }

    // With OpenAI: two-step extraction -> composition
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const extractionPrompt = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_TEMPLATE(p) + "\n\n" + EXTRACTION_SCHEMA }
    ] as const;

    const extract = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: extractionPrompt,
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const raw = extract.choices[0]?.message?.content ?? "{}";
    let data: any = {};
    try { data = JSON.parse(raw); } catch {}

    const body = composeEmail({
      title: p.title,
      audience: p.audience as any,
      tone: p.tone as any,
      type: p.type as any,
      summary: data.summary ?? "Summary unavailable.",
      decisions: data.decisions ?? [],
      actions: data.actions ?? [],
      questions: data.questions ?? []
    });
    const subject = subjectFrom(p.title, data.summary);

    return NextResponse.json({ subject, body, actions: data.actions ?? [] });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
