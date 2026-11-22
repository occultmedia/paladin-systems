"use client";

/*
 * Deals tab (the Deal Desk): a blind bid/ask board. Sellers post asks,
 * buyers post bids with a budget range. Named posts show the poster and
 * their contact buttons; blind posts show only the poster's role, members tap
 * "I'm interested" and the poster sees who responded and reaches out. No chat
 * on purpose. Posts delete themselves after 14 days.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, Clock, EyeOff, Loader2, Mail, MapPin, Megaphone, MessageCircle, Phone, Plus, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DISTRICT_CENTERS } from "@/lib/aruba-data";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABEL,
  BODY_MAX,
  DEAL_TTL_DAYS,
  POST_KINDS,
  POST_KIND_HINT,
  SIDE_LABEL,
  TITLE_MAX,
  sideOf,
  useFeed,
  type FeedPost,
  type NewPost,
  type PostKind,
  type Responder,
} from "@/lib/feed";
import type { AssetClass } from "@/lib/database.types";
import { profileComplete, type Profile } from "@/lib/profile";
import { Avatar, Dialog } from "./profile-dialog";
import { AttachedListing, ListingPicker } from "./listing-attachment";
import { GrainField } from "@/components/landing/grain-field";

const EASE = [0.22, 1, 0.36, 1] as const;
const DISTRICT_NAMES = Object.keys(DISTRICT_CENTERS);

export const KIND_STYLE: Record<PostKind, string> = {
  "Off-market": "bg-zinc-950 text-lime",
  "For sale": "bg-lime text-zinc-950",
  "Buyer request": "bg-[#E6EEF9] text-[#24508F]",
  "For rent": "bg-[#FBF1DE] text-[#8A5A12]",
  Partnership: "bg-[#EFE9F8] text-[#5B3E91]",
};

const priceLabel = (k: PostKind) => (k === "Buyer request" ? "Budget" : k === "For rent" ? "Monthly rent" : k === "Partnership" ? "Capital needed" : "Asking price");

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2)}M` : n >= 1e4 ? `$${Math.round(n / 1000)}k` : `$${n.toLocaleString("en-US")}`);

/** "$700k – $900k", "Up to $900k", "$2.15M", "$4,200/mo". */
export function fmtBudget(p: Pick<FeedPost, "kind" | "budget_min" | "budget_max">) {
  const { budget_min: lo, budget_max: hi } = p;
  if (lo === null && hi === null) return null;
  const range = lo !== null && hi !== null && lo !== hi ? `${money(lo)} – ${money(hi)}` : hi !== null ? (p.kind === "Buyer request" ? `Up to ${money(hi)}` : money(hi)) : `From ${money(lo!)}`;
  return p.kind === "For rent" ? `${range}/mo` : range;
}

export function timeAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

function expiresIn(expires: string) {
  const m = Math.max(0, Math.round((Date.parse(expires) - Date.now()) / 60000));
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h left` : `${Math.floor(h / 24)}d left`;
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

/* ── post card ─────────────────────────────────────────────────────────── */

function ContactRow({ post }: { post: Pick<FeedPost, "title" | "author"> }) {
  const a = post.author;
  const msg = `Hi ${a.name.split(" ")[0]}, about "${post.title}" on Terminal Deals.`;
  const links = [
    a.whatsapp && { href: `https://wa.me/${digits(a.whatsapp)}?text=${encodeURIComponent(msg)}`, label: "WhatsApp", icon: MessageCircle, primary: true },
    a.phone && { href: `tel:${a.phone.replace(/[^\d+]/g, "")}`, label: "Call", icon: Phone },
    a.email && { href: `mailto:${a.email}?subject=${encodeURIComponent(`Re: ${post.title}`)}&body=${encodeURIComponent(msg)}`, label: "Email", icon: Mail },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Mail; primary?: boolean }[];
  if (!links.length) return <p className="text-[12px] text-zinc-500">No contact details on this profile yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ href, label, icon: Icon, primary }) => (
        <a
          key={label}
          href={href}
          target={label === "WhatsApp" ? "_blank" : undefined}
          rel="noreferrer"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
            primary ? "bg-zinc-950 text-lime hover:bg-zinc-800" : "border border-zinc-300 text-zinc-800 hover:border-zinc-950 hover:text-zinc-950"
          }`}
        >
          <Icon size={14} strokeWidth={1.8} />
          {label}
        </a>
      ))}
    </div>
  );
}

function SideBadge({ post }: { post: FeedPost }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${
        post.side === "bid" ? "bg-white text-[#24508F] ring-[#24508F]/30" : "bg-white text-zinc-950 ring-zinc-950/20"
      }`}
    >
      {SIDE_LABEL[post.side]}
    </span>
  );
}

