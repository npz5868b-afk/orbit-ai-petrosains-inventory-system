/** B3 pure material evidence bridge. B1 rows never become approved mappings by name. */
import type { B1Bundle, Check, EvaluationContext, Evidence, Fact, MaterialDemand, PlanResult, Source } from './types';
import { adaptCatalogue } from './catalogue';
import { current, finite, timestamp } from './evidence';
import { adaptInventory, copy, pending, poolIdentity } from './inventory-adapter';
import type { InventoryEvidence, InventorySnapshot, StockReview } from './inventory-adapter';

export interface MaterialReview {
  rowId: string; itemId: string; sku: string;
  mapping: Fact<'exact' | 'alias'>; specificationCompatible: Fact<boolean>;
  quantity: Fact<number>; unit: Fact<string>; inventoryUnit: Fact<string>;
  basis: MaterialDemand['basis']; kind: MaterialDemand['kind'];
  conversionToPoolUnit: Fact<number>; reuseApproved: Fact<boolean>; resetMin: Fact<number>;
}
export interface MaterialMapping {
  rowId: string; offeringId: string; itemName: string | null;
  raw: B1Bundle['materials']['sheets'][number]['records'][number];
  candidates: Array<{itemId: string; sku: string; poolId: string; match: 'exact_candidate'}>;
  selection: {itemId: string; sku: string; poolId: string} | null;
  mappingStatus: 'exact_candidate' | 'verified_exact' | 'verified_alias' | 'rejected' | 'unresolved';
  unresolved: string[]; sources: Source[]; review: MaterialReview | null;
}
export interface ResourceAdaptation {
  evidence: Evidence; inventory: InventoryEvidence; mappings: MaterialMapping[];
  catalogueSha256: string; eventStart: string | null; evaluatedAt: string;
}
const normalizedName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
const verified = (f: Fact<unknown> | undefined, ctx: EvaluationContext, event: string | null): boolean => !!f?.confirmedBy?.trim() && current(f, ctx, event);

