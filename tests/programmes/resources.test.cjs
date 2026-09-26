// SYNTHETIC test evidence only; cloned B1 rows are never persisted to official data.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {core, bundle, fact, scenario, context, eventStart} = require('./fixtures.cjs');
const inv = require('../../.test-tmp/programmes-core/inventory-adapter.js');
const res = require('../../.test-tmp/programmes-core/resources.js');
const meta = {namespace: 'SYNTHETIC-orbit', origin: 'synthetic', sourceRef: 'SYNTHETIC test inventory', retrievedAt: context.evaluatedAt};
function row(sku = 'SYN-1', count = 30) {return {id: `item-${sku}`, sku, name: 'Tools', item_type: 'reusable', base_unit: 'unit', available_quantity: count, total_quantity: count, checked_out_quantity: 0, conversion_to_base: 1, store_id: 'SYNTHETIC-room', updated_at: '2026-09-25T10:00:00Z'};}
function att(quantity, event = false, unit = 'unit') {return {method: 'synthetic', unit, quantity: fact(quantity), ...(event ? {windowStart: '2026-10-01T08:00:00Z', windowEnd: '2026-10-01T18:00:00Z'} : {})};}
function setup() {
  const b = bundle(), s = scenario();
  const op = {offerings: {}, pools: s.evidence.pools, transitionMin: s.evidence.transitionMin, earlyAccessMin: s.evidence.earlyAccessMin, lateAccessMin: s.evidence.lateAccessMin};
  const reviews = [];
  for (let n = 0; n < 3; n++) {
    const id = `ACT-00${n+1}`;
    b.offerings.records[n].fields = structuredClone(s.catalogue.offerings[n].fields);
    b.offerings.records[n].fields.Offering_ID.value = id;
    b.offerings.records[n].fields.Offering_ID.raw_value = id;
    op.offerings[id] = structuredClone(s.evidence.offerings[`ACT-90${n+1}`]);
    const raw = structuredClone(b.materials.sheets[n].records[0]);
    raw.Offering_ID = id; raw.material_row_id = `${id}:r4`; raw.item_name = 'Tools'; raw.row_kind = 'material';
    b.materials.sheets[n].records = [raw];
    reviews.push({rowId: raw.material_row_id, itemId: 'item-SYN-1', sku: 'SYN-1', mapping: fact('exact'), specificationCompatible: fact(true), quantity: fact(1), unit: fact('unit'), inventoryUnit: fact('unit'), basis: fact('per_participant'), kind: fact('reusable'), conversionToPoolUnit: fact(1), reuseApproved: fact(true), resetMin: fact(2)});
  }
  return {b, snapshot: inv.inventorySnapshot([row()], meta), reviews, stocks: [{itemId: 'item-SYN-1', sku: 'SYN-1', current: att(30), event: att(30, true)}], op, request: s.request, spec: {offeringIds: ['ACT-001']}, ctx: context};
}
function run(s) {
  const adapted = res.adaptResources(s.b, s.snapshot, s.stocks, s.reviews, s.op, s.ctx, s.request.eventStart);
  const catalogue = core.adaptCatalogue(s.b), plan = core.evaluatePlan(catalogue, s.request, adapted.evidence, s.ctx, s.spec);
  return {adapted, plan, report: res.materialFeasibility(adapted, plan), catalogue};
}
test('B3 real seed file reads 109 records without approving stock', () => {
  const raw = require('../../backend/data/inventory_catalog.json');
  const s = inv.inventorySnapshot(raw, {...meta, origin: 'seed_file'});
  const a = inv.adaptInventory(s, [], context, eventStart);
  assert.equal(a.records.length, 109); assert.ok(a.pools.every(p => p.currentQuantity.value === null && p.eventQuantity.value === null));
  assert.equal(a.records[0].raw.conversion_to_base, 1);
});
test('B3 exact name is a candidate, never an approved specification or demand', () => {
  const s = setup(); s.reviews = []; const r = run(s);
  assert.equal(r.adapted.mappings[0].mappingStatus, 'exact_candidate');
  assert.equal(r.adapted.evidence.offerings['ACT-001'].materials[0].mapping.verification, 'pending');
  assert.equal(r.plan.status, 'NEEDS VERIFICATION'); assert.equal(r.report[0].status, 'Unknown');
});
test('B3 same name with verified incompatible specification hard fails', () => {
  const s = setup(); s.reviews[0].specificationCompatible = fact(false); const r = run(s);
  assert.equal(r.plan.status, 'NOT FEASIBLE'); assert.equal(r.report[0].status, 'Insufficient'); assert.equal(r.adapted.mappings[0].mappingStatus, 'rejected');
});
test('B3 unknown specification remains unknown', () => {const s = setup(); s.reviews[0].specificationCompatible = fact(null); assert.equal(run(s).report[0].status, 'Unknown');});
test('B3 alias needs current human confirmation and retains reviewer', () => {
  const s = setup(); s.snapshot.records[0].name = 'Special tool'; s.reviews[0].mapping = fact('alias'); delete s.reviews[0].mapping.confirmedBy;
  assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
  s.reviews[0].mapping.confirmedBy = 'SYNTHETIC reviewer'; const r = run(s);
  assert.equal(r.plan.status, 'VERIFIED FEASIBLE'); assert.equal(r.adapted.mappings[0].mappingStatus, 'verified_alias');
  assert.equal(r.adapted.mappings[0].review.mapping.confirmedBy, 'SYNTHETIC reviewer');
});
test('B3 mismatched exact name is not silently converted to an alias', () => {const s = setup(); s.snapshot.records[0].name = 'Red Tools'; assert.equal(run(s).report[0].status, 'Unknown');});
test('B3 conversion_to_base 1 never fills an unknown package conversion', () => {const s = setup(); s.reviews[0].conversionToPoolUnit = fact(null); const r = run(s); assert.equal(r.plan.status, 'NEEDS VERIFICATION'); assert.equal(r.adapted.evidence.offerings['ACT-001'].materials[0].conversionToPoolUnit.value, null);});
test('B3 verified 10 units per box / 3 boxes / 25 units passes quantity check', () => {
  const s = setup(); s.request.participants = 25;
  Object.assign(s.snapshot.records[0], {base_unit: 'box', available_quantity: 3, total_quantity: 3});
  s.stocks[0].current = att(3, false, 'box'); s.stocks[0].event = att(3, true, 'box');
  s.reviews[0].inventoryUnit = fact('box'); s.reviews[0].conversionToPoolUnit = fact(0.1);
  const r = run(s); assert.equal(r.plan.status, 'VERIFIED FEASIBLE'); assert.equal(r.report[0].status, 'Sufficient');
  assert.equal(r.adapted.evidence.offerings['ACT-001'].materials[0].conversionToPoolUnit.value, 0.1);
});
test('B3 unknown usage basis never scales 80 packs to participant count', () => {
  const s = setup(); s.b.materials.sheets[0].records[0].section_context = 'SYNTHETIC original 80 packs'; s.reviews[0].basis = fact(null);
  const r = run(s); assert.equal(r.plan.status, 'NEEDS VERIFICATION'); assert.equal(r.adapted.mappings[0].raw.section_context, 'SYNTHETIC original 80 packs');
});
test('B3 API success and updated_at never become verified current/event evidence', () => {
  const s = setup(); s.snapshot.origin = 'api_read'; s.stocks = []; const r = run(s);
  assert.equal(r.report[0].rawAvailable, 30); assert.equal(r.report[0].currentQuantity.value, null); assert.equal(r.report[0].eventQuantity.value, null);
});
test('B3 verified current stock cannot fill missing future availability', () => {
  const s = setup(); delete s.stocks[0].event; const r = run(s);
  assert.equal(r.report[0].currentQuantity.value, 30); assert.equal(r.report[0].eventQuantity.value, null); assert.equal(r.plan.status, 'NEEDS VERIFICATION');
});
test('B3 expired inventory verification remains unknown', () => {const s = setup(); s.stocks[0].current.quantity.validUntil = '2026-09-01T00:00:00Z'; assert.equal(run(s).report[0].currentQuantity.value, null);});
test('B3 raw available quantity already includes checkout; do not subtract twice', () => {
  const s = setup(); Object.assign(s.snapshot.records[0], {total_quantity: 40, checked_out_quantity: 10});
  assert.equal(run(s).adapted.inventory.records[0].currentQuantity.value, 30);
});
test('B3 unreconciled current count, wrong unit or seed method cannot approve', () => {
  for (const mutate of [s => s.stocks[0].current.quantity.value = 29, s => s.stocks[0].current.unit = 'box', s => s.stocks[0].current.method = 'seed']) {
    const s = setup(); mutate(s); assert.equal(run(s).report[0].currentQuantity.value, null);
  }
});
test('B3 same SKU has one pool across activities; forbidden reuse needs fresh units', () => {
  const s = setup(); s.spec.offeringIds = ['ACT-001', 'ACT-002'];
  s.reviews[0].reuseApproved = fact(false); s.reviews[1].reuseApproved = fact(false); const r = run(s);
  assert.equal(r.adapted.inventory.pools.length, 1); assert.equal(r.plan.status, 'NOT FEASIBLE');
  assert.deepEqual(r.report.map(m => m.status), ['Insufficient', 'Insufficient']);
});
test('B3 cross-activity confirmed and unknown reuse preserve B2 distinctions', () => {
  const s = setup(); s.spec.offeringIds = ['ACT-001', 'ACT-002']; assert.equal(run(s).plan.status, 'VERIFIED FEASIBLE');
  s.reviews[0].reuseApproved = fact(null); assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
});
test('B3 consumables accumulate across activities', () => {
  const s = setup(); s.snapshot.records[0].item_type = 'consumable'; s.spec.offeringIds = ['ACT-001', 'ACT-002'];
  for (const r of s.reviews) r.kind = fact('consumable'); assert.equal(run(s).plan.status, 'NOT FEASIBLE');
});
test('B3 same name with different SKUs stays separate; duplicate SKU is rejected', () => {
  const s = setup(); s.snapshot.records.push(row('SYN-2'));
  const a = run(s).adapted; assert.equal(a.inventory.pools.length, 2); assert.equal(a.mappings[0].candidates.length, 2);
  s.snapshot.records.push(row()); assert.throws(() => run(s), /Duplicate/);
});
test('B3 stale/duplicate/unknown mapping and stock identities cannot drift', () => {
  let s = setup(); s.reviews.push(s.reviews[0]); assert.throws(() => run(s), /Duplicate/);
  s = setup(); s.reviews[0].itemId = 'other'; assert.throws(() => run(s), /bind/);
  s = setup(); s.stocks.push(s.stocks[0]); assert.throws(() => run(s), /Duplicate/);
  s = setup(); s.stocks[0].sku = 'other'; assert.throws(() => run(s), /unbound/);
});
test('B3 original 275 rows and 21 ambiguous rows retained without review', () => {
  const b = bundle(), raw = require('../../backend/data/inventory_catalog.json');
  const a = res.adaptResources(b, inv.inventorySnapshot(raw, {...meta, origin: 'seed_file'}), [], [], {offerings: {}, pools: []}, context, eventStart);
  assert.equal(a.mappings.length, 275); assert.equal(a.mappings.filter(m => m.raw.row_kind === 'material_or_section_needs_review').length, 21);
  assert.ok(a.mappings.every(m => m.raw.material_row_id === m.rowId && m.sources[0].row === m.raw.source.row));
});
test('B3 only reviewed ambiguous section rows may receive a non-material disposition', () => {
  const s = setup(); s.reviews.shift();
  s.op.offerings['ACT-001'].materialRowDispositions = [{sourceRowId: 'ACT-001:r4', classification: fact('not_material'), reason: 'SYNTHETIC reviewed section title'}];
  assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
  s.b.materials.sheets[0].records[0].row_kind = 'material_or_section_needs_review';
  assert.equal(run(s).adapted.evidence.offerings['ACT-001'].materials.length, 0);
  assert.equal(run(s).adapted.mappings.filter(m => m.rowId === 'ACT-001:r4').length, 1);
});
test('B3 booking interval is separate from observedAt and guards early setup', () => {
  const s = setup(); s.spec.setupBeforeArrival = true; s.stocks[0].event.windowStart = eventStart;
  assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
  s.stocks[0].event.windowStart = '2026-10-01T08:55:00Z'; assert.equal(run(s).plan.status, 'VERIFIED FEASIBLE');
});
test('B3 event interval must include final reset; unknown interval cannot verify', () => {
  const s = setup(); s.stocks[0].event.windowEnd = '2026-10-01T09:35:00Z'; assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
  delete s.stocks[0].event.windowEnd; assert.equal(run(s).report[0].eventQuantity.value, null);
});
test('B3 unit evidence expiry must propagate into the B2 operational window', () => {
  const s = setup(); s.reviews[0].unit.validUntil = '2026-10-01T09:01:00Z'; assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
});
test('B3 adaptation, evaluation and reporting do not mutate input and are deterministic', () => {
  const s = setup(), before = JSON.stringify(s); const a = run(s), b = run(s);
  assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(JSON.stringify(s), before);
});
test('B3 evidence feeds recommend and whatIf including a supply shortage Plan B', () => {
  const s = setup(); const a = run(s);
  assert.ok(core.recommend(a.catalogue, s.request, a.adapted.evidence, context, {maxActivities: 1}).primary);
  s.stocks[0].event.quantity = fact(0); const b = run(s);
  const changed = core.whatIf(b.catalogue, a.plan, s.request, b.adapted.evidence, context, {maxActivities: 1});
  assert.equal(changed.previousRechecked.status, 'NOT FEASIBLE'); assert.notEqual(changed.action, 'retained');
});
test('B3 unknown future evidence remains unknown during unrelated what-if', () => {
  const s = setup(); delete s.stocks[0].event; const a = run(s);
  const r = core.whatIf(a.catalogue, a.plan, {...s.request, brief: 'Different wording'}, a.adapted.evidence, context);
  assert.equal(r.action, 'retained'); assert.equal(r.plan.status, 'NEEDS VERIFICATION');
});
test('B3 read transport only issues GET and reads all pages', async () => {
  const calls = [], records = Array.from({length: 251}, (_, i) => row(`S-${i}`));
  const snapshot = await inv.readInventory(async (url, init) => {calls.push([url, init]); const offset = Number(new URL(url).searchParams.get('offset')); return {ok: true, status: 200, json: async () => ({items: records.slice(offset, offset+250), total: 251, limit: 250, offset})};}, 'http://synthetic/api', {namespace: meta.namespace, retrievedAt: meta.retrievedAt});
  assert.equal(snapshot.records.length, 251); assert.equal(calls.length, 2); assert.ok(calls.every(c => c[1].method === 'GET'));
});
test('B3 reader rejects HTTP failure, malformed/incomplete/changing pages without seed fallback', async () => {
  await assert.rejects(inv.readInventory(async () => ({ok: false, status: 503}), 'http://synthetic/api', meta), /HTTP 503/);
  await assert.rejects(inv.readInventory(async () => ({ok: true, json: async () => ({items: [], total: 1, limit: 250, offset: 0})}), 'http://synthetic/api', meta), /Incomplete/);
  await assert.rejects(inv.readInventory(async () => {throw new Error('network offline');}, 'http://synthetic/api', meta), /network offline/);
});
test('B3 operational evidence cannot duplicate inventory quantities under alternate pools', () => {
  const s = setup(); s.op.pools.push({id: 'duplicate-tools', kind: 'equipment', unit: 'unit', currentQuantity: fact(30), eventQuantity: fact(30)});
  assert.throws(() => run(s), /never duplicate/);
});

