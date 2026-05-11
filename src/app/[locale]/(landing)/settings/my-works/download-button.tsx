'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';

export async function downloadMyWorkImage({
  imageUrl,
  fileName,
  successMessage,
  failedMessage,
}: {
  imageUrl: string;
  fileName: string;
  successMessage: string;
  failedMessage: string;
}) {
  if (!imageUrl) {
    return;
  }

  try {
    const resp = await fetch(
      `/api/proxy/file?url=${encodeURIComponent(imageUrl)}`
    );
    if (!resp.ok) {
      const directLink = document.createElement('a');
      directLink.href = imageUrl;
      directLink.download = fileName;
      directLink.target = '_blank';
      directLink.rel = 'noopener noreferrer';
      document.body.appendChild(directLink);
      directLink.click();
      document.body.removeChild(directLink);
      toast.success(successMessage);
      return;
    }

    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
    toast.success(successMessage);
  } catch (error) {
    console.error('Failed to download image:', error);
    toast.error(failedMessage);
  }
}

export function MyWorkDownloadButton({
  imageUrl,
  fileName,
  title,
  successMessage,
  failedMessage,
}: {
  imageUrl: string;
  fileName: string;
  title: string;
  successMessage: string;
  failedMessage: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl || downloading) {
      return;
    }

    try {
      setDownloading(true);
      await downloadMyWorkImage({
        imageUrl,
        fileName,
        successMessage,
        failedMessage,
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-auto max-w-[120px] gap-1.5 bg-transparent p-0 text-primary shadow-none hover:bg-transparent hover:text-primary/80"
      onClick={handleDownload}
      disabled={downloading}
    >
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="min-w-0 truncate">{title}</span>
    </Button>
  );
}