function Responders({ post, load }: { post: FeedPost; load?: (id: string) => Promise<Responder[]> }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Responder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open || list || !load) return;
    load(post.id)
      .then(setList)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Could not load."));
  }, [open, list, load, post.id]);
  const n = post.interest_count ?? 0;
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!n}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:text-zinc-950 disabled:font-normal disabled:text-zinc-500"
      >
        <Users size={13} /> {n ? `${n} interested · ${open ? "hide" : "see who"}` : "No responses yet"}
      </button>
      <AnimatePresence initial={false}>
        {open && n > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {err && <li className="text-[12px] text-[#B23A3A]">{err}</li>}
            {!list && !err && <li className="text-[12px] text-zinc-500">Loading…</li>}
            {list?.map((r) => (
              <li key={r.user_id} className="rounded-xl bg-zinc-50 p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.profile.name} photo={r.profile.photo} logo={r.profile.logo} size={32} />
                  <p className="min-w-0 flex-1 truncate text-[12.5px]">
                    <b className="text-zinc-950">{r.profile.name}</b>
                    <span className="text-zinc-500"> · {[r.profile.title || r.profile.role, r.profile.company].filter(Boolean).join(" · ")}</span>
                  </p>
                </div>
                {r.note && <p className="mt-1.5 text-[12px] text-zinc-600">“{r.note}”</p>}
                <div className="mt-2">
                  <ContactRow post={{ title: post.title, author: r.profile }} />
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PostCard({
  post,
  onDelete,
  onOpenListing,
  onInterest,
  loadResponders,
}: {
  post: FeedPost;
  onDelete: (id: string) => void;
  onOpenListing?: (id: string) => void;
  onInterest?: (id: string, on: boolean) => Promise<void>;
  loadResponders?: (id: string) => Promise<Responder[]>;
}) {
  const [contact, setContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = post.author;
  const budget = fmtBudget(post);
  const toggleInterest = async () => {
    if (!onInterest) return;
    setBusy(true);
    try {
      await onInterest(post.id, !post.interested);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="rounded-2xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-lg hover:shadow-zinc-900/5 sm:p-5"
    >
      <header className="flex items-start gap-3">
        {post.blind && !post.mine ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-950 text-lime" aria-hidden>
            <EyeOff size={18} strokeWidth={1.8} />
          </span>
        ) : (
          <Avatar name={a.name} photo={a.photo} logo={a.logo} size={44} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-zinc-950">
            {post.blind && !post.mine ? `Anonymous ${a.role.toLowerCase()}` : a.name}
            {post.mine && <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-px align-middle text-[10px] font-semibold text-zinc-600">You</span>}
            {post.blind && <span className="ml-2 rounded-full bg-zinc-950 px-1.5 py-px align-middle text-[10px] font-semibold text-lime">Blind</span>}
          </p>
          <p className="truncate text-[12px] text-zinc-500">
            {post.blind && !post.mine ? "Identity hidden until they reach out" : [a.title || a.role, a.company].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex gap-1.5">
            <SideBadge post={post} />
            <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${KIND_STYLE[post.kind]}`}>{post.kind}</span>
          </span>
          <span className="text-[11px] tabular-nums text-zinc-400" title={`Deleted automatically ${DEAL_TTL_DAYS} days after posting`} suppressHydrationWarning>
            {timeAgo(post.created_at)} · {expiresIn(post.expires_at)}
          </span>
        </div>
      </header>

      <h3 className="mt-4 font-display text-[16.5px] font-bold leading-snug text-zinc-950">{post.title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-600">{post.body}</p>
      <AttachedListing id={post.listing_id} onOpen={onOpenListing} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
        {budget && (
          <span className="text-zinc-500">
            {priceLabel(post.kind)} <b className="font-display text-[14px] tabular-nums text-zinc-950">{budget}</b>
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-zinc-600">
          <Building2 size={13} strokeWidth={1.8} /> {ASSET_CLASS_LABEL[post.asset_class]}
        </span>
        {post.district && (
          <span className="inline-flex items-center gap-1 text-zinc-600">
            <MapPin size={13} strokeWidth={1.8} /> {post.district}
          </span>
        )}
      </div>

      <footer className="mt-4 border-t border-zinc-100 pt-3">
        {post.mine ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Responders post={post} load={loadResponders} />
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500" suppressHydrationWarning>
                <Clock size={12} /> Deletes itself in {expiresIn(post.expires_at).replace(" left", "")}
              </span>
              <button
                type="button"
                onClick={() => window.confirm("Delete this post?") && onDelete(post.id)}
                className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-[#B23A3A]"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ) : post.blind ? (
          post.interested ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[12.5px] text-zinc-700">
                <span className="grid size-5 place-items-center rounded-full bg-lime text-zinc-950">
                  <Check size={12} strokeWidth={3} />
                </span>
                Interest sent. The poster sees your profile and contacts you.
              </span>
              <button type="button" onClick={toggleInterest} disabled={busy} className="text-[12px] text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline">
                Withdraw
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleInterest}
              disabled={busy || !onInterest}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-lime transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} strokeWidth={1.8} />}
              I&apos;m interested
            </button>
          )
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {contact ? (
              <motion.div key="c" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {post.sample ? (
                  <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-500">Sample post. Contact details appear on real member posts.</p>
                ) : (
                  <ContactRow post={post} />
                )}
              </motion.div>
            ) : (
              <motion.button
                key="b"
                type="button"
                onClick={() => setContact(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-lime transition-colors hover:bg-zinc-800"
              >
                <MessageCircle size={14} strokeWidth={1.8} />
                Contact {a.name.split(" ")[0]}
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </footer>
    </motion.article>
  );
}

/* ── composer ──────────────────────────────────────────────────────────── */

const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[14px] text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950";

function Composer({ open, onClose, onPost, author }: { open: boolean; onClose: () => void; onPost: (p: NewPost) => Promise<void>; author: Profile }) {
  const [kind, setKind] = useState<PostKind>("Off-market");
  const [asset, setAsset] = useState<AssetClass>("Property");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lo, setLo] = useState("");
  const [hi, setHi] = useState("");
  const [district, setDistrict] = useState("");
  const [listingId, setListingId] = useState<string | null>(null);
  const [blind, setBlind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bid = sideOf(kind) === "bid";

  const reset = () => {
    setTitle("");
    setBody("");
    setLo("");
    setHi("");
    setDistrict("");
    setListingId(null);
    setError(null);
  };
  const amount = (v: string) => (v.trim() ? Number(v.replace(/[^\d.]/g, "")) : null);

  return (
    <Dialog open={open} onClose={onClose} title="New deal" wide>
      <form
        className="space-y-5 px-5 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (title.trim().length < 6) return setError("Give the post a short headline (at least 6 characters).");
          if (body.trim().length < 20) return setError("Add a few details (at least 20 characters) so members know what it is.");
          const min = bid ? amount(lo) : null;
          const max = amount(hi);
          if ([min, max].some((n) => n !== null && (!Number.isFinite(n) || n <= 0))) return setError("Enter amounts as numbers, in US dollars.");
          if (min !== null && max !== null && max < min) return setError("The top of the budget is below the bottom.");
          setBusy(true);
          setError(null);
          try {
            await onPost({ kind, asset_class: asset, title: title.trim(), body: body.trim(), budget_min: min, budget_max: max, district: district || null, listing_id: listingId, blind });
            reset();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not post. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-zinc-700">What are you posting?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of post">
            {POST_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  kind === k ? "border-zinc-950 bg-zinc-950 text-lime" : "border-zinc-300 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            <b className="text-zinc-700">{bid ? "Bid" : "Ask"}:</b> {POST_KIND_HINT[kind]}.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-medium text-zinc-700">Asset class</p>
          <div className="inline-flex rounded-full bg-zinc-100 p-1" role="radiogroup" aria-label="Asset class">
            {ASSET_CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={asset === c}
                onClick={() => setAsset(c)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${asset === c ? "bg-zinc-950 text-lime" : "text-zinc-600 hover:text-zinc-950"}`}
              >
                {ASSET_CLASS_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="feed-title" className="mb-1.5 flex justify-between text-[12.5px] font-medium text-zinc-700">
            Headline <span className="tabular-nums text-zinc-400">{title.length}/{TITLE_MAX}</span>
          </label>
          <input id="feed-title" className={input} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={bid ? "e.g. Cash buyer for a 2-bed condo near Eagle Beach" : "e.g. 3-bed villa in Malmok, owner wants a quiet sale"} />
        </div>

        <div>
          <label htmlFor="feed-body" className="mb-1.5 flex justify-between text-[12.5px] font-medium text-zinc-700">
            Notes <span className="tabular-nums text-zinc-400">{body.length}/{BODY_MAX}</span>
          </label>
          <textarea id="feed-body" className={`${input} min-h-[110px] resize-y`} value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="Size, condition, terms, commission split, timing…" />
        </div>

        {!bid && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-zinc-700">Attach a listing (optional)</p>
            <ListingPicker
              value={listingId}
              onChange={(l) => {
                setListingId(l?.listing_id ?? null);
                // Fill the blanks from the listing; members can still edit them.
                if (l) setAsset(l.category);
                if (l && !district) setDistrict(l.district);
                if (l && !hi && kind !== "For rent") setHi(String(l.asking_price_usd));
              }}
            />
          </div>
        )}

        <div className={`grid gap-4 ${bid ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {bid && (
            <div>
              <label htmlFor="feed-lo" className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
                Budget from (USD)
              </label>
              <input id="feed-lo" className={`${input} tabular-nums`} inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value)} placeholder="700,000" />
            </div>
          )}
          <div>
            <label htmlFor="feed-hi" className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
              {bid ? "Budget up to (USD)" : `${priceLabel(kind)} (USD, optional)`}
            </label>
            <input id="feed-hi" className={`${input} tabular-nums`} inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} placeholder={kind === "For rent" ? "4,200" : bid ? "900,000" : "850,000"} />
          </div>
          <div>
            <label htmlFor="feed-district" className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
              Area (optional)
            </label>
            <select id="feed-district" className={input} value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">Anywhere in Aruba</option>
              {DISTRICT_NAMES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-zinc-50 p-3">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="mt-0.5 size-4 accent-zinc-950" />
          <span className="min-w-0 text-[12.5px] leading-relaxed text-zinc-600">
            <b className="text-zinc-950">Post blind</b> (recommended). Members see you as an anonymous {author.role.toLowerCase()}. They tap &ldquo;I&apos;m interested&rdquo;, you see who they are and decide who to contact.
            {!blind && (
              <>
                {" "}Posting as <b className="text-zinc-950">{author.name}</b>
                {author.company && <> · {author.company}</>}, with your contact buttons.
              </>
            )}
          </span>
        </label>

        {error && <p className="rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] text-zinc-500">Your post deletes itself after {DEAL_TTL_DAYS} days.</p>
          <button
            type="submit"
            disabled={busy}
            className="shine inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 font-display text-[13.5px] font-semibold text-lime transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Post to Deals
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── tab ───────────────────────────────────────────────────────────────── */

export function FeedView({
  profile,
  profileLoading,
  shared,
  onEditProfile,
  onOpenListing,
}: {
  profile: Profile | null;
  profileLoading: boolean;
  shared: boolean;
  onEditProfile: () => void;
  onOpenListing?: (id: string) => void;
}) {
  const router = useRouter();
  const ready = profileComplete(profile);
  const { posts, create, remove, setInterest, responders, loading, error } = useFeed(ready ? profile : null);
  const [kind, setKind] = useState<PostKind | "All">("All");
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState(false);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (kind === "All" || p.kind === kind) &&
        (!t || [p.title, p.body, p.district, p.blind ? null : p.author.name, p.blind ? null : p.author.company, p.listing_id].some((s) => s?.toLowerCase().includes(t))),
    );
  }, [posts, kind, q]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(POST_KINDS.map((k) => [k, 0])) as Record<PostKind, number>;
    posts.forEach((p) => c[p.kind]++);
    return c;
  }, [posts]);

  // Profiles are created with the account. Without one, posting starts at sign-up;
  // an older account missing a detail finishes it in the Profile editor.
  const startPost = () => {
    if (profileLoading) return;
    if (ready) return setComposing(true);
    if (profile) return onEditProfile();
    router.push("/signup");
  };

  return (
    <div className="pb-10">
      <div className="deck bleed relative isolate">
        <GrainField variant="band" className="-z-10" />
        <div className="mx-auto max-w-[1400px] px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Members only · Blind bid/ask · Posts last {DEAL_TTL_DAYS} days</p>
              <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">Deals</h1>
              <p className="mt-1 max-w-xl text-[13px] text-zinc-400">
                Bids and asks from agents, brokers and investors: off-market deals, buyer requests, rentals and partnerships. Post blind, and only reveal yourself to the members you choose.
              </p>
            </div>
            <button
              type="button"
              onClick={startPost}
              className="shine inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-display text-[13.5px] font-semibold text-zinc-950 transition-colors hover:bg-white"
            >
              <Plus size={15} strokeWidth={2.2} />
              New post
            </button>
          </div>

          <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {(["All", ...POST_KINDS] as const).map((k) => {
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={on}
                  className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                    on ? "bg-lime text-zinc-950" : "bg-white/[0.06] text-zinc-300 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
                  }`}
                >
                  {k}
                  <span className={`tabular-nums text-[11px] ${on ? "text-zinc-700" : "text-zinc-500"}`}>{k === "All" ? posts.length : counts[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Posts" className="min-w-0">
          <label className="relative mb-4 block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <span className="sr-only">Search deals</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search deals, areas or a listing ID"
              className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950"
            />
          </label>

          {error && <p className="mb-4 rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">Deals could not load: {error}</p>}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-zinc-100" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center">
              <Megaphone size={22} className="mx-auto text-zinc-400" />
              <p className="mt-3 font-display text-[16px] font-bold text-zinc-950">{posts.length ? "No posts match" : `Nothing posted in the last ${DEAL_TTL_DAYS} days`}</p>
              <p className="mt-1 text-[13px] text-zinc-500">{posts.length ? "Try another type or search." : "Be the first to post."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {shown.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    onOpenListing={onOpenListing}
                    onInterest={setInterest}
                    loadResponders={responders}
                    onDelete={(id) => void remove(id).catch((e) => window.alert(e instanceof Error ? e.message : "Could not delete."))}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="deck relative isolate overflow-hidden rounded-2xl p-5 [background-attachment:scroll]">
            <GrainField variant="ink" className="-z-10" />
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
              <ShieldCheck size={13} className="text-lime" /> How Deals works
            </p>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-zinc-300">
              <li>Post an ask (something to sell, rent or fund) or a bid (what a client wants, with a budget).</li>
              <li>Blind posts hide who you are. Members tap &ldquo;I&apos;m interested&rdquo; and you decide who to contact.</li>
              <li>Named posts show your contact buttons, so members can reach you directly.</li>
              <li className="flex gap-2">
                <Clock size={13} className="mt-[3px] shrink-0 text-lime" />
                <span>Posts delete themselves {DEAL_TTL_DAYS} days after they go up, so Deals is always fresh.</span>
              </li>
            </ul>
            {!profileLoading && !profile && (
              <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white">
                Create an account to post
              </Link>
            )}
            {!shared && <p className="mt-4 border-t border-white/10 pt-3 text-[11.5px] text-zinc-500">Preview: your posts are saved on this device until member accounts open.</p>}
          </div>
        </aside>
      </div>

      {ready && <Composer open={composing} onClose={() => setComposing(false)} onPost={create} author={profile} />}
    </div>
  );
}
