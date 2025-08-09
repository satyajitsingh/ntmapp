"use client";

import { useState, useMemo } from "react";
import { z } from "zod";

const formSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  participants: z.string().optional(),
  audience: z.enum(["internal", "client", "stakeholder"]).default("internal"),
  tone: z.enum(["concise", "formal", "friendly", "persuasive"]).default("concise"),
  type: z.enum(["summary", "follow-up", "action-only"]).default("follow-up"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  notes: z.string().min(10, "Please paste at least a few lines of notes.")
});

type Extracted = {
  subject: string;
  body: string;
  actions: { owner: string; task: string; due: string }[];
};

export default function EmailGenerator() {
  const [values, setValues] = useState({
    title: "",
    date: "",
    participants: "",
    audience: "internal",
    tone: "concise",
    type: "follow-up",
    length: "medium",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setValues(v => ({ ...v, [name]: value }));
  }

  const mailtoHref = useMemo(() => {
    if (!result) return "#";
    const s = encodeURIComponent(result.subject);
    const b = encodeURIComponent(result.body);
    return `mailto:?subject=${s}&body=${b}`;
  }, [result]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = formSchema.safeParse(values as any);
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={onSubmit} className="card">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Meeting Title</label>
              <input name="title" value={values.title} onChange={handleChange} placeholder="Q3 Planning Sync" />
            </div>
            <div>
              <label>Date</label>
              <input name="date" value={values.date} onChange={handleChange} placeholder="2025-08-01" />
            </div>
          </div>
          <div>
            <label>Participants</label>
            <input name="participants" value={values.participants} onChange={handleChange} placeholder="Alice, Bob, Carol" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label>Audience</label>
              <select name="audience" value={values.audience} onChange={handleChange}>
                <option value="internal">Internal</option>
                <option value="client">Client</option>
                <option value="stakeholder">Stakeholder</option>
              </select>
            </div>
            <div>
              <label>Tone</label>
              <select name="tone" value={values.tone} onChange={handleChange}>
                <option value="concise">Concise</option>
                <option value="formal">Formal</option>
                <option value="friendly">Friendly</option>
                <option value="persuasive">Persuasive</option>
              </select>
            </div>
            <div>
              <label>Email Type</label>
              <select name="type" value={values.type} onChange={handleChange}>
                <option value="summary">Summary</option>
                <option value="follow-up">Follow-up</option>
                <option value="action-only">Action-only</option>
              </select>
            </div>
          </div>

          <div>
            <label>Length</label>
            <select name="length" value={values.length} onChange={handleChange}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>

          <div>
            <label>Notes</label>
            <textarea name="notes" value={values.notes} onChange={handleChange} placeholder="- Discussed launch slip...
- Anna to draft comms by Fri
- Need legal review..." rows={10} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button className="btn-primary" disabled={loading}>{loading ? "Generating..." : "Generate Email"}</button>
            <button className="btn-ghost" type="button" onClick={() => setValues(v => ({...v, notes: ""}))}>Clear</button>
          </div>
        </div>
      </form>

      <div className="card">
        {!result ? (
          <div className="text-slate-400">
            Your formatted email will appear here. Generate first, then copy or open your email client.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2>Result</h2>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => copy(result.subject)}>Copy Subject</button>
                <button className="btn-ghost" onClick={() => copy(result.body)}>Copy Body</button>
                <a className="btn-primary" href={mailtoHref}>Open in Email</a>
              </div>
            </div>
            <div>
              <label>Subject</label>
              <div className="mt-1 bg-[#0f141a] border border-[#1d2631] rounded-xl2 p-3 text-slate-200">{result.subject}</div>
            </div>
            <div>
              <label>Body</label>
              <pre className="mt-1 bg-[#0f141a] border border-[#1d2631] rounded-xl2 p-3 whitespace-pre-wrap text-slate-200">{result.body}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
