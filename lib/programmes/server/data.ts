// Runtime catalogue JSON is bundled by Next; Excel and test fixtures are never read.
import manifest from '../../../backend/data/programmes/source_manifest.json';
import offerings from '../../../backend/data/programmes/programme_offerings.json';
import mapping from '../../../backend/data/programmes/programme_theme_mapping.json';
import constraints from '../../../backend/data/programmes/programme_constraints.json';
import dictionary from '../../../backend/data/programmes/programme_dictionary.json';
import materials from '../../../backend/data/programmes/programme_materials.json';
import audit from '../../../backend/data/programmes/import_audit.json';
import type { B1Bundle } from '../types';
export const programmeBundle = {manifest,offerings,mapping,constraints,dictionary,materials,audit} as unknown as B1Bundle;
