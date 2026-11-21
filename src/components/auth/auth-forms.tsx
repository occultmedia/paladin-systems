"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Mail } from "lucide-react";
import { useId, useState } from "react";
import { AIBadge, AIMarketScan, Spotlight, type ScanRow } from "@/components/ai/ai-visuals";
import { ImagePick } from "@/components/feed/profile-dialog";
import { Wordmark } from "@/components/logo";
import { ROLES, logIn, sendReset, signUp, type AuthResult, type Role } from "@/lib/auth";
import { saveSignupProfile } from "@/lib/profile";
import { CONTACT_EMAIL, PLANS, YEARLY_SAVINGS_USD, type Billing } from "@/lib/site";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── layout ─────────────────────────────────────────────────────────────── */

export function AuthShell({
  children,
  rows,
  total,
  headline,
}: {
  children: React.ReactNode;
  rows: ScanRow[];
  total: number;
  headline: string;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-white font-sans text-zinc-800 antialiased lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-5 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Sequence Terminal home">
            <Wordmark />
          </Link>
          <Link href="/" className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
            <ArrowLeft size={14} strokeWidth={2} className="transition-transform group-hover:-translate-x-0.5" />
            Back to site
          </Link>
        </div>
        <motion.main
          id="main"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12"
        >
          {children}
        </motion.main>
        <p className="text-center text-[11.5px] text-zinc-400 lg:text-left">© 2026 Sequence Terminal by Sequence Data · Aruba</p>
      </div>

      <Spotlight className="relative hidden overflow-hidden bg-zinc-950 lg:sticky lg:top-0 lg:block lg:h-dvh">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgb(221_229_220/0.10)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div className="relative flex h-full flex-col justify-center px-12 py-16 xl:px-20">
          <AIBadge dark />
          <h2 className="mt-6 max-w-[18ch] font-display text-[34px] font-bold leading-[1.08] tracking-tight text-white xl:text-[40px]">
            Sequence Terminal read {total} Aruba listings this morning.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-zinc-400">
            Every listing is checked against its comps, its price history and its status, then explained in plain English.
          </p>
          <AIMarketScan dark rows={rows} total={total} headline={headline} className="mt-10 max-w-[520px]" />
          <ul className="mt-10 grid max-w-[520px] grid-cols-3 gap-4 border-t border-white/10 pt-6 text-[12.5px] text-zinc-400">
            {["Daily market briefing", "AI note on every listing", "Watchlist and client leads"].map((t) => (
              <li key={t} className="flex gap-2">
                <Check size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-mint" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Spotlight>
    </div>
  );
}

/* ── fields ─────────────────────────────────────────────────────────────── */

const inputCls =
  "h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-[15px] text-zinc-950 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-950 focus:shadow-[0_0_0_4px_rgb(221_229_220)]";

function Field({ label, children, hint }: { label: string; children: (id: string) => React.ReactNode; hint?: React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-zinc-800">
          {label}
        </label>
        {hint}
      </div>
      {children(id)}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} pr-12`}
        placeholder="At least 8 characters"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
      >
        {show ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
      </button>
    </div>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function Strength({ pw }: { pw: string }) {
  const s = strength(pw);
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][s];
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="h-1 rounded-full bg-zinc-100"
            animate={{ backgroundColor: i < s ? (s >= 3 ? "#1F7A45" : s === 2 ? "#E08A1E" : "#D64545") : "#F4F4F5" }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
      <span className="w-16 text-right text-[11.5px] text-zinc-500">{pw ? label : ""}</span>
    </div>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="shine group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 font-display text-[15px] font-semibold text-mint transition-[background-color,transform] hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
    >
      {busy ? (
        <span className="size-4 animate-spin rounded-full border-2 border-mint border-t-transparent" />
      ) : (
        <>
          {children}
          <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

function Notice({ result }: { result: AuthResult | null }) {
  return (
    <AnimatePresence>
      {result && !result.ok && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
          role="alert"
        >
          {result.error === "not-configured" ? (
            <p className="mt-4 rounded-xl border border-mint-deep bg-mint-soft px-4 py-3 text-[13px] leading-relaxed text-zinc-800">
              Accounts open very soon. For early access, email{" "}
              <a className="font-semibold underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}?subject=Sequence%20Terminal%20early%20access`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ) : (
            <p className="mt-4 rounded-xl border border-[#F3C9C9] bg-[#FDF2F2] px-4 py-3 text-[13px] text-[#9B2C2C]">{result.error}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Done({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }} className="text-center">
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="mx-auto grid size-14 place-items-center rounded-2xl bg-zinc-950 text-mint"
      >
        <Mail size={24} strokeWidth={1.75} />
      </motion.span>
      <h1 className="mt-6 font-display text-[28px] font-bold tracking-tight text-zinc-950">{title}</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-600">{body}</p>
    </motion.div>
  );
}

/* ── log in ─────────────────────────────────────────────────────────────── */

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset" | "sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  if (mode === "sent")
    return (
      <Done
        title="Check your inbox"
        body={
          <>
            If an account exists for <b className="text-zinc-950">{email}</b>, a reset link is on its way.{" "}
            <button type="button" className="font-semibold text-zinc-950 underline underline-offset-2" onClick={() => setMode("login")}>
              Back to log in
            </button>
          </>
        }
      />
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const r = mode === "login" ? await logIn(email, password) : await sendReset(email);
    setBusy(false);
    if (r.ok) return mode === "login" ? router.push("/dashboard") : setMode("sent");
    setResult(r);
  };

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-zinc-950">{mode === "login" ? "Welcome back" : "Reset your password"}</h1>
      <p className="mt-2 text-[15px] text-zinc-500">
        {mode === "login" ? "Log in to see today's market briefing." : "Enter your email and we will send you a reset link."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Email">
          {(id) => <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@agency.aw" />}
        </Field>
        {mode === "login" && (
          <Field
            label="Password"
            hint={
              <button type="button" onClick={() => setMode("reset")} className="text-[12.5px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
                Forgot password?
              </button>
            }
          >
            {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" />}
          </Field>
        )}
        <SubmitButton busy={busy}>{mode === "login" ? "Log in" : "Send reset link"}</SubmitButton>
        <Notice result={result} />
      </form>
      <p className="mt-8 text-center text-[14px] text-zinc-500">
        {mode === "login" ? (
          <>
            New to Sequence Terminal?{" "}
            <Link href="/signup" className="font-semibold text-zinc-950 underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <button type="button" onClick={() => setMode("login")} className="font-semibold text-zinc-950 underline-offset-4 hover:underline">
            Back to log in
          </button>
        )}
      </p>
    </>
  );
}

/* ── sign up ────────────────────────────────────────────────────────────── */

function StepLabel({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
      <span className="flex gap-1">
        {[1, 2].map((i) => (
          <span key={i} className={`h-1 w-6 rounded-full transition-colors ${i <= step ? "bg-zinc-950" : "bg-zinc-200"}`} />
        ))}
      </span>
      Step {step} of 2 · {step === 1 ? "Account" : "Profile"}
    </div>
  );
}

export function SignupForm({ initialPlan = "monthly" }: { initialPlan?: Billing }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("Agent");
  const [plan, setPlan] = useState<Billing>(initialPlan);
  const [step, setStep] = useState<1 | 2>(1);
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [logo, setLogo] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <Done
        title="Confirm your email"
        body={
          <>
            We sent a link to <b className="text-zinc-950">{email}</b>. Open it to finish setting up your Sequence Terminal account.
          </>
        }
      />
    );

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    if (strength(password) < 1) return setResult({ ok: false, error: "Use a password of at least 8 characters." });
    setResult(null);
    setStep(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== "Investor" && !company.trim()) return setResult({ ok: false, error: "Add your company or brokerage name." });
    setBusy(true);
    setResult(null);
    try {
      saveSignupProfile({ name: name.trim(), role, company: company.trim(), title: title.trim() || undefined, email: email.trim(), whatsapp: whatsapp.trim() || undefined, photo, logo });
    } catch (err) {
      setBusy(false);
      return setResult({ ok: false, error: err instanceof Error ? err.message : "Could not save your profile." });
    }
    const r = await signUp({ name, email, password, role, plan, company, title, whatsapp });
    setBusy(false);
    if (r.ok) return r.message === "confirm-email" ? setSent(true) : router.push("/dashboard");
    setResult(r);
  };

  if (step === 2)
    return (
      <>
        <StepLabel step={2} />
        <h1 className="mt-3 font-display text-[32px] font-bold tracking-tight text-zinc-950">Your member profile</h1>
        <p className="mt-2 text-[15px] text-zinc-500">This is how other agents and investors see you on the Feed, and how they reach you.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ImagePick label="Your photo" hint="A clear headshot" value={photo} round onChange={setPhoto} onError={(m) => setResult({ ok: false, error: m })} />
            <ImagePick label="Company logo" hint="PNG with a clear background" value={logo} round={false} onChange={setLogo} onError={(m) => setResult({ ok: false, error: m })} />
          </div>
          <Field label={role === "Investor" ? "Company (optional)" : role === "Brokerage" ? "Brokerage name" : "Company or brokerage"}>
            {(id) => <input id={id} required={role !== "Investor"} autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="Brightwater Realty" />}
          </Field>
          <Field label="Job title (optional)">
            {(id) => <input id={id} autoComplete="organization-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Senior agent" />}
          </Field>
          <Field label="WhatsApp or mobile" hint={<span className="text-[12px] text-zinc-400">Shown to members</span>}>
            {(id) => <input id={id} type="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="+297 560 0000" />}
          </Field>
          <SubmitButton busy={busy}>Create account</SubmitButton>
          <Notice result={result} />
          <p className="text-center text-[12px] text-zinc-400">You won&apos;t be charged today. You can change your profile any time.</p>
        </form>
        <p className="mt-6 text-center text-[14px] text-zinc-500">
          <button type="button" onClick={() => { setResult(null); setStep(1); }} className="inline-flex items-center gap-1.5 font-semibold text-zinc-950 underline-offset-4 hover:underline">
            <ArrowLeft size={14} /> Back
          </button>
        </p>
      </>
    );

  return (
    <>
      <StepLabel step={1} />
      <h1 className="mt-3 font-display text-[32px] font-bold tracking-tight text-zinc-950">Create your account</h1>
      <p className="mt-2 text-[15px] text-zinc-500">The whole Aruba market, read for you every morning.</p>
      <form onSubmit={next} className="mt-8 space-y-5">
        <Field label="Full name">
          {(id) => <input id={id} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Maria Croes" />}
        </Field>
        <Field label="Work email">
          {(id) => <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@agency.aw" />}
        </Field>
        <Field label="Password">
          {(id) => (
            <>
              <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password" />
              <Strength pw={password} />
            </>
          )}
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-zinc-800">I am</legend>
          <div className="relative grid grid-cols-3 rounded-xl bg-zinc-100 p-1">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={`relative h-9 rounded-lg text-[13px] font-semibold transition-colors ${role === r ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {role === r && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="relative">{r === "Brokerage" ? "A brokerage" : `An ${r.toLowerCase()}`}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-zinc-800">Plan</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["monthly", "yearly"] as const).map((b) => {
              const on = plan === b;
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPlan(b)}
                  className={`relative rounded-xl border p-4 text-left transition-[border-color,box-shadow,transform] active:scale-[0.99] ${on ? "border-zinc-950 shadow-[0_0_0_3px_rgb(221_229_220)]" : "border-zinc-200 hover:border-zinc-300"}`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-zinc-950">{b === "monthly" ? "Monthly" : "Yearly"}</span>
                    <span className={`grid size-4 place-items-center rounded-full border ${on ? "border-zinc-950 bg-zinc-950" : "border-zinc-300"}`}>
                      {on && <Check size={10} strokeWidth={3.5} className="text-mint" />}
                    </span>
                  </span>
                  <span className="mt-2 block font-display text-[22px] font-bold leading-none tracking-tight text-zinc-950">
                    ${PLANS[b].price.toLocaleString("en-US")}
                    <span className="text-[12px] font-semibold text-zinc-500">/{PLANS[b].per}</span>
                  </span>
                  <span className="mt-1.5 block text-[11.5px] text-zinc-500">{b === "monthly" ? "Cancel anytime" : `Save $${YEARLY_SAVINGS_USD} a year`}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <SubmitButton busy={false}>Continue</SubmitButton>
        <Notice result={result} />
        <p className="text-center text-[12px] text-zinc-400">Next: your photo, company logo and contact details.</p>
      </form>
      <p className="mt-6 text-center text-[14px] text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-zinc-950 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
