// Read-only inventory audit. Optional explicit --live-api performs GETs only.
// No physical counts, stock attestations, mappings or approvals are supplied here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {core, bundle} = require('./fixtures.cjs');
const inv = require('../../.test-tmp/programmes-core/inventory-adapter.js');
const res = require('../../.test-tmp/programmes-core/resources.js');
const root = path.resolve(__dirname, '../..');
const option = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length+3);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2)+'\n');
async function main() {
  const live = option('live-api'), output = option('output');
  if (live && !output) throw new Error('Live audit requires explicit --output; never overwrite runtime catalogue with a live read');
  const b = bundle(), rawPath = path.join(root, 'backend/data/inventory_catalog.json');
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const reads = [];
  let snapshot;
  if (live) {
    snapshot = await inv.readInventory(async (url, init) => {
      const response = await fetch(url, {...init, signal: AbortSignal.timeout(5000)});
      reads.push({url, method: init.method, status: response.status}); return response;
    }, live, {namespace: option('namespace') ?? 'orbit-local-127.0.0.1-8000', retrievedAt: new Date().toISOString()});
    snapshot.retrievedAt = new Date().toISOString(); // Completion of transport, not a stock observation.
  } else {
    const when = option('evaluated-at'); if (!when) throw new Error('Static audit requires explicit --evaluated-at');
    snapshot = inv.inventorySnapshot(raw, {namespace: 'orbit-project-snapshot', origin: 'seed_file', sourceRef: 'backend/data/inventory_catalog.json', retrievedAt: when});
  }
  const ctx = {evaluatedAt: snapshot.retrievedAt};
  const adapted = res.adaptResources(b, snapshot, [], [], {offerings: {}, pools: []}, ctx, null);
  const catalogue = core.adaptCatalogue(b);
  const plans = catalogue.offerings.map(o => core.evaluatePlan(catalogue, {}, adapted.evidence, ctx, {offeringIds: [o.id]}));
  const materials = plans.flatMap(p => res.materialFeasibility(adapted, p));
  const result = {
    schema: 'orbit-material-inventory-mappings-v1',
    warning: 'Candidate audit only. No mappings, quantities, future bookings, facilitators, rooms or safety approvals have been verified. No stakeholder request is supplied. Raw inventory is not a physical count.',
    sources: {programmeWorkbookSha256: b.manifest.source_sha256, inventoryFileSha256: sha(rawPath), inventory: {origin: snapshot.origin, sourceRef: snapshot.sourceRef, namespace: snapshot.namespace, retrievedAt: snapshot.retrievedAt, timeMeaning: live ? 'HTTP read completion, not physical stock observation' : 'Explicit deterministic local-file audit time, not official publication or physical observation'}, reads},
    summary: {inventoryRecords: snapshot.records.length, materialRows: adapted.mappings.length,
      exactCandidateRows: adapted.mappings.filter(m => m.candidates.length).length,
      exactCandidateLinks: adapted.mappings.reduce((n,m) => n+m.candidates.length,0),
      verifiedExact: adapted.mappings.filter(m=>m.mappingStatus==='verified_exact').length,
      verifiedAlias: adapted.mappings.filter(m=>m.mappingStatus==='verified_alias').length,
      unresolvedRows: adapted.mappings.filter(m=>m.unresolved.length).length,
      ambiguousRows: adapted.mappings.filter(m=>m.raw.row_kind==='material_or_section_needs_review').length,
      verifiedCurrentQuantities: adapted.inventory.pools.filter(p=>p.currentQuantity.verification==='verified').length,
      verifiedEventQuantities: adapted.inventory.pools.filter(p=>p.eventQuantity.verification==='verified').length,
      materialStatuses: {Sufficient: materials.filter(m=>m.status==='Sufficient').length, Insufficient: materials.filter(m=>m.status==='Insufficient').length, Unknown: materials.filter(m=>m.status==='Unknown').length}},
    inventory: adapted.inventory.records, mappings: adapted.mappings, materials,
    coreEvaluation: plans.map(p=>({offeringIds:p.spec.offeringIds,status:p.status,missingInformation:p.missingInformation})),
  };
  const target = output ? path.resolve(output) : path.join(root, 'backend/data/programmes/material_inventory_mappings.json');
  write(target, result);
  console.log(JSON.stringify({output: target, ...result.summary, sha256: sha(target), reads}, null, 2));
}
main().catch(error => {console.error(error); process.exitCode = 1;});