export function adaptResources(bundle: B1Bundle, snapshot: InventorySnapshot, stockReviews: StockReview[], materialReviews: MaterialReview[], operational: Evidence, ctx: EvaluationContext, eventStart: string | null): ResourceAdaptation {
  const catalogue = adaptCatalogue(bundle);
  const inventory = adaptInventory(snapshot, stockReviews, ctx, eventStart);
  // Resource identities owned by this adapter cannot also be supplied as a second pool.
  if (operational.pools.some(p => p.kind === 'equipment' || p.kind === 'consumable' || p.id.startsWith(`orbit:${encodeURIComponent(snapshot.namespace)}:`))) throw new Error('Supply inventory pools only through the resource adapter, never duplicate them in operational evidence');
  const rows = bundle.materials.sheets.flatMap(s => s.records.map(raw => ({offeringId: s.Offering_ID, raw})));
  const byRow = new Map<string, MaterialReview>();
  for (const r of materialReviews) {
    if (byRow.has(r.rowId) || !rows.some(row => row.raw.material_row_id === r.rowId)) throw new Error('Duplicate/unknown material review row ID');
    if (!snapshot.records.some(i => i.id === r.itemId && i.sku === r.sku)) throw new Error('Material review must bind both existing inventory ID and SKU');
    byRow.set(r.rowId, r);
  }
  const evidence = copy(operational);
  evidence.pools = [...evidence.pools, ...copy(inventory.pools)];
  const mappings: MaterialMapping[] = [];
  for (const o of catalogue.offerings) {
    const oe = evidence.offerings[o.id] ?? {};
    if (oe.materials?.length) throw new Error('Do not bypass B1 material reviews with prebuilt material demands');
    oe.materials = [];
    oe.materialsComplete ??= pending([{kind: 'catalogue', ref: o.id, workbookSha256: catalogue.sourceSha256}]);
    evidence.offerings[o.id] = oe;
  }
  for (const {raw, offeringId} of rows) {
    const itemName = typeof raw.item_name === 'string' ? raw.item_name : null;
    const sources: Source[] = [{kind: 'catalogue', ref: raw.material_row_id, workbookSha256: catalogue.sourceSha256, ...raw.source}];
    const candidates = itemName ? snapshot.records.filter(i => normalizedName(i.name) === normalizedName(itemName)).map(i => ({itemId: i.id, sku: i.sku, poolId: poolIdentity(snapshot.namespace, i.sku), match: 'exact_candidate' as const})) : [];
    const r = byRow.get(raw.material_row_id), unresolved: string[] = [];
    const selected = r ? snapshot.records.find(i => i.id === r.itemId && i.sku === r.sku)! : undefined;
    const selection = selected ? {itemId: selected.id, sku: selected.sku, poolId: poolIdentity(snapshot.namespace, selected.sku)} : null;
    let mappingStatus: MaterialMapping['mappingStatus'] = candidates.length ? 'exact_candidate' : 'unresolved';
    let mapping: MaterialDemand['mapping'] = pending(sources);
    const take = <T>(f: Fact<T> | undefined): Fact<T> => f ? copy(f) : pending<T>(sources);
    if (r && verified(r.mapping, ctx, eventStart) && (r.mapping.value === 'alias' || (r.mapping.value === 'exact' && candidates.some(c => c.sku === r.sku)))) {
      mapping = copy(r.mapping); mappingStatus = r.mapping.value === 'alias' ? 'verified_alias' : 'verified_exact';
    } else unresolved.push('Mapping is a candidate/unconfirmed alias only; verify this row to the specific SKU and retain reviewer/date.');
    if (r && verified(r.specificationCompatible, ctx, eventStart) && r.specificationCompatible.value === false) mappingStatus = 'rejected';
    const checkFact = (label: string, f: Fact<unknown> | undefined, allowed: (v: unknown) => boolean) => {
      if (!verified(f, ctx, eventStart) || !allowed(f?.value)) unresolved.push(`${label}: missing, stale, invalid or not independently reviewed for this event.`);
    };
    checkFact('specification', r?.specificationCompatible, v => v === true);
    checkFact('quantity', r?.quantity, v => finite(v));
    checkFact('demand unit', r?.unit, v => typeof v === 'string' && !!v.trim());
    checkFact('inventory unit', r?.inventoryUnit, v => typeof v === 'string' && v === selected?.base_unit);
    checkFact('usage basis', r?.basis, v => ['per_participant', 'per_group', 'per_station', 'per_session'].includes(String(v)));
    checkFact('consumption/reuse classification', r?.kind, v => ['consumable', 'reusable'].includes(String(v)) && v === selected?.item_type);
    checkFact('unit conversion', r?.conversionToPoolUnit, v => finite(v, 0.000001));
    if (r?.kind.value === 'reusable') {
      checkFact('reuse permission (required if reuse is needed)', r.reuseApproved, v => typeof v === 'boolean');
      checkFact('reset', r.resetMin, v => finite(v));
    }
    // Even pending inputs remain present as demands, so B2 cannot omit unresolved rows.
    const sanitize = <T>(f: Fact<T> | undefined): Fact<T> => verified(f, ctx, eventStart) ? take(f) : {...take(f), verification: 'pending'};
    const unitReady = r && verified(r.unit, ctx, eventStart) && typeof r.unit.value === 'string' && r.unit.value.trim() && verified(r.inventoryUnit, ctx, eventStart) && r.inventoryUnit.value === selected?.base_unit;
    const kind = sanitize(r?.kind);
    if (kind.value !== selected?.item_type) kind.verification = 'pending';
    const conversion = unitReady ? sanitize(r?.conversionToPoolUnit) : pending<number>(sources);
    if (unitReady && conversion.verification === 'verified') {
      const facts = [conversion, r!.unit, r!.inventoryUnit];
      conversion.sources = facts.flatMap(f => copy(f.sources));
      conversion.observedAt = facts.map(f => f.observedAt!).sort((a, b) => timestamp(b)! - timestamp(a)!)[0];
      conversion.validUntil = facts.map(f => f.validUntil!).sort((a, b) => timestamp(a)! - timestamp(b)!)[0];
      const starts = facts.flatMap(f => f.availableFrom ? [f.availableFrom] : []);
      if (starts.length) conversion.availableFrom = starts.sort((a, b) => timestamp(b)! - timestamp(a)!)[0];
    }
    const demand: MaterialDemand = {
      id: raw.material_row_id, sourceRowIds: [raw.material_row_id], sources,
      poolId: selection?.poolId ?? `unresolved:${raw.material_row_id}`, mapping,
      specificationCompatible: sanitize(r?.specificationCompatible), quantity: sanitize(r?.quantity),
      unit: unitReady ? r!.unit.value! : '', basis: sanitize(r?.basis), kind,
      conversionToPoolUnit: conversion,
      reuseApproved: sanitize(r?.reuseApproved), resetMin: sanitize(r?.resetMin),
    };
    const disposition = evidence.offerings[offeringId].materialRowDispositions?.find(d => d.sourceRowId === raw.material_row_id);
    const excluded = !r && disposition && verified(disposition.classification, ctx, eventStart) && disposition.classification.value === 'not_material' && !!disposition.reason.trim();
    // Only a reviewed ambiguous section row can be excluded; every original row stays in the report.
    if (excluded && raw.row_kind === 'material_or_section_needs_review') {
      unresolved.splice(0); unresolved.push(`Reviewed non-material row: ${disposition.reason}`);
    } else {
      if (disposition) evidence.offerings[offeringId].materialRowDispositions = evidence.offerings[offeringId].materialRowDispositions!.filter(d => d.sourceRowId !== raw.material_row_id);
      evidence.offerings[offeringId].materials!.push(demand);
    }
    mappings.push({rowId: raw.material_row_id, offeringId, itemName, raw: copy(raw), candidates, selection, mappingStatus, unresolved, sources, review: r ? copy(r) : null});
  }
  return {evidence, inventory, mappings, catalogueSha256: catalogue.sourceSha256, eventStart, evaluatedAt: ctx.evaluatedAt};
}

