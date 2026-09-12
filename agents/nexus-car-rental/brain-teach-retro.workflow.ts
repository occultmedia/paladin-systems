// Nexus Agent Brain — Teach & Weekly Retro
// Source of truth — deploy via n8n MCP validate_workflow + create_workflow_from_code.
// Portable: data tables are referenced BY NAME (nexus_agent_memory, nexus_draft_reviews).
// At deploy: set workflow timezone to America/Aruba and patch TEACH_URL in
// "Format Review Email" with the workspace URL (…/form/nexus-agent-teach).
// Teach form: tell the agents a fact/rule/preference once — permanent memory.
// Saturday retro: the brain reviews its week and emails an honest self-review.

import { workflow, node, trigger, sticky, newCredential, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const teachForm = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Teach Form',
    position: [0, 0],
    parameters: {
      formTitle: 'Teach your Nexus agents',
      formDescription: 'Tell your agents a fact, rule, or preference once — they remember it and apply it from their next run. Email agent = customer replies. Marketing agent = Instagram content.',
      formFields: {
        values: [
          { fieldLabel: 'Which agent?', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Email agent' }, { option: 'Marketing agent' }, { option: 'Both' }] } },
          { fieldLabel: 'Type', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Business fact' }, { option: 'Style rule' }, { option: 'Preference' }, { option: 'Lesson' }] } },
          { fieldLabel: 'The knowledge', fieldType: 'textarea', requiredField: true, placeholder: 'e.g. Minimum driver age is 23 with a license held for 2+ years' },
          { fieldLabel: 'Context (optional)', fieldType: 'text', placeholder: 'why / since when / an example' }
        ]
      },
      responseMode: 'onReceived',
      options: {
        path: 'nexus-agent-teach',
        buttonLabel: 'Teach it',
        appendAttribution: false,
        ignoreBots: true,
        respondWithOptions: { values: { respondWith: 'text', formSubmittedText: 'Learned. Your agents will apply this from their next run.' } }
      }
    }
  },
  output: [{ 'Which agent?': 'Email agent', 'Type': 'Business fact', 'The knowledge': 'Minimum driver age is 23.', 'Context (optional)': 'insurance requirement', submittedAt: '2026-09-15T10:00:00.000-04:00', formMode: 'production' }]
});

const normalizeTeach = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Teaching',
    position: [220, 0],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const j = $json;
