"use client";

/*
 * Feed tab: offers posted by members (agents, investors, brokerages). Every
 * member sees every post; responding means contacting the poster directly by
 * WhatsApp, phone or email. There is no chat or comment thread on purpose.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mail, MapPin, Megaphone, MessageCircle, Pencil, Phone, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DISTRICT_CENTERS } from "@/lib/aruba-data";
import {
  BODY_MAX,
  POST_KINDS,
  POST_KIND_HINT,
  TITLE_MAX,
  useFeed,
  type FeedPost,
  type NewPost,
  type PostKind,
} from "@/lib/feed";
import { profileComplete, type Profile } from "@/lib/profile";
import { Avatar, Dialog } from "./profile-dialog";

const EASE = [0.22, 1, 0.36, 1] as const;
const DISTRICT_NAMES = Object.keys(DISTRICT_CENTERS);

const KIND_STYLE: Record<PostKind, string> = {
  "Off-market": "bg-zinc-950 text-mint",
  "For sale": "bg-mint text-zinc-950",
  "Buyer request": "bg-[#E6EEF9] text-[#24508F]",
  "For rent": "bg-[#FBF1DE] text-[#8A5A12]",
  Partnership: "bg-[#EFE9F8] text-[#5B3E91]",
};

const priceLabel = (k: PostKind) => (k === "Buyer request" ? "Budget" : k === "For rent" ? "Monthly rent" : k === "Partnership" ? "Capital needed" : "Asking price");

function fmtPrice(n: number, kind: PostKind) {
  const v = n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2)}M` : `$${n.toLocaleString("en-US")}`;
  return kind === "For rent" ? `${v}/mo` : kind === "Buyer request" ? `Up to ${v}` : v;
}

function timeAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

/* ── post card ─────────────────────────────────────────────────────────── */

