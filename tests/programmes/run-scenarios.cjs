// B6 integration scenarios; real HTTP optional, official data and synthetic ledgers separate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {bundle,core,context,fact}=require('./fixtures.cjs');
const {consultLocally}=require('../../.test-tmp/programmes-core/local.js');
const {createProgrammeHandlers}=require('../../.test-tmp/programmes-api/lib/programmes/server/handlers.js');
const {materialFeasibility}=require('../../.test-tmp/programmes-core/resources.js');
const {resourceScenario,runResourceScenario}=require('./scenario-evidence.cjs');
const definitions=require('./scenarios.json');
const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const output=option('output');if(!output)throw Error('Provide --output=path; outputs never become runtime data');
const base=option('base');
const report={schema:'B6-scenario-results-v1',classA:[],classB:{},verification:base?'actual HTTP + direct core comparison':'local integration only; no HTTP claim'};
function invariants(r,payload){
 const plans=[r.programme,r.planB,...r.rejectedDetails].filter(Boolean);
 for(const p of plans){
  assert.notEqual(p.status,'VERIFIED FEASIBLE','Class A has no operational approvals');
  assert.ok(p.officialOfferings.every(o=>bundle().offerings.records.some(row=>row.fields.Offering_ID.value===o.id&&row.fields.Activity_Title.value===o.title)));
  if(p.checks.some(c=>c.status==='NOT FEASIBLE'))assert.equal(p.status,'NOT FEASIBLE');
  assert.ok(p.checks.some(c=>c.status==='NEEDS VERIFICATION'));
 }
 if(r.planB){assert.notEqual(r.planB.status,'NOT FEASIBLE');for(const c of r.planB.coverage.filter(c=>c.priority==='critical'))assert.ok(r.planB.coverage.some(v=>v.kind===c.kind&&v.goal===c.goal&&v.strength==='master'),'Alternative must cover retained critical goals');}
 assert.deepEqual(r.requestUnderstanding.ages,payload.request.ages?core.parseAge(payload.request.ages):null);
 assert.equal(r.requestUnderstanding.durationMin,payload.request.durationMin??null);
 assert.ok([...r.materials,...r.planBMaterials].every(m=>m.status==='Unknown'&&m.currentQuantity.value===null&&m.eventQuantity.value===null));
 assert.ok(r.search.evaluated<=r.search.limit);assert.ok(r.conclusion);
}
async function main(){
 const original=JSON.stringify(bundle());
 for(const c of definitions.cases){
  let r;
  if(base){const response=await fetch(base+'/consult',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(c.payload),signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,c.id);r=await response.json();}
  else r=consultLocally(bundle(),c.payload,context.evaluatedAt,null);
  invariants(r,c.payload);
  const direct=consultLocally(bundle(),c.payload,r.evaluatedAt,null);
  // With no approvals, raw inventory cannot promote results. Compare complete plans and checks.
  for(const k of ['programme','planB','search','checks','materials','planBMaterials','tradeOffs','requestUnderstanding'])assert.deepEqual(JSON.parse(JSON.stringify(direct[k])),JSON.parse(JSON.stringify(r[k])),`${c.id} HTTP/core ${k}`);
  if(c.id==='S1-age-and-judge'){assert.equal(r.status,'NOT FEASIBLE');assert.ok(r.programme.schedules.every(s=>s.minimumGroups>=7));assert.ok(r.checks.some(c=>c.ruleId==='RULE-005'&&c.status==='NOT FEASIBLE'));}
  if(c.id==='S3-30-min')assert.ok(r.checks.some(c=>c.ruleId==='RULE-005'&&c.status==='NOT FEASIBLE'));
  if(c.id==='S4-age'){assert.equal(r.status,'NOT FEASIBLE');assert.equal(r.checks.find(c=>c.id==='ACT-011.age').status,'NOT FEASIBLE');assert.equal(r.planB,null,'Do not replace critical IoT learning with an unrelated activity');}
  report.classA.push({...c,transport:base?{mode:'actual HTTP',url:base+'/consult',method:'POST',status:200}:{mode:'direct local integration'},invariants:['Official B1 identity/values preserved','Missing age and ambiguous time stay unknown','Critical coverage required for any alternative','Unknown resource evidence never promotes feasibility','HTTP/direct core full plan/check/material/search equivalence'],actual:r});
  console.log(`${c.id}: ${r.status}; ${r.programme?.spec.offeringIds.join('+')??'no plan'}; Plan B ${r.planB?.spec.offeringIds.join('+')??'none'}; search ${r.search.evaluated}/${r.search.limit}`);
 }
 const s=resourceScenario(),before=runResourceScenario(s);assert.equal(before.plan.status,'VERIFIED FEASIBLE');assert.equal(before.plan.evidenceMode,'synthetic');
 const saved=structuredClone(s);
 const outOfStock=s.reviews.materials.find(r=>r.rowId.startsWith('ACT-019'));
 s.reviews.stocks.find(r=>r.sku===outOfStock.sku).event.quantity=fact(0);
 const unavailable=runResourceScenario(s);assert.equal(unavailable.plan.status,'NOT FEASIBLE');assert.ok(unavailable.materials.some(m=>m.status==='Insufficient'));
 const alternative=core.whatIf(s.catalogue,before.plan,s.request,unavailable.adapted.evidence,s.context,{maxActivities:2,maxEvaluations:200});
 assert.equal(alternative.action,'changed');assert.equal(alternative.plan.status,'VERIFIED FEASIBLE');assert.equal(alternative.plan.coverageComplete,true);assert.ok(alternative.tradeOffs.preserved.some(v=>v.includes('Sustainability')));assert.ok(alternative.tradeOffs.preserved.some(v=>v.includes('Robotics')));
 const altMaterials=materialFeasibility(unavailable.adapted,alternative.plan);assert.ok(altMaterials.every(m=>m.status==='Sufficient'));
 const retainedRequest={...saved.request,participants:29};const retained=core.whatIf(saved.catalogue,before.plan,retainedRequest,before.adapted.evidence,saved.context,{maxActivities:2,maxEvaluations:200});assert.equal(retained.action,'retained');assert.equal(retained.plan.status,'VERIFIED FEASIBLE');
 // Same physical SKU across activities: reviewed reuse passes; forbidden reuse fails.
 const sharedScenario=structuredClone(s);sharedScenario.request.themes=[{text:'Robotics',priority:'critical'},{text:'Water',priority:'critical'}];
 const sequential=runResourceScenario(sharedScenario,{offeringIds:['ACT-001','ACT-003']});assert.equal(sequential.plan.status,'VERIFIED FEASIBLE');
 const deny=structuredClone(sharedScenario);for(const m of deny.reviews.materials.filter(m=>m.sku===s.shared))m.reuseApproved=fact(false);
 const forbidden=runResourceScenario(deny,{offeringIds:['ACT-001','ACT-003']});assert.equal(forbidden.plan.status,'NOT FEASIBLE');
 // No equivalent Plan B: retaining both critical themes must not silently relax them.
 const impossible={...s.request,objectives:[{text:'Introduce IoT architecture',priority:'critical'}]};
 const none=core.whatIf(s.catalogue,before.plan,impossible,unavailable.adapted.evidence,s.context,{maxActivities:2,maxEvaluations:200});assert.equal(none.action,'no_alternative');assert.equal(none.plan,null);
 const capacity=structuredClone(saved);capacity.request.participants=60;capacity.spec={offeringIds:['ACT-001']};capacity.request.themes=[{text:'Robotics',priority:'critical'}];capacity.reviews.operational.offerings['ACT-001'].parallelStations=fact(2);
 const sequentialGroups=runResourceScenario(capacity);assert.equal(sequentialGroups.plan.status,'VERIFIED FEASIBLE');assert.equal(sequentialGroups.plan.schedules[0].parallelCapacity,1);
 const moreTools=structuredClone(capacity);const record=moreTools.snapshot.records.find(r=>r.sku===s.shared);record.total_quantity=60;record.available_quantity=60;const stock=moreTools.reviews.stocks.find(r=>r.sku===s.shared);stock.current.quantity=fact(60);stock.event.quantity=fact(60);const concurrentGroups=runResourceScenario(moreTools);assert.equal(concurrentGroups.plan.status,'VERIFIED FEASIBLE');assert.equal(concurrentGroups.plan.schedules[0].parallelCapacity,2);assert.ok(concurrentGroups.plan.participantDurationMin<sequentialGroups.plan.participantDurationMin);
 const api=createProgrammeHandlers({bundle:async()=>s.bundle,reviews:async()=>s.reviews,inventory:async()=>s.snapshot,now:()=>context.evaluatedAt,inventoryTimeoutMs:10});
 const rejected=await api.consult(new Request('http://localhost/api/programmes/consult',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request:s.request,plan:s.spec})}));assert.equal(rejected.status,503);
 report.classB={label:s.label,sourceCatalogueSha256:s.bundle.manifest.source_sha256,inputs:{request:saved.request,spec:saved.spec,context:saved.context,snapshot:saved.snapshot,reviews:saved.reviews},invariants:['Official B1 unchanged, no material row removed','Synthetic evidence never loaded by real API or page','Same shared SKU identity across activities','Critical themes both preserved by rechecked Plan B'],sufficient:{plan:before.plan,materials:before.materials},outage:{patch:{sku:outOfStock.sku,eventQuantity:0,source:'synthetic test availability'},plan:unavailable.plan,materials:unavailable.materials},alternative:{...alternative,materials:altMaterials},retained:{input:retainedRequest,...retained},sharedReuse:{request:sharedScenario.request,spec:{offeringIds:['ACT-001','ACT-003']},approved:sequential.plan,forbidden:forbidden.plan},concurrency:{request:capacity.request,parallelStations:2,stock30:sequentialGroups.plan,stock60:concurrentGroups.plan},noEquivalentAlternative:{request:impossible,...none},productionAPIRejection:{status:rejected.status,response:await rejected.json()}};
 assert.equal(JSON.stringify(bundle()),original,'No official data mutations');
 fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('Class B resource lifecycle, critical-preserving Plan B, reuse, retained What-if and API rejection: PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
