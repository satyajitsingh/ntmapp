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
  to: string;
};

const SAMPLE_NOTES = `- Design ready; backend ~2 weeks behind
- Anna to draft client comms by Fri
- Need legal review of Terms update
- Client wants weekly status`;

const TONE_PREVIEW: Record<Values["tone"], { intro: string; signoff: string }> = {
  concise: { intro: "Quick summary below. Highlights + next steps.", signoff: "Thanks!" },
  formal: { intro: "Please find a concise summary of today’s discussion below.", signoff: "Best regards," },
  friendly: { intro: "Here’s a clear recap of what we covered today.", signoff: "Thanks so much," },
  persuasive: { intro: "Here’s where we are and what we need to move forward.", signoff: "Thanks in advance," },
  casual: { intro: "Hey folks — quick recap from today’s chat:", signoff: "Cheers," }
};

/* =========================
   Safe per-tab storage
   ========================= */
const STORAGE_KEY = "nte_values_v4"; // bump to invalidate any earlier saves

type SafeStore = { get:(k:string)=>string|null; set:(k:string,v:string)=>void; remove:(k:string)=>void; };
function makeSafeSessionStorage(): SafeStore {
  let ok = false, ss: Storage | null = null;
  try {
    if (typeof window !== "undefined" && "sessionStorage" in window) {
      ss = window.sessionStorage;
      const T = "__test_ss__";
      ss.setItem(T, "1"); ss.removeItem(T);
      ok = true;
    }
  } catch { ok = false; }
  if (!ok) {
    const mem = new Map<string,string>();
    return {
      get: k => mem.get(k) ?? null,
      set: (k,v) => { mem.set(k,v); },
      remove: k => { mem.delete(k); }
    };
  }
  return {
    get: k => ss!.getItem(k),
    set: (k,v) => { try { ss!.setItem(k,v); } catch {} },
    remove: k => { try { ss!.removeItem(k); } catch {} }
  };
}
const sessionSafe = makeSafeSessionStorage();

/* =========================
   Helpers
   ========================= */
function downloadEML(subject: string, body: string, to: string) {
  const date = new Date().toUTCString();
  const headers = [
    `Date: ${date}`,
    `To: ${to || ""}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`
  ].join("\r\n");
  const eml = headers + "\r\n\r\n" + body.replace(/\n/g, "\r\n");
  const blob = new Blob([eml], { type: "message/rfc822" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (subject || "email").replace(/[^\w\-]+/g, "_") + ".eml";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function sanitizeRecipients(raw: string): string {
  if (!raw) return "";
  return raw
    .split(/[,;]+/)
    .map(e => e.trim())
    .filter(Boolean)
    .join(",");
}
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateRecipients(raw: string): { ok: boolean; bad: string[] } {
  const list = sanitizeRecipients(raw).split(",").filter(Boolean);
  const bad = list.filter(e => !isValidEmail(e));
  return { ok: bad.length === 0, bad };
}
function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:20px;right:20px;background:#0f141a;color:#e7eef7;border:1px solid #223042;padding:10px 12px;border-radius:10px;z-index:9999";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
  }
  toast("Copied!");
}
async function grammarCheck(text: string) {
  const res = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      text,
      language: "en-GB" // or en-US
    })
  });
  const data = await res.json();
  // apply suggestions (simple inline patch)
  let fixed = text;
  for (const m of (data.matches || []).reverse()) {
    const r = m.replacements?.[0]?.value;
    if (!r) continue;
    const offset = m.offset;
    const length = m.length;
    fixed = fixed.slice(0, offset) + r + fixed.slice(offset + length);
  }
  return fixed;
}

/* =========================
   Compose links (no OAuth)
   ========================= */
function encodeParam(v: string) { return encodeURIComponent(v || ""); }
function trimSubject(s: string) { return s.replace(/\r?\n/g, " ").trim().slice(0, 200); }

function openGmail(to: string, subject: string, body: string) {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeParam(to)}&su=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
  window.open(url, "_blank");
}
function openOutlook(to: string, subject: string, body: string) {
  const url = `https://outlook.live.com/owa/?path=/mail/action/compose&to=${encodeParam(to)}&subject=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
  window.open(url, "_blank");
}
function openYahoo(to: string, subject: string, body: string) {
  const url = `https://compose.mail.yahoo.com/?to=${encodeParam(to)}&subject=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
  window.open(url, "_blank");
}
function openMailto(to: string, subject: string, body: string) {
  const href = `mailto:${encodeParam(to)}?subject=${encodeParam(trimSubject(subject))}&body=${encodeParam(body)}`;
  window.location.href = href;
}

/* =========================
   Component
   ========================= */
