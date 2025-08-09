type Action = { owner: string; task: string; due: string };

export function composeEmail(opts: {
  title?: string;
  audience: "internal" | "client" | "stakeholder";
  tone: "concise" | "formal" | "friendly" | "persuasive";
  type: "summary" | "follow-up" | "action-only";
  summary: string;
  decisions: string[];
  actions: Action[];
  questions: string[];
}) {
  const greeting =
    opts.audience === "client"
      ? "Hi team,"
      : opts.audience === "stakeholder"
      ? "Hello,"
      : "Hi all,";

  const signoff =
    opts.tone === "formal" ? "Best regards," : opts.tone === "persuasive" ? "Thanks in advance," : "Thanks!";

  const parts: string[] = [];
  if (opts.type !== "action-only") {
    parts.push(`${greeting}
${opts.summary.trim()}
`);
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
      parts.push(`- ${a.owner} — ${a.task}${due}`);
    }
    parts.push("");
  }
  if (opts.type !== "action-only" && opts.questions.length) {
    parts.push("Open Questions");
    for (const q of opts.questions) parts.push(`- ${q}`);
    parts.push("");
  }
  parts.push(`${signoff}
{your name}`);
  return parts.join("\n");
}

export function subjectFrom(title?: string, summary?: string) {
  if (title) return `${title} — summary & next steps`;
  return (summary ?? "Meeting follow-up").slice(0, 70);
}