const agentRaw = String(j['Which agent?'] || 'Both').toLowerCase();
let agent = 'shared';
if (agentRaw.indexOf('email') >= 0) agent = 'inbox';
else if (agentRaw.indexOf('marketing') >= 0) agent = 'marketing';
const typeRaw = String(j['Type'] || 'Business fact').toLowerCase();
let kind = 'fact';
if (typeRaw.indexOf('style') >= 0) kind = 'style_rule';
else if (typeRaw.indexOf('preference') >= 0) kind = 'preference';
else if (typeRaw.indexOf('lesson') >= 0) kind = 'lesson';
const today = DateTime.now().setZone('America/Aruba').toFormat('yyyy-LL-dd');
const context = String(j['Context (optional)'] || '').trim();
return { json: {
  agent: agent,
  kind: kind,
  content: String(j['The knowledge'] || '').trim().slice(0, 400),
  source: 'told',
  evidence: ((context ? context + ' — ' : '') + 'taught via form').slice(0, 300),
  weight: 2,
  active: true,
  created_date: today,
  updated_date: today
} };
`
    }
  },
  output: [{ agent: 'inbox', kind: 'fact', content: 'Minimum driver age is 23.', source: 'told', evidence: 'insurance requirement — taught via form', weight: 2, active: true, created_date: '2026-09-15', updated_date: '2026-09-15' }]
});

const insertTaught = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save to Memory',
    position: [440, 0],
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
  output: [{ id: 2, createdAt: '2026-09-15T14:00:00.000Z', updatedAt: '2026-09-15T14:00:00.000Z' }]
});

const retroSchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Saturday 18:00',
    position: [0, 320],
    parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [6], triggerAtHour: 18, triggerAtMinute: 0 }] } }
  },
  output: [{}]
});

const fetchAllMemory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Fetch All Memory',
    position: [220, 320],
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'nexus_agent_memory' },
      returnAll: true
    }
  },
  output: [{ id: 1, agent: 'inbox', kind: 'style_rule', content: 'Keep replies short.', source: 'correction', weight: 1, active: true, created_date: '2026-09-16' }]
});

const fetchComparedReviews = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Fetch Compared Reviews',
    position: [440, 320],
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'nexus_draft_reviews' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'compared' }] },
      returnAll: true
    }
  },
  output: [{ id: 42, thread_id: 't1', similarity: 0.5, lessons_added: 2, compared_at: '2026-09-17T01:00:00.000Z' }]
});

const buildDigest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Retro Digest',
    position: [660, 320],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const NL = String.fromCharCode(10);
const now = DateTime.now().setZone('America/Aruba');
const weekAgoMs = now.toMillis() - 7 * 24 * 3600 * 1000;

const mem = [];
const mItems = $('Fetch All Memory').all();
for (let i = 0; i < mItems.length; i++) {
  const r = mItems[i].json;
  if (r && r.content) mem.push(r);
}
const reviews = [];
const rItems = $('Fetch Compared Reviews').all();
for (let i = 0; i < rItems.length; i++) {
  const r = rItems[i].json;
  if (!r || !r.thread_id) continue;
  const t = Date.parse(String(r.compared_at || '')) || 0;
  if (t >= weekAgoMs) reviews.push(r);
}
if (!mem.length && !reviews.length) return [];

function memLine(r) {
  return '- (' + (r.agent || '?') + ' / ' + (r.kind || '?') + ' / weight ' + (r.weight || 1) + ' / via ' + (r.source || '?') + ') ' + String(r.content).slice(0, 200);
}
const newMem = [];
for (let i = 0; i < mem.length; i++) {
  const t = Date.parse(String(mem[i].created_date || '')) || 0;
  if (t >= weekAgoMs) newMem.push(mem[i]);
}
const parts = [];
parts.push('== THIS WEEK ==');
parts.push('Corrected drafts analyzed: ' + reviews.length);
let editedHeavily = 0;
for (let i = 0; i < reviews.length; i++) {
  const s = Number(reviews[i].similarity);
  if (isFinite(s) && s > 0 && s < 0.7) editedHeavily++;
}
parts.push('Heavily edited drafts (similarity < 0.7): ' + editedHeavily);
parts.push('New memory entries this week: ' + newMem.length);
parts.push(newMem.length ? newMem.map(memLine).join(NL) : '(none)');
parts.push('');
parts.push('== FULL MEMORY (' + mem.length + ' entries) ==');
parts.push(mem.length ? mem.map(memLine).join(NL) : '(empty)');

return [{ json: {
  digest: parts.join(NL),
  memCount: mem.length,
  newCount: newMem.length,
  reviewCount: reviews.length,
  weekLabel: now.toFormat('d LLL yyyy')
} }];
`
    }
  },
  output: [{ digest: '== THIS WEEK ==', memCount: 5, newCount: 2, reviewCount: 3, weekLabel: '19 Sep 2026' }]
});

const claudeRetro = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Claude Sonnet 5 (Retro)',
    position: [800, 540],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' },
      options: { maxTokensToSample: 3000 }
    },
    credentials: { anthropicApi: newCredential('Anthropic') }
  }
});

const retroParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Retro Schema',
    position: [1020, 540],
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{ "headline": "I learned to keep replies shorter.", "learned": ["Keep replies under 120 words", "Always add the WhatsApp number"], "patterns": "You consistently cut my closing paragraph.", "adjustments": "I will draft with at most three short paragraphs.", "questions": ["What is the security deposit amount?"], "housekeeping": ["Two similar rules about reply length exist — consider keeping one"] }'
    }
  }
});

const weeklyRetro = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Weekly Self-Review — Claude',
    position: [880, 320],
    parameters: {
      promptType: 'define',
      text: expr('Write your weekly self-review for the Nexus Car Rental Aruba team.\n\nWeek: {{ $json.weekLabel }}\n\n=== ACTIVITY & MEMORY DIGEST ===\n{{ $json.digest }}'),
      hasOutputParser: true,
      options: {
        systemMessage: `You are the shared brain of two AI agents working for Nexus Car Rental Aruba: an inbox agent that drafts customer email replies (a human approves every send) and a marketing agent that creates Instagram content. Once a week you write an honest, useful self-review for the owner.

From the digest, produce:
- headline: one sentence capturing the week.
- learned: the most important new lessons or facts from this week, as plain sentences (max 6). Empty array if none.
- patterns: 1-3 sentences on patterns in how the team corrects your drafts (what they cut, add, or rephrase). If there were no corrections, say so plainly.
- adjustments: 1-3 sentences on what you will concretely do differently next week based on the data.
- questions: up to 4 questions whose answers would most improve your work — things you keep having to guess (missing prices, policies, preferences). Phrase each so it can be answered in one line via the Teach form. Empty array if none.
- housekeeping: duplicate, outdated, or contradicting memory entries the team should clean up or clarify. Describe them concretely; never invent entries that are not in the digest. Empty array if none.

Be concrete and reference real content from the digest. Never invent activity. The whole review must be scannable in under a minute.`
      }
    },
    subnodes: { model: claudeRetro, outputParser: retroParser }
  },
  output: [{ output: { headline: 'I learned to keep replies shorter.', learned: ['Keep replies under 120 words'], patterns: 'You cut my closings.', adjustments: 'Three short paragraphs max.', questions: ['What is the deposit amount?'], housekeeping: [] } }]
});

