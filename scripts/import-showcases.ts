import { readFile } from 'fs/promises';
import path from 'path';

import { desc } from 'drizzle-orm';

import { showcase, user } from '@/config/db/schema';
import { db, closeDb } from '@/core/db';
import { getUuid } from '@/shared/lib/hash';

type ShowcaseImportItem = {
  title: string;
  description?: string;
  prompt?: string;
  image: string;
  tags?: string;
};

async function main() {
  const filePath = path.resolve(process.cwd(), 'showcases-import.json');
  const raw = await readFile(filePath, 'utf-8');
  const items = JSON.parse(raw) as ShowcaseImportItem[];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('showcases-import.json is empty or invalid');
  }

  const [owner] = await db()
    .select({ id: user.id, email: user.email })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(1);

  if (!owner?.id) {
    throw new Error('No user found in database; cannot assign showcase.userId');
  }

  const rows = items.map((item, index) => {
    if (!item.title?.trim() || !item.image?.trim()) {
      throw new Error(`Invalid item at index ${index}: title and image are required`);
    }

    return {
      id: getUuid(),
      userId: owner.id,
      title: item.title.trim(),
      description: item.description?.trim() || null,
      prompt: item.prompt?.trim() || null,
      image: item.image.trim(),
      tags: item.tags?.trim() || null,
    };
  });

  await db().insert(showcase).values(rows);

  console.log(`Imported ${rows.length} showcases`);
  console.log(`Assigned userId: ${owner.id}`);
  console.log(`Assigned user email: ${owner.email}`);
}

main()
  .catch((error) => {
    console.error('Import showcases failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
