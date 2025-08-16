"use client";

import { useEffect, useMemo, useState } from "react";

type Extracted = {
  subject: string;
  body: string;
  actions?: { owner: string; task: string; due: string }[];
};

type Values = {
  title: string;
  date: string;
  participants: string;
  audience: "internal" | "client" | "stakeholder";
  tone: "concise" | "formal" | "friendly" | "persuasive" | "casual";
  type: "summary" | "follow-up" | "action-only";
  length: "short" | "medium" | "long";
  notes: string;
  to: string; // recipients for compose quick actions (comma-separated)
};

const SAMPLE_NOTES = `- Design ready; backend ~2 weeks behind
- Anna to draft client comms by Fri
- Need legal review of Terms update
- Client wants weekly status`;

const TONE_PREVIEW: Record<Values["tone"], { intro: string; signoff: string }> = {
  concise: {
    intro: "Quick summary below. Highlights + next steps.",
    signoff: "Thanks!"
  },
  formal: {
    intro: "Please find a concise summary of today’s discussion below.",
    signoff: "Best regards,"
  },
  friendly: {
    intro: "Here’s a clear recap of what we covered today.",
    signoff: "Thanks so much,"
  },
  persuasive: {
    intro: "Here’s where we are and what we need to move forward.",
    signoff: "Thanks in advance,"
  },
  casual: {
    intro: "Hey folks — quick recap from today’s chat:",
    signoff: "Cheers,"
  }
};

