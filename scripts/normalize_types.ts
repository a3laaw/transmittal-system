// One-time script to normalize transmittal types in the database.
// - Merge duplicates with different casing (e.g., "SOURCE APPROVAL" vs "Source Approval")
// - Remove abbreviation-only values that came from the wrong Excel column (MD, SD, SM, OT, MD - SD)
// - Normalize "Submittal" to "SOURCE APPROVAL" (or keep as is if it's a valid type)
//
// Run with: bun run scripts/normalize_types.ts

import { db } from '../src/lib/db';

// Mapping of old type → new normalized type (or null to clear it)
const TYPE_NORMALIZATION: Record<string, string | null> = {
  // Valid types - normalize to uppercase
  'COMPANY PROFILE': 'COMPANY PROFILE',
  'SHOP DRAWINGS': 'SHOP DRAWINGS',
  'SAMPLE': 'SAMPLE',
  'SOURCE APPROVAL': 'SOURCE APPROVAL',
  'Source Approval': 'SOURCE APPROVAL', // merge duplicate
  'TEST REPORT': 'TEST REPORT',
  'Submittal': 'SUBMITTAL',

  // Abbreviations from wrong column - remove (set to null)
  'MD': null,
  'SD': null,
  'SM': null,
  'OT': null,
  'MD - SD': null,
};

async function main() {
  console.log('Fetching all transmittals with types...');
  const transmittals = await db.transmittal.findMany({
    where: { NOT: { type: null } },
    select: { id: true, type: true },
  });

  console.log(`Found ${transmittals.length} transmittals with types`);

  // Group by current type to see distribution
  const typeCounts: Record<string, number> = {};
  for (const t of transmittals) {
    const tp = t.type || '';
    typeCounts[tp] = (typeCounts[tp] || 0) + 1;
  }

  console.log('\nCurrent type distribution:');
  for (const [k, v] of Object.entries(typeCounts).sort()) {
    const normalized = TYPE_NORMALIZATION[k];
    const action = normalized === undefined ? '(keep as-is)' : normalized === null ? '(REMOVE)' : `→ ${normalized}`;
    console.log(`  ${JSON.stringify(k)}: ${v} ${action}`);
  }

  // Apply normalization
  let updated = 0;
  let cleared = 0;
  for (const t of transmittals) {
    const oldType = t.type || '';
    const newType = TYPE_NORMALIZATION[oldType];

    if (newType === undefined) continue; // not in mapping - keep as-is

    if (newType === null) {
      // Clear the type
      await db.transmittal.update({
        where: { id: t.id },
        data: { type: null },
      });
      cleared++;
    } else if (newType !== oldType) {
      // Update to normalized form
      await db.transmittal.update({
        where: { id: t.id },
        data: { type: newType },
      });
      updated++;
    }
  }

  console.log(`\nDone: ${updated} types normalized, ${cleared} types cleared (abbreviations removed)`);

  // Verify final state
  const finalTypes = await db.transmittal.findMany({
    where: { NOT: { type: null } },
    distinct: ['type'],
    select: { type: true },
  });
  console.log('\nFinal unique types:');
  for (const t of finalTypes.sort((a, b) => (a.type || '').localeCompare(b.type || ''))) {
    console.log(`  ${JSON.stringify(t.type)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
