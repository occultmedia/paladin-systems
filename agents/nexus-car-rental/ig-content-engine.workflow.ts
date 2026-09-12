// Nexus IG Content Engine — Research, Draft, Learn
// Deployed: https://paladinxsystems.app.n8n.cloud/workflow/FtVx5tMkFxwUVMtU
// Workflow settings (set via API, not expressible in SDK source): timezone America/Aruba.
// Data table nexus_ig_posts = bLjxeBsdJPqCudHf.

import { workflow, node, trigger, sticky, newCredential, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const runSchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Mon/Wed/Fri 07:00',
    position: [0, 0],
    parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1, 3, 5], triggerAtHour: 7, triggerAtMinute: 0 }] } }
  },
  output: [{}]
});

const seedQueries = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Seed High-Intent Queries',
    position: [220, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const seeds = ['aruba car rental', 'car rental aruba airport', 'do you need a car in aruba', 'aruba jeep rental', 'aruba itinerary', 'things to do in aruba'];
return seeds.map(function (s) { return { json: { seed: s } }; });
`
    }
  },
  output: [{ seed: 'aruba car rental' }]
});

const fetchSuggest = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Google Suggest — Traveler Searches',
    position: [440, 0],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://suggestqueries.google.com/complete/search',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: 'client', value: 'firefox' }, { name: 'q', value: expr('{{ $json.seed }}') }] },
      options: { timeout: 15000, response: { response: { responseFormat: 'text', outputPropertyName: 'raw' } } }
    }
  },
  output: [{ raw: '["aruba car rental",["aruba car rental airport","aruba car rental tips"]]' }]
});

const fetchRedditAruba = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Reddit — r/aruba Top This Month',
    position: [660, 0],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://www.reddit.com/r/aruba/top.json',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: 't', value: 'month' }, { name: 'limit', value: '25' }] },
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'n8n:nexus-content-engine:1.0 (content research for a local Aruba business)' }] },
      options: { timeout: 20000, response: { response: { responseFormat: 'json' } } }
    }
  },
  output: [{ data: { children: [{ data: { title: 'Trip report: a week in Aruba with a rental car', ups: 140, num_comments: 32 } }] } }]
});

const fetchRedditSearch = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Reddit — Car Rental Conversations',
    position: [880, 0],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://www.reddit.com/search.json',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: 'q', value: 'aruba car rental' }, { name: 'sort', value: 'top' }, { name: 't', value: 'year' }, { name: 'limit', value: '25' }] },
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'n8n:nexus-content-engine:1.0 (content research for a local Aruba business)' }] },
      options: { timeout: 20000, response: { response: { responseFormat: 'json' } } }
    }
  },
  output: [{ data: { children: [{ data: { title: 'Do I really need a car in Aruba?', ups: 95, num_comments: 61 } }] } }]
});

const fetchHistory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Fetch Past Post Performance',
    position: [1100, 0],
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'bLjxeBsdJPqCudHf', cachedResultName: 'nexus_ig_posts' },
      returnAll: true
    }
  },
  output: [{ post_id: '20260908-airport-pickup', created_date: '2026-09-08', theme: 'Airport pickup made easy', format: 'reel', hook: 'Landing in Aruba?', status: 'posted', likes: 120, comments: 14, saves: 33, shares: 9, reach: 5400, score: 301, notes: '' }]
});

const buildBrief = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Research Brief',
    position: [1320, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const NL = String.fromCharCode(10);
const zone = 'America/Aruba';
const now = DateTime.now().setZone(zone);

const searchPhrases = [];
const suggestItems = $('Google Suggest — Traveler Searches').all();
for (let i = 0; i < suggestItems.length; i++) {
  const raw = suggestItems[i].json.raw;
  if (typeof raw !== 'string') continue;
  try {
    const parsed = JSON.parse(raw);
    const seed = String(parsed[0] || '');
    const sugs = Array.isArray(parsed[1]) ? parsed[1] : [];
    if (sugs.length) searchPhrases.push('- "' + seed + '" -> ' + sugs.slice(0, 8).join(' | '));
  } catch (e) {}
}

function redditLines(nodeName) {
  const lines = [];
  try {
    const first = $(nodeName).first();
    const resp = first ? first.json : null;
    const children = resp && resp.data && Array.isArray(resp.data.children) ? resp.data.children : [];
    for (let i = 0; i < children.length && lines.length < 12; i++) {
      const d = children[i].data || {};
      if (!d.title || d.stickied) continue;
      lines.push('- [' + (d.ups || 0) + ' upvotes, ' + (d.num_comments || 0) + ' comments] ' + String(d.title).slice(0, 140));
    }
  } catch (e) {}
  return lines;
}
const arubaSub = redditLines('Reddit — r/aruba Top This Month');
const rentalTalk = redditLines('Reddit — Car Rental Conversations');

const rows = [];
const histItems = $('Fetch Past Post Performance').all();
for (let i = 0; i < histItems.length; i++) {
  const r = histItems[i].json;
  if (r && r.post_id) rows.push(r);
}
rows.sort(function (a, b) { return String(b.created_date || '').localeCompare(String(a.created_date || '')); });
const recent = rows.slice(0, 9);
const scored = rows.filter(function (r) { return r.status === 'posted' && typeof r.score === 'number' && r.score > 0; });
scored.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
const top = scored.slice(0, 5);
const weak = scored.length > 5 ? scored.slice(-3).reverse() : [];

function postLine(r) {
  let line = '- [' + r.post_id + '] ' + (r.format || '?') + ' | theme: ' + (r.theme || '?') + ' | hook: "' + String(r.hook || '').slice(0, 90) + '" | status: ' + (r.status || '?');
  if (typeof r.score === 'number' && r.score > 0) {
    line += ' | score: ' + r.score + ' (likes ' + (r.likes || 0) + ', comments ' + (r.comments || 0) + ', saves ' + (r.saves || 0) + ', reach ' + (r.reach || 0) + ')';
  }
  if (r.notes) line += ' | team notes: ' + String(r.notes).slice(0, 120);
  return line;
}

const research = [];
research.push('== LIVE GOOGLE SEARCHES (high-intent phrases travelers type today) ==');
research.push(searchPhrases.length ? searchPhrases.join(NL) : '(unavailable this run — rely on evergreen high-intent angles)');
research.push('');
research.push('== REDDIT r/aruba — TOP THREADS THIS MONTH (what Aruba travelers care about right now) ==');
research.push(arubaSub.length ? arubaSub.join(NL) : '(unavailable this run)');
research.push('');
research.push('== REDDIT — ARUBA CAR RENTAL CONVERSATIONS (top of the last year) ==');
research.push(rentalTalk.length ? rentalTalk.join(NL) : '(unavailable this run)');

const history = [];
if (!rows.length) {
  history.push('No performance history yet — this is one of the first runs. Establish baselines: vary formats and pillars across the pack so we learn fast.');
} else {
  history.push('== TOP PERFORMERS (lean into what works) ==');
  history.push(top.length ? top.map(postLine).join(NL) : '(no scored posts yet)');
  history.push('');
  history.push('== WEAKEST SCORED POSTS (avoid these patterns) ==');
  history.push(weak.length ? weak.map(postLine).join(NL) : '(not enough data yet)');
  history.push('');
  history.push('== LAST 9 POSTS (do NOT repeat these themes or hooks) ==');
  history.push(recent.map(postLine).join(NL));
}

return [{ json: {
  runDate: now.toFormat('yyyy-LL-dd'),
  runLabel: now.toFormat('cccc d LLLL yyyy'),
  idPrefix: now.toFormat('yyyyLLdd'),
  researchBrief: research.join(NL),
  historyBrief: history.join(NL)
} }];
`
    }
  },
  output: [{ runDate: '2026-09-14', runLabel: 'Monday 14 September 2026', idPrefix: '20260914', researchBrief: '== LIVE GOOGLE SEARCHES ==', historyBrief: 'No performance history yet' }]
});

