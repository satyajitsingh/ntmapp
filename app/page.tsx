export const dynamic = "force-dynamic";
export const revalidate = 0;

import EmailGenerator from "@/components/EmailGenerator";

export default function Page() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1>Notes → Sendable Email</h1>
        <p className="text-slate-400 mt-2">
          Paste meeting notes, pick tone and audience, and get a client-ready email in seconds.
        </p>
      </header>
      <EmailGenerator />
      <footer className="mt-16 text-center text-slate-500 text-sm">
        <span>Free demo. No signup required.</span>
      </footer>
    </main>
  );
}