export default function EmailGenerator() {
  const [values, setValues] = useState<Values>({
    title: "", date: "", participants: "",
    audience: "internal", tone: "concise", type: "follow-up",
    length: "medium", notes: "", to: ""
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(true);

  const toneTip = TONE_PREVIEW[values.tone];

  /* ---- Persistence ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem("nte_values_v2"); } catch {}
    const saved = sessionSafe.get(STORAGE_KEY);
    if (saved) {
      try { setValues(JSON.parse(saved)); } catch {}
    }
  }, []);
  useEffect(() => { sessionSafe.set(STORAGE_KEY, JSON.stringify(values)); }, [values]);
  useEffect(() => {
    const onPageHide = () => sessionSafe.remove(STORAGE_KEY);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  /* ---- Shortcuts ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "enter") {
        const form = document.querySelector("form");
        form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "c" && result) {
        copyToClipboard(`Subject: ${result.subject}\n\n${result.body}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  function set<K extends keyof Values>(k: K, v: Values[K]) {
    setValues(prev => ({ ...prev, [k]: v }));
  }

  /* ---- Generate ---- */
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
      const payload = {
        title: values.title, date: values.date, participants: values.participants,
        audience: values.audience, tone: values.tone, type: values.type,
        length: values.length, notes: values.notes
      };
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data); setPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const combinedPlain = useMemo(() => {
    if (!result) return "";
    return `Subject: ${result.subject}\n\n${result.body}`;
  }, [result]);

  /* ---- Render ---- */
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* ===== FORM ===== */}
      <form onSubmit={onGenerate} className="card p-4 sm:p-6 space-y-5">
        <div>
          <label>Recipient(s)</label>
          <input
            className="input mt-1 h-12"
            placeholder="to@example.com, second@example.com"
            value={values.to}
            onChange={(e) => set("to", e.target.value)}
            spellCheck={false}
          />
          {values.to && !validateRecipients(values.to).ok && (
            <p className="text-xs text-red-400 mt-1">
              Check: {validateRecipients(values.to).bad.join(", ")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Meeting Title</label>
            <input
              className="input mt-1 h-12"
              placeholder="Q3 Planning Sync"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
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
            />
          </div>
        </div>

        {/* Tone, audience, type */}
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
    
        {/* Tone preview */}
        <div className="flex flex-wrap gap-2 mb-4">
  {["concise","formal","friendly","persuasive","casual"].map((t) => (
    <button
      key={t}
      type="button"
      className="btn btn-ghost h-10"
      onClick={async () => {
        // call the same endpoint, only swapping tone; reuse existing form values
        const payload = {
          title: values.title,
          date: values.date,
          participants: values.participants,
          audience: values.audience,
          tone: t as any,
          type: values.type,
          length: values.length,
          notes: values.notes
        };
        setLoading(true);
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          setResult(data);
          setValues(v => ({ ...v, tone: t as any })); // update UI tone
        } finally {
          setLoading(false);
        }
      }}
    >
      Rewrite: {t}
    </button>
    
  ))}
</div>
        <div className="rounded-xl border border-[#1e2733] bg-[#0f141a] p-3">
          <p className="text-xs text-slate-400 mb-1">Tone preview</p>
          <div className="text-sm">
            <p>{toneTip.intro}</p>
            <p className="text-slate-400">Sign-off: {toneTip.signoff}</p>
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
            <button type="button" onClick={() => set("notes", SAMPLE_NOTES)} className="text-xs text-slate-400">Insert sample</button>
          </div>
          <textarea
            className="input mt-1 min-h-[160px]"
            placeholder="- Discussed launch slip…"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        <div>
    <button
  type="button"
  className="btn btn-ghost h-12"
  onClick={async () => {
    if (!result) return;
    const fixed = await grammarCheck(result.body);
    setResult({ ...result, body: fixed });
    toast("Grammar pass applied");
  }}
>
  Check grammar
</button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-2">
          <button className="btn btn-primary h-12" disabled={loading}>
            {loading ? "Generating…" : "Generate Email"}
          </button>
          <button type="button" className="btn btn-ghost h-12" onClick={() => { setResult(null); set("notes",""); }}>
            Clear
          </button>
        </div>
      </form>

      {/* ===== PREVIEW ===== */}
      <div className="card p-4 sm:p-6">
        {!result && !loading && <p className="text-slate-400">Generate to see the email preview.</p>}
        {loading && <p className="text-slate-400">Loading…</p>}

        {result && !loading && (
          <>
            <div className="flex gap-2 mb-4">
              <button className="btn btn-ghost" onClick={() => copyToClipboard(result.subject)}>Copy Subject</button>
              <button className="btn btn-ghost" onClick={() => copyToClipboard(result.body)}>Copy Body</button>
              <button className="btn btn-primary" onClick={() => copyToClipboard(combinedPlain)}>Copy Both</button>
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 mb-4">
              <button className="btn btn-ghost" onClick={() => openGmail(sanitizeRecipients(values.to),result.subject,result.body)}>Gmail</button>
              <button className="btn btn-ghost" onClick={() => openOutlook(sanitizeRecipients(values.to),result.subject,result.body)}>Outlook</button>
              <button className="btn btn-ghost" onClick={() => openYahoo(sanitizeRecipients(values.to),result.subject,result.body)}>Yahoo</button>
              <button className="btn btn-ghost" onClick={() => openMailto(sanitizeRecipients(values.to),result.subject,result.body)}>Mail App</button>
              <button type="button" className="btn btn-ghost h-12"onClick={() => downloadEML(result.subject, result.body, sanitizeRecipients(values.to))}>Download .eml</button>
            </div>

            <div>
              <label>Subject</label>
              <input className="input mt-1 h-12" value={result.subject} onChange={(e)=>setResult({...result, subject:e.target.value})}/>
            </div>
            <div>
              <label>Body</label>
              <textarea className="input mt-1 min-h-[420px] sm:min-h-[520px] resize-y whitespace-pre-wrap break-words" value={result.body} onChange={(e)=>setResult({...result, body:e.target.value})}/>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
