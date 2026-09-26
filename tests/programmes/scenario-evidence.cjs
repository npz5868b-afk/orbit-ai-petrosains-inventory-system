// B6 CLASS B ONLY: every quantity, mapping, approval, staff and date below is SYNTHETIC.
// Official B1 rows are untouched. No fixture is imported by runtime or API modules.
const {bundle,core,fact,pool,context,eventStart}=require('./fixtures.cjs');
const {inventorySnapshot}=require('../../.test-tmp/programmes-core/inventory-adapter.js');
const {adaptResources,materialFeasibility}=require('../../.test-tmp/programmes-core/resources.js');
function resourceScenario(){
 const b=bundle(),catalogue=core.adaptCatalogue(b),ids=['ACT-001','ACT-003','ACT-018','ACT-019'];
 const op={offerings:{},pools:[pool('SYNTHETIC-staff','facilitator',20),pool('SYNTHETIC-room','room',4)],transitionMin:fact(3),earlyAccessMin:fact(120),lateAccessMin:fact(120)};
 const materials=[],stocks=[],records=[],shared='SYNTHETIC-shared-tool';
 for(const id of ids){
  const o=catalogue.offerings.find(o=>o.id===id),fields={};
  for(const k of ['Recommended_Age','Standard_Duration_Min','Setup_Time_Min','Min_Participants','Max_Participants','Facilitators_Required','Electricity_Required','Internet_Required','Water_Required','Cost_Band'])fields[k]=fact(o.fields[k].value);
  op.offerings[id]={fields,available:fact(true),safetyApproved:fact(true),venueReady:fact(true),accessibilityReady:fact(true),offlineReady:fact(true),unstableInternetReady:fact(true),operationalRequirementsApproved:fact(true),parallelStations:fact(1),resetMin:fact(2),finalResetMin:fact(2),facilitatorPoolId:'SYNTHETIC-staff',roomPoolId:'SYNTHETIC-room',materialsComplete:fact(true)};
  // Every retained row gets explicit synthetic demand evidence; none are dropped.
  for(const [i,row] of b.materials.sheets.find(s=>s.Offering_ID===id).records.entries()){
   const sku=(id==='ACT-001'||id==='ACT-003')&&i===0?shared:`SYNTHETIC-${row.material_row_id}`;
   const kind=i===1?'consumable':'reusable',quantity=sku===shared?30:1000;
   if(!records.some(r=>r.sku===sku)){
    records.push({id:`test-${sku}`,sku,name:`SYNTHETIC fixture for ${row.material_row_id}`,item_type:kind,base_unit:'unit',available_quantity:quantity,total_quantity:quantity,store_id:'SYNTHETIC-only'});
    const att=(event)=>({method:'synthetic',unit:'unit',quantity:fact(quantity),...(event?{windowStart:'2026-10-01T07:00:00Z',windowEnd:'2026-10-01T23:00:00Z'}:{})});
    stocks.push({itemId:`test-${sku}`,sku,current:att(false),event:att(true)});
   }
   materials.push({rowId:row.material_row_id,itemId:`test-${sku}`,sku,mapping:fact('alias'),specificationCompatible:fact(true),quantity:fact(1),unit:fact('unit'),inventoryUnit:fact('unit'),basis:fact('per_participant'),kind:fact(kind),conversionToPoolUnit:fact(1),reuseApproved:fact(true),resetMin:fact(2)});
  }
 }
 return {label:'SYNTHETIC Class B; not live approval or stock. All demand=1 unit per participant is explicitly invented test evidence, not inferred from ACT sheets.',bundle:b,catalogue,context,shared,
  snapshot:inventorySnapshot(records,{namespace:'SYNTHETIC-B6',origin:'synthetic',sourceRef:'SYNTHETIC B6 scenario ledger',retrievedAt:context.evaluatedAt}),reviews:{stocks,materials,operational:op},
  request:{themes:[{text:'Robotics',priority:'critical'},{text:'Sustainability',priority:'critical'}],objectives:[],audienceType:'SYNTHETIC test group',ages:'14-16',participants:30,durationMin:600,eventStart,venue:'indoor',internet:'stable',electricity:'yes',water:'yes',budgetBand:'High',accessibility:[]},spec:{offeringIds:['ACT-001','ACT-019']}};
}
function runResourceScenario(s,spec=s.spec){const adapted=adaptResources(s.bundle,s.snapshot,s.reviews.stocks,s.reviews.materials,s.reviews.operational,s.context,s.request.eventStart);const plan=core.evaluatePlan(s.catalogue,s.request,adapted.evidence,s.context,spec);return {adapted,plan,materials:materialFeasibility(adapted,plan)};}
module.exports={resourceScenario,runResourceScenario};
