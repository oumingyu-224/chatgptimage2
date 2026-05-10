import { readFile } from 'fs/promises';
import path from 'path';

import { and, desc, eq, inArray } from 'drizzle-orm';

import { showcase, user } from '@/config/db/schema';
import { closeDb, db } from '@/core/db';

type ShowcaseImportItem = {
  title: string;
  image: string;
};

const TARGET_EMAIL = 'a1345240039@gmail.com';
const SOURCE_USER_ID = '9c51bddc-466d-4c2e-90bf-0a3b246f586b';

async function main() {
  const filePath = path.resolve(process.cwd(), 'showcases-import.json');
  const raw = await readFile(filePath, 'utf-8');
  const items = JSON.parse(raw) as ShowcaseImportItem[];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('showcases-import.json is empty or invalid');
  }

  const [targetUser] = await db()
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, TARGET_EMAIL))
    .orderBy(desc(user.createdAt))
    .limit(1);

  if (!targetUser?.id) {
    throw new Error(`Target user not found: ${TARGET_EMAIL}`);
  }

  const images = items.map((item) => item.image).filter(Boolean);
  if (images.length === 0) {
    throw new Error('No showcase images found in import file');
  }

  const matchedRows = await db()
    .select({ id: showcase.id, image: showcase.image, title: showcase.title })
    .from(showcase)
    .where(
      and(eq(showcase.userId, SOURCE_USER_ID), inArray(showcase.image, images))
    );

  if (matchedRows.length === 0) {
    throw new Error('No matching showcases found for reassignment');
  }

  await db()
    .update(showcase)
    .set({ userId: targetUser.id })
    .where(
      and(eq(showcase.userId, SOURCE_USER_ID), inArray(showcase.image, images))
    );

  console.log(`Reassigned ${matchedRows.length} showcases`);
  console.log(`Source userId: ${SOURCE_USER_ID}`);
  console.log(`Target userId: ${targetUser.id}`);
  console.log(`Target user email: ${targetUser.email}`);
}

main()
  .catch((error) => {
    console.error('Reassign showcases failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
