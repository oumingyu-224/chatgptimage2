import { PERMISSIONS } from '@/core/rbac';

export const PROMPT_READ_PERMISSION_CODES = [
  PERMISSIONS.PROMPTS_READ,
  PERMISSIONS.CATEGORIES_READ,
];

export const PROMPT_WRITE_PERMISSION_CODES = [
  PERMISSIONS.PROMPTS_WRITE,
  PERMISSIONS.CATEGORIES_WRITE,
];

export const PROMPT_DELETE_PERMISSION_CODES = [
  PERMISSIONS.PROMPTS_DELETE,
  PERMISSIONS.PROMPTS_WRITE,
  PERMISSIONS.CATEGORIES_DELETE,
  PERMISSIONS.CATEGORIES_WRITE,
];

export const SHOWCASE_READ_PERMISSION_CODES = [
  PERMISSIONS.SHOWCASES_READ,
  PERMISSIONS.CATEGORIES_READ,
];

export const SHOWCASE_WRITE_PERMISSION_CODES = [
  PERMISSIONS.SHOWCASES_WRITE,
  PERMISSIONS.CATEGORIES_WRITE,
];

export const SHOWCASE_DELETE_PERMISSION_CODES = [
  PERMISSIONS.SHOWCASES_DELETE,
  PERMISSIONS.SHOWCASES_WRITE,
  PERMISSIONS.CATEGORIES_DELETE,
  PERMISSIONS.CATEGORIES_WRITE,
];

export function shouldExcludeArchivedRecords<T extends string>(
  status?: T,
  includeArchived = false
) {
  return !status && !includeArchived;
}

export function createPromptDeleteAction({
  findPrompt,
  deletePrompt,
}: {
  findPrompt: ({ id }: { id: string }) => Promise<{ id: string } | null>;
  deletePrompt: (id: string) => Promise<boolean>;
}) {
  return async (id: string) => {
    const prompt = await findPrompt({ id });
    if (!prompt) {
      return false;
    }

    return await deletePrompt(id);
  };
}

export function createShowcaseDeleteAction({
  getShowcase,
  deleteShowcase,
}: {
  getShowcase: (id: string) => Promise<{ id: string } | null>;
  deleteShowcase: (id: string) => Promise<boolean>;
}) {
  return async (id: string) => {
    const showcase = await getShowcase(id);
    if (!showcase) {
      return false;
    }

    return await deleteShowcase(id);
  };
}
