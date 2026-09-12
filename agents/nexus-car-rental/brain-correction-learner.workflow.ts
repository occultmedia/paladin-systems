// Nexus Agent Brain — Correction Learner
// Source of truth — deploy via n8n MCP validate_workflow + create_workflow_from_code.
// Portable: data tables are referenced BY NAME (nexus_draft_reviews, nexus_agent_memory).
// At deploy: set workflow timezone to America/Aruba.
// Nightly loop: for every reply draft the inbox agent created, check whether the team
// sent a (possibly edited) reply in that thread; Claude diffs draft vs sent and turns
// the edits into durable lessons in nexus_agent_memory.

import { workflow, node, trigger, sticky, newCredential, languageModel, outputParser, switchCase, expr } from '@n8n/workflow-sdk';

const dailyCheck = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Every Day 21:00',
    position: [0, 0],
    parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 21, triggerAtMinute: 0 }] } }
  },
  output: [{}]
});

const fetchAwaiting = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Fetch Awaiting Drafts',
    position: [220, 0],
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'nexus_draft_reviews' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'awaiting_send' }] },
      returnAll: true
    }
  },
  output: [{ id: 42, thread_id: '18f2a1b2c3d4e5f6', draft_id: 'r-1', customer_email: 'sarah@example.com', subject: 'Car rental 12-19 December', draft_text: '<p>Hi Sarah,</p>', status: 'awaiting_send', drafted_at: '2026-09-15T14:10:00.000Z' }]
});

const getThread = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Get Thread Messages',
    position: [440, 0],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'thread',
      operation: 'get',
      threadId: expr('{{ $json.thread_id }}'),
      simple: true,
      options: { returnOnlyMessages: false }
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: '18f2a1b2c3d4e5f6', messages: [{ id: 'm-reply', internalDate: '1789581600000', From: 'info@nexuscarsaruba.com', labels: [{ id: 'SENT' }] }] }]
});

const assessStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assess Sent Status',
    position: [660, 0],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const row = $('Fetch Awaiting Drafts').item.json;
const OWN = 'nexuscarsaruba.com';
const msgs = Array.isArray($json.messages) ? $json.messages : [];
const draftedAtMs = Date.parse(String(row.drafted_at || '')) || 0;
let sentId = '';
let sentAtMs = 0;
for (let i = 0; i < msgs.length; i++) {
  const m = msgs[i] || {};
  const ts = Number(m.internalDate || 0);
  if (!ts || ts <= draftedAtMs) continue;
  let isSent = false;
  const labels = Array.isArray(m.labels) ? m.labels : [];
  for (let k = 0; k < labels.length; k++) {
    const lid = String((labels[k] && (labels[k].id || labels[k].name)) || '').toUpperCase();
    if (lid === 'SENT') isSent = true;
  }
  const from = String(m.From || m.from || '').toLowerCase();
  if (!isSent && from.indexOf(OWN) >= 0) isSent = true;
  if (!isSent) continue;
  if (!sentAtMs || ts < sentAtMs) { sentAtMs = ts; sentId = String(m.id || ''); }
}
let outcome = 'waiting';
if (sentId) outcome = 'reply_sent';
else if (draftedAtMs && (Date.now() - draftedAtMs) > 7 * 24 * 3600 * 1000) outcome = 'expired';
return { json: {
  review_id: String(row.id || ''),
  thread_id: String(row.thread_id || ''),
  customer_email: String(row.customer_email || ''),
  subject: String(row.subject || ''),
  draft_text: String(row.draft_text || ''),
  drafted_at: String(row.drafted_at || ''),
  outcome: outcome,
  sent_message_id: sentId
} };
`
    }
  },
  output: [{ review_id: '42', thread_id: '18f2a1b2c3d4e5f6', customer_email: 'sarah@example.com', subject: 'Car rental 12-19 December', draft_text: '<p>Hi Sarah,</p>', drafted_at: '2026-09-15T14:10:00.000Z', outcome: 'reply_sent', sent_message_id: 'm-reply' }]
});

const routeOutcome = switchCase({
  version: 3.4,
  config: {
    name: 'Route by Outcome',
    position: [880, 0],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { renameOutput: true, outputKey: 'reply sent', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.outcome }}'), rightValue: 'reply_sent', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
          { renameOutput: true, outputKey: 'expired', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.outcome }}'), rightValue: 'expired', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'still waiting' }
    }
  }
});

const fetchSent = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Fetch Sent Reply',
    position: [1120, -180],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'get',
      messageId: expr('{{ $json.sent_message_id }}'),
      simple: false,
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: 'm-reply', threadId: '18f2a1b2c3d4e5f6', subject: 'Re: Car rental 12-19 December', text: 'Hi Sarah, thanks! We have automatic SUVs. WhatsApp us at +297...', html: '<p>Hi Sarah,</p>' }]
});

const prepareComparison = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Comparison',
    position: [1340, -180],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const a = $('Assess Sent Status').item.json;
const m = $json;
let sent = '';
if (typeof m.text === 'string' && m.text.trim()) {
  sent = m.text;
} else if (typeof m.html === 'string' && m.html.trim()) {
  sent = m.html.replace(/<style[^]*?<[/]style>/gi, ' ').replace(/<[^>]+>/g, ' ');
} else if (typeof m.snippet === 'string') {
  sent = m.snippet;
}
sent = String(sent).replace(/[ ]{2,}/g, ' ').trim().slice(0, 6000);
let draft = String(a.draft_text || '');
draft = draft.replace(/<br[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/[ ]{2,}/g, ' ').trim().slice(0, 6000);
return { json: {
  review_id: String(a.review_id || ''),
  customer_email: String(a.customer_email || ''),
  subject: String(a.subject || ''),
  draft_plain: draft,
  sent_plain: sent
} };
`
    }
  },
  output: [{ review_id: '42', customer_email: 'sarah@example.com', subject: 'Car rental 12-19 December', draft_plain: 'Hi Sarah,', sent_plain: 'Hi Sarah, thanks! We have automatic SUVs.' }]
});

