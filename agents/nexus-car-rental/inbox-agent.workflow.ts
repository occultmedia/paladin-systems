// Nexus Inbox Agent — Reply Drafts for Approval
// Deployed: https://paladinxsystems.app.n8n.cloud/workflow/CaZ9lmPGWEDUhyFz
// Workflow settings (set via API, not expressible in SDK source): timezone America/Aruba.
// Approval is structural: there is no send node — replies are created as Gmail
// drafts inside the original thread and a human sends (or discards) them.

import { workflow, node, trigger, sticky, newCredential, languageModel, outputParser, ifElse, expr } from '@n8n/workflow-sdk';

const inboxTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.4,
  config: {
    name: 'New Email in Inbox',
    position: [0, 0],
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      simple: false,
      filters: {
        q: '-from:me -category:promotions -category:social -category:forums',
        readStatus: 'unread'
      },
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: '18f2a1b2c3d4e5f6', threadId: '18f2a1b2c3d4e5f6', labelIds: ['UNREAD', 'INBOX'], subject: 'Car rental 12-19 December', date: '2026-09-12T14:03:00.000Z', from: { value: [{ address: 'sarah@example.com', name: 'Sarah Jones' }], text: 'Sarah Jones <sarah@example.com>' }, to: { value: [{ address: 'info@nexuscarsaruba.com', name: '' }] }, text: 'Hi, do you have an automatic SUV available from Dec 12 to 19? We land at 2pm. Thanks, Sarah', html: '<div>Hi, do you have an automatic SUV available from Dec 12 to 19?</div>' }]
});

const extractEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Email Essentials',
    position: [220, 0],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `
const j = $json;
let fromAddress = '';
let fromName = '';
if (j.from && Array.isArray(j.from.value) && j.from.value.length) {
  fromAddress = String(j.from.value[0].address || '');
  fromName = String(j.from.value[0].name || '');
} else if (typeof j.from === 'string') {
  fromAddress = j.from;
}
let body = '';
if (typeof j.text === 'string' && j.text.trim()) {
  body = j.text;
} else if (typeof j.html === 'string' && j.html.trim()) {
  body = j.html.replace(/<style[^]*?<[/]style>/gi, ' ').replace(/<script[^]*?<[/]script>/gi, ' ').replace(/<[^>]+>/g, ' ');
} else if (typeof j.snippet === 'string') {
  body = j.snippet;
}
body = String(body).replace(/[ ]{2,}/g, ' ').trim();
if (body.length > 6000) body = body.slice(0, 6000) + ' [... truncated ...]';
const subject = typeof j.subject === 'string' && j.subject.trim() ? j.subject.trim() : '(no subject)';
const lower = subject.toLowerCase();
const replySubject = lower.indexOf('re:') === 0 ? subject : 'Re: ' + subject;
return { json: {
  gmailMessageId: String(j.id || ''),
  threadId: String(j.threadId || ''),
  fromAddress: fromAddress,
  fromName: fromName || fromAddress || 'Unknown sender',
  subject: subject,
  replySubject: replySubject,
  receivedAt: String(j.date || ''),
  bodyText: body || '(empty body)'
} };
`
    }
  },
  output: [{ gmailMessageId: '18f2a1b2c3d4e5f6', threadId: '18f2a1b2c3d4e5f6', fromAddress: 'sarah@example.com', fromName: 'Sarah Jones', subject: 'Car rental 12-19 December', replySubject: 'Re: Car rental 12-19 December', receivedAt: '2026-09-12T14:03:00.000Z', bodyText: 'Hi, do you have an automatic SUV available from Dec 12 to 19? We land at 2pm. Thanks, Sarah' }]
});

const claudeInbox = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Claude Sonnet 5 (Inbox)',
    position: [360, 220],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' },
      options: { maxTokensToSample: 4096 }
    },
    credentials: { anthropicApi: newCredential('Anthropic') }
  }
});

const replyParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Reply Draft Schema',
    position: [600, 220],
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{ "category": "booking_inquiry", "should_draft": true, "confidence": 0.93, "reasoning": "Customer asks about SUV availability for December dates.", "subject": "Re: Car rental 12-19 December", "body_html": "<p>Hi Sarah,</p><p>Thank you for reaching out!</p>" }'
    }
  }
});

