# Nexus Car Rental Aruba — AI Agents

Two agents for Nexus Car Rental Aruba, built as three n8n workflows plus one
data table on `https://paladinxsystems.app.n8n.cloud`. This folder holds the
deployed workflow source (n8n Workflow SDK) and the operations manual.

| What | n8n workflow | Link |
| --- | --- | --- |
| Marketing agent (create) | Nexus IG Content Engine — Research, Draft, Learn | [FtVx5tMkFxwUVMtU](https://paladinxsystems.app.n8n.cloud/workflow/FtVx5tMkFxwUVMtU) |
| Marketing agent (learn) | Nexus IG Performance Log — Learning Loop | [mgmOJrMe8guJMwbO](https://paladinxsystems.app.n8n.cloud/workflow/mgmOJrMe8guJMwbO) |
| Email agent | Nexus Inbox Agent — Reply Drafts for Approval | [CaZ9lmPGWEDUhyFz](https://paladinxsystems.app.n8n.cloud/workflow/CaZ9lmPGWEDUhyFz) |
| Shared memory | Data table `nexus_ig_posts` (id `bLjxeBsdJPqCudHf`) | n8n → Data tables |

All three are created **inactive** — they go live after the go-live checklist
below. Everything runs on Claude Sonnet 5 (`claude-sonnet-5`) and is pinned to
the `America/Aruba` timezone.

## Agent 1 — Instagram marketing agent

```
Mon/Wed/Fri 07:00 AST
  ├─ research: Google autocomplete (live high-intent searches:
  │            "car rental aruba airport", "do you need a car in aruba", …)
  │            + Reddit r/aruba top threads + Aruba car-rental conversations
  ├─ memory:   reads nexus_ig_posts — top performers, flops, last 9 posts
  ├─ Claude:   writes 3 Instagram posts (hook, caption, hashtags, shot list,
  │            CTA, best posting time). Post 3 is always an experiment.
  ├─ log:      saves all 3 to nexus_ig_posts as status=drafted
  └─ approve:  emails the pack to info@nexuscarsaruba.com — nothing is
               posted automatically; the team posts what it likes, edits freely
```

**How it targets high intent:** the research step pulls what trip-planners
literally type into Google right now plus what they discuss on Reddit, and the
system prompt prioritizes travelers booking Aruba trips in the next 0–90 days
(then cruise passengers, returning visitors, locals).

**How it constantly improves:** the team logs each post's real numbers through
the results form (below). Every future run feeds top performers, weak posts,
and team notes back into Claude with explicit instructions: double down on
what worked, avoid what flopped, never repeat the last 9 themes, and always
run one experiment per pack.

- Results form: `https://paladinxsystems.app.n8n.cloud/form/nexus-ig-results`
  (live once the Performance Log workflow is active)
- Engagement score: `likes + 2×comments + 3×saves + 2×shares + reach/100` —
  saves and shares weigh most because Instagram's ranking rewards them.
- Sunday 17:00 AST: if drafted posts have no results logged, a check-in email
  lists them with a button to the form. Nothing pending → no email.
- Research sources are keyless; when one is unreachable the run continues and
  the prompt falls back to evergreen angles.
- Guardrail: the agent may never state prices, availability, or policies — it
  writes `[CHECK: …]` placeholders for the team to fill.

## Agent 2 — Email agent (human approval built in)

```
Gmail inbox, checked every minute (unread; own mail / promos / social filtered)
  ├─ Claude classifies: booking_inquiry · quote_request · existing_booking ·
  │                     logistics · complaint · partnership · automated · spam
  ├─ real customer email → Claude writes the reply
  │     · in the sender's language (EN / ES / NL / Papiamento)
  │     · facts only from the "Business facts" block, else [CHECK: …]
  │     · complaints: empathy, no fault admissions, no promised compensation
  └─ the reply is saved as a Gmail DRAFT inside the original thread
```

**Approval is structural, not optional:** the workflow has no send node. The
team opens the thread in Gmail, the draft is already attached — review, edit,
hit Send. Newsletters, receipts, and spam are skipped without a draft.

## Go-live checklist (~10 minutes)

1. **Anthropic credential** — n8n → Credentials → new *Anthropic* credential
   with the API key (console.anthropic.com). Select it on the Claude node in
   the Content Engine and the Inbox Agent.
2. **Gmail credential** — connect `info@nexuscarsaruba.com` (Google OAuth) and
   select it on: Email Pack for Approval, Email Sunday Check-In, the Gmail
   trigger, and Create Draft in Thread.
3. **Business facts** — in the Inbox Agent, open *Triage & Draft Reply —
   Claude* → system message → replace every `[CHECK: …]` in the Business
   facts block you can (airport meeting point, driver age, deposit, fleet,
   insurance, delivery). More facts = fewer blanks in drafts.
4. **Activate** all three workflows (toggle top-right). Activate the
   Performance Log first so the form URL works when the first pack references it.
5. **Bookmark** the results form on the phone that checks Instagram insights.

## Costs & cadence

Claude Sonnet 5 is called 3×/week for content (one larger call) and once per
inbound customer email (one small call) — for a small business inbox this is
typically a few dollars per month. Cadence, posting days, and the every-minute
inbox poll are all plain settings on the trigger nodes.

## Ideas for v2

- **Auto-publish to Instagram** (Facebook Graph API credential) once trust is
  established — the pack email then becomes approve-to-post.
- **Booqable tool for the inbox agent** so drafts can include real
  availability (same API already used by the Weekly Car Wash Plan workflow).
- **WhatsApp channel** for the inbox agent via the WhatsApp Business API.

## Files

- `ig-content-engine.workflow.ts` — marketing agent: research → draft → approve
- `ig-performance-log.workflow.ts` — results form + Sunday check-in (learning loop)
- `inbox-agent.workflow.ts` — email triage + in-thread reply drafts

Sources are n8n Workflow SDK code (restricted TypeScript) mirroring what is
deployed; they are excluded from this site's typecheck/lint. To recreate a
workflow, paste a file through the n8n MCP `validate_workflow` /
`create_workflow_from_code` tools, or rebuild by hand from the canvas.