const claudeCreative = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Claude Sonnet 5 (Creative)',
    position: [1440, 240],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' },
      options: { maxTokensToSample: 8000 }
    },
    credentials: { anthropicApi: newCredential('Anthropic') }
  }
});

const packParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Content Pack Schema',
    position: [1680, 240],
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{ "strategy_note": "Search interest is spiking around airport pickup, so two posts answer arrival questions.", "experiment": "Post 3 tests a POV reel because we have never tried first-person hooks.", "posts": [ { "slug": "airport-pickup", "format": "reel", "theme": "Airport pickup made easy", "target_audience": "High-intent planners flying into AUA in the next 90 days", "hook": "Landing in Aruba? Your car should land with you.", "caption": "Bon bini! Here is how pickup works...", "hashtags": "#aruba #arubacarrental #arubatravel #onehappyisland", "visual_direction": "Clip 1: arrivals hall pan. Clip 2: keys handed over. Clip 3: driving off with ocean view.", "cta": "Book your car before you fly — link in bio.", "best_time": "6:30 PM AST — trip planners scroll after dinner" } ] }'
    }
  }
});

const creativeDirector = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Creative Director — Claude',
    position: [1560, 0],
    parameters: {
      promptType: 'define',
      text: expr('Create the next Instagram content pack for Nexus Car Rental Aruba.\n\nRun date: {{ $json.runLabel }}\n\n=== FRESH MARKET RESEARCH (collected minutes ago) ===\n{{ $json.researchBrief }}\n\n=== OUR PERFORMANCE HISTORY ===\n{{ $json.historyBrief }}'),
      hasOutputParser: true,
      options: {
        systemMessage: `You are the marketing brain for Nexus Car Rental Aruba — an independent car rental company on Aruba (airport: Queen Beatrix International, AUA). You act as a senior social media strategist and direct-response copywriter who deeply understands Instagram.

# Mission
Grow bookings by turning high-intent Aruba travelers into website and DM inquiries, and build a brand that visitors and locals trust.

# Who we target (priority order)
1. HIGH INTENT: people actively planning an Aruba trip in the next 0-90 days. They type searches like "car rental aruba airport" and "do you need a car in aruba". Content that answers their exact questions converts best.
2. Cruise passengers with one day on the island (see-the-whole-island-by-car angle).
3. Returning visitors and long-stay guests (snowbirds, remote workers).
4. Locals who need a temporary car.

# Content pillars (rotate — never two posts from the same pillar in one pack)
A. ANSWER HIGH-INTENT QUESTIONS: airport pickup, driving in Aruba, do-you-need-a-car, places you can only reach by car (Arikok National Park, Baby Beach, California Lighthouse, Mangel Halto).
B. ITINERARY / HIDDEN-GEM VALUE: save-worthy mini guides ("5 stops on the north coast loop") that implicitly require a car.
C. TRUST AND BEHIND THE SCENES: clean cars, real team, easy pickup, honest service. Humanize the brand.
D. SOCIAL PROOF AND GUEST MOMENTS: reviews, guest stories, UGC-style moments.
E. DIRECT OFFER / BOOKING PUSH: clear call to book (max 1 per pack).

# Viral mechanics you must apply
- Hook in the first line / first 1.5 seconds: curiosity, specificity, or a strong opinion. Never open with "Did you know".
- Reels and carousels outperform single images; pick the format that fits the idea.
- Optimize for SAVES and SHARES (practical value, itineraries, checklists) — the algorithm rewards them most.
- Captions: first line is the hook, short lines, whitespace, one idea per line, CTA at the end.
- Hashtags: 8-15, mixing broad travel tags (#aruba #arubatravel #onehappyisland) with intent tags (#arubacarrental #arubaairport #arubaitinerary).
- Visual directions must be executable by a small team with a phone — no drone crews, no actors.

# How to use the research
The user message contains TODAY's Google autocomplete phrases (what high-intent travelers literally type) plus current Reddit threads. Anchor at least 2 of the 3 posts in something concrete from that research — a question, worry, trend, or topic. Use the angle; never copy text.

# How to improve every run (your feedback loop)
The performance history shows real results of past posts (score = weighted engagement).
- Double down on themes, formats, and hook styles that appear under TOP PERFORMERS.
- Avoid the patterns of the weakest posts.
- Never repeat a theme or hook from the LAST 9 POSTS list.
- Post 3 is always an EXPERIMENT: a format, angle, or hook style we have not tried yet. State the hypothesis in "experiment".

# Hard rules
- NEVER invent prices, discounts, availability, fleet details, or policies. Where a business fact is needed, write [CHECK: what to confirm] and keep the post usable without it.
- English captions; you may open with "Bon bini" (Papiamento welcome) when it fits.
- No competitor bashing, no engagement bait ("tag 5 friends"), no fake urgency, nothing that could embarrass the brand.
- Every post must plausibly move someone closer to renting a car in Aruba.

# Output
Return exactly the JSON the schema requires: strategy_note (2-3 sentences: what the research says and what you chose to do), experiment (what post 3 tests and why), and posts — EXACTLY 3 posts. Per post: slug (2-4 words, kebab-case), format (reel | carousel | single image | story), theme, target_audience, hook, caption (ready to paste, with natural line breaks and emoji where they help), hashtags (one space-separated string), visual_direction (numbered shot list or slide list), cta, best_time (Aruba time plus a one-clause reason).`
      }
    },
    subnodes: { model: claudeCreative, outputParser: packParser }
  },
  output: [{ output: { strategy_note: 'Airport questions dominate current searches.', experiment: 'POV reel test.', posts: [{ slug: 'airport-pickup', format: 'reel', theme: 'Airport pickup made easy', target_audience: 'Planners flying into AUA', hook: 'Landing in Aruba?', caption: 'Bon bini!', hashtags: '#aruba #arubacarrental', visual_direction: 'Clip 1: arrivals hall.', cta: 'Book before you fly.', best_time: '6:30 PM AST' }] } }]
});

const prepareRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Draft Rows',
    position: [1800, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const pack = $('Creative Director — Claude').first().json.output || {};
const brief = $('Build Research Brief').first().json;
const posts = Array.isArray(pack.posts) ? pack.posts : [];
const out = [];
for (let i = 0; i < posts.length; i++) {
  const p = posts[i] || {};
  const slugSrc = String(p.slug || p.theme || 'post-' + (i + 1)).toLowerCase();
  let slug = slugSrc.replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '').slice(0, 40);
  if (!slug) slug = 'post-' + (i + 1);
  out.push({ json: {
    post_id: brief.idPrefix + '-' + slug,
    created_date: brief.runDate,
    theme: String(p.theme || ''),
    format: String(p.format || ''),
    hook: String(p.hook || ''),
    caption: String(p.caption || ''),
    hashtags: String(p.hashtags || ''),
    visual_direction: String(p.visual_direction || ''),
    cta: String(p.cta || ''),
    target_audience: String(p.target_audience || ''),
    status: 'drafted',
    posted_date: '',
    likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, score: 0,
    notes: '',
    best_time: String(p.best_time || '')
  } });
}
return out;
`
    }
  },
  output: [{ post_id: '20260914-airport-pickup', created_date: '2026-09-14', theme: 'Airport pickup made easy', format: 'reel', hook: 'Landing in Aruba?', caption: 'Bon bini!', hashtags: '#aruba', visual_direction: 'Clip 1', cta: 'Book now', target_audience: 'Planners', status: 'drafted', posted_date: '', likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, score: 0, notes: '', best_time: '6:30 PM AST' }]
});

const insertRows = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Log Drafts to Content Table',
    position: [2020, -120],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'bLjxeBsdJPqCudHf', cachedResultName: 'nexus_ig_posts' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          post_id: expr('{{ $json.post_id }}'),
          created_date: expr('{{ $json.created_date }}'),
          theme: expr('{{ $json.theme }}'),
          format: expr('{{ $json.format }}'),
          hook: expr('{{ $json.hook }}'),
          caption: expr('{{ $json.caption }}'),
          hashtags: expr('{{ $json.hashtags }}'),
          visual_direction: expr('{{ $json.visual_direction }}'),
          cta: expr('{{ $json.cta }}'),
          target_audience: expr('{{ $json.target_audience }}'),
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
          { id: 'post_id', displayName: 'post_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_date', displayName: 'created_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'theme', displayName: 'theme', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'format', displayName: 'format', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hook', displayName: 'hook', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'caption', displayName: 'caption', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hashtags', displayName: 'hashtags', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'visual_direction', displayName: 'visual_direction', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'cta', displayName: 'cta', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'target_audience', displayName: 'target_audience', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
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
  output: [{ id: 1, createdAt: '2026-09-14T11:00:00.000Z', updatedAt: '2026-09-14T11:00:00.000Z' }]
});

const buildEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Approval Email',
    position: [2020, 120],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const FORM_URL = 'https://paladinxsystems.app.n8n.cloud/form/nexus-ig-results';
const rows = $input.all().map(function (i) { return i.json; });
const pack = $('Creative Director — Claude').first().json.output || {};
const brief = $('Build Research Brief').first().json;

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function nl2br(s) { return esc(s).split(String.fromCharCode(10)).join('<br>'); }

const label = 'padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;display:inline-block;margin-right:6px';
const box = 'background:#f8f9fa;border:1px solid #dadce0;border-radius:6px;padding:10px 14px;margin:0 0 14px 0;font-size:13px';
const fieldName = 'font-size:11px;color:#5f6368;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 2px 0;font-weight:bold';
const fieldVal = 'font-size:13px;color:#202124;margin:0';

let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#202124">';
html += '<h2 style="margin:0 0 2px 0">Instagram Content Pack — Nexus Car Rental Aruba</h2>';
html += '<div style="color:#5f6368;font-size:13px;margin-bottom:14px">' + esc(brief.runLabel) + ' &middot; researched, written and ranked by your content agent &middot; nothing is posted automatically</div>';
html += '<div style="' + box + '"><strong>Strategy this run:</strong> ' + esc(pack.strategy_note || '') + '</div>';
if (pack.experiment) {
  html += '<div style="' + box + 'border-left:4px solid #7b2ff2"><strong>Experiment:</strong> ' + esc(pack.experiment) + '</div>';
}
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  html += '<div style="border:1px solid #dadce0;border-radius:8px;padding:14px 16px;margin-bottom:16px">';
  html += '<div style="margin-bottom:6px"><span style="' + label + 'background:#e8f0fe;color:#1a73e8">POST ' + (i + 1) + '</span>';
  html += '<span style="' + label + 'background:#fce8e6;color:#d93025">' + esc((r.format || 'post').toUpperCase()) + '</span>';
  html += '<span style="color:#5f6368;font-size:12px">' + esc(r.theme) + '</span></div>';
  html += '<div style="' + fieldName + '">Targets</div><p style="' + fieldVal + '">' + esc(r.target_audience) + '</p>';
  html += '<div style="' + fieldName + '">Hook</div><p style="' + fieldVal + ';font-weight:bold">' + esc(r.hook) + '</p>';
  html += '<div style="' + fieldName + '">Caption (copy-paste)</div><div style="background:#f8f9fa;border:1px solid #eee;border-radius:6px;padding:10px 12px;font-size:13px;white-space:pre-wrap">' + nl2br(r.caption) + '</div>';
  html += '<div style="' + fieldName + '">Hashtags</div><p style="' + fieldVal + ';color:#1a73e8">' + esc(r.hashtags) + '</p>';
  html += '<div style="' + fieldName + '">How to shoot it</div><p style="' + fieldVal + '">' + nl2br(r.visual_direction) + '</p>';
  html += '<div style="' + fieldName + '">CTA</div><p style="' + fieldVal + '">' + esc(r.cta) + '</p>';
  html += '<div style="' + fieldName + '">Best time to post</div><p style="' + fieldVal + '">' + esc(r.best_time) + '</p>';
  html += '<div style="margin-top:10px;font-size:12px;color:#5f6368">When posted (or skipped), log it under ID <strong>' + esc(r.post_id) + '</strong></div>';
  html += '</div>';
}
html += '<div style="' + box + '"><strong>How this agent improves:</strong> post what you like (edit freely), skip what you do not, and after ~48 hours log likes / comments / saves / reach';
if (FORM_URL.indexOf('REPLACE') === -1) {
  html += ' via the <a href="' + FORM_URL + '">results form</a>';
} else {
  html += ' via the results form (see the Nexus IG Performance Log workflow)';
}
html += '. The agent studies every number before writing the next pack.</div>';
html += '<div style="color:#5f6368;font-size:11px;margin-top:8px">Generated automatically — review before posting. Facts marked [CHECK: ...] must be verified.</div>';
html += '</div>';

const subject = 'IG Content Pack ' + brief.runDate + ' — 3 posts to review';
return [{ json: { subject: subject, html: html } }];
`
    }
  },
  output: [{ subject: 'IG Content Pack 2026-09-14 — 3 posts to review', html: '<div>...</div>' }]
});