const claudeCompare = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Claude Sonnet 5 (Compare)',
    position: [1480, 40],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' },
      options: { maxTokensToSample: 2000 }
    },
    credentials: { anthropicApi: newCredential('Anthropic') }
  }
});

const lessonParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Lesson Schema',
    position: [1700, 40],
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{ "similarity": 0.6, "summary": "The human shortened the reply and added the WhatsApp number.", "lessons": [ { "kind": "style_rule", "content": "Always include the WhatsApp number when confirming pickup details.", "evidence": "added: WhatsApp us at +297..." } ] }'
    }
  }
});

const compareDrafts = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Extract Lessons — Claude',
    position: [1560, -180],
    parameters: {
      promptType: 'define',
      text: expr('Customer: {{ $json.customer_email }}\nSubject: {{ $json.subject }}\n\n=== WHAT YOU (THE AI) DRAFTED ===\n{{ $json.draft_plain }}\n\n=== WHAT THE HUMAN ACTUALLY SENT (may include quoted earlier messages at the bottom — ignore quoted content) ===\n{{ $json.sent_plain }}'),
      hasOutputParser: true,
      options: {
        systemMessage: `You compare an email reply drafted by an AI inbox assistant for Nexus Car Rental Aruba against the reply a human team member actually sent, and you extract durable lessons so future drafts need less editing.

Rules:
- Extract only DURABLE, RECURRING lessons — things that will apply to future emails. Never extract one-off specifics: a particular customer's name, dates, a single booking's price, or anything tied only to this one conversation.
- kinds: "fact" = a stable business truth the human's version reveals (policy, requirement, standing service detail — be careful with prices: only extract one if it reads like a standing rate or policy); "style_rule" = tone, structure, length, wording, signature habits; "preference" = workflow/channel preferences (e.g. move people to WhatsApp, always ask for flight number).
- Each lesson: ONE self-contained imperative sentence the AI can obey next time, e.g. "Keep replies under 120 words." evidence = a short quote or paraphrase of the change that proves it.
- 0 to 3 lessons. If the human sent the draft essentially unchanged, return an empty lessons array — that is a success, not a failure.
- similarity: 0-1, how close the sent reply is to the draft (1 = sent as-is, 0 = completely rewritten). If the sent text is empty or missing, return similarity 0 and no lessons.
- summary: one sentence describing what the human changed.`
      }
    },
    subnodes: { model: claudeCompare, outputParser: lessonParser }
  },
  output: [{ output: { similarity: 0.6, summary: 'Shortened and added WhatsApp number.', lessons: [{ kind: 'style_rule', content: 'Always include the WhatsApp number when confirming pickup details.', evidence: 'added: WhatsApp us at +297...' }] } }]
});

const flattenLessons = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Flatten Lessons',
    position: [1800, -280],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const items = $input.all();
