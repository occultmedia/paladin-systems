// Nexus IG Performance Log — Learning Loop
// Deployed: https://paladinxsystems.app.n8n.cloud/workflow/mgmOJrMe8guJMwbO
// Public results form (while active): https://paladinxsystems.app.n8n.cloud/form/nexus-ig-results
// Workflow settings (set via API, not expressible in SDK source): timezone America/Aruba.

import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

const resultsForm = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Results Form',
    position: [0, 0],
    parameters: {
      formTitle: 'Nexus IG — Log Post Results',
      formDescription: 'After a post from the content pack has been on Instagram for about 48 hours (or you decided to skip it), log it here. The content agent learns from every entry and writes better packs.',
      formFields: {
        values: [
          { fieldLabel: 'Post ID', fieldType: 'text', requiredField: true, placeholder: 'e.g. 20260914-airport-pickup — shown under each post in the content pack email' },
          { fieldLabel: 'What happened?', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Posted' }, { option: 'Skipped' }] } },
          { fieldLabel: 'Likes', fieldType: 'number', placeholder: '0' },
          { fieldLabel: 'Comments', fieldType: 'number', placeholder: '0' },
          { fieldLabel: 'Saves', fieldType: 'number', placeholder: '0' },
          { fieldLabel: 'Shares', fieldType: 'number', placeholder: '0' },
          { fieldLabel: 'Reach / views', fieldType: 'number', placeholder: '0' },
          { fieldLabel: 'Notes for the agent', fieldType: 'textarea', placeholder: 'e.g. changed the hook, lots of DMs about jeeps, posted at a different time' }
        ]
      },
      responseMode: 'onReceived',
      options: {
        path: 'nexus-ig-results',
        buttonLabel: 'Log results',
        appendAttribution: false,
        ignoreBots: true,
        respondWithOptions: { values: { respondWith: 'text', formSubmittedText: 'Logged! The content agent will use this to sharpen the next pack.' } }
      }
    }
  },
  output: [{ 'Post ID': '20260914-airport-pickup', 'What happened?': 'Posted', 'Likes': 120, 'Comments': 14, 'Saves': 33, 'Shares': 9, 'Reach / views': 5400, 'Notes for the agent': 'Lots of DMs', submittedAt: '2026-09-16T21:00:00.000-04:00', formMode: 'production' }]
});

const normalizeResults = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Submission',
    position: [220, 0],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const j = $json;
