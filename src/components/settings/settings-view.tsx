"use client";

/*
 * Settings tab: your member profile (photo, company logo, name, role,
 * company), the contact details other members use to reach you, billing and
 * payment preferences, your plan (Standard or Pro), and account access. Profile + contact save together;
 * billing saves on its own.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, LogOut, Mail } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { ImagePick } from "@/components/feed/profile-dialog";
import { GrainField } from "@/components/landing/grain-field";
import { ROLES, logOut, sendReset, useUser } from "@/lib/auth";
import { DEFAULT_BILLING, PAY_METHODS, useBilling, type BillingPrefs, type PayMethod } from "@/lib/billing";
import { profileComplete, type Profile } from "@/lib/profile";
import { PLANS, PLAN_ORDER, PRO_FEATURES, fmtPlanPrice } from "@/lib/site";
import { usePlan } from "@/lib/plan";
import { UpgradeButton } from "@/components/dashboard/pro-view";

const EASE = [0.22, 1, 0.36, 1] as const;
const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[14px] text-zinc-950 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950 focus:shadow-[0_0_0_3px_rgb(172_250_104/0.45)]";

const SECTIONS = [
  ["profile", "Profile"],
  ["contact", "Contact info"],
  ["plan", "Plan"],
  ["billing", "Billing & payment"],
  ["account", "Account"],
] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-[11.5px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function Card({ id, title, text, children }: { id: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section id={`settings-${id}`} className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white">
      <header className="border-b border-zinc-100 px-5 py-4 sm:px-6">
        <h2 className="font-display text-[17px] font-bold text-zinc-950">{title}</h2>
        <p className="mt-0.5 text-[12.5px] text-zinc-500">{text}</p>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function Saved({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1F7A45]">
          <Check size={14} strokeWidth={2.5} /> Saved
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ── profile + contact ───────────────────────────────────────────────── */