export default function EmailGenerator() {
  // ---- state ----
  const [values, setValues] = useState<Values>({
    title: "",
    date: "",
    participants: "",
    audience: "internal",
    tone: "concise",
    type: "follow-up",
    length: "medium",
    notes: "",
    to: ""
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(true); // collapsed on small screens via CSS toggle below

  // ---- persistence ----
  useEffect(() => {
    const saved = localStorage.getItem("nte_values_v2");
    if (saved) try { setValues(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("nte_values_v2", JSON.stringify(values));
  }, [values]);

  function set<K extends keyof Values>(k: K, v: Values[K]) {
    setValues(prev => ({ ...prev, [k]: v }));
  }

  // ---- generate ----
  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if ((values.notes || "").trim().length < 10) {
      setError("Please add a bit more detail to your notes.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // send only fields the API expects
      const payload = {
        title: values.title,
        date: values.date,
        participants: values.participants,
        audience: values.audience,
        tone: values.tone,
        type: values.type,
        length: values.length,
        notes: values.notes
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      // auto-open preview on mobile after generation
      setPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ---- copy helpers ----
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Copied!");
    }
  }

  function toast(msg: string) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;bottom:20px;right:20px;background:#0f141a;color:#e7eef7;border:1px solid #223042;padding:10px 12px;border-radius:10px;z-index:9999";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  const combinedPlain = useMemo(() => {
    if (!result) return "";
    return `Subject: ${result.subject}

${result.body}`;
  }, [result]);

  // ---- compose quick-actions (no OAuth) ----
  function encodeParam(v: string) {
    return encodeURIComponent(v || "");
  }
  function trimSubject(s: string) {
    const oneLine = s.replace(/\r?\n/g, " ").trim();
    return oneLine.slice(0, 200); // keep it reasonable for URL length
  }
  function openGmail(to: string, subject: string, body: string) {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeParam(
      to
    )}&su=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
    window.open(url, "_blank");
  }
  function openOutlook(to: string, subject: string, body: string) {
    // Works for Outlook.com and usually redirects for M365
    const url = `https://outlook.live.com/owa/?path=/mail/action/compose&to=${encodeParam(
      to
    )}&subject=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
    window.open(url, "_blank");
  }
  function openYahoo(to: string, subject: string, body: string) {
    const url = `https://compose.mail.yahoo.com/?to=${encodeParam(
      to
    )}&subject=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
    window.open(url, "_blank");
  }
  function openMailto(to: string, subject: string, body: string) {
    const href = `mailto:${encodeParam(to)}?subject=${encodeParam(
      trimSubject(subject)
    )}&body=${encodeParam(body)}`;
    window.location.href = href;
  }

  const toneTip = TONE_PREVIEW[values.tone];

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* ======== FORM (mobile-first) ======== */}
      <form onSubmit={onGenerate} className="card p-4 sm:p-6 space-y-5">
        {/* Recipients for quick compose */}
        <div>
          <label>Recipient(s)</label>
          <input
            className="input mt-1 h-12"
            placeholder="to@example.com, second@example.com"
            value={values.to}
            onChange={(e) => set("to", e.target.value)}
            spellCheck={false}
          />
          <p className="text-xs text-slate-400 mt-1">
            Optional — used only by the “Open in Gmail/Outlook/Yahoo/Mail” buttons.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Meeting Title</label>
            <input
              className="input mt-1 h-12"
              placeholder="Q3 Planning Sync"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              spellCheck={true}
            />
          </div>
          <div>
            <label>Date</label>
            <input
              className="input mt-1 h-12"
              placeholder="2025-08-01"
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label>Participants</label>
            <input
              className="input mt-1 h-12"
              placeholder="Alice, Bob, Carol"
              value={values.participants}
              onChange={(e) => set("participants", e.target.value)}
              spellCheck={true}
            />
          </div>
        </div>

        {/* Tone + live preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label>Audience</label>
            <select
              className="input mt-1 h-12"
              value={values.audience}
              onChange={(e) => set("audience", e.target.value as Values["audience"])}
            >
              <option value="internal">Internal</option>
              <option value="client">Client</option>
              <option value="stakeholder">Stakeholder</option>
            </select>
          </div>
          <div>
            <label>Tone</label>
            <select
              className="input mt-1 h-12"
              value={values.tone}
              onChange={(e) => set("tone", e.target.value as Values["tone"])}
            >
              <option value="concise">Concise</option>
              <option value="formal">Formal</option>
              <option value="friendly">Friendly</option>
              <option value="persuasive">Persuasive</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label>Email Type</label>
            <select
              className="input mt-1 h-12"
              value={values.type}
              onChange={(e) => set("type", e.target.value as Values["type"])}
            >
              <option value="summary">Summary</option>
              <option value="follow-up">Follow-up</option>
              <option value="action-only">Action-only</option>
            </select>
          </div>
        </div>

        {/* Tone preview card */}
        <div className="rounded-xl border border-[#1e2733] bg-[#0f141a] p-3">
          <p className="text-xs text-slate-400 mb-1">Tone preview</p>
          <div className="text-sm leading-6">
            <p className="text-slate-200">
              <span className="opacity-80">{toneTip.intro}</span>
            </p>
            <p className="text-slate-400 mt-1">Sign-off example: <span className="text-slate-200">{toneTip.signoff}</span></p>
          </div>
        </div>

        <div>
          <label>Length</label>
          <select
            className="input mt-1 h-12"
            value={values.length}
            onChange={(e) => set("length", e.target.value as Values["length"])}
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </div>

        <div>
          <div className="flex items-end justify-between">
            <label>Notes</label>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => set("notes", SAMPLE_NOTES)}
            >
              Insert sample
            </button>
          </div>
          <textarea
            className="input mt-1 min-h-[160px] sm:min-h-[200px] resize-y"
            placeholder="- Discussed launch slip…"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            spellCheck={true}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Mobile-first buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button className="btn btn-primary h-12" disabled={loading}>
            {loading ? "Generating…" : "Generate Email"}
          </button>
          <button
            type="button"
            className="btn btn-ghost h-12"
            onClick={() => {
              setResult(null);
              set("notes", "");
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {/* ======== PREVIEW (collapsible on small, sticky on desktop) ======== */}
      <div className="card p-4 sm:p-6 md:sticky md:top-6 md:h-fit">
        {/* Collapse toggle visible on small screens */}
        <div className="flex items-center justify-between sm:hidden mb-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          <button
            className="btn btn-ghost h-10"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Hide" : "Show"}
          </button>
        </div>

        {/* Content wrapper: show/hide on small; always show on sm+ */}
        <div className={`${previewOpen ? "block" : "hidden"} sm:block`}>
          {!result && !loading && (
            <div className="text-slate-400">
              Generate to see the email preview. You can copy the subject, the body, or both — or jump straight to your mail client below.
            </div>
          )}

          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-6 w-2/3 rounded bg-[#0f141a]" />
              <div className="h-24 rounded bg-[#0f141a]" />
              <div className="h-40 rounded bg-[#0f141a]" />
            </div>
          )}

          {result && !loading && (
            <>
              {/* Quick actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-4">
                <h3 className="font-semibold">Actions</h3>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  <button className="btn btn-ghost h-12" onClick={() => copy(result.subject)}>
                    Copy Subject
                  </button>
                  <button className="btn btn-ghost h-12" onClick={() => copy(result.body)}>
                    Copy Body
                  </button>
                  <button
                    className="btn btn-primary h-12"
                    onClick={() => copy(`Subject: ${result.subject}\n\n${result.body}`)}
                  >
                    Copy Both
                  </button>
                </div>
              </div>

              {/* Open compose in common providers */}
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">
                  Open a draft in your mail service (uses the recipient(s) above):
                </p>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost h-12"
                    onClick={() => openGmail(values.to, result.subject, result.body)}
                  >
                    Open in Gmail
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost h-12"
                    onClick={() => openOutlook(values.to, result.subject, result.body)}
                  >
                    Open in Outlook
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost h-12"
                    onClick={() => openYahoo(values.to, result.subject, result.body)}
                  >
                    Open in Yahoo
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost h-12"
                    onClick={() => openMailto(values.to, result.subject, result.body)}
                  >
                    Open in Mail App
                  </button>
                </div>
              </div>

              {/* Editable preview */}
              <div className="mb-4">
                <label>Subject (editable)</label>
                <input
                  className="input mt-1 h-12"
                  value={result.subject}
                  onChange={(e) => setResult({ ...result, subject: e.target.value })}
                  spellCheck={true}
                />
              </div>

              <div>
                <label>Body (editable)</label>
                <textarea
                  className="input mt-1 min-h-[280px] sm:min-h-[340px] resize-y whitespace-pre-wrap break-words"
                  value={result.body}
                  onChange={(e) => setResult({ ...result, body: e.target.value })}
                  spellCheck={true}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