function num(v) { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n) : 0; }
const likes = num(j['Likes']);
const comments = num(j['Comments']);
const saves = num(j['Saves']);
const shares = num(j['Shares']);
const reach = num(j['Reach / views']);
const happened = String(j['What happened?'] || 'Posted').toLowerCase();
const status = happened.indexOf('skip') >= 0 ? 'skipped' : 'posted';
const score = status === 'skipped' ? 0 : Math.round(likes + 2 * comments + 3 * saves + 2 * shares + reach / 100);
return { json: {
  post_id: String(j['Post ID'] || '').trim(),
  status: status,
  posted_date: DateTime.now().setZone('America/Aruba').toFormat('yyyy-LL-dd'),
  likes: likes, comments: comments, saves: saves, shares: shares, reach: reach,
  score: score,
  notes: String(j['Notes for the agent'] || '').trim()
} };
`
    }
  },
  output: [{ post_id: '20260914-airport-pickup', status: 'posted', posted_date: '2026-09-16', likes: 120, comments: 14, saves: 33, shares: 9, reach: 5400, score: 301, notes: 'Lots of DMs' }]
});

const updateRow = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Post Performance',
    position: [440, 0],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'bLjxeBsdJPqCudHf', cachedResultName: 'nexus_ig_posts' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'post_id', condition: 'eq', keyValue: expr('{{ $json.post_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          status: expr('{{ $json.status }}'),
          posted_date: expr('{{ $json.posted_date }}'),
          likes: expr('{{ $json.likes }}'),
          comments: expr('{{ $json.comments }}'),
          saves: expr('{{ $json.saves }}'),
          shares: expr('{{ $json.shares }}'),
          reach: expr('{{ $json.reach }}'),
          score: expr('{{ $json.score }}'),
          notes: expr('{{ $json.notes }}')
        },
        schema: [
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'posted_date', displayName: 'posted_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'likes', displayName: 'likes', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'comments', displayName: 'comments', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'saves', displayName: 'saves', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'shares', displayName: 'shares', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'reach', displayName: 'reach', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'score', displayName: 'score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1, createdAt: '2026-09-14T11:00:00.000Z', updatedAt: '2026-09-16T21:00:05.000Z' }]
});

const sundayCheck = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Sunday 17:00',
    position: [0, 300],
    parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [0], triggerAtHour: 17, triggerAtMinute: 0 }] } }
  },
  output: [{}]
});

const fetchDrafts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Fetch Posts Missing Results',
    position: [220, 300],
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'bLjxeBsdJPqCudHf', cachedResultName: 'nexus_ig_posts' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'drafted' }] },
      returnAll: true
    }
  },
  output: [{ post_id: '20260914-airport-pickup', created_date: '2026-09-14', theme: 'Airport pickup made easy', hook: 'Landing in Aruba?', status: 'drafted' }]
});

const buildReminder = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Reminder Email',
    position: [440, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const FORM_URL = 'https://paladinxsystems.app.n8n.cloud/form/nexus-ig-results';
const items = $input.all();
const rows = [];
for (let i = 0; i < items.length; i++) {
  const r = items[i].json;
  if (r && r.post_id) rows.push(r);
}
rows.sort(function (a, b) { return String(b.created_date || '').localeCompare(String(a.created_date || '')); });
const shown = rows.slice(0, 12);

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#202124">';
html += '<h2 style="margin:0 0 2px 0">Quick check-in: how did this week&#39;s posts do?</h2>';
html += '<div style="color:#5f6368;font-size:13px;margin-bottom:14px">' + rows.length + ' post(s) from the content packs have no results logged yet. Two minutes of numbers = a smarter content agent next week.</div>';
html += '<table style="width:100%;border-collapse:collapse;margin:6px 0 14px 0">';
html += '<tr><th style="text-align:left;padding:6px 8px;background:#f1f3f4;font-size:12px;color:#5f6368;border-bottom:1px solid #dadce0">Post ID</th><th style="text-align:left;padding:6px 8px;background:#f1f3f4;font-size:12px;color:#5f6368;border-bottom:1px solid #dadce0">Hook</th><th style="text-align:left;padding:6px 8px;background:#f1f3f4;font-size:12px;color:#5f6368;border-bottom:1px solid #dadce0">Drafted</th></tr>';
for (let i = 0; i < shown.length; i++) {
  const r = shown[i];
  html += '<tr><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #eee"><strong>' + esc(r.post_id) + '</strong></td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #eee">' + esc(String(r.hook || '').slice(0, 80)) + '</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #eee">' + esc(r.created_date || '') + '</td></tr>';
}
html += '</table>';
if (rows.length > shown.length) {
  html += '<div style="color:#5f6368;font-size:12px;margin-bottom:10px">…and ' + (rows.length - shown.length) + ' more.</div>';
}
html += '<a href="' + FORM_URL + '" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 18px;border-radius:6px">Log results (takes 2 min)</a>';
html += '<div style="color:#5f6368;font-size:12px;margin-top:10px">Open Instagram &rarr; post &rarr; View insights, then copy likes, comments, saves, shares and reach into the form. Mark skipped posts as Skipped so the agent stops suggesting that angle.</div>';
html += '<div style="color:#5f6368;font-size:11px;margin-top:16px">Sent automatically every Sunday when posts are missing results.</div>';
html += '</div>';

const subject = 'IG check-in — ' + rows.length + ' post(s) waiting for results';
return [{ json: { subject: subject, html: html } }];
`
    }
  },
  output: [{ subject: 'IG check-in — 3 post(s) waiting for results', html: '<div>...</div>' }]
});

const sendReminder = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Sunday Check-In',
    position: [660, 300],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'info@nexuscarsaruba.com',
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Nexus Content Engine' }
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: 'msg2', threadId: 'thr2', labelIds: ['SENT'] }]
});

const loopNote = sticky(`## Nexus IG Performance Log — the learning loop
This is how the content agent gets smarter.

**Form** (share/bookmark): https://paladinxsystems.app.n8n.cloud/form/nexus-ig-results
Team logs likes / comments / saves / shares / reach per post ID → the matching row in the *nexus_ig_posts* data table is updated with a weighted score (saves and shares count most).

**Sunday 17:00**: if any posts still have status "drafted", a check-in email lists them with a button to the form. No unlogged posts = no email.

Setup: connect **Gmail** on "Email Sunday Check-In", then activate. (The form URL above only works while this workflow is active.)`, [resultsForm, sundayCheck], { color: 4 });

export default workflow('nexus-ig-performance-log', 'Nexus IG Performance Log — Learning Loop')
  .add(resultsForm)
  .to(normalizeResults)
  .to(updateRow)
  .add(sundayCheck)
  .to(fetchDrafts)
  .to(buildReminder)
  .to(sendReminder)
  .add(loopNote);
