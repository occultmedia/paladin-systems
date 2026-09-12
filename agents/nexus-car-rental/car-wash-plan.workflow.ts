// Weekly Car Wash Plan — Booqable
// Source of truth — conversion of the original workflow (built before this repo folder
// existed) so it can be redeployed to any workspace. Deploy via n8n MCP
// validate_workflow + create_workflow_from_code; set workflow timezone to America/Aruba.
// Every Monday 07:00 AST: pulls the coming week's pickups/returns from Booqable, flags
// same-day / next-day turnarounds, emails a day-by-day wash plan.

import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

const mondaySchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Every Monday 07:00',
    position: [0, 0],
    parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 7, triggerAtMinute: 0 }] } }
  },
  output: [{}]
});

const computeWindow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Compute Date Window',
    position: [220, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const zone = 'America/Aruba';
const now = DateTime.now().setZone(zone);
const weekStart = now.startOf('day');
const weekEnd = weekStart.plus({ days: 7 });
const pickupsEnd = weekStart.plus({ days: 8 });
const label = weekStart.toFormat('d LLL') + ' - ' + weekEnd.minus({ days: 1 }).toFormat('d LLL yyyy');
return [{ json: {
  zone: zone,
  weekStartISO: weekStart.toISO({ suppressMilliseconds: true }),
  weekEndISO: weekEnd.toISO({ suppressMilliseconds: true }),
  pickupsEndISO: pickupsEnd.toISO({ suppressMilliseconds: true }),
  weekLabel: label
} }];
`
    }
  },
  output: [{ zone: 'America/Aruba', weekStartISO: '2026-09-14T00:00:00-04:00', weekEndISO: '2026-09-21T00:00:00-04:00', pickupsEndISO: '2026-09-22T00:00:00-04:00', weekLabel: '14 Sep - 20 Sep 2026' }]
});

const fetchPickups = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch Upcoming Pickups',
    position: [440, 0],
    parameters: {
      method: 'GET',
      url: 'https://tropicars-car-rental.booqable.com/api/4/plannings',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: 'filter[starts_at][gte]', value: expr("{{ $('Compute Date Window').first().json.weekStartISO }}") },
          { name: 'filter[starts_at][lt]', value: expr("{{ $('Compute Date Window').first().json.pickupsEndISO }}") },
          { name: 'include', value: 'item,order,order.customer,stock_item_plannings.stock_item' },
          { name: 'page[size]', value: '100' }
        ]
      },
      options: {
        timeout: 30000,
        response: { response: { responseFormat: 'json' } },
        pagination: {
          pagination: {
            paginationMode: 'updateAParameterInEachRequest',
            parameters: { parameters: [{ type: 'qs', name: 'page[number]', value: expr('{{ $pageCount + 1 }}') }] },
            paginationCompleteWhen: 'other',
            completeExpression: expr('{{ ($response.body.data || []).length === 0 }}'),
            limitPagesFetched: true,
            maxRequests: 15,
            requestInterval: 300
          }
        }
      }
    },
    credentials: { httpTemplatedCustomAuth: newCredential('Booqable API') }
  },
  output: [{ data: [{ id: 'p1', type: 'plannings', attributes: { starts_at: '2026-09-15T14:00:00Z', stops_at: '2026-09-19T14:00:00Z', quantity: 1 } }], included: [] }]
});

const fetchReturns = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch Upcoming Returns',
    position: [660, 0],
    executeOnce: true,
    parameters: {
      method: 'GET',
      url: 'https://tropicars-car-rental.booqable.com/api/4/plannings',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: 'filter[stops_at][gte]', value: expr("{{ $('Compute Date Window').first().json.weekStartISO }}") },
          { name: 'filter[stops_at][lt]', value: expr("{{ $('Compute Date Window').first().json.weekEndISO }}") },
          { name: 'include', value: 'item,order,order.customer,stock_item_plannings.stock_item' },
          { name: 'page[size]', value: '100' }
        ]
      },
      options: {
        timeout: 30000,
        response: { response: { responseFormat: 'json' } },
        pagination: {
          pagination: {
            paginationMode: 'updateAParameterInEachRequest',
            parameters: { parameters: [{ type: 'qs', name: 'page[number]', value: expr('{{ $pageCount + 1 }}') }] },
            paginationCompleteWhen: 'other',
            completeExpression: expr('{{ ($response.body.data || []).length === 0 }}'),
            limitPagesFetched: true,
            maxRequests: 15,
            requestInterval: 300
          }
        }
      }
    },
    credentials: { httpTemplatedCustomAuth: newCredential('Booqable API') }
  },
  output: [{ data: [{ id: 'p2', type: 'plannings', attributes: { starts_at: '2026-09-10T14:00:00Z', stops_at: '2026-09-16T14:00:00Z', quantity: 1 } }], included: [] }]
});

const buildPlan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Wash Plan',
    position: [880, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `
const zone = 'America/Aruba';
const win = $('Compute Date Window').first().json;
const weekStart = DateTime.fromISO(win.weekStartISO, { setZone: true });
const weekEnd = DateTime.fromISO(win.weekEndISO, { setZone: true });

const pickupPages = $('Fetch Upcoming Pickups').all().map(function (i) { return i.json; });
const returnPages = $('Fetch Upcoming Returns').all().map(function (i) { return i.json; });

const included = {};
function indexPage(page) {
  const inc = page.included || [];
  for (let k = 0; k < inc.length; k++) { included[inc[k].type + ':' + inc[k].id] = inc[k]; }
}
pickupPages.forEach(indexPage);
returnPages.forEach(indexPage);

function lookup(ref) { return ref ? included[ref.type + ':' + ref.id] : undefined; }
function rel(res, name) {
  if (!res || !res.relationships || !res.relationships[name]) return undefined;
  return res.relationships[name].data;
}

function toRow(p) {
  const a = p.attributes || {};
  const order = lookup(rel(p, 'order'));
  const oa = order ? (order.attributes || {}) : {};
  const customer = order ? lookup(rel(order, 'customer')) : undefined;
  const itemRef = rel(p, 'item');
  const item = lookup(itemRef);
  let sipRefs = rel(p, 'stock_item_plannings') || [];
  if (!Array.isArray(sipRefs)) sipRefs = [sipRefs];
  const plates = [];
  for (let k = 0; k < sipRefs.length; k++) {
    const sip = lookup(sipRefs[k]);
    const si = sip ? lookup(rel(sip, 'stock_item')) : undefined;
    if (si && si.attributes && si.attributes.identifier) plates.push(String(si.attributes.identifier));
  }
  return {
    planningId: p.id,
    vehicle: item && item.attributes && item.attributes.name ? item.attributes.name : 'Unknown vehicle',
    plates: plates,
    unitKey: plates.length ? plates.slice().sort().join('+') : null,
    productKey: itemRef ? itemRef.type + ':' + itemRef.id : null,
    quantity: a.quantity || 1,
    startsAt: a.starts_at ? DateTime.fromISO(a.starts_at, { zone: 'utc' }).setZone(zone) : null,
    stopsAt: a.stops_at ? DateTime.fromISO(a.stops_at, { zone: 'utc' }).setZone(zone) : null,
    orderNumber: (oa.number !== undefined && oa.number !== null) ? oa.number : null,
    orderStatus: oa.status || 'unknown',
    customerName: customer && customer.attributes && customer.attributes.name ? customer.attributes.name : '',
    archived: a.archived === true,
    turnaround: 'none',
    nextOutAt: null, nextOutOrder: null, nextOutCustomer: null,
    tightInAt: null, tightInOrder: null
  };
}

function collect(pages) {
  const out = [];
  const seen = {};
  for (let g = 0; g < pages.length; g++) {
    const data = pages[g].data || [];
    for (let k = 0; k < data.length; k++) {
      const row = toRow(data[k]);
      if (seen[row.planningId]) continue;
      seen[row.planningId] = true;
      if (row.archived) continue;
      if (row.orderStatus === 'canceled' || row.orderStatus === 'concept') continue;
      out.push(row);
    }
  }
  return out;
}

const allPickups = collect(pickupPages).filter(function (r) { return r.startsAt; });
const allReturns = collect(returnPages).filter(function (r) { return r.stopsAt; });
const weekPickups = allPickups.filter(function (r) { return r.startsAt >= weekStart && r.startsAt < weekEnd; });
const weekReturns = allReturns.filter(function (r) { return r.stopsAt >= weekStart && r.stopsAt < weekEnd; });

function sameVehicle(a, b) {
  if (a.unitKey && b.unitKey) { return a.unitKey === b.unitKey; }
  return !!(a.productKey && b.productKey && a.productKey === b.productKey);
}

for (let k = 0; k < weekReturns.length; k++) {
  const ret = weekReturns[k];
  const retDay = ret.stopsAt.startOf('day');
  const cands = allPickups.filter(function (p) {
    if (p.planningId === ret.planningId) { return false; }
    if (!sameVehicle(ret, p)) { return false; }
    const dd = p.startsAt.startOf('day').diff(retDay, 'days').days;
    return dd >= 0 && dd <= 1;
  }).sort(function (a, b) { return a.startsAt.toMillis() - b.startsAt.toMillis(); });
  if (cands.length) {
    const nx = cands[0];
    const dd = nx.startsAt.startOf('day').diff(retDay, 'days').days;
    ret.turnaround = dd === 0 ? 'same-day' : 'next-day';
    ret.nextOutAt = nx.startsAt;
    ret.nextOutOrder = nx.orderNumber;
    ret.nextOutCustomer = nx.customerName;
    nx.tightInAt = ret.stopsAt;
    nx.tightInOrder = ret.orderNumber;
  }
}

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtT(dt) { return dt ? dt.toFormat('HH:mm') : '--'; }
function fmtDT(dt) { return dt ? dt.toFormat('ccc d LLL HH:mm') : '--'; }
function vehLabel(r) {
  let v = '<strong>' + esc(r.vehicle) + '</strong>';
  if (r.plates.length) { v += ' <span style="color:#5f6368">(' + esc(r.plates.join(', ')) + ')</span>'; }
  if (r.quantity > 1) { v += ' <span style="color:#5f6368">x' + r.quantity + '</span>'; }
  return v;
}
function whoLabel(r) {
  const parts = [];
  if (r.orderNumber !== null) { parts.push('#' + esc(r.orderNumber)); }
  if (r.customerName) { parts.push(esc(r.customerName)); }
  return parts.join(' &middot; ');
}
function flagLabel(r) {
  if (r.turnaround === 'same-day') {
    return '<span style="color:#d93025;font-weight:bold">WASH ASAP &mdash; goes out same day ' + fmtT(r.nextOutAt) + (r.nextOutOrder !== null ? ' (#' + esc(r.nextOutOrder) + ')' : '') + '</span>';
  }
  if (r.turnaround === 'next-day') {
    return '<span style="color:#e8710a;font-weight:bold">WASH SAME DAY &mdash; goes out next day ' + fmtDT(r.nextOutAt) + (r.nextOutOrder !== null ? ' (#' + esc(r.nextOutOrder) + ')' : '') + '</span>';
  }
  return '<span style="color:#188038">no rental within 1 day</span>';
}

const thStyle = 'text-align:left;padding:6px 8px;background:#f1f3f4;font-size:12px;color:#5f6368;border-bottom:1px solid #dadce0';
const tdStyle = 'padding:6px 8px;font-size:13px;border-bottom:1px solid #eee;vertical-align:top';
const tableStyle = 'width:100%;border-collapse:collapse;margin:6px 0 14px 0';

const sameDayList = weekReturns.filter(function (r) { return r.turnaround === 'same-day'; });
const nextDayList = weekReturns.filter(function (r) { return r.turnaround === 'next-day'; });
const tight = sameDayList.concat(nextDayList).sort(function (a, b) { return a.stopsAt.toMillis() - b.stopsAt.toMillis(); });

let html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#202124">';
html += '<h2 style="margin:0 0 2px 0">Car Wash Plan &mdash; Tropicars</h2>';
html += '<div style="color:#5f6368;font-size:13px;margin-bottom:14px">Week ' + esc(win.weekLabel) + ' &middot; from Booqable &middot; all times Aruba (AST)</div>';

html += '<div style="background:#f8f9fa;border:1px solid #dadce0;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px">';
html += '<strong>' + weekReturns.length + '</strong> returns &middot; <strong>' + weekPickups.length + '</strong> pickups &middot; ';
html += '<span style="color:#d93025"><strong>' + sameDayList.length + '</strong> same-day turnaround</span> &middot; ';
html += '<span style="color:#e8710a"><strong>' + nextDayList.length + '</strong> next-day turnaround</span>';
html += '</div>';

if (tight.length) {
  html += '<h3 style="margin:0 0 4px 0;color:#d93025">Wash priority &mdash; tight turnarounds</h3>';
  html += '<table style="' + tableStyle + '">';
  html += '<tr><th style="' + thStyle + '">Comes in</th><th style="' + thStyle + '">Vehicle</th><th style="' + thStyle + '">From order</th><th style="' + thStyle + '">Goes out again</th></tr>';
  for (let k = 0; k < tight.length; k++) {
    const r = tight[k];
    const badge = r.turnaround === 'same-day' ? '<span style="color:#d93025;font-weight:bold">SAME DAY</span>' : '<span style="color:#e8710a;font-weight:bold">NEXT DAY</span>';
    html += '<tr><td style="' + tdStyle + '">' + fmtDT(r.stopsAt) + '</td><td style="' + tdStyle + '">' + vehLabel(r) + '</td><td style="' + tdStyle + '">' + whoLabel(r) + '</td><td style="' + tdStyle + '">' + badge + ' ' + fmtDT(r.nextOutAt) + (r.nextOutCustomer ? ' &middot; ' + esc(r.nextOutCustomer) : '') + '</td></tr>';
  }
  html += '</table>';
}

for (let d = 0; d < 7; d++) {
  const day = weekStart.plus({ days: d });
  const dayReturns = weekReturns.filter(function (r) { return r.stopsAt.hasSame(day, 'day'); }).sort(function (a, b) { return a.stopsAt.toMillis() - b.stopsAt.toMillis(); });
  const dayPickups = weekPickups.filter(function (r) { return r.startsAt.hasSame(day, 'day'); }).sort(function (a, b) { return a.startsAt.toMillis() - b.startsAt.toMillis(); });
  html += '<h3 style="margin:18px 0 4px 0;border-bottom:2px solid #202124;padding-bottom:4px">' + day.toFormat('cccc d LLLL') + '</h3>';
  if (!dayReturns.length && !dayPickups.length) {
    html += '<div style="color:#5f6368;font-size:13px;margin-bottom:10px">No movements.</div>';
    continue;
  }
  if (dayReturns.length) {
    html += '<div style="font-size:13px;font-weight:bold;margin-top:8px">IN &mdash; returning (' + dayReturns.length + ')</div>';
    html += '<table style="' + tableStyle + '">';
    html += '<tr><th style="' + thStyle + '">Time</th><th style="' + thStyle + '">Vehicle</th><th style="' + thStyle + '">Order / customer</th><th style="' + thStyle + '">Wash urgency</th></tr>';
    for (let k = 0; k < dayReturns.length; k++) {
      const r = dayReturns[k];
      html += '<tr><td style="' + tdStyle + '">' + fmtT(r.stopsAt) + '</td><td style="' + tdStyle + '">' + vehLabel(r) + '</td><td style="' + tdStyle + '">' + whoLabel(r) + '</td><td style="' + tdStyle + '">' + flagLabel(r) + '</td></tr>';
    }
    html += '</table>';
  }
  if (dayPickups.length) {
    html += '<div style="font-size:13px;font-weight:bold;margin-top:8px">OUT &mdash; going out (' + dayPickups.length + ')</div>';
    html += '<table style="' + tableStyle + '">';
    html += '<tr><th style="' + thStyle + '">Time</th><th style="' + thStyle + '">Vehicle</th><th style="' + thStyle + '">Order / customer</th><th style="' + thStyle + '">Note</th></tr>';
    for (let k = 0; k < dayPickups.length; k++) {
      const r = dayPickups[k];
      const note = r.tightInAt ? '<span style="color:#d93025">arrives back ' + fmtDT(r.tightInAt) + ' &mdash; wash before this pickup</span>' : 'must be clean &amp; ready';
      html += '<tr><td style="' + tdStyle + '">' + fmtT(r.startsAt) + '</td><td style="' + tdStyle + '">' + vehLabel(r) + '</td><td style="' + tdStyle + '">' + whoLabel(r) + '</td><td style="' + tdStyle + '">' + note + '</td></tr>';
    }
    html += '</table>';
  }
}

if (pickupPages.length >= 15 || returnPages.length >= 15) {
  html += '<div style="color:#d93025;font-size:12px">Warning: page limit reached while fetching from Booqable; the list above may be incomplete.</div>';
}
html += '<div style="color:#5f6368;font-size:11px;margin-top:16px">Generated automatically from Booqable on ' + DateTime.now().setZone(zone).toFormat('ccc d LLL yyyy HH:mm') + ' (AST). Returns marked SAME DAY / NEXT DAY go out again within a day and must be washed first.</div>';
html += '</div>';

let subject = 'Car Wash Plan ' + win.weekLabel;
if (sameDayList.length || nextDayList.length) {
  subject += ' - ' + sameDayList.length + ' same-day, ' + nextDayList.length + ' next-day';
} else {
  subject += ' - no tight turnarounds';
}

return [{ json: {
  subject: subject,
  html: html,
  totalReturns: weekReturns.length,
  totalPickups: weekPickups.length,
  sameDayCount: sameDayList.length,
  nextDayCount: nextDayList.length
} }];
`
    }
  },
  output: [{ subject: 'Car Wash Plan 14 Sep - 20 Sep 2026 - no tight turnarounds', html: '<div>...</div>', totalReturns: 1, totalPickups: 1, sameDayCount: 0, nextDayCount: 0 }]
});

const emailPlan = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Wash Plan',
    position: [1100, 0],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'info@nexuscarsaruba.com',
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Tropicars Wash Planner' }
    },
    credentials: { gmailOAuth2: newCredential('Gmail (Nexus Car Rental)') }
  },
  output: [{ id: 'msg4', threadId: 'thr4', labelIds: ['SENT'] }]
});

const washNote = sticky(`## Setup checklist
1. **Booqable API key** — in Booqable go to your employee settings (tropicars-car-rental.booqable.com/employees/current) → Create new authentication method → copy the key into the **Booqable API** credential as: Authorization: Bearer YOUR_KEY
2. **Gmail** — connect the Google account that should send the report in the **Email Wash Plan** node
3. Recipients: edit "To" in the Email node (currently info@nexuscarsaruba.com)

Runs every **Monday 07:00 Aruba time** and covers the next 7 days. Returns that go out again the same day are flagged WASH ASAP; next-day ones WASH SAME DAY.`, [mondaySchedule, computeWindow], { color: 4 });

export default workflow('nexus-car-wash-plan', 'Weekly Car Wash Plan — Booqable')
  .add(mondaySchedule)
  .to(computeWindow)
  .to(fetchPickups)
  .to(fetchReturns)
  .to(buildPlan)
  .to(emailPlan)
  .add(washNote);
