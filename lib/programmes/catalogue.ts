import type { AgeRange, B1Bundle, Catalogue, Cell, Derived, NumericField, Offering, Requirement, Source } from './types';
import { finite, integer } from './evidence';

export function parseAge(raw: unknown): AgeRange | null {
  if (finite(raw)) return {min: raw, max: raw};
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  let match = /^(\d+(?:\.\d+)?)\s*\+$/.exec(s);
  if (match) return {min: Number(match[1]), max: null};
  match = /^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (match && Number(match[1]) <= Number(match[2])) return {min: Number(match[1]), max: Number(match[2])};
  if (/^\d+(?:\.\d+)?$/.test(s)) return {min: Number(s), max: Number(s)};
  return null;
}
export function requirement(cell: Pick<Cell, 'value' | 'state'>): Requirement {
  if (cell.state === 'yes' && cell.value === 'Yes') return 'required';
  if (cell.state === 'no' && cell.value === 'No') return 'not_required';
  if (cell.state === 'optional' && cell.value === 'Optional') return 'optional';
  if (cell.state === 'not_applicable' && cell.value === 'N/A') return 'not_applicable';
  return 'unknown';
}
export function adaptCatalogue(bundle: B1Bundle): Catalogue {
  if (bundle.manifest.schema_version !== '1.0.0' || !/^[a-f0-9]{64}$/.test(bundle.manifest.source_sha256)) throw new Error('Unsupported or invalid B1 manifest');
  const sha = bundle.manifest.source_sha256;
  for (const doc of [bundle.offerings, bundle.mapping, bundle.constraints, bundle.dictionary, bundle.materials, bundle.audit]) {
    if (doc.source_sha256 !== sha || doc.schema_version !== '1.0.0') throw new Error('Mixed or unsupported B1 sources');
  }
  if (!bundle.audit.issues || bundle.audit.operational_validation !== 'needs_verification') throw new Error('B1 audit evidence is required');
  const ids = bundle.offerings.records.map(r => r.fields.Offering_ID?.value);
  if (ids.length !== 21 || new Set(ids).size !== ids.length || ids.some(i => typeof i !== 'string' || !/^ACT-\d{3}$/.test(i))) throw new Error('Invalid official offering identities/count');
  const rules = bundle.constraints.records.map(r => r.fields.Rule_ID?.value);
  if (rules.length !== 12 || new Set(rules).size !== 12 || Array.from({length: 12}, (_, i) => `RULE-${String(i + 1).padStart(3, '0')}`).some(id => !rules.includes(id))) throw new Error('Official rules incomplete');
  for (const key of ['Unknown', 'N/A', 'To be validated']) if (!bundle.dictionary.records.some(r => r.fields.Field_Name.value === key)) throw new Error('Dictionary special definitions missing');
  const fields: NumericField[] = ['Standard_Duration_Min', 'Setup_Time_Min', 'Min_Participants', 'Max_Participants', 'Facilitators_Required'];
  const offerings = bundle.offerings.records.map((r): Offering => {
    const id = String(r.fields.Offering_ID.value), title = r.fields.Activity_Title?.value;
    if (typeof title !== 'string' || !title.trim() || !r.fields.Notes || !r.fields.Data_Confidence) throw new Error(`Incomplete catalogue record ${id}`);
    const source: Source = {kind: 'catalogue', ref: `${bundle.manifest.workbook_filename}#${id}`, workbookSha256: sha, ...r.source};
    const notes = String(r.fields.Notes.value ?? ''), confidence = String(r.fields.Data_Confidence.value ?? 'Unknown');
    const auditIssues = bundle.audit.issues.filter(i => i.source.sheet === r.source.sheet && i.source.row === r.source.row);
    function derived<T>(key: string, value: T | null): Derived<T> {
      const raw = r.fields[key];
      if (!raw) throw new Error(`Missing source field ${id}.${key}`);
      return {value, raw, source: {...source, cell: raw.cell}, verification: 'pending', reasons: [
        'Catalogue value retained for planning; not event-specific operational verification.',
        `Data_Confidence=${confidence} does not verify individual fields.`, `Notes: ${notes}`,
        ...auditIssues.map(i => `Audit: ${i.code}${i.source.cell ? ` (${i.source.cell})` : ''}`),
      ]};
    }
    const numbers = {} as Offering['numbers'];
    for (const key of fields) {
      const v = r.fields[key]?.value;
      const valid = key.endsWith('_Min') ? finite(v) : integer(v);
      numbers[key] = derived(key, valid ? v as number : null);
    }
    const act = bundle.materials.sheets.filter(s => s.Offering_ID === id);
    if (act.length !== 1) throw new Error(`ACT association missing or ambiguous: ${id}`);
    const type = r.fields.Offering_Type?.value, delivery = r.fields.Delivery_Mode?.value;
    return {id, title, identity: 'official_catalogue', fields: r.fields, source, notes, confidence, auditIssues,
      age: derived('Recommended_Age', parseAge(r.fields.Recommended_Age?.value)), numbers,
      utilities: {electricity: derived('Electricity_Required', requirement(r.fields.Electricity_Required)), internet: derived('Internet_Required', requirement(r.fields.Internet_Required)), water: derived('Water_Required', requirement(r.fields.Water_Required))},
      format: type === 'Science Show' ? 'Show' : typeof type === 'string' ? type : null,
      delivery: delivery === 'Facilitated hands-on' ? 'Facilitator-led' : delivery === 'Facilitated demonstration' ? 'Demonstration' : typeof delivery === 'string' ? delivery : null,
      materialRowIds: act[0].records.map(m => m.material_row_id)};
  });
  for (const row of bundle.mapping.records) for (const key of ['Primary_Offering_ID', 'Secondary_Offering_ID']) {
    const c = row.fields[key];
    if (!ids.includes(c.value) && !['blank', 'not_applicable', 'unknown', 'to_be_validated'].includes(c.state)) throw new Error('Unknown mapping offering ID');
  }
  return {sourceSha256: sha, offerings, mappings: bundle.mapping.records, rules: bundle.constraints.records, dictionary: bundle.dictionary.records, audit: bundle.audit.issues};
}