const triageAndDraft = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Triage & Draft Reply — Claude',
    position: [480, 0],
    parameters: {
      promptType: 'define',
      text: expr('A new email arrived in the Nexus Car Rental Aruba inbox. Classify it and, if appropriate, draft the reply.\n\nFrom: {{ $json.fromName }} <{{ $json.fromAddress }}>\nSubject: {{ $json.subject }}\nReceived: {{ $json.receivedAt }}\n\nEmail body:\n{{ $json.bodyText }}'),
      hasOutputParser: true,
      options: {
        systemMessage: `You are the inbox assistant for Nexus Car Rental Aruba, a car rental company on Aruba (airport: Queen Beatrix International, AUA — email: info@nexuscarsaruba.com). You read ONE incoming email and produce (1) a classification and (2) when appropriate, a reply draft. A human reviews every draft inside Gmail before anything is sent — you never send email yourself.

# Business facts you may state (EDIT ME — keep current; treat as the ONLY source of truth)
- Company: Nexus Car Rental Aruba. Contact: info@nexuscarsaruba.com.
- Pickup on Aruba; airport pickup available at AUA [CHECK: confirm exact meeting-point wording].
- Bookings are made through the booking page on our website.
- [CHECK: fleet categories and transmission options]
- [CHECK: minimum driver age and license requirements]
- [CHECK: deposit amount and accepted payment methods]
- [CHECK: insurance coverage options]
- [CHECK: hotel/cruise-terminal delivery availability]
Anything not in this list must NOT be stated as fact.

# Classify (category)
- booking_inquiry: wants to rent, asks availability or how to book
- quote_request: asks a price for dates or a vehicle
- existing_booking: change, extend, cancel, or a question about a current or past booking
- logistics: pickup, drop-off, airport meeting point, hours, requirements, driving on Aruba
- complaint: unhappy about service, vehicle, or a charge
- partnership_or_vendor: hotels, tour operators, suppliers, influencers, B2B
- automated_or_marketing: newsletters, receipts, notifications, no-reply senders, system mail
- spam_or_irrelevant: everything else

# should_draft
true → booking_inquiry, quote_request, existing_booking, logistics, complaint, partnership_or_vendor.
false → automated_or_marketing, spam_or_irrelevant, and anything a human must write personally from scratch (legal threats, press, obvious scams). Explain the decision in "reasoning" (one short sentence).

# Drafting rules
- Reply in the language of the sender (English, Spanish, Dutch or Papiamento).
- Warm, professional, concise — a helpful island business, not a corporation. Greet by first name when known.
- Answer everything you CAN from Business facts. For anything you cannot know (prices, availability, refunds, exceptions) do NOT guess: keep the sentence and insert [CHECK: exact thing the team must fill in] where the fact belongs.
- Always move things forward: confirm their dates back to them, point to the booking page, or ask for the one missing detail (dates, flight number, vehicle type, booking number).
- Quotes: restate their dates and wishes, then structure the reply so the team only fills in [CHECK: quote for these dates].
- Complaints: lead with empathy and an apology for the experience (never admit legal fault, never promise compensation), and say the team is personally looking into it.
- Existing bookings: ask for the booking number if it is missing.
- Sign off as "The Nexus Car Rental Aruba team" — never invent a personal name.
- body_html is simple HTML: <p> paragraphs and <br> only. No styling, no images, no signature banners.

# Output
Return exactly: category, should_draft (boolean), confidence (0-1), reasoning (one short sentence shown to the team), subject (reply subject, usually starting with "Re:"), body_html (empty string when should_draft is false).`
      }
    },
    subnodes: { model: claudeInbox, outputParser: replyParser }
  },
  output: [{ output: { category: 'booking_inquiry', should_draft: true, confidence: 0.93, reasoning: 'Customer asks about SUV availability for December dates.', subject: 'Re: Car rental 12-19 December', body_html: '<p>Hi Sarah,</p><p>Thank you for reaching out!</p>' } }]
});

const shouldDraft = ifElse({
  version: 2.3,
  config: {
    name: 'Needs a Reply Draft?',
    position: [740, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.output.should_draft }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const createDraft = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Create Draft in Thread',
    position: [980, -100],
    parameters: {
      resource: 'draft',
      operation: 'create',
      subject: expr("{{ $('Extract Email Essentials').item.json.replySubject }}"),
      emailType: 'html',
      message: expr('{{ $json.output.body_html }}'),
      options: {
        threadId: expr("{{ $('Extract Email Essentials').item.json.threadId }}"),
        sendTo: expr("{{ $('Extract Email Essentials').item.json.fromAddress }}")
      }
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: 'r-draft-1', message: { id: 'm1', threadId: '18f2a1b2c3d4e5f6', labelIds: ['DRAFT'] } }]
});

const skipEmail = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Skip — No Reply Needed', position: [980, 100], parameters: {} },
  output: [{ output: { category: 'automated_or_marketing', should_draft: false } }]
});

const inboxNote = sticky(`## Nexus Inbox Agent — how it works
Checks the inbox **every minute** for new unread email (own mail, promos and social are filtered out). Claude classifies each message and, for real customer email, writes a reply draft **inside the same Gmail thread**.

**Nothing is ever sent automatically.** Open the thread in Gmail → the draft is waiting → edit if needed → hit Send. Facts the agent cannot know appear as [CHECK: ...] for you to fill in.

Setup:
1. Connect **Gmail** (info@nexuscarsaruba.com) on the trigger and on "Create Draft in Thread".
2. Add the **Anthropic** API key on "Claude Sonnet 5 (Inbox)".
3. Update the "Business facts" block in the agent's system message — replace every [CHECK: ...] you can (pickup point, ages, deposit, fleet). The more facts, the fewer blanks in drafts.
4. Activate.`, [inboxTrigger, extractEmail], { color: 4 });

export default workflow('nexus-inbox-agent', 'Nexus Inbox Agent — Reply Drafts for Approval')
  .add(inboxTrigger)
  .to(extractEmail)
  .to(triageAndDraft)
  .to(shouldDraft
    .onTrue(createDraft)
    .onFalse(skipEmail))
  .add(inboxNote);
