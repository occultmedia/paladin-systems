"use client";

/* Profile editor: photo, company logo, who you are and how members reach you. */

import { AnimatePresence, motion } from "framer-motion";
import { Building2, Camera, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ROLES } from "@/lib/auth";
import { resizeImage } from "@/lib/images";
import { initialsOf, profileComplete, type Profile } from "@/lib/profile";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Modal shell: bottom sheet on phones, centred card on larger screens. */
export function Dialog({ open, onClose, title, children, wide = false, top = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean; /** Above the full-screen map. */ top?: boolean }) {
  useEffect(() => {
    if (!open) return;
    // Capture phase: Esc closes this dialog only, not the full-screen map underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 ${top ? "z-[1400]" : "z-[1200]"} flex items-end justify-center bg-zinc-950/60 backdrop-blur-sm sm:items-center sm:p-6`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            data-lenis-prevent
            className={`max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-xl" : "sm:max-w-lg"}`}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-5 py-4 backdrop-blur">
              <h2 className="font-display text-[17px] font-bold text-zinc-950">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950">
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Round photo with the company logo as a small badge. */
export function Avatar({ name, photo, logo, size = 44 }: { name: string; photo?: string; logo?: string; size?: number }) {
  const badge = Math.round(size * 0.46);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="size-full rounded-full object-cover ring-1 ring-zinc-200" />
      ) : (
        <span className="grid size-full place-items-center rounded-full bg-zinc-950 font-display font-bold text-lime" style={{ fontSize: size * 0.36 }}>
          {initialsOf(name)}
        </span>
      )}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="absolute -bottom-1 -right-1 rounded-md bg-white object-contain p-[2px] shadow-sm ring-1 ring-zinc-200"
          style={{ width: badge, height: badge }}
        />
      )}
    </span>
  );
}

export function ImagePick({ label, hint, value, round, onChange, onError }: { label: string; hint: string; value?: string; round: boolean; onChange: (v?: string) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const Icon = round ? Camera : Building2;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`group relative grid size-[72px] shrink-0 place-items-center overflow-hidden border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition-colors hover:border-zinc-950 hover:text-zinc-950 ${round ? "rounded-full" : "rounded-xl"}`}
        aria-label={value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={`size-full ${round ? "object-cover" : "bg-white object-contain p-1.5"}`} />
        ) : (
          <Icon size={20} strokeWidth={1.6} />
        )}
        {value && !busy && (
          <span className="absolute inset-0 grid place-items-center bg-zinc-950/55 text-[10.5px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">Change</span>
        )}
      </button>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-zinc-950">{label}</p>
        <p className="text-[11.5px] leading-snug text-zinc-500">{hint}</p>
        <div className="mt-1.5 flex gap-3 text-[12px]">
          <button type="button" onClick={() => ref.current?.click()} className="font-semibold text-zinc-950 underline-offset-4 hover:underline">
            {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-950">
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onChange(await resizeImage(f, { mode: round ? "cover" : "contain", size: round ? 320 : 256 }));
          } catch (err) {
            onError(err instanceof Error ? err.message : "Upload failed.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[14px] text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950";

function Field({ label, children, hint }: { label: string; children: (id: string) => React.ReactNode; hint?: string }) {
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

export function ProfileDialog({ open, onClose, initial, onSave, shared }: { open: boolean; onClose: () => void; initial: Profile; onSave: (p: Profile) => Promise<void> | void; shared: boolean }) {
  const [p, setP] = useState<Profile>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form each time it opens (not on every parent render).
  useEffect(() => {
    if (open) {
      setP(initial);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} title="Your profile">
      <form
        className="space-y-5 px-5 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!profileComplete(p)) return setError("Add your name and at least one way to reach you (email, phone or WhatsApp).");
          setSaving(true);
          setError(null);
          try {
            await onSave(p);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save your profile.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <p className="text-[12.5px] leading-relaxed text-zinc-500">This is how other members see you on the Market feed. They contact you using the details below.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <ImagePick label="Your photo" hint="A clear headshot. Square works best." value={p.photo} round onChange={(v) => set("photo", v)} onError={setError} />
          <ImagePick label="Company logo" hint="PNG with a transparent background looks best." value={p.logo} round={false} onChange={(v) => set("logo", v)} onError={setError} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">{(id) => <input id={id} className={field} value={p.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />}</Field>
          <Field label="Company">{(id) => <input id={id} className={field} value={p.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" placeholder="Agency or firm" />}</Field>
        </div>

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
                className={`relative rounded-full py-1.5 text-[12.5px] font-semibold transition-colors ${p.role === r ? "text-white" : "text-zinc-600 hover:text-zinc-950"}`}
              >
                {p.role === r && <motion.span layoutId="profile-role" className="absolute inset-0 rounded-full bg-zinc-950" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative">{r === "Agent" ? "An agent" : r === "Investor" ? "An investor" : "A brokerage"}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Job title (optional)">{(id) => <input id={id} className={field} value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Broker / Owner" />}</Field>

        <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4">
          <legend className="px-1 text-[12.5px] font-semibold text-zinc-950">How members contact you</legend>
          <Field label="WhatsApp" hint="With country code, e.g. +297 560 0000">
            {(id) => <input id={id} className={field} value={p.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" autoComplete="tel" />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone">{(id) => <input id={id} className={field} value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" />}</Field>
            <Field label="Email">{(id) => <input id={id} type="email" className={field} value={p.email ?? ""} onChange={(e) => set("email", e.target.value)} autoComplete="email" />}</Field>
          </div>
        </fieldset>

        {error && <p className="rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] text-zinc-500">{shared ? "Visible to every Terminal member." : "Saved on this device until accounts open."}</p>
          <button
            type="submit"
            disabled={saving}
            className="shine inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 font-display text-[13.5px] font-semibold text-lime transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save profile
          </button>
        </div>
      </form>
    </Dialog>
  );
}
