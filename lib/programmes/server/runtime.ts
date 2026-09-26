// Server-only entry imported solely by Next route handlers; never export via core index.
import { readFile, stat } from 'node:fs/promises';
import { readInventory } from '../inventory-adapter';
import { assertProductionReviews, createProgrammeHandlers } from './handlers';
import { programmeBundle } from './data';

const INVENTORY_TIMEOUT_MS = 1500;
function apiBase(): string {
  const raw = process.env.ORBIT_PROGRAMME_INVENTORY_API_URL ?? 'http://127.0.0.1:8000/api';
  const url = new URL(raw);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid server inventory URL');
  return url.toString().replace(/\/$/,'');
}
export const programmeHandlers = createProgrammeHandlers({
  bundle: async () => programmeBundle,
  reviews: async () => {
    const file = process.env.ORBIT_PROGRAMME_REVIEW_FILE;
    if (!file) return {stocks:[],materials:[],operational:{offerings:{},pools:[]}};
    if ((await stat(file)).size > 1024*1024) throw new Error('Server review file too large');
    const bytes = await readFile(file); if (bytes.length > 1024*1024) throw new Error('Server review file too large');
    const reviews: unknown = JSON.parse(bytes.toString('utf8')); assertProductionReviews(reviews); return reviews;
  },
  inventory: async at => {
    const signal = AbortSignal.timeout(INVENTORY_TIMEOUT_MS);
    const snapshot = await readInventory((url, init)=>fetch(url,{...init,signal,cache:'no-store',redirect:'error'}),apiBase(),{
      namespace:process.env.ORBIT_PROGRAMME_INVENTORY_NAMESPACE ?? 'orbit-primary',retrievedAt:at,
    });
    snapshot.retrievedAt = new Date().toISOString();
    return snapshot;
  },
  now: () => new Date().toISOString(),
  inventoryTimeoutMs: INVENTORY_TIMEOUT_MS + 50,
});
