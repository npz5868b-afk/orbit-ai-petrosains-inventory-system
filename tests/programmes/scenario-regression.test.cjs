// B6 gap regression: supporting-only critical coverage is not an equivalent Plan B.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {bundle,core,context}=require('./fixtures.cjs');
const {consultLocally}=require('../../.test-tmp/programmes-core/local.js');
const {inventorySnapshot}=require('../../.test-tmp/programmes-core/inventory-adapter.js');
const {adaptResources}=require('../../.test-tmp/programmes-core/resources.js');
const cases=require('./scenarios.json').cases;
const {comparePlans}=require('../../.test-tmp/programmes-core/local.js');

test('B6 scenario4 What-if summary does not promise a Plan B when no critical-preserving alternative exists',()=>{
 const before=consultLocally(bundle(),cases.find(c=>c.id==='S4-original').payload,context.evaluatedAt,null);
 const after=consultLocally(bundle(),cases.find(c=>c.id==='S4-age').payload,context.evaluatedAt,null);
 assert.equal(after.planB,null);assert.equal(after.status,'NOT FEASIBLE');
 assert.match(comparePlans(before.programme,after.programme,after.planB),/No suitable Plan B/);
 assert.match(comparePlans(before.programme,after.programme,before.planB),/separately rechecked Plan B/);
});
test('B6 scenario3 related candidates remain pending but supporting-only critical theme cannot qualify as Plan B',()=>{
 const r=consultLocally(bundle(),cases.find(c=>c.id==='S3-original').payload,context.evaluatedAt,null);
 assert.ok(r.programme);assert.equal(r.programme.status,'NEEDS VERIFICATION');assert.equal(r.programme.coverageComplete,false);assert.equal(r.planB,null);
});
test('B6 What-if hard-failed plan cannot switch to a supporting-only critical alternative',()=>{
 const b=bundle(),cat=core.adaptCatalogue(b),input=cases.find(c=>c.id==='S3-original').payload.request;
 const snapshot=inventorySnapshot([],{namespace:'SYNTHETIC-unavailable',origin:'synthetic',sourceRef:'SYNTHETIC empty resource evidence',retrievedAt:context.evaluatedAt});
 const a=adaptResources(b,snapshot,[],[],{offerings:{},pools:[]},context,null);
 const previous=core.evaluatePlan(cat,input,a.evidence,context,{offeringIds:['ACT-017']});
 const next={...input,durationMin:90};const r=core.whatIf(cat,previous,next,a.evidence,context,{maxActivities:2,maxEvaluations:60});
 assert.equal(r.previousRechecked.status,'NOT FEASIBLE');assert.equal(r.action,'no_alternative');assert.equal(r.plan,null);assert.match(r.reason,/critical|alternative/);
});
