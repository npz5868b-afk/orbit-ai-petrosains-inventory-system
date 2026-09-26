// Real HTTP smoke tests against explicit local Next instances; no Stage 1 writes.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const option=k=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3);
const base=option('base'),degraded=option('degraded'),output=option('output');
if(!base||!degraded||!output)throw new Error('Provide --base, --degraded and --output');
const cases=[];
async function call(name,url,method='GET',input,expect=200) {
  const response=await fetch(url,{method,headers:input!==undefined?{'content-type':'application/json'}:{},body:input!==undefined?JSON.stringify(input):undefined,signal:AbortSignal.timeout(15000)});
  const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
  assert.equal(response.status,expect,`${name}: ${raw.slice(0,300)}`);
  cases.push({name,url,method,input:input??null,httpStatus:response.status,response:data});return data;
}
async function main(){
  const o=await call('official-offerings',base+'/offerings');assert.equal(o.offerings.length,21);
  const t=await call('pending-themes',base+'/themes');assert.equal(t.supportingMappings.verification,'pending');
  const request={themes:[{text:'Robotics',priority:'critical'}],objectives:[],participants:30,ages:'12-14',durationMin:240,eventStart:'2026-10-01T09:00:00Z',venue:'indoor',internet:'stable',electricity:'yes',water:'yes',budgetBand:'Medium',accessibility:[]};
  const payload={request,plan:{offeringIds:['ACT-001']},search:{maxActivities:1,maxEvaluations:21}};
  const normal=await call('normal-consult',base+'/consult','POST',payload);assert.equal(normal.inventory.state,'read');assert.equal(normal.status,'NEEDS VERIFICATION');
  const missing=await call('missing-information',base+'/consult','POST',{request:{},search:{maxActivities:1,maxEvaluations:3}});assert.ok(missing.missingInformation.length);
  const hard=await call('hard-failure-and-unknowns',base+'/consult','POST',{...payload,request:{...request,durationMin:1}});assert.equal(hard.status,'NOT FEASIBLE');assert.ok(hard.checks.some(c=>c.status==='NEEDS VERIFICATION'));
  await call('reject-client-evidence',base+'/consult','POST',{...payload,evidence:{verified:true}},400);
  await call('reject-illegal-offering',base+'/consult','POST',{...payload,plan:{offeringIds:['FAKE']}},400);
  const none=await call('bounded-no-plan',base+'/consult','POST',{request:{...request,durationMin:1},search:{maxActivities:1,maxEvaluations:2}});assert.equal(none.programme,null);assert.equal(none.search.exhaustedWithinBounds,false);
  const offline=await call('unreachable-inventory-degradation',degraded+'/consult','POST',payload);assert.equal(offline.inventory.degraded,true);assert.equal(offline.inventory.state,'unavailable');assert.equal(offline.status,'NEEDS VERIFICATION');assert.ok(offline.materials.every(m=>m.eventQuantity.value===null));
  await call('method-not-supported',base+'/consult','GET',undefined,405);
  fs.writeFileSync(path.resolve(output),JSON.stringify({mode:'actual HTTP against isolated Next production servers',note:'Default reviews are empty; current stock, mappings and future availability remain unverified. Degraded instance points to an unreachable dependency for this test only.',recordedAt:new Date().toISOString(),cases},null,2)+'\n');
  console.log(JSON.stringify({passed:cases.length,cases:cases.map(c=>({name:c.name,status:c.httpStatus,feasibility:c.response?.status??null})),output:path.resolve(output)},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
