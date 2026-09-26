// Node regression checks for the shared B5 protocol/local runner. No browser claims.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bundle,core,context}=require('./fixtures.cjs');
const {consultLocally,comparePlans,LatestEvaluation}=require('../../.test-tmp/programmes-core/local.js');
const {validateConsultation}=require('../../.test-tmp/programmes-core/protocol.js');
const {createProgrammeHandlers}=require('../../.test-tmp/programmes-api/lib/programmes/server/handlers.js');
const {inventorySnapshot}=require('../../.test-tmp/programmes-core/inventory-adapter.js');
const fast={maxActivities:1,maxEvaluations:21};
const input=()=>({request:{participants:30,ages:'12+',durationMin:240,internet:'unknown',themes:[{text:'Robotics',priority:'preference'},{text:'Sustainability',priority:'preference'}]},search:fast});
const run=(payload=input(),at=context.evaluatedAt,last=null)=>consultLocally(bundle(),payload,at,last);
const handlers=()=>createProgrammeHandlers({bundle:async()=>bundle(),reviews:async()=>({stocks:[],materials:[],operational:{offerings:{},pools:[]}}),inventory:async()=>{throw Error('SYNTHETIC unavailable dependency')},now:()=>context.evaluatedAt,inventoryTimeoutMs:5});
test('B5 offline catalogue endpoint returns public B1 data and never accesses reviews or inventory',async()=>{
 const h=createProgrammeHandlers({bundle:async()=>bundle(),reviews:async()=>{throw Error('SECRET')},inventory:async()=>{throw Error('SECRET')},now:()=>context.evaluatedAt,inventoryTimeoutMs:5});
 const response=await h.offerings(new Request('http://local/api/programmes/offerings?include=offline'));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.schema,'orbit-programme-browser-v1');
 assert.equal(core.adaptCatalogue(data.bundle).offerings.length,21);assert.equal(data.bundle.materials.sheets.flatMap(s=>s.records).length,275);
 assert.equal(data.bundle.mapping.records.length,25);assert.equal(data.bundle.constraints.records.length,12);
 assert.deepEqual(data.bundle.offerings,bundle().offerings);assert.deepEqual(data.bundle.audit,bundle().audit);
 assert.doesNotMatch(JSON.stringify(data),/SECRET|ORBIT_PROGRAMME_|confirmedBy|reviewFile|server\/runtime/);
 assert.deepEqual(Object.keys(data.bundle.manifest).sort(),['schema_version','sheet_names','source_sha256','workbook_filename']);
});
test('B5 existing offerings contract remains unchanged without opt-in',async()=>{
 const data=await (await handlers().offerings(new Request('http://local/api/programmes/offerings'))).json();assert.equal(data.bundle,undefined);assert.equal(data.offerings.length,21);
});
test('B5 no loaded catalogue cannot produce offline success',()=>{assert.throws(()=>consultLocally(null,input(),context.evaluatedAt,null));});
test('B5 mixed/unreadable catalogue is rejected before offline computation',()=>{const b=bundle();b.constraints.source_sha256='wrong';assert.throws(()=>consultLocally(b,input(),context.evaluatedAt,null),/Mixed/);});
test('B5 local and degraded API share exact programme/search/check/material results',async()=>{
 const payload=input(),r=run(payload),online=await (await handlers().consult(new Request('http://local/api/programmes/consult',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}))).json();
 for(const key of ['programme','search','checks','materials','planB','tradeOffs','missingInformation','themeCoverage','storyline'])assert.deepEqual(JSON.parse(JSON.stringify(r[key])),online[key],key);
});
test('B5 local result retains open-ended ages and multi-theme priorities',()=>{const r=run();assert.deepEqual(r.requestUnderstanding.ages,{min:12,max:null});assert.equal(r.requestUnderstanding.themes.length,2);});
test('B5 empty request does not infer data from a free-text brief',()=>{const r=run({request:{brief:'200 students robotics age 12'},search:fast});assert.equal(r.requestUnderstanding.participants,null);assert.equal(r.requestUnderstanding.ages,null);assert.deepEqual(r.requestUnderstanding.themes,[]);assert.equal(r.status,'NEEDS VERIFICATION');});
test('B5 historical inventory timestamp never becomes current/event evidence',()=>{
 const r=run(input(),context.evaluatedAt,'2001-01-01T00:00:00Z');assert.equal(r.inventory.state,'local');assert.equal(r.inventory.readAt,'2001-01-01T00:00:00Z');assert.match(r.inventory.explanation,/historical only/);
 assert.ok(r.materials.length);assert.ok(r.materials.every(m=>m.currentQuantity.value===null&&m.eventQuantity.value===null&&m.rawAvailable===null&&m.status==='Unknown'));
});
test('B5 What-if rechecks the original legal IDs and keeps pending status',()=>{
 const before=run(),payload=input();payload.plan=before.programme.spec;payload.request.participants=31;const after=run(payload);
 assert.equal(after.status,'NEEDS VERIFICATION');assert.deepEqual(after.programme.spec,before.programme.spec);assert.match(comparePlans(before.programme,after.programme),/retained and rechecked/);
});
test('B5 What-if hard failure and unknowns remain together; Plan B is independently evaluated',()=>{
 const payload=input();payload.plan={offeringIds:['ACT-011']};payload.request.ages='4-8';payload.request.durationMin=240;
 const r=run(payload);assert.equal(r.status,'NOT FEASIBLE');assert.ok(r.checks.some(c=>c.status==='NEEDS VERIFICATION'));assert.ok(r.planB);assert.notEqual(r.planB.status,'NOT FEASIBLE');assert.notDeepEqual(r.planB.spec,payload.plan);assert.ok(r.tradeOffs.unresolved.length);
});
test('B5 no acceptable result preserves bounded search diagnostics',()=>{const payload=input();payload.request.durationMin=1;const r=run(payload);assert.equal(r.programme,null);assert.match(comparePlans({spec:{offeringIds:['ACT-011']}},null),/within the search bounds/);assert.ok(r.rejectedDetails.some(p=>p.checks.some(c=>c.status==='NOT FEASIBLE')));});
test('B5 explicit same input and evaluation time give identical local result',()=>{assert.deepEqual(run(),run());});
test('B5 latest evaluation gate rejects delayed older completions and invalidates on edit',async()=>{
 const gate=new LatestEvaluation(),observed=[];const old=gate.invalidate();let resolve;const pending=new Promise(r=>resolve=r).then(()=>{if(gate.isCurrent(old))observed.push('old')});
 const newer=gate.invalidate();if(gate.isCurrent(newer))observed.push('new');resolve();await pending;assert.deepEqual(observed,['new']);gate.invalidate();assert.equal(gate.isCurrent(newer),false);
});
for(const [label,request] of Object.entries({invalidAge:{ages:'12-4'},badDate:{eventStart:'2026-02-31T10:00:00+08:00'},tooMany:{participants:1001},tooLong:{durationMin:1441},forged:{verified:true},tooManyGoals:{themes:Array.from({length:9},()=>({text:'science',priority:'critical'}))},tooManyNeeds:{accessibility:Array.from({length:13},()=> 'wheelchair')}}))test(`B5 local and API boundary rejects ${label}`,()=>{assert.throws(()=>run({request,search:fast}));});
test('B5 search workload is reduced for large participant counts',()=>{const r=validateConsultation({request:{participants:1000},search:{maxActivities:3}},[]);assert.equal(r.search.maxEvaluations,20);});
test('B5 distinct network and utility values survive the shared request boundary',()=>{for(const internet of ['unknown','none','unstable','stable']){const r=validateConsultation({request:{internet,electricity:'no',water:'unknown',accessibility:null}},[]);assert.equal(r.normalized.request.internet,internet);assert.equal(r.normalized.request.electricity,'no');assert.equal(r.normalized.request.accessibility,null);}});
test('B5 browser dependency graph contains no server/runtime, Node fs or catalogue file imports',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..'),seen=new Set();
 function visit(file){if(seen.has(file))return;seen.add(file);const text=fs.readFileSync(file,'utf8');assert.doesNotMatch(text,/from ['"](?:node:|.*\/server\/)|process\.env|backend\/data/);
 for(const match of text.matchAll(/(?:import|export)(?!\s+type\b)[\s\S]*?from\s*['"]([^'"]+)['"]/g)){const dep=match[1];if(!dep.startsWith('.')&&!dep.startsWith('@/lib/programmes')&&!dep.startsWith('@/components/programmes'))continue;const base=dep.startsWith('@/')?path.join(root,dep.slice(2)):path.resolve(path.dirname(file),dep);const target=['.ts','.tsx','/index.ts'].map(e=>base+e).find(f=>fs.existsSync(f));if(target)visit(target);}}
 visit(path.join(root,'components/programmes/consultant.tsx'));assert.ok(seen.size>=10);
});
