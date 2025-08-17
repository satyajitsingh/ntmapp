// utils/format.ts

type Action = { owner: string; task: string; due: string };

function formatWhen(dateStr?: string): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;

  // Try parsing ISO (YYYY-MM-DD) or free text; if parse fails, use the raw string
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    // e.g., "1 Aug 2025"
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  // If the browser can't parse it, just show what the user entered
  return s;
}

function introLine(opts: {
  tone: "concise" | "formal" | "friendly" | "persuasive" | "casual";
  title?: string;
  date?: string;
}) {
  const t = opts.title?.trim();
  const when = formatWhen(opts.date) ?? "today";
  switch (opts.tone) {
    case "formal":
      return `The key takeaways from the "${t ?? "meeting"}" session held on ${when} are summarised below.`;
    case "friendly":
      return `Thanks for joining "${t ?? "our meeting"}" on ${when}. Here’s a clear recap and what’s next.`;
    case "persuasive":
      return `Following "${t ?? "the meeting"}" on ${when}, here’s where we landed and what we need to move forward.`;
    case "casual":
      return `Hey folks — quick recap from "${t ?? "today’s chat"}" (${when}).`;
    case "concise":
    default:
      return `Here’s a quick follow-up from "${t ?? "the meeting"}" (${when}).`;
  }
}

function signoffFor(tone: "concise" | "formal" | "friendly" | "persuasive" | "casual") {
  switch (tone) {
    case "formal": return "Best regards,";
    case "persuasive": return "Thanks in advance,";
    case "casual": return "Cheers,";
    case "friendly": return "Thanks so much,";
    case "concise":
    default: return "Thanks!";
  }
}

export function composeEmail(opts: {
  title?: string;
  date?: string;
  participants?: string; // ← will always render an Attendees line (with '—' if blank)
  audience: "internal" | "client" | "stakeholder";
  tone: "concise" | "formal" | "friendly" | "persuasive" | "casual";
  type: "summary" | "follow-up" | "action-only";
  summary: string;
  decisions: string[];
  actions: Action[];
  questions: string[];
}) {
  const greeting =
    opts.audience === "client" ? "Hi team," :
    opts.audience === "stakeholder" ? "Hello," :
    "Hi all,";

  const parts: string[] = [];

  // Greeting + intro paragraph (always first)
  parts.push(greeting);
  parts.push(introLine({ tone: opts.tone, title: opts.title, date: opts.date }));

  // Attendees (always present; placeholder if not provided)
  const attendees = (opts.participants && opts.participants.trim()) ? opts.participants.trim() : "—";
  parts.push(`Attendees: ${attendees}`);
  parts.push(""); // blank line before sections

  // Sections (never start the email — they come after intro)
  if (opts.type !== "action-only") {
    if (opts.summary?.trim()) {
      parts.push("Summary");
      parts.push(opts.summary.trim());
      parts.push("");
    }
    if (opts.decisions.length) {
      parts.push("Decisions");
      for (const d of opts.decisions) parts.push(`- ${d}`);
      parts.push("");
    }
  }

  if (opts.actions.length) {
    parts.push("Action Items");
    for (const a of opts.actions) {
      const due = a.due ? ` — ${a.due}` : "";
      parts.push(`- ${a.owner || "TBD"} — ${a.task}${due}`);
    }
    parts.push("");
  }

  if (opts.type !== "action-only" && opts.questions.length) {
    parts.push("Open Questions");
    for (const q of opts.questions) parts.push(`- ${q}`);
    parts.push("");
  }

  // Signoff
  parts.push(`${signoffFor(opts.tone)}\n{your name}`);

  return parts.join("\n");
}

export function subjectFrom(
  title?: string,
  type: "summary" | "follow-up" | "action-only" = "follow-up"
) {
  const base = title?.trim() || "Meeting";
  const suffix =
    type === "summary" ? "summary" :
    type === "action-only" ? "action items" :
    "follow-up";
  // Short, concise: "<Title> — <suffix>", max ~70 chars
  const full = `${base} — ${suffix}`;
  return full.length > 70 ? full.slice(0, 70) : full;
}
