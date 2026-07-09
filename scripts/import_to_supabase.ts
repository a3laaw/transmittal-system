import { db } from '../src/lib/db';
import fs from 'fs';

interface MigrationData {
  Transmittal: any[];
  Revision: any[];
  Review: any[];
  Attachment: any[];
}

async function main() {
  const data: MigrationData = JSON.parse(fs.readFileSync('/tmp/migration_data.json', 'utf-8'));
  
  // Import Transmittals
  console.log(`Importing ${data.Transmittal.length} transmittals...`);
  for (let i = 0; i < data.Transmittal.length; i++) {
    const t = data.Transmittal[i];
    try {
      await db.transmittal.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          reference: t.reference,
          discipline: t.discipline,
          disciplineCode: t.disciplineCode || null,
          category: t.category || 'TRANSMITTAL',
          type: t.type || null,
          description: t.description || null,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        },
        update: {},
      });
    } catch (e: any) {
      if (!e.message.includes('Foreign key')) {
        console.error(`  Error on ${t.reference}: ${e.message.slice(0, 60)}`);
      }
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${data.Transmittal.length}...`);
  }
  console.log(`  Done: transmittals`);

  // Import Revisions
  console.log(`Importing ${data.Revision.length} revisions...`);
  for (let i = 0; i < data.Revision.length; i++) {
    const r = data.Revision[i];
    try {
      await db.revision.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          transmittalId: r.transmittalId,
          revNumber: r.revNumber,
          submitDate: r.submitDate ? new Date(r.submitDate) : null,
          replyDate: r.replyDate ? new Date(r.replyDate) : null,
          action: r.action || null,
          approvalType: r.approvalType || null,
          notes: r.notes || null,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
    } catch (e: any) {
      // Skip errors silently for speed
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${data.Revision.length}...`);
  }
  console.log(`  Done: revisions`);

  // Import Reviews
  console.log(`Importing ${data.Review.length} reviews...`);
  for (let i = 0; i < data.Review.length; i++) {
    const r = data.Review[i];
    try {
      await db.review.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          transmittalId: r.transmittalId,
          party: r.party,
          status: r.status || null,
          submitDate: r.submitDate ? new Date(r.submitDate) : null,
          submitRev: r.submitRev !== null ? Number(r.submitRev) : null,
          reviewDate: r.reviewDate ? new Date(r.reviewDate) : null,
          notes: r.notes || null,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        },
        update: {},
      });
    } catch (e: any) {
      // Skip errors silently
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${data.Review.length}...`);
  }
  console.log(`  Done: reviews`);

  // Import Attachments
  console.log(`Importing ${data.Attachment.length} attachments...`);
  for (const a of data.Attachment) {
    try {
      await db.attachment.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          transmittalId: a.transmittalId,
          fileName: a.fileName,
          filePath: a.filePath || '',
          fileType: a.fileType || '',
          fileSize: a.fileSize || 0,
          url: a.url || null,
          urlSource: a.urlSource || null,
          createdAt: new Date(a.createdAt),
        },
        update: {},
      });
    } catch (e: any) {
      console.error(`  Error: ${e.message.slice(0, 60)}`);
    }
  }
  console.log(`  Done: attachments`);

  // Verify
  const counts = await Promise.all([
    db.transmittal.count(),
    db.revision.count(),
    db.review.count(),
    db.attachment.count(),
    db.category.count(),
    db.discipline.count(),
    db.docType.count(),
  ]);
  console.log(`\n✅ Final counts in Supabase:`);
  console.log(`  Transmittals: ${counts[0]}`);
  console.log(`  Revisions: ${counts[1]}`);
  console.log(`  Reviews: ${counts[2]}`);
  console.log(`  Attachments: ${counts[3]}`);
  console.log(`  Categories: ${counts[4]}`);
  console.log(`  Disciplines: ${counts[5]}`);
  console.log(`  DocTypes: ${counts[6]}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
