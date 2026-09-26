// Handler tests: inventory/network/clock dependencies are simulated and explicitly isolated.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {core,bundle,context}=require('./fixtures.cjs');
const {createProgrammeHandlers,assertProductionReviews}=require('../../.test-tmp/programmes-api/lib/programmes/server/handlers.js');
const inv=require('../../.test-tmp/programmes-core/inventory-adapter.js');
const res=require('../../.test-tmp/programmes-core/resources.js');
const emptyReviews=()=>({stocks:[],materials:[],operational:{offerings:{},pools:[]}});
function environment(overrides={}) {
  let reads=0;
  const snapshot=inv.inventorySnapshot(require('../../backend/data/inventory_catalog.json'),{namespace:'SYNTHETIC-handler-test',origin:'seed_file',sourceRef:'SYNTHETIC local test payload; not live',retrievedAt:context.evaluatedAt});
  const deps={bundle:async()=>bundle(),reviews:async()=>emptyReviews(),inventory:async()=>{reads++;return snapshot;},now:()=>context.evaluatedAt,inventoryTimeoutMs:20,...overrides};
  return {handlers:createProgrammeHandlers(deps),deps,snapshot,reads:()=>reads};
}
function request(value, headers={'content-type':'application/json'}) {return new Request('http://localhost/api/programmes/consult',{method:'POST',headers,body:typeof value==='string'?value:JSON.stringify(value)});}
const brief=()=>({themes:[{text:'Robotics',priority:'critical'}],objectives:[],ages:'12-14',participants:30,durationMin:240,eventStart:'2026-10-01T09:00:00Z',venue:'indoor',internet:'stable',electricity:'yes',water:'yes',budgetBand:'Medium',accessibility:[]});
const fast={maxActivities:1,maxEvaluations:21};
async function consult(env,payload){const response=await env.handlers.consult(request(payload));return {http:response.status,data:await response.json()};}
test('API offerings preserves 21 official IDs/names/Notes and has no operational approval',async()=>{
  const e=environment(),r=await e.handlers.offerings(new Request('http://local'));
  const b=await r.json(); assert.equal(b.offerings.length,21);assert.equal(b.offerings[19].officialName,'Fabolous Fizzy');
  assert.ok(b.offerings.every(o=>o.operationalVerification==='pending'));assert.equal(e.reads(),0);
  assert.equal(r.headers.get('cache-control'),'no-store');
});
test('API themes retains supporting mappings and explicitly pending status',async()=>{
  const e=environment(),b=await (await e.handlers.themes(new Request('http://local'))).json();
  assert.ok(b.themes.length);assert.equal(b.supportingMappings.verification,'pending');assert.equal(b.supportingMappings.records.length,25);assert.equal(e.reads(),0);
});
test('API valid specified plan equals direct B2/B3 evaluation byte for byte',async()=>{
  const e=environment(),input=brief(),spec={offeringIds:['ACT-001']};
  const {http,data}=await consult(e,{request:input,plan:spec,search:fast});assert.equal(http,200);
  const b=bundle(),a=res.adaptResources(b,e.snapshot,[],[],emptyReviews().operational,context,input.eventStart);
  const direct=core.evaluatePlan(core.adaptCatalogue(b),input,a.evidence,context,spec);
  assert.deepEqual(data.programme,JSON.parse(JSON.stringify(direct)));assert.equal(data.status,'NEEDS VERIFICATION');
  assert.ok(data.materials.every(m=>m.status==='Unknown'));assert.ok(data.checks.length);assert.ok(data.missingInformation.length);
});
test('API recommendation search equals direct core with the same explicit bounds',async()=>{
  const e=environment(),input=brief(),{data}=await consult(e,{request:input,search:fast});
  const b=bundle(),a=res.adaptResources(b,e.snapshot,[],[],emptyReviews().operational,context,input.eventStart);
  const direct=core.recommend(core.adaptCatalogue(b),input,a.evidence,context,fast);
  assert.deepEqual(data.programme,JSON.parse(JSON.stringify(direct.primary)));assert.deepEqual(data.search,direct.search);
});
test('API missing information is a valid 200 result with targeted questions',async()=>{
  const {http,data}=await consult(environment(),{request:{},search:fast});assert.equal(http,200);assert.equal(data.status,'NEEDS VERIFICATION');assert.ok(data.missingInformation.length);
});
test('API known duration failure and unknown stock both remain visible',async()=>{
  const {http,data}=await consult(environment(),{request:{...brief(),durationMin:1},plan:{offeringIds:['ACT-019']},search:fast});
  assert.equal(http,200);assert.equal(data.status,'NOT FEASIBLE');assert.ok(data.checks.some(c=>c.status==='NOT FEASIBLE'));assert.ok(data.checks.some(c=>c.status==='NEEDS VERIFICATION'));
});
test('API no acceptable plan includes bounded conclusion, failures and unknown diagnostics',async()=>{
  const {http,data}=await consult(environment(),{request:{...brief(),durationMin:1},search:{maxActivities:1,maxEvaluations:2}});
  assert.equal(http,200);assert.equal(data.programme,null);assert.equal(data.outcome,'no_plan_within_search');
  assert.equal(data.search.exhaustedWithinBounds,false);assert.match(data.conclusion,/No acceptable plan found within/);assert.ok(data.rejectedDetails.length);assert.ok(data.missingInformation.length);
});
test('API inventory exception degrades to empty Unknown evidence without leaking error text',async()=>{
  const e=environment({inventory:async()=>{throw new Error('password=SECRET internal/stack');}});
  const {http,data}=await consult(e,{request:brief(),search:fast});assert.equal(http,200);assert.equal(data.inventory.state,'unavailable');
  assert.equal(data.inventory.degraded,true);assert.doesNotMatch(JSON.stringify(data),/SECRET|internal\/stack/);assert.ok(data.materials.every(m=>m.currentQuantity.value===null&&m.eventQuantity.value===null));
});
test('API hung inventory promise times out while catalogue computation continues',async()=>{
  const e=environment({inventory:()=>new Promise(()=>{}),inventoryTimeoutMs:5});
  const {http,data}=await consult(e,{request:brief(),search:fast});assert.equal(http,200);assert.equal(data.inventory.state,'timeout');assert.equal(data.status,'NEEDS VERIFICATION');
});
test('API AbortSignal TimeoutError is identified as timeout',async()=>{
  const e=environment({inventory:async()=>{throw new DOMException('secret endpoint','TimeoutError');}});
  assert.equal((await consult(e,{request:{},search:fast})).data.inventory.state,'timeout');
});
for(const [label,value] of Object.entries({negativePeople:{participants:-1},fractionPeople:{participants:2.5},tooManyPeople:{participants:1001},invalidDate:{eventStart:'2026-02-31T09:00:00Z'},invalidEnum:{internet:'sometimes'},wrongType:{participants:'30'},badAge:{ages:{min:18,max:12}},badGoal:{themes:[{text:'x',priority:'verified'}]},badBoolean:{participantLed:'yes'},tooLong:{brief:'x'.repeat(4001)}})) test(`API rejects ${label} before reading inventory`,async()=>{
  const e=environment(),{http}=await consult(e,{request:value});assert.equal(http,400);assert.equal(e.reads(),0);
});
for(const spoof of [{verified:true},{confirmedBy:'operator'},{evidence:{pools:[]}},{ResourcePool:{eventQuantity:1000}},{PlanResult:{status:'VERIFIED FEASIBLE'}},{inventoryUrl:'http://attacker/'},{namespace:'fake'},{whatIf:{previous:{status:'VERIFIED FEASIBLE'}}}]) test(`API rejects client authority field ${Object.keys(spoof)[0]}`,async()=>{
  const e=environment();assert.equal((await consult(e,{request:brief(),...spoof})).http,400);assert.equal(e.reads(),0);
});
test('API rejects nested forged evidence in request/goal/plan',async()=>{
  for(const payload of [{request:{...brief(),verified:true}},{request:{themes:[{text:'x',priority:'critical',confirmedBy:'admin'}]}},{request:brief(),plan:{offeringIds:['ACT-001'],status:'VERIFIED FEASIBLE'}}]) {
    const e=environment();assert.equal((await consult(e,payload)).http,400);assert.equal(e.reads(),0);
  }
});
test('API rejects nonexistent/duplicate offering IDs and invalid search budgets',async()=>{
  for(const extra of [{plan:{offeringIds:['FAKE']}},{plan:{offeringIds:['ACT-001','ACT-001']}},{search:{maxActivities:4}},{search:{maxEvaluations:201}},{search:{maxEvaluations:0}},{search:{maxActivities:3,maxEvaluations:200}}]) {
    assert.equal((await consult(environment(),{request:{...brief(),participants:1000},...extra})).http,400);
  }
});
test('API rejects malformed JSON, invalid content type, excessive and lying-length bodies',async()=>{
  const e=environment();assert.equal((await e.handlers.consult(request('{broken'))).status,400);
  assert.equal((await e.handlers.consult(request('{}',{'content-type':'text/plain'}))).status,415);
  assert.equal((await e.handlers.consult(request(' '.repeat(65537),{'content-type':'application/json','content-length':'2'}))).status,413);
  assert.equal((await e.handlers.consult(request('{}',{'content-type':'application/json','content-length':'70000'}))).status,413);assert.equal(e.reads(),0);
});
test('API server catalogue/review failures are sanitized 503 dependency errors',async()=>{
  for(const overrides of [{bundle:async()=>{throw new Error('SECRET file path');}},{reviews:async()=>{throw new Error('SECRET credentials');}}]) {
    const {http,data}=await consult(environment(overrides),{request:brief()});assert.equal(http,503);assert.doesNotMatch(JSON.stringify(data),/SECRET|stack/);
  }
});
test('API refuses synthetic evidence accidentally loaded from a server review file',async()=>{
  const reviews=emptyReviews();reviews.operational.offerings['ACT-001']={available:{value:true,verification:'verified',sources:[{kind:'synthetic',ref:'test'}]}};
  assert.throws(()=>assertProductionReviews(reviews),/Synthetic/);
  const {http}=await consult(environment({reviews:async()=>reviews}),{request:brief()});assert.equal(http,503);
});
test('API operational assumptions never become confirmed staff/stock',async()=>{
  const {data}=await consult(environment(),{request:{...brief(),assumptions:[{kind:'operational',text:'Assume enough staff and stock'}]},search:fast});
  assert.equal(data.status,'NEEDS VERIFICATION');assert.ok(data.checks.some(c=>c.id.startsWith('request.assumption')));
});
test('API routes export only approved methods and Node runtime (compiled route smoke test)',()=>{
  for(const [name,method] of [['offerings','GET'],['themes','GET'],['consult','POST']]) {
    const route=require(`../../.test-tmp/programmes-api/app/api/programmes/${name}/route.js`);assert.equal(route.runtime,'nodejs');assert.equal(typeof route[method],'function');
    assert.ok(!Object.keys(route).some(k=>['PUT','DELETE','PATCH'].includes(k)));
  }
});
test('API JSON runtime data matches original B1 manifest bytes',()=>{
  const b=bundle(),crypto=require('node:crypto');
  for(const [name,hash] of Object.entries(b.manifest.outputs)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../backend/data/programmes',name))).digest('hex'),hash);
});