function ContactRow({ post }: { post: FeedPost }) {
  const a = post.author;
  if (post.sample)
    return <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-500">Sample post. Contact details appear on real member posts.</p>;
  const msg = `Hi ${a.name.split(" ")[0]}, I saw your post on Sequence Terminal: "${post.title}".`;
  const links = [
    a.whatsapp && { href: `https://wa.me/${digits(a.whatsapp)}?text=${encodeURIComponent(msg)}`, label: "WhatsApp", icon: MessageCircle, primary: true },
    a.phone && { href: `tel:${a.phone.replace(/[^\d+]/g, "")}`, label: "Call", icon: Phone },
    a.email && { href: `mailto:${a.email}?subject=${encodeURIComponent(`Re: ${post.title}`)}&body=${encodeURIComponent(msg)}`, label: "Email", icon: Mail },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Mail; primary?: boolean }[];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ href, label, icon: Icon, primary }) => (
        <a
          key={label}
          href={href}
          target={label === "WhatsApp" ? "_blank" : undefined}
          rel="noreferrer"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
            primary ? "bg-zinc-950 text-mint hover:bg-zinc-800" : "border border-zinc-300 text-zinc-800 hover:border-zinc-950 hover:text-zinc-950"
          }`}
        >
          <Icon size={14} strokeWidth={1.8} />
          {label}
        </a>
      ))}
    </div>
  );
}

function PostCard({ post, onDelete }: { post: FeedPost; onDelete: (id: string) => void }) {
  const [contact, setContact] = useState(false);
  const a = post.author;
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
        <Avatar name={a.name} photo={a.photo} logo={a.logo} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-zinc-950">
            {a.name}
            {post.mine && <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-px align-middle text-[10px] font-semibold text-zinc-600">You</span>}
          </p>
          <p className="truncate text-[12px] text-zinc-500">
            {[a.title || a.role, a.company].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${KIND_STYLE[post.kind]}`}>{post.kind}</span>
          <span className="text-[11px] tabular-nums text-zinc-400">{timeAgo(post.created_at)}</span>
        </div>
      </header>

      <h3 className="mt-4 font-display text-[16.5px] font-bold leading-snug text-zinc-950">{post.title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-600">{post.body}</p>

      {(post.price_usd !== null || post.district) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          {post.price_usd !== null && (
            <span className="text-zinc-500">
              {priceLabel(post.kind)} <b className="font-display text-[14px] tabular-nums text-zinc-950">{fmtPrice(post.price_usd, post.kind)}</b>
            </span>
          )}
          {post.district && (
            <span className="inline-flex items-center gap-1 text-zinc-600">
              <MapPin size={13} strokeWidth={1.8} /> {post.district}
            </span>
          )}
        </div>
      )}

      <footer className="mt-4 border-t border-zinc-100 pt-3">
        {post.mine ? (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-zinc-500">Members contact you directly.</span>
            <button
              type="button"
              onClick={() => window.confirm("Delete this post?") && onDelete(post.id)}
              className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-[#B23A3A]"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {contact ? (
              <motion.div key="c" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <ContactRow post={post} />
              </motion.div>
            ) : (
              <motion.button
                key="b"
                type="button"
                onClick={() => setContact(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-mint transition-colors hover:bg-zinc-800"
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [district, setDistrict] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setBody("");
    setPrice("");
    setDistrict("");
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Post an offer" wide>
      <form
        className="space-y-5 px-5 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (title.trim().length < 6) return setError("Give the offer a short headline (at least 6 characters).");
          if (body.trim().length < 20) return setError("Add a few details (at least 20 characters) so members know what it is.");
          const n = price ? Number(price.replace(/[^\d.]/g, "")) : null;
          if (n !== null && (!Number.isFinite(n) || n <= 0)) return setError("Enter the amount as a number, in US dollars.");
          setBusy(true);
          setError(null);
          try {
            await onPost({ kind, title: title.trim(), body: body.trim(), price_usd: n, district: district || null });
            reset();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not post. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
          <Avatar name={author.name} photo={author.photo} logo={author.logo} size={36} />
          <p className="min-w-0 text-[12.5px] text-zinc-600">
            Posting as <b className="text-zinc-950">{author.name}</b>
            {author.company && <> · {author.company}</>}
          </p>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-medium text-zinc-700">What are you offering?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of post">
            {POST_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  kind === k ? "border-zinc-950 bg-zinc-950 text-mint" : "border-zinc-300 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">{POST_KIND_HINT[kind]}.</p>
        </div>

        <div>
          <label htmlFor="feed-title" className="mb-1.5 flex justify-between text-[12.5px] font-medium text-zinc-700">
            Headline <span className="tabular-nums text-zinc-400">{title.length}/{TITLE_MAX}</span>
          </label>
          <input id="feed-title" className={input} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3-bed villa in Malmok, owner wants a quiet sale" />
        </div>

        <div>
          <label htmlFor="feed-body" className="mb-1.5 flex justify-between text-[12.5px] font-medium text-zinc-700">
            Details <span className="tabular-nums text-zinc-400">{body.length}/{BODY_MAX}</span>
          </label>
          <textarea id="feed-body" className={`${input} min-h-[120px] resize-y`} value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="Size, condition, terms, commission split, timing…" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="feed-price" className="mb-1.5 block text-[12.5px] font-medium text-zinc-700">
              {priceLabel(kind)} (USD, optional)
            </label>
            <input id="feed-price" className={`${input} tabular-nums`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={kind === "For rent" ? "4,200" : "850,000"} />
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

        {error && <p className="rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] text-zinc-500">Offers only. Members reply by contacting you, not in the Feed.</p>
          <button
            type="submit"
            disabled={busy}
            className="shine inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 font-display text-[13.5px] font-semibold text-mint transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Post to the Feed
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── tab ───────────────────────────────────────────────────────────────── */

export function FeedView({ profile, profileLoading, shared, onEditProfile }: { profile: Profile | null; profileLoading: boolean; shared: boolean; onEditProfile: () => void }) {
  const ready = profileComplete(profile);
  const { posts, create, remove, loading, error } = useFeed(ready ? profile : null);
  const [kind, setKind] = useState<PostKind | "All">("All");
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState(false);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (kind === "All" || p.kind === kind) &&
        (!t || [p.title, p.body, p.district, p.author.name, p.author.company].some((s) => s?.toLowerCase().includes(t))),
    );
  }, [posts, kind, q]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(POST_KINDS.map((k) => [k, 0])) as Record<PostKind, number>;
    posts.forEach((p) => c[p.kind]++);
    return c;
  }, [posts]);

  const startPost = () => (ready ? setComposing(true) : onEditProfile());

  return (
    <div className="pb-10">
      <div className="deck bleed">
        <div className="mx-auto max-w-[1400px] px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Members only · Agents, investors and brokerages</p>
              <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight text-white sm:text-[34px]">Feed</h1>
              <p className="mt-1 max-w-xl text-[13px] text-zinc-400">
                Offers from across the Aruba market: off-market deals, buyer requests, rentals and partnerships. See something you want? Contact the poster directly.
              </p>
            </div>
            <button
              type="button"
              onClick={startPost}
              className="shine inline-flex items-center gap-2 rounded-full bg-mint px-5 py-2.5 font-display text-[13.5px] font-semibold text-zinc-950 transition-colors hover:bg-white"
            >
              <Plus size={15} strokeWidth={2.2} />
              Post an offer
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
                    on ? "bg-mint text-zinc-950" : "bg-white/[0.06] text-zinc-300 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Posts" className="min-w-0">
          <label className="relative mb-4 block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <span className="sr-only">Search the Feed</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search offers, areas, agents or companies"
              className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-950"
            />
          </label>

          {error && <p className="mb-4 rounded-lg bg-[#FBE9E9] px-3 py-2 text-[12.5px] text-[#B23A3A]">The Feed could not load: {error}</p>}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-zinc-100" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center">
              <Megaphone size={22} className="mx-auto text-zinc-400" />
              <p className="mt-3 font-display text-[16px] font-bold text-zinc-950">{posts.length ? "No offers match" : "No offers yet"}</p>
              <p className="mt-1 text-[13px] text-zinc-500">{posts.length ? "Try another type or search." : "Be the first to post one."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {shown.map((p) => (
                  <PostCard key={p.id} post={p} onDelete={(id) => void remove(id).catch((e) => window.alert(e instanceof Error ? e.message : "Could not delete."))} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Your profile</p>
            {profileLoading ? (
              <div className="mt-4 h-14 animate-pulse rounded-xl bg-zinc-100" />
            ) : ready ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar name={profile.name} photo={profile.photo} logo={profile.logo} size={52} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-zinc-950">{profile.name}</p>
                    <p className="truncate text-[12px] text-zinc-500">{[profile.title || profile.role, profile.company].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 text-[12.5px] text-zinc-600">
                  {profile.whatsapp && <li className="flex items-center gap-2"><MessageCircle size={13} className="text-zinc-400" /> {profile.whatsapp}</li>}
                  {profile.phone && <li className="flex items-center gap-2"><Phone size={13} className="text-zinc-400" /> {profile.phone}</li>}
                  {profile.email && <li className="flex min-w-0 items-center gap-2"><Mail size={13} className="shrink-0 text-zinc-400" /> <span className="truncate">{profile.email}</span></li>}
                </ul>
                <button type="button" onClick={onEditProfile} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-950 underline-offset-4 hover:underline">
                  <Pencil size={12} /> Edit profile
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">Add your photo, company logo and contact details so members know who is posting and how to reach you.</p>
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-[12.5px] font-semibold text-mint transition-colors hover:bg-zinc-800"
                >
                  Set up your profile
                </button>
              </>
            )}
          </div>

          <div className="deck rounded-2xl p-5 [background-attachment:scroll]">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
              <ShieldCheck size={13} className="text-mint" /> How the Feed works
            </p>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-zinc-300">
              <li>Post offers, not conversation: a deal, a buyer, a rental or a partnership.</li>
              <li>Every Sequence Terminal member sees every post.</li>
              <li>Interested members contact you directly by WhatsApp, phone or email.</li>
              <li>Delete your post once the deal is done.</li>
            </ul>
            {!shared && <p className="mt-4 border-t border-white/10 pt-3 text-[11.5px] text-zinc-500">Preview: your posts are saved on this device until member accounts open.</p>}
          </div>
        </aside>
      </div>

      {ready && <Composer open={composing} onClose={() => setComposing(false)} onPost={create} author={profile} />}
    </div>
  );
}
