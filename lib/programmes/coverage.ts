import type { Catalogue, CoverageEvidence, Offering, Request, Source } from './types';

const tokens = (s: string): string[] => [...new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(t => t.length > 2 && !['the', 'and', 'for', 'with', 'learn', 'understand', 'explore'].includes(t)))];
const phrases = (o: Offering, key: string): string[] => String(o.fields[key]?.value ?? '').split(';').map(s => s.trim()).filter(Boolean);

// Planner concept relationships, NOT organiser mappings or a table of activity IDs.
// An inference needs corroboration in two different Master fields; repetition is irrelevant.
const relationships: Record<string, {anchors: string[]; rationale: string}> = {
  sustainability: {anchors: ['renewable energy', 'solar energy', 'waste reduction', 'circular economy', 'upcycling', 'conservation', 'sustainable consumption', 'climate action'], rationale: 'renewable-energy, resource-cycle or conservation learning can support sustainability'},
  engineering: {anchors: ['engineering', 'engineering design', 'design challenge', 'prototype'], rationale: 'sourced design, construction and prototyping work can support engineering learning'},
  'creative engineering': {anchors: ['creative engineering', 'design challenge', 'engineering design', 'prototype'], rationale: 'sourced design challenges and prototyping can support creative engineering'},
  chemistry: {anchors: ['chemical reactions', 'chemical change', 'acids', 'alkalis', 'saponification', 'atoms and molecules'], rationale: 'sourced study of reactions, composition or chemical change can support chemistry'},
  biodiversity: {anchors: ['biodiversity', 'ecology', 'ecosystems', 'food chains', 'conservation', 'adaptations'], rationale: 'sourced ecological relationships and conservation content can support biodiversity'},
  energy: {anchors: ['energy conversion', 'solar energy', 'electricity', 'combustion', 'heat transfer'], rationale: 'sourced energy transformations and transfer processes can support energy learning'},
  robotics: {anchors: ['robotics', 'robot', 'robots', 'automation'], rationale: 'explicit sourced robotics/automation content can support robotics; electronics or sensing alone is insufficient'},
};

/** Field-aware evidence matching. No ungrounded synonym/model expansion or match-count percentages. */
export function coverage(catalogue: Catalogue, offerings: Offering[], request: Request): CoverageEvidence[] {
  const results: CoverageEvidence[] = [];
  for (const kind of ['theme', 'objective'] as const) for (const goal of kind === 'theme' ? request.themes : request.objectives) {
    const sought = tokens(goal.text);
    for (const o of offerings) {
      const primaryKeys = kind === 'theme' ? ['Suitable_Themes'] : ['Suitable_Objectives', 'Learning_Outcomes'];
      const supportingKeys = ['Key_Concepts', 'STEM_Domain', 'Short_Description'];
      const exact = primaryKeys.flatMap(k => phrases(o, k).filter(p => p.toLowerCase() === goal.text.toLowerCase()).map(p => ({k, p})));
      const contextual = primaryKeys.flatMap(k => phrases(o, k).filter(p => sought.length > 0 && sought.every(t => tokens(p).includes(t))).map(p => ({k, p})));
      const corroboration = supportingKeys.flatMap(k => phrases(o, k).filter(p => sought.some(t => tokens(p).includes(t))).map(p => ({k, p})));
      const relationship = kind === 'theme' ? relationships[goal.text.toLowerCase()] : undefined;
      const conceptEvidence = relationship ? ['Suitable_Themes', 'Suitable_Objectives', 'Learning_Outcomes', 'Key_Concepts', 'Short_Description'].flatMap(k => phrases(o, k).filter(p => relationship.anchors.some(anchor => tokens(anchor).every(t => tokens(p).includes(t)))).map(p => ({k, p}))) : [];
      const inferred = !exact.length && !contextual.length && new Set(conceptEvidence.map(e => e.k)).size >= 2;
      const matches = exact.length ? exact : contextual.length ? contextual : inferred ? conceptEvidence : [];
      const mapping = catalogue.mappings.filter(m => [m.fields.Primary_Offering_ID.value, m.fields.Secondary_Offering_ID.value].includes(o.id) && [m.fields.Theme, m.fields.Stakeholder_Objective].some(c => c && c.value && sought.length > 0 && sought.every(t => tokens(String(c.value)).includes(t))));
      const sources: Source[] = [...matches, ...corroboration].map(m => ({...o.source, cell: o.fields[m.k]?.cell}));
      for (const m of mapping) sources.push({kind: 'catalogue', ref: String(m.fields.Mapping_ID.value), workbookSha256: catalogue.sourceSha256, ...m.source});
      const master = matches.length > 0;
      results.push({goal: goal.text, priority: goal.priority, kind, offeringId: o.id,
        strength: master ? 'master' : mapping.length || corroboration.length ? 'supporting_only' : 'none',
        rationale: master ? `${inferred ? `Planner inference (${relationship!.rationale}), corroborated across Master fields. ` : ''}Master ${matches.map(m => `${m.k}: ${m.p}`).join(' | ')}${corroboration.length ? `; context: ${corroboration.map(m => `${m.k}: ${m.p}`).join(' | ')}` : ''}. This is a catalogue-grounded relevance inference, not a verified learning outcome.` : mapping.length ? 'Theme_Objective_Mapping suggests relevance, but its validation is pending; no direct Master goal match was found.' : corroboration.length ? 'Related concepts appear in the Master, but explicit objective/theme support remains to be confirmed.' : 'No supported match under the declared field-aware matching method.',
        sources, provisional: true});
    }
  }
  return results;
}
