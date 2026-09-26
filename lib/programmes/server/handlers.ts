/** HTTP boundary only. Scoring, resource arithmetic and feasibility stay in B2/B3. */
import type { B1Bundle, Evidence } from '../types';
import type { MaterialReview } from '../resources';
import type { InventorySnapshot, StockReview } from '../inventory-adapter';
import { adaptCatalogue } from '../catalogue';
import { inventorySnapshot } from '../inventory-adapter';

export interface ServerReviews { stocks: StockReview[]; materials: MaterialReview[]; operational: Evidence }
export interface ProgrammeDependencies {
  bundle(): Promise<B1Bundle>;
  reviews(): Promise<ServerReviews>;
  inventory(evaluatedAt: string): Promise<InventorySnapshot>;
  now(): string;
  inventoryTimeoutMs: number;
}
export {LIMITS} from '../protocol';
import {LIMITS, InputError, validateConsultation} from '../protocol';
import {computeConsultation} from '../consultation';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
async function body(req: Request): Promise<unknown> {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError(415, 'JSON_REQUIRED', 'Use application/json.');
  const length = req.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > LIMITS.bodyBytes)) throw new InputError(413, 'REQUEST_TOO_LARGE', 'Request exceeds the 64 KiB limit.');
  if (!req.body) throw new InputError(400, 'INVALID_JSON', 'A JSON object is required.');
  const reader = req.body.getReader(), parts: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = async () => {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > LIMITS.bodyBytes) throw new InputError(413, 'REQUEST_TOO_LARGE', 'Request exceeds the 64 KiB limit.');
        parts.push(part.value);
      }
    };
    await Promise.race([read(), new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new InputError(408, 'REQUEST_TIMEOUT', 'Request body timed out.')), 5000);})]);
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) {bytes.set(part, offset); offset += part.length;}
    try {return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));}
    catch {throw new InputError(400, 'INVALID_JSON', 'Malformed JSON or UTF-8.');}
  } finally {clearTimeout(timer); void reader.cancel().catch(() => undefined);}
}
async function timedInventory(deps: ProgrammeDependencies, at: string): Promise<{snapshot: InventorySnapshot; state: 'read' | 'unavailable' | 'timeout'}> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([deps.inventory(at), new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new InputError(504, 'INVENTORY_TIMEOUT', 'timeout')), deps.inventoryTimeoutMs);})]);
    return {snapshot, state: 'read'};
  } catch (error) {
    return {snapshot: inventorySnapshot([], {namespace: 'unavailable-inventory', origin: 'saved_snapshot', sourceRef: 'No inventory loaded; dependency unavailable (not cached/seed data)', retrievedAt: at}), state: (error instanceof InputError && error.code === 'INVENTORY_TIMEOUT') || (error instanceof Error && error.name === 'TimeoutError') ? 'timeout' : 'unavailable'};
  } finally {clearTimeout(timer);}
}
/** Reject test evidence even if accidentally placed in a server review file. */
export function assertProductionReviews(value: unknown): asserts value is ServerReviews {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid server review document');
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.stocks) || !Array.isArray(r.materials) || !r.operational || typeof r.operational !== 'object') throw new Error('Invalid server review document');
  function walk(v: unknown): void {
    if (Array.isArray(v)) {v.forEach(walk); return;}
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (o.kind === 'synthetic' || o.method === 'synthetic') throw new Error('Synthetic evidence cannot be loaded by the API');
    Object.values(o).forEach(walk);
  }
  walk(value);
}
export function createProgrammeHandlers(deps: ProgrammeDependencies) {
  const safe = (fn: (req: Request) => Promise<Response>) => async (req: Request): Promise<Response> => {
    try {return await fn(req);}
    catch (e) {return e instanceof InputError ? json({error: {code:e.code, message:e.message}}, e.status) : json({error: {code:'PROGRAMME_DATA_UNAVAILABLE', message:'Programme data or server review configuration is unavailable. No feasibility conclusion was produced.'}}, 503);}
  };
  return {
    offerings: safe(async req => {
      const bundle = await deps.bundle(), catalogue = adaptCatalogue(bundle);
      // Public catalogue only: no review file, inventory configuration or server paths.
      if (new URL(req.url).searchParams.get("include") === "offline") {
        const {schema_version,source_sha256,workbook_filename,sheet_names} = bundle.manifest;
        return json({schema: "orbit-programme-browser-v1", bundle: {...bundle,manifest:{schema_version,source_sha256,workbook_filename,sheet_names}}});
      }
      return json({sourceSha256: catalogue.sourceSha256, offerings: catalogue.offerings.map(o => ({Offering_ID:o.id, officialName:o.title, identity:o.identity, fields:o.fields, source:o.source, notes:o.notes, dataConfidence:o.confidence, operationalVerification:'pending'}))});
    }),
    themes: safe(async () => {
      const catalogue = adaptCatalogue(await deps.bundle()), themes = new Map<string, Array<{Offering_ID:string; source:unknown}>>();
      for (const o of catalogue.offerings) for (const label of String(o.fields.Suitable_Themes?.value ?? '').split(/[;,]/).map(t=>t.trim()).filter(Boolean)) {
        const list=themes.get(label) ?? []; list.push({Offering_ID:o.id,source:{...o.source,cell:o.fields.Suitable_Themes?.cell}}); themes.set(label,list);
      }
      return json({sourceSha256:catalogue.sourceSha256, themes:[...themes].map(([name,offerings])=>({name,offerings,verification:'pending',basis:'Master catalogue relevance; not confirmed programme outcomes'})), supportingMappings:{verification:'pending',role:'supporting guidance, not a fixed answer table',records:catalogue.mappings}});
    }),
    consult: safe(async req => {
      // Read/validate client structure before invoking any inventory dependency.
      const input = await body(req), bundle = await deps.bundle(), catalogue = adaptCatalogue(bundle);
      validateConsultation(input, catalogue.offerings.map(o=>o.id));
      const reviews = await deps.reviews(); assertProductionReviews(reviews);
      const read = await timedInventory(deps, deps.now());
      const evaluatedAt = deps.now();
      const dependency = {state:read.state, degraded:read.state!=='read', readAt:read.state==='read'?read.snapshot.retrievedAt:null, quantityVerification:'No quantity is verified by a successful HTTP read.', explanation:read.state==='read'?'Inventory records read; independent stock and future availability evidence remain required.':read.state==='timeout'?'Inventory read timed out; deterministic catalogue checks continue with Unknown resource evidence.':'Inventory read failed; deterministic catalogue checks continue with Unknown resource evidence. No seed or cache fallback was used.'};
      return json(computeConsultation(bundle, input, read.snapshot, reviews, evaluatedAt, dependency));
    }),
  };
}
