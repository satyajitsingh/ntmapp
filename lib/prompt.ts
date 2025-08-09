export const SYSTEM_PROMPT = `You are an assistant that turns raw meeting notes into ready-to-send emails.
Follow the requested tone and audience. Keep it concise and action-oriented.
Always extract: decisions, action items (owner, due date), and open questions.
Return well-formatted plain text suitable for email clients.`;

export const USER_TEMPLATE = (p: {
  title?: string;
  date?: string;
  participants?: string;
  audience: string;
  tone: string;
  type: string;
  length: string;
  notes: string;
}) => `MEETING TITLE: ${p.title ?? ""}
DATE: ${p.date ?? ""}
PARTICIPANTS: ${p.participants ?? ""}
AUDIENCE: ${p.audience}
TONE: ${p.tone}
EMAIL TYPE: ${p.type}
TARGET LENGTH: ${p.length}

NOTES:
${p.notes}

CONSTRAINTS:
- Subject line ≤ 80 chars.
- Start with 2–3 line executive summary.
- Separate sections: Decisions, Action Items (Owner • Task • Due), Open Questions.
- End with a clear call to confirm or correct.`;

export const EXTRACTION_SCHEMA = `Return a valid JSON object with keys:
- summary: string
- decisions: string[]
- actions: {owner:string, task:string, due:string}[]
- questions: string[]
Do not include any other keys.`;
