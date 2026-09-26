/** B3 read adapter. Transport is injected; no fetch globals, database or writes. */
import type { EvaluationContext, Fact, ResourcePool, Source } from './types';
import { current, finite, integer, timestamp, validateContext } from './evidence';

export interface InventoryRecord {
  id: string; sku: string; name: string; item_type: 'consumable' | 'reusable';
  base_unit: string; available_quantity: number; total_quantity: number;
  store_id: string; checked_out_quantity?: number; updated_at?: string;
  display_unit?: string; issue_unit?: string; conversion_to_base?: number | null;
  [key: string]: unknown;
}
export interface InventorySnapshot {
  schema: 'orbit-programme-inventory-v1'; namespace: string;
  origin: 'api_read' | 'seed_file' | 'saved_snapshot' | 'synthetic';
  sourceRef: string; retrievedAt: string; records: InventoryRecord[];
}
export type SnapshotMeta = Omit<InventorySnapshot, 'schema' | 'records'>;
export type ReadTransport = (url: string, init: {method: 'GET'}) => Promise<{ok: boolean; status: number; json(): Promise<unknown>}>;
export interface QuantityAttestation {
  method: 'physical_count' | 'reconciled_inventory' | 'event_availability' | 'synthetic';
  unit: string; quantity: Fact<number>;
  /** Event availability interval, independent of observation/fact expiry. */
  windowStart?: string; windowEnd?: string;
}
export interface StockReview { itemId: string; sku: string; current?: QuantityAttestation; event?: QuantityAttestation }
export interface InventoryEvidence {
  pools: ResourcePool[];
  records: Array<{raw: InventoryRecord; poolId: string; currentQuantity: Fact<number>; eventQuantity: Fact<number>; reviews: StockReview | null; reasons: string[]; sources: Source[]; retrievedAt: string}>;
}
export const poolIdentity = (namespace: string, sku: string): string => `orbit:${encodeURIComponent(namespace)}:sku:${encodeURIComponent(sku)}`;
export const pending = <T>(sources: Source[] = []): Fact<T> => ({value: null, verification: 'pending', sources: sources.map(s => ({...s}))});
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function inventorySnapshot(input: unknown, meta: SnapshotMeta): InventorySnapshot {
  if (!meta.namespace.trim() || !meta.sourceRef.trim() || timestamp(meta.retrievedAt) === null) throw new Error('Inventory source identity and explicit retrieval time required');
  if (!['api_read', 'seed_file', 'saved_snapshot', 'synthetic'].includes(meta.origin)) throw new Error('Unknown inventory origin');
  if (!Array.isArray(input)) throw new Error('Inventory records must be an array');
  const ids = new Set<string>(), skus = new Set<string>();
  for (const r of input as InventoryRecord[]) {
    if (!r || !['id', 'sku', 'name', 'base_unit', 'store_id'].every(k => typeof r[k] === 'string' && String(r[k]).trim()) || !['reusable', 'consumable'].includes(r.item_type) || !integer(r.available_quantity) || !integer(r.total_quantity) || r.available_quantity > r.total_quantity) throw new Error('Invalid inventory identity, unit, kind or quantity');
    if (r.checked_out_quantity !== undefined && r.checked_out_quantity !== Math.max(0, r.total_quantity - r.available_quantity)) throw new Error('Inventory checked-out arithmetic conflicts with Stage 1 contract');
    if (ids.has(r.id) || skus.has(r.sku)) throw new Error('Duplicate item ID/SKU: never sum duplicate resource identities');
    ids.add(r.id); skus.add(r.sku);
  }
  return {schema: 'orbit-programme-inventory-v1', namespace: meta.namespace, origin: meta.origin, sourceRef: meta.sourceRef, retrievedAt: meta.retrievedAt, records: copy(input as InventoryRecord[])};
}
export async function readInventory(get: ReadTransport, apiBase: string, meta: Omit<SnapshotMeta, 'origin' | 'sourceRef'>): Promise<InventorySnapshot> {
  const base = apiBase.replace(/\/$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error('Explicit HTTP(S) inventory API base required');
  const records: unknown[] = []; let expected: number | null = null;
  for (let page = 0; page < 100; page++) {
    const offset = records.length;
    const response = await get(`${base}/inventory?limit=250&offset=${offset}`, {method: 'GET'});
    if (!response.ok) throw new Error(`Inventory read failed: HTTP ${response.status}; no implicit seed/cache fallback`);
    const value = await response.json() as {items?: unknown[]; total?: number; limit?: number; offset?: number};
    if (!value || !Array.isArray(value.items) || !integer(value.total) || value.limit !== 250 || value.offset !== offset || value.items.length > 250 || value.items.length + offset > value.total || (expected !== null && expected !== value.total)) throw new Error('Invalid or changing inventory pagination; retry a consistent read');
    expected = value.total; records.push(...value.items);
    if (records.length === expected) return inventorySnapshot(records, {...meta, origin: 'api_read', sourceRef: `${base}/inventory`});
    if (!value.items.length) throw new Error('Incomplete inventory page; missing records are not zero stock');
  }
  throw new Error('Inventory read page limit exceeded; completeness not established');
}
export function adaptInventory(snapshot: InventorySnapshot, reviews: StockReview[], ctx: EvaluationContext, eventStart: string | null): InventoryEvidence {
  validateContext(ctx);
  inventorySnapshot(snapshot.records, snapshot);
  if (timestamp(snapshot.retrievedAt)! > timestamp(ctx.evaluatedAt)!) throw new Error('Inventory retrieval occurs after evaluation');
  const bySku = new Map<string, StockReview>();
  for (const review of reviews) {
    if (bySku.has(review.sku) || !snapshot.records.some(r => r.sku === review.sku && r.id === review.itemId)) throw new Error('Duplicate or unbound stock attestation');
    bySku.set(review.sku, review);
  }
  const records = snapshot.records.map(raw => {
    const sources: Source[] = [{kind: snapshot.origin === 'synthetic' ? 'synthetic' : 'user_report', ref: `${snapshot.sourceRef}#${raw.id}/${raw.sku}`}];
    const reasons = ['Raw record and retrieval time do not verify a physical count; updated_at is not observedAt.', 'Current quantity does not establish future availability.'];
    const review = bySku.get(raw.sku);
    const quantity = (att: QuantityAttestation | undefined, scope: 'current' | 'event'): Fact<number> => {
      if (!att) {reasons.push(`${scope}: no independent quantity attestation`); return pending(sources);}
      const f = att.quantity;
      const method = scope === 'current' ? ['physical_count', 'reconciled_inventory', 'synthetic'] : ['event_availability', 'synthetic'];
      const trusted = !!f?.confirmedBy?.trim() && current(f, ctx, scope === 'event' ? eventStart : undefined) && finite(f.value) && att.unit === raw.base_unit && method.includes(att.method) && (att.method !== 'synthetic' || f.sources.every(s => s.kind === 'synthetic'));
      if (!trusted || (scope === 'current' && f.value !== raw.available_quantity)) {reasons.push(`${scope}: missing/stale evidence, wrong unit/method, or unreconciled quantity`); return {...pending<number>(f?.sources ?? sources), observedAt: f?.observedAt, validUntil: f?.validUntil};}
      if (scope === 'event') {
        const from = timestamp(att.windowStart), to = timestamp(att.windowEnd), event = timestamp(eventStart);
        if (from === null || to === null || event === null || from > event || to < event) {reasons.push('event: explicit availability interval missing or excludes event start'); return pending(f.sources);}
        // Do not substitute booking start for the time the evidence was observed.
        return {...copy(f), availableFrom: f.availableFrom && timestamp(f.availableFrom)! > from ? f.availableFrom : att.windowStart, validUntil: timestamp(f.validUntil)! < to ? f.validUntil : att.windowEnd};
      }
      return copy(f);
    };
    return {raw: copy(raw), poolId: poolIdentity(snapshot.namespace, raw.sku), currentQuantity: quantity(review?.current, 'current'), eventQuantity: quantity(review?.event, 'event'), reviews: review ? copy(review) : null, reasons, sources, retrievedAt: snapshot.retrievedAt};
  });
  return {records, pools: records.map(r => ({id: r.poolId, kind: r.raw.item_type === 'consumable' ? 'consumable' : 'equipment', unit: r.raw.base_unit, currentQuantity: r.currentQuantity, eventQuantity: r.eventQuantity}))};
}
