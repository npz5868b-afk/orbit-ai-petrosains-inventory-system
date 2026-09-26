// Audit examples only. Synthetic evidence never goes in backend/data/programmes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {core, bundle, scenario, evaluate, fact, pool, material, setField, context} = require('./fixtures.cjs');
const b = bundle(), official = core.adaptCatalogue(b), s = scenario();
const request = {...s.request, themes: [{text: 'Renewable Energy', priority: 'critical'}], objectives: [], durationMin: 120};
const evidence = {offerings: {}, pools: []}, spec = {offeringIds: ['ACT-019']};
const pending = core.evaluatePlan(official, request, evidence, context, spec);
const failedRequest = {...request, durationMin: 30};
const failed = core.evaluatePlan(official, failedRequest, evidence, context, spec);
assert.equal(pending.status, 'NEEDS VERIFICATION'); assert.equal(failed.status, 'NOT FEASIBLE');
const changedScenario = scenario();
setField(changedScenario.catalogue.offerings[0], 'Internet_Required', 'Yes');
changedScenario.evidence.offerings['ACT-901'].fields.Internet_Required = fact('Yes');
const changedBefore = evaluate(changedScenario);
const changedInput = {...changedScenario.request, internet: 'none'};
const changed = core.whatIf(changedScenario.catalogue, changedBefore, changedInput, changedScenario.evidence, context, {maxActivities: 2});
assert.equal(changed.action, 'changed');
const retainedScenario = scenario(), retainedBefore = evaluate(retainedScenario), retainedInput = {...retainedScenario.request, internet: 'none'};
const retained = core.whatIf(retainedScenario.catalogue, retainedBefore, retainedInput, retainedScenario.evidence, context);
assert.equal(retained.action, 'retained');
const unverifiedScenario = scenario(); unverifiedScenario.evidence.offerings['ACT-901'].available = fact(null);
const unverifiedBefore = evaluate(unverifiedScenario), unverifiedInput = {...unverifiedScenario.request, brief: 'Rephrased stakeholder brief only'};
const stillUnverified = core.whatIf(unverifiedScenario.catalogue, unverifiedBefore, unverifiedInput, unverifiedScenario.evidence, context);
assert.equal(stillUnverified.plan.status, 'NEEDS VERIFICATION');
const cases = [
  {name: 'official-catalogue-pending', catalogue: 'official', input: {request, evidence, context, spec}, output: pending},
  {name: 'official-catalogue-hard-failure-plus-unknowns', catalogue: 'official', input: {request: failedRequest, evidence, context, spec}, output: failed},
  {name: 'SYNTHETIC-plan-b-after-internet-loss', catalogue: 'syntheticInternetRequired', input: {beforeRequest: changedScenario.request, beforeSpec: changedScenario.spec, request: changedInput, evidence: changedScenario.evidence, context}, previousOutput: changedBefore, output: changed},
  {name: 'SYNTHETIC-what-if-retains-offline-plan', catalogue: 'syntheticOffline', input: {beforeRequest: retainedScenario.request, beforeSpec: retainedScenario.spec, request: retainedInput, evidence: retainedScenario.evidence, context}, previousOutput: retainedBefore, output: retained},
  {name: 'SYNTHETIC-what-if-retains-pending-status', catalogue: 'syntheticOffline', input: {beforeRequest: unverifiedScenario.request, beforeSpec: unverifiedScenario.spec, request: unverifiedInput, evidence: unverifiedScenario.evidence, context}, previousOutput: unverifiedBefore, output: stillUnverified},
];
function revisionCase(name, scenario, expected) {
  const output = evaluate(scenario); assert.equal(output.status, expected);
  cases.push({name: `SYNTHETIC-B2-R1-${name}`, catalogue: 'syntheticOffline', input: {request: scenario.request, evidence: scenario.evidence, context: scenario.context, spec: scenario.spec}, output});
}
const venueCase = scenario(); venueCase.request.venue = 'sheltered_outdoor';
revisionCase('incompatible-sheltered-venue', venueCase, 'NOT FEASIBLE');
const equipmentCase = scenario(); equipmentCase.spec.offeringIds = ['ACT-901', 'ACT-902'];
equipmentCase.evidence.pools.push(pool('shared-tools', 'equipment', 30));
for (const id of equipmentCase.spec.offeringIds) equipmentCase.evidence.offerings[id].materials = [material(`${id}-tool`, 'shared-tools', 'reusable', 'per_participant', 1, {reuseApproved: fact(false)})];
revisionCase('forbidden-cross-activity-reuse', structuredClone(equipmentCase), 'NOT FEASIBLE');
for (const id of equipmentCase.spec.offeringIds) equipmentCase.evidence.offerings[id].materials[0].reuseApproved = fact(null);
revisionCase('unknown-cross-activity-reuse', structuredClone(equipmentCase), 'NEEDS VERIFICATION');
for (const id of equipmentCase.spec.offeringIds) equipmentCase.evidence.offerings[id].materials[0].reuseApproved = fact(true);
revisionCase('approved-cross-activity-reuse', structuredClone(equipmentCase), 'VERIFIED FEASIBLE');
const durationCase = scenario(); durationCase.spec.offeringIds = ['ACT-901', 'ACT-902']; durationCase.request.participants = 90; durationCase.request.durationMin = 80;
durationCase.evidence.offerings['ACT-901'].parallelStations = fact(null);
delete durationCase.evidence.offerings['ACT-901'].facilitatorPoolId; delete durationCase.evidence.offerings['ACT-901'].roomPoolId;
revisionCase('known-99-minute-bound-with-other-concurrency-unknown', structuredClone(durationCase), 'NOT FEASIBLE');
durationCase.request.durationMin = 137;
revisionCase('unknown-concurrency-at-optimistic-programme-bound', structuredClone(durationCase), 'NEEDS VERIFICATION');
const result = {warning: 'Audit examples only. SYNTHETIC catalogues and resource/approval/booking facts are test data, not official offerings or operational confirmation. Not runtime defaults.',
  officialSource: {sha256: b.manifest.source_sha256, entry: 'backend/data/programmes/source_manifest.json', loadWith: 'adaptCatalogue(B1Bundle)'},
  syntheticCatalogues: {syntheticInternetRequired: changedScenario.catalogue, syntheticOffline: retainedScenario.catalogue}, cases};
const target = path.resolve(__dirname, '../../docs/programmes/B2-examples.json');
fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({generated: path.relative(path.resolve(__dirname, '../..'), target), cases: cases.map(c => ({name: c.name, status: c.output.status ?? c.output.plan?.status, action: c.output.action ?? null}))}, null, 2));