function ProfileForm({ initial, onSave, shared }: { initial: Profile; onSave: (p: Profile) => Promise<void> | void; shared: boolean }) {
  const [p, setP] = useState<Profile>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [base, setBase] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(p) !== base;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileComplete(p)) return setError("Add your name and at least one way to reach you (WhatsApp, phone or email).");
    setSaving(true);
    setError(null);
    try {
      await onSave(p);
      setBase(JSON.stringify(p));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card id="profile" title="Profile" text="How you appear on the Market feed and to the members you contact.">
        <div className="grid gap-5 sm:grid-cols-2">
          <ImagePick label="Profile photo" hint="A clear headshot. Square works best." value={p.photo} round onChange={(v) => set("photo", v)} onError={setError} />
          <ImagePick label="Company logo" hint="PNG with a transparent background looks best." value={p.logo} round={false} onChange={(v) => set("logo", v)} onError={setError} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">{(id) => <input id={id} className={field} value={p.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />}</Field>
          <Field label="Job title (optional)">{(id) => <input id={id} className={field} value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Broker / Owner" />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company or brokerage">{(id) => <input id={id} className={field} value={p.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" />}</Field>
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-zinc-700">I am</p>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-zinc-100 p-1" role="radiogroup" aria-label="Role">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={p.role === r}
                  onClick={() => set("role", r)}
                  className={`relative rounded-full py-1.5 text-[12.5px] font-semibold transition-colors ${p.role === r ? "text-lime" : "text-zinc-600 hover:text-zinc-950"}`}
                >
                  {p.role === r && <motion.span layoutId="settings-role" className="absolute inset-0 rounded-full bg-zinc-950" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <span className="relative">{r}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card id="contact" title="Contact info" text="Members reach you with these when they answer one of your posts. Add at least one.">
        <Field label="WhatsApp" hint="With country code, e.g. +297 560 0000. Shown as a WhatsApp button on your posts.">
          {(id) => <input id={id} className={field} value={p.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" autoComplete="tel" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">{(id) => <input id={id} className={field} value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" />}</Field>
          <Field label="Contact email">{(id) => <input id={id} type="email" className={field} value={p.email ?? ""} onChange={(e) => set("email", e.target.value)} autoComplete="email" />}</Field>
        </div>
      </Card>

      {/* save bar: sticks to the bottom while there are unsaved changes */}
      <div className={`${dirty ? "sticky" : ""} bottom-4 z-20`}>
        <div className={`flex flex-col gap-3 rounded-2xl px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${dirty ? "bg-zinc-950 text-white shadow-2xl" : "border border-zinc-200 bg-white"}`}>
          <p className={`text-[12.5px] ${dirty ? "text-zinc-300" : "text-zinc-500"}`}>
            {error ? <span className="text-[#F28B82]">{error}</span> : dirty ? "You have unsaved changes." : shared ? "Visible to every Terminal member." : "Saved on this device until your account is live."}
          </p>
          <div className="flex items-center gap-3">
            <Saved show={saved && !dirty} />
            {dirty && (
              <button type="button" onClick={() => { setP(JSON.parse(base)); setError(null); }} className="text-[12.5px] font-semibold text-zinc-400 hover:text-white">
                Discard
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2 font-display text-[13px] font-semibold text-zinc-950 transition-[background-color,opacity] hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save profile
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ── plan ────────────────────────────────────────────────────────────── */

function PlanCard() {
  const { plan, requested } = usePlan();
  return (
    <Card id="plan" title="Plan" text="Both plans are billed once a year. Pro adds property auctions and social media listings.">
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_ORDER.map((k) => {
          const on = plan === k;
          return (
            <div key={k} className={`relative rounded-xl border p-4 ${on ? "border-zinc-950 shadow-[0_0_0_3px_rgb(172_250_104/0.55)]" : "border-zinc-200"}`}>
              <span className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-zinc-950">{PLANS[k].name}</span>
                {on && <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10.5px] font-semibold text-lime">Your plan</span>}
                {!on && k === "pro" && requested !== null && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600">Requested</span>}
              </span>
              <span className="mt-2 block font-display text-[22px] font-bold leading-none text-zinc-950">
                ${PLANS[k].price.toLocaleString("en-US")}
                <span className="text-[12px] font-semibold text-zinc-500">/{PLANS[k].per}</span>
              </span>
              <span className="mt-1.5 block text-[11.5px] leading-snug text-zinc-500">{PLANS[k].blurb}</span>
              {k === "pro" && (
                <ul className="mt-3 space-y-1">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-zinc-700">
                      <Check size={12} strokeWidth={2.5} className="text-zinc-950" /> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {plan === "standard" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="max-w-md text-[11.5px] leading-relaxed text-zinc-500">
            {requested !== null
              ? "We have your request. Pro opens on your account as soon as the Pro invoice is paid."
              : `Upgrading moves you from ${fmtPlanPrice("standard")} to ${fmtPlanPrice("pro")}. We email the invoice; Pro opens as soon as it is paid. You are not charged now.`}
          </p>
          <UpgradeButton />
        </div>
      ) : (
        <p className="border-t border-zinc-100 pt-4 text-[11.5px] text-zinc-500">You have everything in Terminal, auctions and social media listings included.</p>
      )}
    </Card>
  );
}

/* ── billing ─────────────────────────────────────────────────────────── */

function BillingForm({ initial, onSave, shared }: { initial: BillingPrefs; onSave: (b: BillingPrefs) => Promise<void>; shared: boolean }) {
  const [b, setB] = useState<BillingPrefs>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BillingPrefs>(k: K, v: BillingPrefs[K]) => {
    setSaved(false);
    setB((x) => ({ ...x, [k]: v }));
  };

  return (
    <Card id="billing" title="Billing & payment" text="How you would like to pay and where invoices go.">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (b.billing_email && !/^\S+@\S+\.\S+$/.test(b.billing_email)) return setError("Enter a valid billing email.");
          setSaving(true);
          setError(null);
          try {
            await onSave({ ...b, billing_email: b.billing_email.trim(), invoice_name: b.invoice_name.trim(), tax_id: b.tax_id?.trim() || undefined, address: b.address?.trim() || undefined });
            setSaved(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-zinc-700">How would you like to pay?</legend>
          <div className="grid gap-2">
            {(Object.keys(PAY_METHODS) as PayMethod[]).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-[13.5px] transition-colors ${b.method === k ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 text-zinc-800 hover:border-zinc-500"}`}
              >
                <input type="radio" name="pay-method" className="sr-only" checked={b.method === k} onChange={() => set("method", k)} />
                <span className={`grid size-4 place-items-center rounded-full border ${b.method === k ? "border-lime" : "border-zinc-400"}`}>
                  {b.method === k && <span className="size-2 rounded-full bg-lime" />}
                </span>
                {PAY_METHODS[k]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
            You are not charged yet. When billing opens, card details are entered on the payment provider&apos;s secure checkout; Terminal never stores card or bank numbers.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Billing email" hint="Invoices and receipts go here.">
            {(id) => <input id={id} type="email" className={field} value={b.billing_email} onChange={(e) => set("billing_email", e.target.value)} autoComplete="email" />}
          </Field>
          <Field label="Name on invoice">{(id) => <input id={id} className={field} value={b.invoice_name} onChange={(e) => set("invoice_name", e.target.value)} placeholder="You or your company" autoComplete="organization" />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="KvK / tax number (optional)">{(id) => <input id={id} className={field} value={b.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />}</Field>
          <Field label="Billing address (optional)">{(id) => <input id={id} className={field} value={b.address ?? ""} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />}</Field>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-zinc-200 px-3.5 py-3">
          <span>
            <span className="block text-[13.5px] font-medium text-zinc-950">Email me a receipt for every payment</span>
            <span className="block text-[11.5px] text-zinc-500">Sent to your billing email.</span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={b.receipts} onChange={(e) => set("receipts", e.target.checked)} />
          <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-zinc-200 transition-colors peer-checked:bg-zinc-950 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-zinc-950 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-lime" />
        </label>

        {error && <p className="rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="text-[11.5px] text-zinc-500">{shared ? "Saved to your account." : "Saved on this device until your account is live."}</p>
          <div className="flex items-center gap-3">
            <Saved show={saved} />
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 font-display text-[13px] font-semibold text-lime transition-colors hover:bg-zinc-800 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save billing
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/* ── account ─────────────────────────────────────────────────────────── */

function AccountCard() {
  const { user } = useUser();
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Card id="account" title="Account" text="Sign-in details and access.">
      {user ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] text-zinc-500">Signed in as</p>
              <p className="text-[14px] font-semibold text-zinc-950">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const r = await sendReset(user.email ?? "");
                setSent(r.ok ? "Check your inbox for a link to set a new password." : r.error);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-[12.5px] font-semibold text-zinc-800 transition-colors hover:border-zinc-950"
            >
              <Mail size={14} /> Change password
            </button>
          </div>
          {sent && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[12.5px] text-zinc-600">{sent}</p>}
          <button
            type="button"
            onClick={async () => {
              await logOut();
              router.push("/");
            }}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-zinc-500 transition-colors hover:text-[#B42318]"
          >
            <LogOut size={14} /> Log out
          </button>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[46ch] text-[13px] text-zinc-600">You are using a preview. Your settings are saved on this device. Create an account to keep them and appear on the Market feed.</p>
          <Link href="/signup" className="rounded-full bg-zinc-950 px-5 py-2 font-display text-[13px] font-semibold text-lime hover:bg-zinc-800">
            Create an account
          </Link>
        </div>
      )}
    </Card>
  );
}

/* ── tab ─────────────────────────────────────────────────────────────── */

const noop = () => () => {};

export function SettingsView({ profile, onSaveProfile, shared }: { profile: { draft: Profile; loading: boolean }; onSaveProfile: (p: Profile) => Promise<void> | void; shared: boolean }) {
  const billing = useBilling();
  // Forms take their starting values once; wait until saved values have been read in the browser.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [section, setSection] = useState<string>("profile");

  return (
    <div className="pb-16">
      <div className="deck bleed relative isolate">
        <GrainField variant="ink" particles={false} className="-z-10" />
        <div className="mx-auto max-w-[1400px] px-4 pb-7 pt-8 sm:px-6 sm:pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Your account</p>
          <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">Settings</h1>
          <p className="mt-1 max-w-xl text-[13px] text-zinc-400">Your profile, photo and company logo, how members contact you, and how you pay.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#settings-${id}`}
              onClick={() => setSection(id)}
              className={`relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors lg:rounded-lg ${section === id ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-950"}`}
            >
              {section === id && <motion.span layoutId="settings-nav" transition={{ duration: 0.3, ease: EASE }} className="absolute inset-0 rounded-full bg-lime/60 lg:rounded-lg" />}
              <span className="relative">{label}</span>
            </a>
          ))}
        </nav>

        <div className="min-w-0 max-w-[820px] space-y-6">
          {!hydrated || profile.loading ? (
            <div className="h-80 animate-pulse rounded-2xl bg-zinc-100" />
          ) : (
            <ProfileForm initial={profile.draft} onSave={onSaveProfile} shared={shared} />
          )}
          <PlanCard />
          {hydrated ? (
            <BillingForm key={billing.shared ? "account" : "device"} initial={billing.prefs ?? DEFAULT_BILLING} onSave={billing.save} shared={billing.shared} />
          ) : (
            <div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />
          )}
          <AccountCard />
        </div>
      </div>
    </div>
  );
}
