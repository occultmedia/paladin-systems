# Nexus Car Rental Aruba — AI Agents

Two AI agents that **learn like employees**, built as six n8n workflows plus a
shared memory. This folder is the **source of truth**: every workflow exists
here as portable n8n Workflow SDK code and can be deployed to any n8n
workspace in minutes (see `MIGRATION.md`).

## The system

```
                        ┌──────────────────────────────────────┐
                        │       SHARED BRAIN (data tables)     │
                        │  nexus_agent_memory   facts, style   │
                        │                       rules, lessons │
                        │  nexus_draft_reviews  draft vs sent  │
                        │  nexus_ig_posts       post results   │
                        └──────▲──────────▲──────────▲─────────┘
      reads memory             │          │          │        reads memory
  ┌────────────────────┐       │          │          │   ┌─────────────────────┐
  │  INBOX AGENT       │ logs every draft │  logs packs   │  MARKETING AGENT    │
  │  drafts replies in │───────┘          │          └────│  researches, writes │
  │  Gmail threads —   │                  │               │  IG content packs — │
  │  human hits Send   │                  │               │  human posts them   │
  └────────────────────┘                  │               └─────────────────────┘
                                          │
              ┌───────────────────────────┴────────────────────────────┐
              │                LEARNING LOOPS (the brain)              │
              │  Correction Learner  nightly: diffs drafts vs what     │
              │                      you actually sent → lessons      │
              │  Teach form          tell it a fact once → permanent  │
              │  Results form        post metrics → content strategy  │
              │  Weekly Retro        Saturday self-review email       │
              └────────────────────────────────────────────────────────┘
```

Four ways the agents get smarter, all automatic once live:

1. **From outcomes** — every Instagram post's real likes/comments/saves/reach
   feeds the next content pack (score = `likes + 2×comments + 3×saves +
   2×shares + reach/100`; saves and shares weigh most because Instagram's
   ranking rewards them).
2. **From your corrections** — every reply draft is logged; when you send an
   edited version, Claude diffs draft vs sent at night and extracts durable
   lessons ("keep it under 120 words", "always add the WhatsApp number").
   Next draft already applies them. A draft sent unchanged = success.
3. **From being told** — the Teach form (`/form/nexus-agent-teach`) writes
   facts, style rules, and preferences straight into memory. Say it once.
4. **Weekly self-review** — Saturday 18:00 the brain emails what it learned,
   patterns in your edits, what it will do differently, and the questions
   whose answers would help it most.

**Approval is structural, not optional.** The inbox agent has no send node —
replies exist only as Gmail drafts until a human hits Send. The marketing
agent emails content packs; a human posts them.

## Workflows (source files)

| File | Workflow | Triggers |
| --- | --- | --- |
| `ig-content-engine.workflow.ts` | Nexus IG Content Engine — Research, Draft, Learn | Mon/Wed/Fri 07:00 AST |
| `ig-performance-log.workflow.ts` | Nexus IG Performance Log — Learning Loop | Results form + Sunday 17:00 |
| `inbox-agent.workflow.ts` | Nexus Inbox Agent — Reply Drafts for Approval | Gmail, every minute |
| `brain-correction-learner.workflow.ts` | Nexus Agent Brain — Correction Learner | Daily 21:00 |
| `brain-teach-retro.workflow.ts` | Nexus Agent Brain — Teach & Weekly Retro | Teach form + Saturday 18:00 |
| `car-wash-plan.workflow.ts` | Weekly Car Wash Plan — Booqable | Monday 07:00 AST |

Content engine research is keyless and live: Google autocomplete (what
high-intent travelers type — "car rental aruba airport") plus Reddit r/aruba
and car-rental threads. If a source is down, the run degrades gracefully.

## Data tables (shared memory)

- `nexus_ig_posts` — every generated post + real performance (19 columns).
- `nexus_agent_memory` — facts / style rules / preferences / lessons, with
  `agent` (inbox | marketing | shared), `source` (told | correction), weight,
  active flag.
- `nexus_draft_reviews` — every reply draft, what was actually sent,
  similarity, lessons extracted.

Workflows reference tables **by name**, so they deploy to any workspace
unchanged. The schema ports to Postgres/Supabase in one script the day a
custom dashboard gets built on top.

## Go-live checklist (on the business n8n account)

1. Deploy per `MIGRATION.md` (Claude does this once the n8n connector points
   at the new workspace).
2. **Credentials** (n8n → Credentials):
   - *Anthropic* — API key from console.anthropic.com. Used by 4 Claude nodes.
   - *Gmail (Nexus Car Rental)* — Google OAuth for info@nexuscarsaruba.com.
   - *Booqable API* — header `Authorization: Bearer <key>` (car wash plan only).
3. Fill what you can in the inbox agent's **Business facts** block — or skip
   it and use the Teach form after activation; taught facts apply automatically.
4. **Activate** all six workflows (Performance Log and Teach & Retro first, so
   the form links work). Check each workflow's Settings → timezone =
   America/Aruba.
5. Bookmark the two forms on the team's phones:
   `/form/nexus-ig-results` and `/form/nexus-agent-teach`.

Running cost: n8n Starter (~€20–24/mo) + Claude API (~$5–15/mo at this
volume). Note Starter's active-workflow cap (historically 5; this stack has
6) — either consolidate the Correction Learner into the Inbox Agent workflow
(it supports a second trigger) or take the Pro plan.

## Ideas for v2

- **Review engine** (highest ROI): Booqable return → next-morning thank-you +
  Google review link. Same building blocks as the car wash plan.
- **Booqable tool for the inbox agent**: real availability in drafts instead
  of `[CHECK: …]` — most drafts become send-as-is.
- **WhatsApp channel** via WhatsApp Business API — same brain, Aruba's
  highest-traffic channel.
- **Sequence Labs agent dashboard** (Next.js + Supabase): named agents, live
  activity feed, "what I've learned" page, approve/teach from one screen.
  n8n stays underneath as invisible plumbing. Productizable for other clients.