const preps = $('Prepare Comparison').all();
const today = DateTime.now().setZone('America/Aruba').toFormat('yyyy-LL-dd');
const out = [];
for (let i = 0; i < items.length; i++) {
  const o = items[i].json.output || {};
  const prep = (preps[i] && preps[i].json) || {};
  const lessons = Array.isArray(o.lessons) ? o.lessons.slice(0, 3) : [];
  for (let k = 0; k < lessons.length; k++) {
    const l = lessons[k] || {};
    const content = String(l.content || '').trim();
    if (!content) continue;
    let kind = String(l.kind || 'lesson');
    if (kind !== 'fact' && kind !== 'style_rule' && kind !== 'preference') kind = 'lesson';
    out.push({ json: {
      agent: 'inbox',
      kind: kind,
      content: content.slice(0, 400),
      source: 'correction',
      evidence: ('From reply to ' + (prep.customer_email || 'a customer') + ' — ' + String(l.evidence || '')).slice(0, 300),
      weight: 1,
      active: true,
      created_date: today,
      updated_date: today
    } });
  }
}
return out;
`
    }
  },
  output: [{ agent: 'inbox', kind: 'style_rule', content: 'Always include the WhatsApp number when confirming pickup details.', source: 'correction', evidence: 'From reply to sarah@example.com — added WhatsApp', weight: 1, active: true, created_date: '2026-09-19', updated_date: '2026-09-19' }]
});

const insertLessons = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Lessons to Memory',
    position: [2020, -280],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'name', value: 'nexus_agent_memory' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          agent: expr('{{ $json.agent }}'),
          kind: expr('{{ $json.kind }}'),
          content: expr('{{ $json.content }}'),
          source: expr('{{ $json.source }}'),
          evidence: expr('{{ $json.evidence }}'),
          weight: expr('{{ $json.weight }}'),
          active: expr('{{ $json.active }}'),
          created_date: expr('{{ $json.created_date }}'),
          updated_date: expr('{{ $json.updated_date }}')
        },
        schema: [
          { id: 'agent', displayName: 'agent', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'content', displayName: 'content', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'evidence', displayName: 'evidence', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'weight', displayName: 'weight', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'active', displayName: 'active', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
          { id: 'created_date', displayName: 'created_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_date', displayName: 'updated_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1, createdAt: '2026-09-19T01:00:00.000Z', updatedAt: '2026-09-19T01:00:00.000Z' }]
});

const markCompared = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Review Compared',
    position: [1800, -60],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'name', value: 'nexus_draft_reviews' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr("{{ $('Prepare Comparison').item.json.review_id }}") }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: 'compared',
          sent_text: expr("{{ $('Prepare Comparison').item.json.sent_plain }}"),
          similarity: expr('{{ $json.output.similarity }}'),
          lessons_added: expr('{{ ($json.output.lessons || []).length }}'),
          compared_at: expr('{{ $now.toISO() }}')
        },
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'sent_text', displayName: 'sent_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'similarity', displayName: 'similarity', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'lessons_added', displayName: 'lessons_added', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'compared_at', displayName: 'compared_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 42, createdAt: '2026-09-15T14:10:05.000Z', updatedAt: '2026-09-19T01:00:05.000Z' }]
});

const markExpired = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Review Expired',
    position: [1120, 140],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'name', value: 'nexus_draft_reviews' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.review_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: 'expired',
          compared_at: expr('{{ $now.toISO() }}')
        },
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'compared_at', displayName: 'compared_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 7, createdAt: '2026-09-01T10:00:05.000Z', updatedAt: '2026-09-19T01:00:05.000Z' }]
});

const stillWaiting = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Still Waiting — Check Tomorrow', position: [1120, 280], parameters: {} },
  output: [{ outcome: 'waiting' }]
});

const learnerNote = sticky(`## Correction Learner — how the inbox agent learns from you
Every night at **21:00** this checks each reply draft the inbox agent created:
- If the team **sent a reply** in that thread, Claude diffs the draft against what was actually sent and extracts durable lessons ("keep it shorter", "always add the WhatsApp number", real policies). Lessons land in the *nexus_agent_memory* table and are applied to every future draft.
- A draft sent unchanged = success, no lesson needed.
- Drafts with no reply after 7 days are marked expired.

Setup: connect **Gmail** on "Get Thread Messages" + "Fetch Sent Reply" and **Anthropic** on the Claude node, set timezone America/Aruba, then activate.`, [dailyCheck, fetchAwaiting], { color: 4 });

export default workflow('nexus-brain-correction-learner', 'Nexus Agent Brain — Correction Learner')
  .add(dailyCheck)
  .to(fetchAwaiting)
  .to(getThread)
  .to(assessStatus)
  .to(routeOutcome
    .onCase(0, fetchSent.to(prepareComparison.to(compareDrafts)))
    .onCase(1, markExpired)
    .onCase(2, stillWaiting))
  .add(compareDrafts)
  .to(flattenLessons)
  .to(insertLessons)
  .add(compareDrafts)
  .to(markCompared)
  .add(learnerNote);