export interface MaterialFeasibility {
  rowId: string; offeringId: string; poolId: string | null;
  status: 'Sufficient' | 'Insufficient' | 'Unknown'; scope: 'event_programme';
  reasons: string[]; checks: Check[]; sources: Source[]; evidenceTimes: string[]; nextAction: string;
  rawAvailable: number | null; currentQuantity: Fact<number>; eventQuantity: Fact<number>;
}
/** Describe a B2 result; never implement a second quantity/scheduling evaluator. */
export function materialFeasibility(adapted: ResourceAdaptation, plan: PlanResult): MaterialFeasibility[] {
  if (plan.evaluatedAt !== adapted.evaluatedAt || plan.requestUnderstanding.eventStart !== adapted.eventStart) throw new Error('Re-adapt resource evidence for the changed event/time before reporting');
  return adapted.mappings.filter(m => plan.spec.offeringIds.includes(m.offeringId)).map(m => {
    const id = m.selection?.poolId ?? null;
    const item = adapted.inventory.records.find(i => i.poolId === id);
    const checks = plan.checks.filter(c => c.id.startsWith(`${m.offeringId}.${m.rowId}.`) || c.id.startsWith(`${m.offeringId}.materials.`) || c.id.startsWith(`${m.offeringId}.evidence.window.`) || c.id === `equipment.${id}.allocation` || c.id === `consumable.${id}.total` || c.id === `resource.${id}.overlap` || c.id === `resource.${id}.current`);
    const quantityCheck = checks.some(c => c.id === `equipment.${id}.allocation` || c.id === `consumable.${id}.total`);
    const failed = checks.some(c => c.status === 'NOT FEASIBLE');
    const unknown = !quantityCheck || checks.some(c => c.status === 'NEEDS VERIFICATION') || !['verified_exact', 'verified_alias'].includes(m.mappingStatus);
    return {rowId: m.rowId, offeringId: m.offeringId, poolId: id, scope: 'event_programme', status: failed ? 'Insufficient' : unknown ? 'Unknown' : 'Sufficient',
      reasons: checks.length ? checks.map(c => c.reason) : m.unresolved,
      checks: copy(checks), sources: [...copy(m.sources), ...checks.flatMap(c => copy(c.sources))], evidenceTimes: [...new Set(checks.flatMap(c => c.evidenceTimes))],
      nextAction: failed ? 'Resolve the cited incompatible mapping/shortage and re-evaluate the whole programme.' : unknown ? 'Verify the row, specifications, units/basis, current stock and event availability; retain unresolved source rows.' : 'Retain the event-scoped evidence; re-evaluate if participants, supply or timing changes.',
      rawAvailable: item?.raw.available_quantity ?? null, currentQuantity: copy(item?.currentQuantity ?? pending<number>()), eventQuantity: copy(item?.eventQuantity ?? pending<number>())};
  });
}
