const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {core, bundle, fact, pool, material, scenario, evaluate, setField, context} = require('./fixtures.cjs');
const status = (p, id) => p.checks.find(c => c.id === id)?.status;
const failure = (p, text) => p.checks.some(c => c.status === 'NOT FEASIBLE' && c.reason.includes(text));

test('B1 six manifest hashes match and original official names/notes/audit survive adaptation', () => {
  const b = bundle(), c = core.adaptCatalogue(b);
  for (const [name, hash] of Object.entries(b.manifest.outputs)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../../backend/data/programmes', name))).digest('hex'), hash);
  assert.equal(c.offerings.length, 21); assert.equal(c.rules.length, 12);
  assert.equal(c.offerings[19].title, 'Fabolous Fizzy');
  assert.match(c.offerings[0].notes, /planning assumptions/);
  assert.ok(c.offerings[0].auditIssues.length);
  assert.equal(c.offerings[18].confidence, 'High');
  assert.equal(c.offerings[18].numbers.Standard_Duration_Min.verification, 'pending');
  assert.match(c.offerings[18].numbers.Standard_Duration_Min.reasons.join(' '), /planning assumption/);
});
test('Adapter rejects mixed source hashes, missing rules and missing audit', () => {
  let b = bundle(); b.mapping.source_sha256 = '0'.repeat(64); assert.throws(() => core.adaptCatalogue(b), /Mixed/);
  b = bundle(); b.constraints.records.pop(); assert.throws(() => core.adaptCatalogue(b), /rules incomplete/);
  b = bundle(); b.audit.issues = null; assert.throws(() => core.adaptCatalogue(b), /audit evidence/);
});
test('Age n+, bounded range and unknown retain their distinct meaning', () => {
  assert.deepEqual(core.parseAge('10+'), {min: 10, max: null});
  assert.deepEqual(core.parseAge('4-8'), {min: 4, max: 8});
  assert.deepEqual(core.parseAge('12–14'), {min: 12, max: 14});
  assert.equal(core.parseAge('Unknown'), null); assert.equal(core.parseAge('14-12'), null);
});
test('Missing age is not supplied by Secondary school; partly ineligible range fails', () => {
  const s = scenario(); delete s.request.ages;
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.request.ages = {min: 9, max: 14}; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('Upper age bound is enforced; an open-ended requested range needs verification', () => {
  const s = scenario(); setField(s.catalogue.offerings[0], 'Recommended_Age', '4-8');
  s.evidence.offerings['ACT-901'].fields.Recommended_Age = fact('4-8');
  s.request.ages = {min: 6, max: 9}; assert.equal(status(evaluate(s), 'ACT-901.age'), 'NOT FEASIBLE');
  s.request.ages = '6+'; assert.equal(status(evaluate(s), 'ACT-901.age'), 'NEEDS VERIFICATION');
});
test('Request rejects invalid numbers/enums instead of turning them into zero or false', () => {
  const s = scenario(); s.request.participants = 0; s.request.internet = false;
  const result = core.normalizeRequest(s.request);
  assert.ok(result.checks.filter(c => c.status === 'NOT FEASIBLE').length >= 2);
  assert.equal(result.request.participants, null); assert.equal(result.request.internet, 'unknown');
  for (const v of [-1, Infinity, NaN, '30']) {s.request.participants = v; assert.equal(core.normalizeRequest(s.request).request.participants, null);}
});
test('Optional, No, N/A, Unknown and numeric zero are not truthiness-coerced', () => {
  for (const [value, state, expected] of [['Optional', 'optional', 'optional'], ['No', 'no', 'not_required'], ['N/A', 'not_applicable', 'not_applicable'], ['Unknown', 'unknown', 'unknown'], [0, 'zero', 'unknown'], [null, 'blank', 'unknown']]) assert.equal(core.requirement({value, state}), expected);
});
test('Optional internet is not required, but offline prerequisites must be verified', () => {
  const s = scenario(); setField(s.catalogue.offerings[0], 'Internet_Required', 'Optional');
  s.evidence.offerings['ACT-901'].fields.Internet_Required = fact('Optional'); s.request.internet = 'none';
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  delete s.evidence.offerings['ACT-901'].offlineReady;
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});
test('Required internet distinguishes absent, unstable and unknown service', () => {
  const s = scenario(); setField(s.catalogue.offerings[0], 'Internet_Required', 'Yes'); s.evidence.offerings['ACT-901'].fields.Internet_Required = fact('Yes');
  s.request.internet = 'none'; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
  s.request.internet = 'unknown'; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.request.internet = 'unstable'; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
  delete s.evidence.offerings['ACT-901'].unstableInternetReady; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.evidence.offerings['ACT-901'].unstableInternetReady = fact(true); assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
});
test('Required electricity failure is retained alongside unknown future bookings', () => {
  const s = scenario(); setField(s.catalogue.offerings[0], 'Electricity_Required', 'Yes'); s.evidence.offerings['ACT-901'].fields.Electricity_Required = fact('Yes');
  s.request.electricity = 'no'; s.evidence.pools[0].eventQuantity = fact(null);
  const p = evaluate(s); assert.equal(p.status, 'NOT FEASIBLE'); assert.ok(p.checks.some(c => c.status === 'NEEDS VERIFICATION')); assert.equal(status(p, 'ACT-901.electricity'), 'NOT FEASIBLE');
});
test('Actual catalogue drafting notes stay pending even if confidence is High', () => {
  const s = scenario(), c = core.adaptCatalogue(bundle());
  for (const id of ['ACT-001', 'ACT-002', 'ACT-019']) {
    const p = core.evaluatePlan(c, {...s.request, themes: [], objectives: [], durationMin: 1000}, {offerings: {}, pools: []}, context, {offeringIds: [id]});
    assert.equal(p.status, 'NEEDS VERIFICATION'); assert.ok(p.checks.some(c => /Notes:/.test(c.reason) && c.reason.includes('planning') || c.reason.includes('timings and staffing')));
    assert.equal(p.officialOfferings[0].identity, 'official_catalogue');
  }
});
test('To be confirmed preserves official identity and related candidates are not emptied', () => {
  const s = scenario(), c = core.adaptCatalogue(bundle());
  const result = core.recommend(c, {...s.request, themes: [{text: 'Renewable Energy', priority: 'critical'}], objectives: [], durationMin: 2000}, {offerings: {}, pools: []}, context, {maxActivities: 1, maxEvaluations: 21});
  assert.ok(result.primary); assert.equal(result.primary.status, 'NEEDS VERIFICATION');
  assert.equal(result.primary.officialOfferings[0].availabilityRaw, 'To be confirmed');
});
test('200 participants at max 30 become 7 balanced groups; staff and rooms constrain rounds', () => {
  const s = scenario(); s.request.participants = 200; s.request.durationMin = 400;
  s.evidence.offerings['ACT-901'].parallelStations = fact(7);
  const p = evaluate(s), a = p.schedules[0];
  assert.equal(a.minimumGroups, 7); assert.equal(a.groups.reduce((a,b) => a+b), 200);
  assert.ok(a.groups.every(n => n >= 10 && n <= 30)); assert.equal(a.parallelCapacity, 2); assert.equal(a.rounds, 4);
  assert.equal(p.participantDurationMin, 131); assert.equal(p.status, 'VERIFIED FEASIBLE');
});
test('Group minimum is enforced without a too-small final group or fake extra participants', () => {
  assert.deepEqual(core.balancedGroups(31, 10, 30), [16, 15]);
  assert.equal(core.balancedGroups(31, 20, 30), null);
});
test('Unknown concurrency produces provisional planning, not unlimited lanes or a hard false impossibility', () => {
  const s = scenario(); s.request.participants = 200; s.request.durationMin = 60;
  delete s.evidence.offerings['ACT-901'].parallelStations;
  s.evidence.pools.forEach(p => {p.eventQuantity = fact(null);});
  const p = evaluate(s); assert.equal(p.status, 'NEEDS VERIFICATION'); assert.equal(p.schedules[0].provisional, true);
  assert.equal(p.schedules[0].parallelCapacity, 1); assert.equal(status(p, 'schedule.window'), 'NEEDS VERIFICATION');
});
test('Known resource upper bounds can prove duration failure even while concurrency approval is unknown', () => {
  const s = scenario(); s.request.participants = 200; s.request.durationMin = 60;
  delete s.evidence.offerings['ACT-901'].parallelStations;
  const p = evaluate(s); assert.equal(p.status, 'NOT FEASIBLE'); assert.equal(status(p, 'ACT-901.parallel'), 'NEEDS VERIFICATION'); assert.equal(p.schedules[0].parallelCapacity, 2);
});
test('Consumables sum across sequential groups; verified reusable tools use peak demand', () => {
  const s = scenario(); s.request.participants = 60;
  s.evidence.pools.push(pool('paper', 'consumable', 60), pool('tools', 'equipment', 30));
  s.evidence.offerings['ACT-901'].materials = [material('paper', 'paper', 'consumable'), material('tool', 'tools')];
  const p = evaluate(s); assert.equal(p.status, 'VERIFIED FEASIBLE');
  assert.match(p.checks.find(c => c.id === 'consumable.paper.total').reason, /demand 60/);
  assert.match(p.checks.find(c => c.id === 'resource.tools.overlap').reason, /demand 30/);
  s.evidence.offerings['ACT-901'].parallelStations = fact(2); s.evidence.pools.find(p => p.id === 'tools').eventQuantity = fact(60);
  const parallel = evaluate(s); assert.match(parallel.checks.find(c => c.id === 'resource.tools.overlap').reason, /demand 60/);
});
test('Limited reusable equipment reduces parallelism and recalculates rounds', () => {
  const s = scenario(); s.request.participants = 60; s.evidence.offerings['ACT-901'].parallelStations = fact(2);
  s.evidence.pools.push(pool('tools', 'equipment', 30)); s.evidence.offerings['ACT-901'].materials = [material('tool', 'tools')];
  assert.equal(evaluate(s).schedules[0].parallelCapacity, 1); assert.equal(evaluate(s).schedules[0].rounds, 2);
});
test('Shared pool requirements from multiple material rows are aggregated before lane selection', () => {
  const s = scenario(); s.request.participants = 60; s.evidence.offerings['ACT-901'].parallelStations = fact(2);
  s.evidence.pools.push(pool('tools', 'equipment', 60)); s.evidence.offerings['ACT-901'].materials = [material('tool-a', 'tools'), material('tool-b', 'tools')];
  const p = evaluate(s); assert.equal(p.schedules[0].parallelCapacity, 1); assert.equal(p.status, 'VERIFIED FEASIBLE');
});
test('Consumables are accumulated across separate programme activities', () => {
  const s = scenario(); s.spec.offeringIds = ['ACT-901', 'ACT-902'];
  s.evidence.pools.push(pool('paper', 'consumable', 50));
  for (const id of s.spec.offeringIds) s.evidence.offerings[id].materials = [material(`${id}-paper`, 'paper', 'consumable')];
  const p = evaluate(s); assert.equal(status(p, 'consumable.paper.total'), 'NOT FEASIBLE'); assert.match(p.checks.find(c => c.id === 'consumable.paper.total').reason, /demand 60/);
});
test('Unknown usage basis prevents multiplying an 80-pack sample to 200 participants', () => {
  const s = scenario(); s.request.participants = 200; s.request.durationMin = 500;
  s.evidence.pools.push(pool('packs', 'consumable', 1000)); s.evidence.offerings['ACT-901'].materials = [material('80-pack-sample', 'packs', 'consumable', null, 80, {basis: fact(null)})];
  const p = evaluate(s); assert.equal(p.status, 'NEEDS VERIFICATION'); assert.ok(!p.checks.some(c => c.id === 'consumable.packs.total'));
});
test('Incompatible verified specifications fail; missing specs remain unresolved', () => {
  const s = scenario(); s.evidence.pools.push(pool('tools', 'equipment', 100));
  const m = material('red-led', 'tools', 'reusable', 'per_participant', 1, {specificationCompatible: fact(false)}); s.evidence.offerings['ACT-901'].materials = [m];
  assert.equal(evaluate(s).status, 'NOT FEASIBLE'); m.specificationCompatible = fact(null); assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});
test('Alias requires human confirmation and units-per-box require their own sourced conversion', () => {
  const s = scenario(); s.request.participants = 25; s.evidence.pools.push(pool('boxes', 'consumable', 3, 'box'));
  const m = material('items', 'boxes', 'consumable', 'per_participant', 1, {mapping: fact('alias', {confirmedBy: undefined}), conversionToPoolUnit: fact(null)}); s.evidence.offerings['ACT-901'].materials = [m];
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  m.mapping.confirmedBy = 'synthetic-test-operator'; m.conversionToPoolUnit = fact(0.1);
  const p = evaluate(s); assert.equal(p.status, 'VERIFIED FEASIBLE'); assert.match(p.checks.find(c => c.id === 'consumable.boxes.total').reason, /demand 2.5 box/);
});
test('Unknown reuse and reset cannot be promoted by rotation arithmetic', () => {
  const s = scenario(); s.request.participants = 60; s.evidence.pools.push(pool('tools', 'equipment', 30));
  const m = material('tools', 'tools', 'reusable', 'per_participant', 1, {reuseApproved: fact(null), resetMin: fact(null)}); s.evidence.offerings['ACT-901'].materials = [m];
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  m.reuseApproved = fact(false); assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('Shared facilitators, rooms, equipment and participants cannot overlap illegally', () => {
  const s = scenario(), req = core.normalizeRequest(s.request).request;
  const intervals = ['one', 'two'].map((id, i) => ({id, offeringId: `ACT-90${i+1}`, phase: 'delivery', startMin: 0, endMin: 30, participantIds: ['same-person'], resources: [{poolId: 'staff', quantity: 2}, {poolId: 'room', quantity: 1}, {poolId: 'kit', quantity: 1}]}));
  const result = core.checkIntervals(intervals, [pool('staff', 'facilitator', 3), pool('room', 'room', 1), pool('kit', 'equipment', 1)], req, context);
  for (const id of ['participant.same-person.overlap', 'resource.staff.overlap', 'resource.room.overlap', 'resource.kit.overlap']) assert.equal(result.find(c => c.id === id).status, 'NOT FEASIBLE');
  intervals[1].startMin = 30; intervals[1].endMin = 60;
  assert.equal(core.aggregate(core.checkIntervals(intervals, [pool('staff', 'facilitator', 3), pool('room', 'room', 1), pool('kit', 'equipment', 1)], req, context)), 'VERIFIED FEASIBLE');
});
test('Generated full journeys never overlap a participant, including transitions', () => {
  const s = scenario(); s.request.participants = 60; s.spec.offeringIds = ['ACT-901', 'ACT-902']; s.evidence.offerings['ACT-901'].parallelStations = fact(2);
  const p = evaluate(s); assert.ok(p.intervals.some(i => i.phase === 'transition')); assert.ok(!p.checks.some(c => c.id.startsWith('participant.') && c.status === 'NOT FEASIBLE'));
  for (let i = 1; i <= 60; i++) assert.equal(p.journey.filter(j => j.participantIds.includes(`participant-${i}`)).length, 2);
});
test('Setup is once per station, reset between rounds; unknown timing is not a verified zero', () => {
  const s = scenario(); s.request.participants = 60;
  const p = evaluate(s); assert.equal(p.intervals.filter(i => i.phase === 'setup').length, 1); assert.equal(p.participantDurationMin, 67);
  delete s.evidence.offerings['ACT-901'].resetMin; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  delete s.evidence.offerings['ACT-901'].finalResetMin; assert.equal(status(evaluate(s), 'ACT-901.finalReset'), 'NEEDS VERIFICATION');
});
test('Early setup requires access plus event-scoped resources; cannot remove setup silently', () => {
  const s = scenario(); s.request.durationMin = 30; s.spec.setupBeforeArrival = true;
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE'); assert.equal(evaluate(s).operationalStartMin, -5);
  delete s.evidence.earlyAccessMin; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.evidence.earlyAccessMin = fact(0); assert.equal(evaluate(s).status, 'NOT FEASIBLE');
  s.spec.setupBeforeArrival = false; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('Participant end and final operational release differ; late access is not assumed', () => {
  const s = scenario(); s.request.durationMin = 35; s.evidence.offerings['ACT-901'].finalResetMin = fact(5);
  const p = evaluate(s); assert.equal(p.participantDurationMin, 35); assert.equal(p.operationalEndMin, 40); assert.equal(p.status, 'VERIFIED FEASIBLE');
  delete s.evidence.lateAccessMin; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.evidence.lateAccessMin = fact(0); assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('Known duration failure wins over critical unknown and retains both check results', () => {
  const s = scenario(); s.request.durationMin = 20; s.evidence.offerings['ACT-901'].available = fact(null);
  const p = evaluate(s); assert.equal(p.status, 'NOT FEASIBLE'); assert.equal(status(p, 'ACT-901.availability'), 'NEEDS VERIFICATION'); assert.ok(failure(p, 'lower bound'));
});
test('Missing staff is not supplied by an assumption; noncritical reflection can remain conditional', () => {
  const s = scenario(); s.evidence.pools[0].eventQuantity = fact(null); s.request.assumptions = [{kind: 'operational', text: 'Assume enough staff'}];
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.evidence.pools[0].eventQuantity = fact(4); s.request.assumptions = [{kind: 'reflection_topic', text: 'Discuss local engineering examples'}];
  const p = evaluate(s); assert.equal(p.status, 'FEASIBLE WITH ASSUMPTIONS'); assert.equal(p.enhancements[0].label, 'PROPOSED ENHANCEMENT');
});
test('All explicit synthetic evidence passes; result never hides the synthetic label', () => {
  const p = evaluate(scenario()); assert.equal(p.status, 'VERIFIED FEASIBLE'); assert.equal(p.evidenceMode, 'synthetic');
});
test('Current inventory cannot establish future availability, stale snapshots remain visible', () => {
  const s = scenario(); s.evidence.pools[0].eventQuantity = fact(null);
  let p = evaluate(s); assert.equal(status(p, 'resource.staff.current'), 'VERIFIED FEASIBLE'); assert.equal(status(p, 'resource.staff.overlap'), 'NEEDS VERIFICATION');
  s.evidence.pools[0].eventQuantity = fact(4); s.evidence.pools[0].currentQuantity.validUntil = '2026-09-25T00:00:00Z';
  p = evaluate(s); assert.equal(p.status, 'NEEDS VERIFICATION'); assert.equal(status(p, 'resource.staff.current'), 'NEEDS VERIFICATION');
});
test('Evidence for another event or expiring mid-delivery cannot verify this programme', () => {
  const s = scenario(); s.evidence.offerings['ACT-901'].safetyApproved.eventStart = '2026-10-02T09:00:00Z'; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.evidence.offerings['ACT-901'].safetyApproved = fact(true, {validUntil: '2026-10-01T09:15:00Z'}); assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});
test('Official duration is never compressed through a verification override', () => {
  const s = scenario(); s.request.durationMin = 20; s.evidence.offerings['ACT-901'].fields.Standard_Duration_Min = fact(10);
  const p = evaluate(s); assert.equal(p.status, 'NOT FEASIBLE'); assert.equal(p.schedules[0].deliveryMin, 30);
  assert.ok(p.enhancements.some(e => e.kind === 'adapted_format' && e.label === 'PROPOSED ENHANCEMENT' && e.approvalsRequired.includes('Petrosains approval')));
});
test('Multiple critical themes require a combined plan with contextual explanations', () => {
  const s = scenario(); s.request.themes.push({text: 'Sustainability', priority: 'critical'});
  const r = core.recommend(s.catalogue, s.request, s.evidence, context, {maxActivities: 2});
  assert.ok(r.primary); assert.equal(r.primary.spec.offeringIds.length, 2); assert.equal(r.primary.coverageComplete, true);
  assert.ok(r.primary.coverage.some(c => c.goal === 'Sustainability' && c.rationale.includes('Suitable_Themes: Sustainability') && c.sources.length));
});
test('Critical goals and preferences are distinct; repetition does not inflate goal scoring', () => {
  const s = scenario(); s.request.objectives.push({text: 'Unrelated objective', priority: 'preference'}); assert.notEqual(evaluate(s).status, 'NOT FEASIBLE');
  s.request.objectives[1].priority = 'critical'; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
  s.request.objectives = [{text: 'Build teamwork', priority: 'critical'}, {text: 'Build teamwork', priority: 'preference'}];
  assert.equal(core.normalizeRequest(s.request).request.objectives.length, 1);
});
test('Unvalidated mapping alone is supporting evidence and cannot certify critical coverage', () => {
  const s = scenario(); s.request.themes = [{text: 'Special Mapping Theme', priority: 'critical'}];
  const c = v => ({value: v});
  s.catalogue.mappings = [{source: {sheet: 'SYNTHETIC Mapping', row: 2}, fields: {Mapping_ID: c('SYNTHETIC-MAP'), Primary_Offering_ID: c('ACT-901'), Secondary_Offering_ID: c(null), Theme: c('Special Mapping Theme'), Stakeholder_Objective: c(''), Validation_Status: c('To be validated')}}];
  const p = evaluate(s); assert.equal(p.status, 'NEEDS VERIFICATION'); assert.equal(p.coverageComplete, false); assert.equal(p.coverage[0].strength, 'supporting_only');
});
test('Individually fitting activities are not blindly combined beyond the full window', () => {
  const s = scenario(); s.request.durationMin = 60; s.request.themes = [];
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  s.spec.offeringIds.push('ACT-902'); assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('Plan B is reevaluated and reports preserved, lost, improved and unresolved', () => {
  const s = scenario(); setField(s.catalogue.offerings[0], 'Internet_Required', 'Yes'); s.evidence.offerings['ACT-901'].fields.Internet_Required = fact('Yes');
  const before = evaluate(s); s.request.internet = 'none';
  const r = core.whatIf(s.catalogue, before, s.request, s.evidence, context, {maxActivities: 2});
  assert.equal(r.action, 'changed'); assert.equal(r.previousRechecked.status, 'NOT FEASIBLE');
  assert.deepEqual(r.plan.spec.offeringIds, ['ACT-903']); assert.equal(r.plan.status, 'VERIFIED FEASIBLE');
  assert.ok(r.tradeOffs.preserved.includes('theme: Robotics')); assert.ok(r.tradeOffs.lost.length); assert.ok(r.tradeOffs.improved.length);
});
test('No suitable alternative and bounded search failure do not claim global impossibility', () => {
  const s = scenario(); const before = evaluate(s); s.request.ages = {min: 3, max: 5};
  const r = core.whatIf(s.catalogue, before, s.request, s.evidence, context, {maxActivities: 2, maxEvaluations: 1});
  assert.equal(r.action, 'no_alternative'); assert.equal(r.plan, null); assert.match(r.reason, /No acceptable plan found within/); assert.equal(r.alternativeSearch.exhaustedWithinBounds, false);
});
test('What-if can retain an offline-compatible plan and explain affected checks', () => {
  const s = scenario(); const before = evaluate(s); s.request.internet = 'none';
  const r = core.whatIf(s.catalogue, before, s.request, s.evidence, context);
  assert.equal(r.action, 'retained'); assert.equal(r.plan.status, 'VERIFIED FEASIBLE'); assert.deepEqual(r.plan.spec.offeringIds, before.spec.offeringIds);
  assert.ok(r.changedInputs.includes('internet')); assert.ok(r.changedChecks.some(c => c.id === 'ACT-901.offline'));
});
test('Unrelated What-if cannot upgrade existing unknown evidence', () => {
  const s = scenario(); s.evidence.offerings['ACT-901'].available = fact(null); const before = evaluate(s);
  s.request.brief = 'Reworded brief'; const r = core.whatIf(s.catalogue, before, s.request, s.evidence, context);
  assert.equal(r.action, 'retained'); assert.equal(r.plan.status, 'NEEDS VERIFICATION'); assert.equal(status(r.plan, 'ACT-901.availability'), 'NEEDS VERIFICATION');
});
test('Unknown offering remains unsupported and is not given an official card', () => {
  const s = scenario(); s.spec.offeringIds = ['INVENTED']; const p = evaluate(s);
  assert.equal(p.status, 'NOT FEASIBLE'); assert.deepEqual(p.officialOfferings, []); assert.equal(status(p, 'offering.INVENTED.identity'), 'NOT FEASIBLE');
});
test('All twelve official Rule_IDs are linked; known handling and venue failures are enforced', () => {
  const s = scenario(); s.request.participantLed = true; s.request.venue = 'outdoor'; s.request.accessibility = null; s.request.budgetBand = 'unknown';
  const p = evaluate(s); assert.equal(status(p, 'ACT-901.handling'), 'NOT FEASIBLE'); assert.equal(status(p, 'ACT-901.venue.type'), 'NOT FEASIBLE');
  for (const c of p.checks) assert.ok(c.sources.some(s => s.ref === c.ruleId));
  assert.ok(p.checks.some(c => c.ruleId === 'RULE-011')); assert.ok(p.checks.some(c => c.ruleId === 'RULE-008'));
});
test('Same input and explicit time yield byte-identical results without mutating inputs', () => {
  const s = scenario(), before = JSON.stringify(s);
  const a = core.recommend(s.catalogue, s.request, s.evidence, context, {maxActivities: 2});
  const b = core.recommend(s.catalogue, s.request, s.evidence, context, {maxActivities: 2});
  assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(JSON.stringify(s), before);
  assert.throws(() => core.evaluatePlan(s.catalogue, s.request, s.evidence, {}, s.spec), /explicit ISO/);
});
test('Pure core source excludes platform I/O and hidden clocks/randomness', () => {
  const dir = path.resolve(__dirname, '../../lib/programmes');
  const ts = process.env.ORBIT_TYPESCRIPT_PATH ? require(path.join(path.dirname(process.env.ORBIT_TYPESCRIPT_PATH), 'typescript.js')) : require('typescript');
  for (const file of fs.readdirSync(dir)) if (file.endsWith('.ts')) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isIdentifier(node)) assert.ok(!['fetch', 'window', 'document', 'localStorage', 'process', 'require'].includes(node.text), `${file}: ${node.text}`);
      if (ts.isImportDeclaration(node)) assert.ok(node.moduleSpecifier.text.startsWith('./'), `${file}: external import`);
      if (ts.isCallExpression(node)) assert.ok(!['Date.now', 'Math.random'].includes(node.expression.getText(tree)), file);
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
});
test('Invalid calendar dates are rejected rather than silently rolled into the next month', () => {
  assert.equal(core.timestamp('2026-02-31T09:00:00Z'), null);
  assert.equal(core.timestamp('2026-01-01T24:00:00Z'), null);
  assert.notEqual(core.timestamp('2028-02-29T09:00:00+08:00'), null);
});
test('Decimal quantity rounding noise does not create a false shortage', () => {
  const s = scenario(); s.evidence.pools.push(pool('liquid', 'consumable', 0.3, 'litre'));
  s.evidence.offerings['ACT-901'].materials = [material('liquid-a', 'liquid', 'consumable', 'per_session', 0.1), material('liquid-b', 'liquid', 'consumable', 'per_session', 0.2)];
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  s.evidence.pools.find(p => p.id === 'liquid').eventQuantity = fact(0.29);
  assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('A less verified alternative is a trade-off, not an improvement in status', () => {
  const s = scenario(); const before = evaluate(s); s.evidence.offerings['ACT-901'].available = fact(null);
  const after = evaluate(s), t = core.tradeOffs(before, after);
  assert.ok(t.lost.some(x => x.includes('VERIFIED FEASIBLE → NEEDS VERIFICATION')));
  assert.ok(!t.improved.some(x => x.includes('VERIFIED FEASIBLE → NEEDS VERIFICATION')));
});
test('Global transition/access evidence must cover the whole operational window', () => {
  const s = scenario(); s.spec.offeringIds = ['ACT-901', 'ACT-902'];
  s.evidence.transitionMin.validUntil = '2026-10-01T09:01:00Z';
  const p = evaluate(s); assert.equal(p.status, 'NEEDS VERIFICATION'); assert.equal(status(p, 'programme.transitionMin.window'), 'NEEDS VERIFICATION');
});
test('Sustainability inference uses corroborating Master concepts, not a fixed offering list', () => {
  const s = scenario(), c = core.adaptCatalogue(bundle());
  const p = core.evaluatePlan(c, {...s.request, themes: [{text: 'Sustainability', priority: 'critical'}], objectives: [], durationMin: 200}, {offerings: {}, pools: []}, context, {offeringIds: ['ACT-019']});
  const why = p.coverage.find(c => c.goal === 'Sustainability');
  assert.equal(why.strength, 'master'); assert.match(why.rationale, /Planner inference/); assert.match(why.rationale, /Solar energy|solar energy|renewable energy/i);
  assert.ok(new Set(why.sources.map(s => s.cell)).size >= 2); assert.equal(why.provisional, true); assert.equal(p.status, 'NEEDS VERIFICATION');
});
test('Repeating a concept in one text field cannot manufacture corroborated theme coverage', () => {
  const s = scenario(), o = s.catalogue.offerings[0];
  s.request.themes = [{text: 'Sustainability', priority: 'critical'}]; s.request.objectives = [];
  for (const key of ['Suitable_Themes', 'Suitable_Objectives', 'Learning_Outcomes', 'Key_Concepts']) setField(o, key, 'Unrelated content');
  setField(o, 'Short_Description', 'renewable energy renewable energy renewable energy');
  assert.equal(evaluate(s).coverage[0].strength, 'none');
});
test('Ambiguous B1 rows require mapping or an explicit human-reviewed non-material disposition', () => {
  const s = scenario(); s.catalogue.offerings[0].materialRowIds = ['SYNTHETIC:section-heading'];
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.evidence.offerings['ACT-901'].materialRowDispositions = [{sourceRowId: 'SYNTHETIC:section-heading', classification: fact('not_material'), reason: 'SYNTHETIC human review: this row is a section title'}];
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  delete s.evidence.offerings['ACT-901'].materialRowDispositions[0].classification.confirmedBy;
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});

// B2 Operator regression cases. Every catalogue/resource/approval here is SYNTHETIC.
for (const [venue, expected] of [['indoor', 'VERIFIED FEASIBLE'], ['outdoor', 'NOT FEASIBLE'], ['sheltered_outdoor', 'NOT FEASIBLE'], ['unknown', 'NEEDS VERIFICATION']]) {
  test(`R1 venue: Indoor catalogue / request ${venue}, even with venueReady=true`, () => {
    const s = scenario(); s.request.venue = venue;
    assert.equal(evaluate(s).status, expected);
  });
}
for (const raw of [null, 'Unknown', 'N/A', 'To be validated', 'Indoor or TBD', 'subject to site review']) {
  for (const venue of ['indoor', 'outdoor', 'sheltered_outdoor', 'unknown']) {
    test(`R1 venue: unresolved catalogue ${String(raw)} / ${venue} stays unknown`, () => {
      const s = scenario(); setField(s.catalogue.offerings[0], 'Indoor_Outdoor', raw); s.request.venue = venue;
      assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
    });
  }
}
for (const [raw, venue, expected] of [
  ['Indoor or sheltered outdoor', 'sheltered_outdoor', 'VERIFIED FEASIBLE'],
  ['Indoor or sheltered outdoor', 'outdoor', 'NOT FEASIBLE'],
  ['Indoor or sheltered outdoor', 'indoor', 'VERIFIED FEASIBLE'],
  ['Outdoor', 'indoor', 'NOT FEASIBLE'],
  ['Outdoor', 'outdoor', 'VERIFIED FEASIBLE'],
  ['Outdoor', 'sheltered_outdoor', 'NEEDS VERIFICATION'],
  ['Indoor with ventilation', 'sheltered_outdoor', 'NOT FEASIBLE'],
  ['Indoor with approval or suitable outdoor area', 'outdoor', 'VERIFIED FEASIBLE'],
]) test(`R1 venue boundary: ${raw} / ${venue}`, () => {
  const s = scenario(); setField(s.catalogue.offerings[0], 'Indoor_Outdoor', raw); s.request.venue = venue;
  assert.equal(evaluate(s).status, expected);
});
function sharedEquipment(approval = false, quantity = 30) {
  const s = scenario(); s.spec.offeringIds = ['ACT-901', 'ACT-902'];
  s.evidence.pools.push(pool('shared-tools', 'equipment', quantity));
  for (const id of s.spec.offeringIds) s.evidence.offerings[id].materials = [material(`${id}-tool`, 'shared-tools', 'reusable', 'per_participant', 1, {reuseApproved: fact(approval)})];
  return s;
}
test('R2 Operator: cross-activity shared equipment cannot reuse verified-false units', () => {
  const s = sharedEquipment(false); const p = evaluate(s);
  assert.deepEqual(p.schedules.map(x => x.rounds), [1, 1]);
  assert.equal(p.status, 'NOT FEASIBLE');
});
test('R2 unknown cross-activity reuse retains NEEDS VERIFICATION', () => {
  assert.equal(evaluate(sharedEquipment(null)).status, 'NEEDS VERIFICATION');
});
test('R2 enough fresh units need no reuse permission', () => {
  assert.equal(evaluate(sharedEquipment(false, 60)).status, 'VERIFIED FEASIBLE');
  assert.equal(evaluate(sharedEquipment(null, 60)).status, 'VERIFIED FEASIBLE');
});
test('R2 approved reuse and reset retain resource occupancy and pass', () => {
  const p = evaluate(sharedEquipment(true)); assert.equal(p.status, 'VERIFIED FEASIBLE');
  assert.ok(p.intervals.some(i => i.offeringId === 'ACT-901' && i.phase === 'reset' && i.endMin - i.startMin === 2 && i.resources.some(r => r.poolId === 'shared-tools')));
});
test('R2 approval at only one endpoint cannot authorize a transfer', () => {
  for (const id of ['ACT-901', 'ACT-902']) {
    const s = sharedEquipment(true); s.evidence.offerings[id].materials[0].reuseApproved = fact(false);
    assert.equal(evaluate(s).status, 'NOT FEASIBLE');
  }
});
test('R2 stale reuse or missing reset cannot establish a verified reuse chain', () => {
  const s = sharedEquipment(true); s.evidence.offerings['ACT-901'].materials[0].reuseApproved.validUntil = '2026-09-01T00:00:00Z';
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  const t = sharedEquipment(true); t.evidence.offerings['ACT-901'].materials[0].resetMin = fact(null);
  assert.equal(evaluate(t).status, 'NEEDS VERIFICATION');
});
test('R2 different verified pools do not imply reuse', () => {
  const s = sharedEquipment(false); s.evidence.pools.push(pool('other-tools', 'equipment', 30));
  s.evidence.offerings['ACT-902'].materials[0].poolId = 'other-tools';
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
});
test('R2 within-activity rounds also allow fresh units instead of forbidden reuse', () => {
  const s = sharedEquipment(false, 60); s.spec.offeringIds = ['ACT-901']; s.request.participants = 60;
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  s.evidence.pools.find(p => p.id === 'shared-tools').eventQuantity = fact(30);
  assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
function unknownFirstParallel(window = 80) {
  const s = scenario(); s.spec.offeringIds = ['ACT-901', 'ACT-902']; s.request.participants = 90; s.request.durationMin = window;
  const oe = s.evidence.offerings['ACT-901']; oe.parallelStations = fact(null); delete oe.facilitatorPoolId; delete oe.roomPoolId;
  return s;
}
test('R3 Operator: unknown ACT-901 concurrency cannot mask ACT-902 known 99-minute minimum', () => {
  const p = evaluate(unknownFirstParallel());
  assert.equal(p.status, 'NOT FEASIBLE');
  assert.equal(status(p, 'ACT-902.duration.minimum'), 'NOT FEASIBLE');
  assert.equal(status(p, 'ACT-901.parallel'), 'NEEDS VERIFICATION');
  assert.equal(status(p, 'schedule.window'), 'NOT FEASIBLE');
});
test('R3 programme sums separate activity lower bounds, not tentative one-lane displays', () => {
  // 35 optimistic ACT-901 + 3 transition + 99 confirmed ACT-902 = 137.
  assert.equal(evaluate(unknownFirstParallel(136)).status, 'NOT FEASIBLE');
  assert.equal(evaluate(unknownFirstParallel(137)).status, 'NEEDS VERIFICATION');
  assert.equal(evaluate(unknownFirstParallel(138)).status, 'NEEDS VERIFICATION');
});
test('R3 unknown capacity alone does not prove an impossible schedule', () => {
  const s = unknownFirstParallel(80); s.spec.offeringIds = ['ACT-901'];
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});
test('R3 exactly 99 minutes fits confirmed single-lane activity; 98 does not', () => {
  const s = scenario(); s.request.participants = 90; s.request.durationMin = 99;
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  s.request.durationMin = 98; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('R3 reversing blocks retains independently known overtime', () => {
  const s = unknownFirstParallel(); s.spec.offeringIds.reverse();
  assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('R3 early setup and unknown reset remain separate lower-bound conditions', () => {
  const s = unknownFirstParallel(132); s.spec.setupBeforeArrival = true;
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
  s.request.durationMin = 131; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
  const t = unknownFirstParallel(80); t.evidence.offerings['ACT-902'].resetMin = fact(null);
  const p = evaluate(t); assert.equal(p.status, 'NOT FEASIBLE');
  assert.equal(status(p, 'ACT-902.reset'), 'NEEDS VERIFICATION');
});

test('R2 three activity allocations conserve units across approved and forbidden boundaries', () => {
  const s = sharedEquipment(true, 60); s.spec.offeringIds.push('ACT-903');
  s.evidence.offerings['ACT-903'].materials = [material('third-tool', 'shared-tools', 'reusable', 'per_participant', 1, {reuseApproved: fact(false)})];
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE'); // 30 reused + 30 fresh.
  s.evidence.offerings['ACT-902'].materials[0].reuseApproved = fact(false);
  assert.equal(evaluate(s).status, 'NOT FEASIBLE'); // Three disjoint sets need 90.
  s.evidence.offerings['ACT-902'].materials[0].reuseApproved = fact(null);
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});
test('R2 reset before the next activity is included in exact timing boundaries', () => {
  const s = sharedEquipment(true); s.evidence.offerings['ACT-901'].materials[0].resetMin = fact(10);
  s.request.durationMin = 83; const p = evaluate(s);
  assert.equal(p.status, 'VERIFIED FEASIBLE'); // 35 + 10 release + 3 transition + 35.
  assert.equal(p.schedules[1].startMin, 48);
  s.request.durationMin = 82; assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('R2 fractional units and multiple demands do not create or duplicate equipment', () => {
  const s = sharedEquipment(false, 0.6);
  for (const id of s.spec.offeringIds) s.evidence.offerings[id].materials = [material(`${id}-a`, 'shared-tools', 'reusable', 'per_group', 0.1, {reuseApproved: fact(false)}), material(`${id}-b`, 'shared-tools', 'reusable', 'per_group', 0.2, {reuseApproved: fact(false)})];
  assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE');
  s.evidence.pools.find(p => p.id === 'shared-tools').eventQuantity = fact(0.59);
  assert.equal(evaluate(s).status, 'NOT FEASIBLE');
});
test('R3 output exposes 35 and 99 minute activity lower bounds without certifying unknown lanes', () => {
  const p = evaluate(unknownFirstParallel());
  assert.deepEqual(p.schedules.map(s => s.minimumRounds), [1, 3]);
  assert.deepEqual(p.schedules.map(s => s.attendanceLowerBoundMin), [35, 99]);
  assert.deepEqual(p.schedules.map(s => s.operationalLowerBoundMin), [35, 99]);
  assert.equal(p.schedules[0].provisional, true);
  assert.match(p.checks.find(c => c.id === 'schedule.window').reason, /lower bound 137 min/);
});
test('R1 all actual B1 venue phrases retain supported indoor and unresolved unknown requests', () => {
  const phrases = [...new Set(core.adaptCatalogue(bundle()).offerings.map(o => o.fields.Indoor_Outdoor.value))];
  for (const raw of phrases) {
    const s = scenario(); setField(s.catalogue.offerings[0], 'Indoor_Outdoor', raw);
    assert.equal(evaluate(s).status, 'VERIFIED FEASIBLE', raw);
    s.request.venue = 'unknown'; assert.equal(evaluate(s).status, 'NEEDS VERIFICATION', raw);
  }
});
test('R1 missing venue cell is unknown even when site readiness is verified', () => {
  const s = scenario(); delete s.catalogue.offerings[0].fields.Indoor_Outdoor;
  assert.equal(evaluate(s).status, 'NEEDS VERIFICATION');
});

