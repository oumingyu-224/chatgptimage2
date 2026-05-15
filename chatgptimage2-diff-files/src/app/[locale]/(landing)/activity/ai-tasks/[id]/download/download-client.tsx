'use client';

import { useEffect } from 'react';

import { useRouter } from '@/core/i18n/navigation';

function guessFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1] || 'bin';
  } catch {
    return 'bin';
  }
}

export default function DownloadClient({
  taskId,
  downloads,
}: {
  taskId: string;
  downloads: string[];
}) {
  const router = useRouter();

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      for (const [index, url] of downloads.entries()) {
        if (isCancelled) {
          return;
        }

        const response = await fetch(
          `/api/proxy/file?url=${encodeURIComponent(url)}`
        );
        if (!response.ok) {
          continue;
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${taskId}-${index + 1}.${guessFileExtension(url)}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
      }

      if (!isCancelled) {
        router.replace('/activity/ai-tasks');
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [downloads, router, taskId]);

  return null;
}
