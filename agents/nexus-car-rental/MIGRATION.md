# Migrating to the business n8n account

Goal: move everything from the personal workspace
(`paladinxsystems.app.n8n.cloud`, johnwever89@gmail.com) to a new workspace
owned by **info@nexuscarsaruba.com**. Nothing was live on the old account
(no credentials connected, empty tables), so this is a clean redeploy from
source — no data migration.

## Step 1 — You (once, ~5 min)

1. Create the n8n Cloud account with **info@nexuscarsaruba.com** and pick a
   workspace name (this becomes `https://<workspace>.app.n8n.cloud`).
2. On claude.ai → **Settings → Connectors**, reconnect the **n8n** connector
   to the new workspace (so Claude's tools point at it instead of the old one).
3. Do **not** delete the old workspace yet.

## Step 2 — Claude (once the connector points at the new workspace)

1. Create the three data tables: `nexus_ig_posts`, `nexus_agent_memory`,
   `nexus_draft_reviews` (column definitions in README / old workspace).
2. Deploy all six `*.workflow.ts` files via `validate_workflow` →
   `create_workflow_from_code`. Table references are name-based, so no ID
   surgery is needed.
3. Patch the three `FORM_URL` / `TEACH_URL` constants with the real workspace
   domain (in *Build Approval Email*, *Build Reminder Email*, *Format Review
   Email*).
4. Set every workflow's timezone to `America/Aruba` and verify.

## Step 3 — You (go-live, ~15 min)

Follow the README go-live checklist: connect Anthropic + Gmail (+ Booqable
for the wash plan), activate all six workflows, bookmark the two forms.

## Step 4 — Cleanup

After the first successful runs on the new workspace: cancel/delete the old
`paladinxsystems` workspace. For reference, it contained workflow IDs
FtVx5tMkFxwUVMtU (content engine v1), mgmOJrMe8guJMwbO (performance log),
CaZ9lmPGWEDUhyFz (inbox agent v1), FmF1yyYmE1Onx8zA (correction learner),
J2czpK2F9sHfJNpl (car wash plan) and data tables bLjxeBsdJPqCudHf /
B1pu2mQYgL1XRQIj / zOciuytfaH0c4ods — all superseded by this folder.
Note: the v2 sources here are ahead of what was deployed on the old
workspace (memory wiring + Teach & Retro were never deployed there).
