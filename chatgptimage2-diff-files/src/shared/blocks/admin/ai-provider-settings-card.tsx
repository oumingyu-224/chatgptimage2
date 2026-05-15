'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Switch } from '@/shared/components/ui/switch';
import type { AIProviderChannel } from '@/shared/services/ai_channels';

const PROVIDERS = [
  { value: 'kie', label: 'Kie' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'fal', label: 'Fal' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: 'Custom' },
];

export function AIProviderSettingsCard({
  title,
  description,
  initialRows,
  submitText,
  texts,
}: {
  title: string;
  description?: string;
  initialRows: AIProviderChannel[];
  submitText: string;
  texts: {
    add_custom_channel: string;
    enabled: string;
    priority: string;
    name: string;
    provider: string;
    model: string;
    api_key: string;
    base_url: string;
    save_failed: string;
    settings_updated: string;
    custom_name: string;
    enabled_row_required: string;
  };
}) {
  const [rows, setRows] = useState<AIProviderChannel[]>(initialRows);
  const [loading, setLoading] = useState(false);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.priority - b.priority),
    [rows]
  );

  const updateRow = (id: string, patch: Partial<AIProviderChannel>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const addCustomRow = () => {
    const id = `custom-${Date.now()}`;
    const maxPriority = rows.reduce(
      (max, row) => Math.max(max, row.priority || 0),
      0
    );
    setRows((prev) => [
      ...prev,
      {
        id,
        name: texts.custom_name,
        provider: 'custom',
        priority: maxPriority + 10,
        enabled: false,
        model: 'nano-banana-pro',
        apiKey: '',
        baseUrl: '',
      },
    ]);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const saveRows = async () => {
    try {
      const invalidRow = sortedRows.find(
        (row) =>
          row.enabled &&
          (!Number.isFinite(Number(row.priority)) ||
            Number(row.priority) < 1 ||
            !String(row.name || '').trim() ||
            !String(row.provider || '').trim() ||
            !String(row.model || '').trim() ||
            !String(row.apiKey || '').trim() ||
            !String(row.baseUrl || '').trim())
      );
      if (invalidRow) {
        throw new Error(texts.enabled_row_required);
      }

      setLoading(true);
      const resp = await fetch('/api/admin/settings/ai-providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows: sortedRows }),
      });
      const json = await resp.json();
      if (!resp.ok || json.code !== 0) {
        throw new Error(
          json.message === 'enabled_row_required'
            ? texts.enabled_row_required
            : json.message || texts.save_failed
        );
      }
      toast.success(texts.settings_updated);
      setRows(json.data?.rows || sortedRows);
    } catch (e: any) {
      toast.error(e?.message || texts.save_failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{title}</CardTitle>
          <Button type="button" variant="outline" onClick={addCustomRow}>
            <Plus className="mr-2 h-4 w-4" />
            {texts.add_custom_channel}
          </Button>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{texts.enabled}</TableHead>
              <TableHead>{texts.priority}</TableHead>
              <TableHead>{texts.name}</TableHead>
              <TableHead>{texts.provider}</TableHead>
              <TableHead>{texts.model}</TableHead>
              <TableHead>{texts.api_key}</TableHead>
              <TableHead>{texts.base_url}</TableHead>
              <TableHead className="w-12"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const isDefault = row.id.startsWith('default-');
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(checked) =>
                        updateRow(row.id, { enabled: checked })
                      }
                      className="h-4 w-7"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={row.priority}
                      onChange={(e) =>
                        updateRow(row.id, {
                          priority: Number(e.target.value || 1),
                        })
                      }
                      className="w-22"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      className="min-w-30"
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                      value={row.provider}
                      disabled={isDefault}
                      onChange={(e) =>
                        updateRow(row.id, {
                          provider: e.target.value as AIProviderChannel['provider'],
                        })
                      }
                    >
                      {PROVIDERS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.model}
                      onChange={(e) => updateRow(row.id, { model: e.target.value })}
                      className="min-w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="password"
                      value={row.apiKey}
                      onChange={(e) => updateRow(row.id, { apiKey: e.target.value })}
                      className="min-w-44"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.baseUrl || ''}
                      onChange={(e) =>
                        updateRow(row.id, { baseUrl: e.target.value })
                      }
                      className="min-w-44"
                    />
                  </TableCell>
                  <TableCell>
                    {!isDefault ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center gap-2">
          <Button type="button" onClick={saveRows} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