test('B3 a changed event requires fresh booking evidence rather than reusing the old scope', () => {
  const s = setup(); s.request.eventStart = '2026-10-02T09:00:00Z';
  const r = run(s); assert.equal(r.report[0].eventQuantity.value, null); assert.equal(r.plan.status, 'NEEDS VERIFICATION');
});
test('B3 classification is independently reviewed rather than inherited from inventory tag', () => {
  const s = setup(); s.reviews[0].kind = fact(null); assert.equal(run(s).report[0].status, 'Unknown');
  s.reviews[0].kind = fact('consumable'); assert.equal(run(s).report[0].status, 'Unknown');
});
test('B3 unconfirmed quantity/unit/reviewer never enters usable demand', () => {
  for (const key of ['quantity', 'unit', 'inventoryUnit', 'basis', 'conversionToPoolUnit']) {
    const s = setup(); delete s.reviews[0][key].confirmedBy; assert.equal(run(s).report[0].status, 'Unknown', key);
  }
});
test('B3 later fact availability cannot be loosened by a broader booking window', () => {
  const s = setup(); s.spec.setupBeforeArrival = true; s.stocks[0].event.quantity.availableFrom = eventStart;
  assert.equal(run(s).plan.status, 'NEEDS VERIFICATION');
});
test('B3 physical count approval must be independent of catalogue/user-report sources', () => {
  const s = setup(); s.stocks[0].current.method = 'physical_count';
  s.stocks[0].current.quantity.sources = [{kind: 'catalogue', ref: 'seed'}];
  assert.equal(run(s).report[0].currentQuantity.value, null);
  s.stocks[0].current.quantity.sources = [{kind: 'verified_record', ref: 'SYNTHETIC example physical ledger'}];
  assert.equal(run(s).report[0].currentQuantity.value, 30);
});
test('B3 report is event scoped and preserves next action, source and dates', () => {
  const s = setup(), r = run(s), m = r.report[0];
  assert.equal(m.scope, 'event_programme'); assert.ok(m.sources.length); assert.ok(m.evidenceTimes.length); assert.ok(m.nextAction);
  assert.throws(() => res.materialFeasibility(r.adapted, {...r.plan, evaluatedAt: '2026-09-27T00:00:00Z'}), /Re-adapt/);
});
test('B3 changing totals or duplicate pages do not create a complete inventory snapshot', async () => {
  const records = Array.from({length: 250}, (_, i) => row(`S-${i}`)); let count = 0;
  await assert.rejects(inv.readInventory(async () => ({ok: true, json: async () => ++count === 1 ? {items: records, total: 251, limit: 250, offset: 0} : {items: [row('last')], total: 252, limit: 250, offset: 250}}), 'http://synthetic/api', meta), /changing/);
  await assert.rejects(inv.readInventory(async () => ({ok: true, json: async () => ({items: [row(), row()], total: 2, limit: 250, offset: 0})}), 'http://synthetic/api', meta), /Duplicate/);
});
test('B3 API unknown unit/invalid counts cannot be silently defaulted', () => {
  for (const r of [{...row(), base_unit: ''}, {...row(), available_quantity: -1}, {...row(), available_quantity: 31}, {...row(), checked_out_quantity: 1}]) assert.throws(() => inv.inventorySnapshot([r], meta), /Invalid|conflicts/);
});
test('B3 supply shortage can select a revalidated Plan B using a distinct reviewed SKU', () => {
  const s = setup(); s.snapshot.records.push(row('SYN-2'));
  s.stocks.push({itemId:'item-SYN-2',sku:'SYN-2',current:att(30),event:att(30,true)});
  Object.assign(s.reviews[2], {itemId:'item-SYN-2',sku:'SYN-2'});
  const before = run(s); s.stocks[0].event.quantity = fact(0); const after = run(s);
  const r = core.whatIf(after.catalogue,before.plan,s.request,after.adapted.evidence,context,{maxActivities:1});
  assert.equal(r.action,'changed'); assert.deepEqual(r.plan.spec.offeringIds,['ACT-003']); assert.equal(r.plan.status,'VERIFIED FEASIBLE');
  assert.ok(r.tradeOffs.preserved.length); assert.ok(r.tradeOffs.improved.length);
});
test('B3 sufficient changed supply may retain the original plan', () => {
  const s=setup(), before=run(s); Object.assign(s.snapshot.records[0],{available_quantity:40,total_quantity:40});
  s.stocks[0].current=att(40); s.stocks[0].event=att(40,true); const after=run(s);
  const r=core.whatIf(after.catalogue,before.plan,s.request,after.adapted.evidence,context);
  assert.equal(r.action,'retained'); assert.equal(r.plan.status,'VERIFIED FEASIBLE');
});
test('B3 an empty inventory is an unresolved mapping, not proof that all materials have zero supply', () => {
  const s=setup(); s.snapshot.records=[]; s.stocks=[]; s.reviews=[];
  const r=run(s); assert.equal(r.report[0].status,'Unknown'); assert.equal(r.report[0].rawAvailable,null);
});
test('B3 canonical SKU identity survives name/location updates without merging distinct namesakes', () => {
  const s=setup(), before=run(s).adapted.inventory.pools[0].id;
  s.snapshot.records[0].store_id='SYNTHETIC-other-room'; s.snapshot.records[0].name='Renamed Tools';
  assert.equal(run(s).adapted.inventory.pools[0].id,before);
  assert.notEqual(inv.poolIdentity('another-installation','SYN-1'),before);
});