const formatRetro = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Review Email',
    position: [1100, 320],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const TEACH_URL = 'https://REPLACE-WITH-YOUR-N8N-URL/form/nexus-agent-teach';
const o = $json.output || {};
const d = $('Build Retro Digest').first().json;

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function list(items) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return '<p style="color:#5f6368;font-size:13px;margin:4px 0">(nothing this week)</p>';
  let out = '<ul style="margin:4px 0 0 0;padding-left:20px">';
  for (let i = 0; i < arr.length; i++) {
    out += '<li style="font-size:13px;margin-bottom:4px">' + esc(arr[i]) + '</li>';
  }
  return out + '</ul>';
}
const h = 'margin:16px 0 2px 0;font-size:14px';
let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#202124">';
html += '<h2 style="margin:0 0 2px 0">Weekly review from your agents</h2>';
html += '<div style="color:#5f6368;font-size:13px;margin-bottom:12px">Week of ' + esc(d.weekLabel) + ' &middot; ' + d.reviewCount + ' corrected draft(s) studied &middot; ' + d.newCount + ' new thing(s) learned &middot; ' + d.memCount + ' total memory entries</div>';
html += '<div style="background:#f8f9fa;border:1px solid #dadce0;border-radius:6px;padding:10px 14px;font-size:13px"><strong>' + esc(o.headline || 'Weekly self-review') + '</strong></div>';
html += '<h3 style="' + h + '">What I learned this week</h3>' + list(o.learned);
html += '<h3 style="' + h + '">Patterns in your corrections</h3><p style="font-size:13px;margin:4px 0">' + esc(o.patterns || '(no clear pattern yet)') + '</p>';
html += '<h3 style="' + h + '">What I will do differently</h3><p style="font-size:13px;margin:4px 0">' + esc(o.adjustments || '(no changes planned)') + '</p>';
html += '<h3 style="' + h + '">Questions — answering these makes me better</h3>' + list(o.questions);
html += '<h3 style="' + h + '">Memory housekeeping</h3>' + list(o.housekeeping);
if (TEACH_URL.indexOf('REPLACE') === -1) {
  html += '<div style="color:#5f6368;font-size:12px;margin-top:14px">Teach me anything (facts, rules, preferences) in 20 seconds: <a href="' + TEACH_URL + '">the Teach form</a>.</div>';
} else {
  html += '<div style="color:#5f6368;font-size:12px;margin-top:14px">Teach me anything (facts, rules, preferences) in 20 seconds via the Teach form (see the Teach &amp; Weekly Retro workflow).</div>';
}
html += '</div>';

const subject = 'Weekly agent review — ' + d.newCount + ' new lesson(s), ' + d.reviewCount + ' corrected draft(s)';
return [{ json: { subject: subject, html: html } }];
`
    }
  },
  output: [{ subject: 'Weekly agent review — 2 new lesson(s), 3 corrected draft(s)', html: '<div>...</div>' }]
});

const sendRetro = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Weekly Review',
    position: [1320, 320],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'info@nexuscarsaruba.com',
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Nexus Agent Brain' }
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: 'msg3', threadId: 'thr3', labelIds: ['SENT'] }]
});

const brainNote = sticky(`## Teach & Weekly Retro — the agents' shared brain
**Teach form** (bookmark it): https://YOUR-WORKSPACE.app.n8n.cloud/form/nexus-agent-teach
Tell an agent a fact, style rule, or preference ONCE — it lands in the *nexus_agent_memory* table and is applied on every future email draft and content pack.

**Saturday 18:00 — self-review**: the brain reads everything it learned (taught facts + lessons from corrected drafts) plus this week's corrections, then emails an honest retro: what it learned, patterns in your edits, what it will do differently, questions it wants answered, and memory worth cleaning up. No activity = no email.

Setup: connect **Gmail** on "Email Weekly Review" + **Anthropic** on the Claude node, patch TEACH_URL in "Format Review Email", set timezone America/Aruba, then activate.`, [teachForm, retroSchedule], { color: 4 });

export default workflow('nexus-brain-teach-retro', 'Nexus Agent Brain — Teach & Weekly Retro')
  .add(teachForm)
  .to(normalizeTeach)
  .to(insertTaught)
  .add(retroSchedule)
  .to(fetchAllMemory)
  .to(fetchComparedReviews)
  .to(buildDigest)
  .to(weeklyRetro)
  .to(formatRetro)
  .to(sendRetro)
  .add(brainNote);