const sendPack = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Pack for Approval',
    position: [2240, 120],
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
  output: [{ id: 'msg1', threadId: 'thr1', labelIds: ['SENT'] }]
});

const setupNote = sticky(`## Nexus IG Content Engine — setup
1. **Anthropic** — add your Anthropic API key to the credential on the "Claude Sonnet 5 (Creative)" node.
2. **Gmail** — connect the Google account in "Email Pack for Approval".
3. Optional: paste your results-form URL into FORM_URL at the top of "Build Approval Email" (the form lives in the "Nexus IG Performance Log" workflow).
4. Activate. Runs **Mon / Wed / Fri 07:00** (set workflow timezone to America/Aruba in Settings if not already).

**Learning loop:** every pack is logged to the *nexus_ig_posts* data table as "drafted". When the team logs real results via the form, the next run reads top performers + flops and adapts. Post 3 is always an experiment.

Research sources are keyless (Google autocomplete + Reddit); if one is down the run continues with the rest.`, [runSchedule, seedQueries], { color: 4 });

export default workflow('nexus-ig-content-engine', 'Nexus IG Content Engine — Research, Draft, Learn')
  .add(runSchedule)
  .to(seedQueries)
  .to(fetchSuggest)
  .to(fetchRedditAruba)
  .to(fetchRedditSearch)
  .to(fetchHistory)
  .to(buildBrief)
  .to(creativeDirector)
  .to(prepareRows)
  .to(insertRows)
  .add(prepareRows)
  .to(buildEmail)
  .to(sendPack)
  .add(setupNote);
