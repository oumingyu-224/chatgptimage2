'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Filter as FilterType, Search as SearchType } from '@/shared/types/blocks/common';

export function Search({
  search,
  filters,
}: {
  search: SearchType;
  filters?: FilterType[];
}) {
  const [value, setValue] = useState(search.value || '');
  const [loadingAction, setLoadingAction] = useState<'search' | 'reset' | null>(
    null
  );
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    Object.fromEntries((filters || []).map((filter) => [filter.name, filter.value || '']))
  );
  const t = useTranslations('common.actions');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setValue(search.value || '');
  }, [search.value]);

  useEffect(() => {
    setFilterValues(
      Object.fromEntries((filters || []).map((filter) => [filter.name, filter.value || '']))
    );
  }, [filters]);

  useEffect(() => {
    setLoadingAction(null);
  }, [searchParams, search.value, filters]);

  const shouldDeferFilters = Boolean(search.showButtons && filters?.length);

  const applyParams = (
    params: URLSearchParams,
    action: 'search' | 'reset' | null,
    historyMode: 'push' | 'replace' = 'push'
  ) => {
    setLoadingAction(action);
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (nextUrl === currentUrl) {
      router.refresh();
      return;
    }

    if (historyMode === 'replace') {
      router.replace(nextUrl, { scroll: false });
    } else {
      router.push(nextUrl, { scroll: false });
    }
  };

  const handleSearch = () => {
    const nextValue = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');

    if (nextValue) {
      params.set(search.name, nextValue);
    } else {
      params.delete(search.name);
    }

    (filters || []).forEach((filter) => {
      const filterValue = filterValues[filter.name] || '';
      if (filterValue) {
        params.set(filter.name, filterValue);
      } else {
        params.delete(filter.name);
      }
    });

    applyParams(params, 'search', 'push');
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (loadingAction) {
        return;
      }
      handleSearch();
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <Input
        type="text"
        placeholder={search.placeholder || ''}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="w-full md:max-w-sm"
      />
      {filters?.map((filter) => (
        <Select
          key={filter.name}
          value={filterValues[filter.name] || ''}
          defaultValue={filter.value || ''}
          onValueChange={(nextValue) => {
            if (shouldDeferFilters) {
              setFilterValues((prev) => ({
                ...prev,
                [filter.name]: nextValue,
              }));
              return;
            }

            const params = new URLSearchParams(searchParams.toString());
            params.set('page', '1');

            if (nextValue) {
              params.set(filter.name, nextValue);
            } else {
              params.delete(filter.name);
            }

            applyParams(params, null, 'push');
          }}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder={filter.title} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{filter.title}</SelectLabel>
              {filter.options
                ?.filter((item) => item.value && item.value !== '')
                .map((item) => (
                  <SelectItem key={item.value} value={item.value!}>
                    {item.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
      {search.showButtons ? (
        <>
          <Button
            size="sm"
            className="w-full md:w-auto"
            disabled={Boolean(loadingAction)}
            onClick={() => {
              if (loadingAction) {
                return;
              }
              handleSearch();
            }}
          >
            {loadingAction === 'search' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('search')
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full md:w-auto"
            disabled={Boolean(loadingAction)}
            onClick={() => {
              if (loadingAction) {
                return;
              }
              const hasSearchValue = value.trim().length > 0;
              const hasFilterValue = (filters || []).some(
                (filter) => (filterValues[filter.name] || '').trim().length > 0
              );
              const hasSearchParam = searchParams.has(search.name);
              const hasFilterParam = (filters || []).some((filter) =>
                searchParams.has(filter.name)
              );
              if (
                !hasSearchValue &&
                !hasFilterValue &&
                !hasSearchParam &&
                !hasFilterParam
              ) {
                setLoadingAction(null);
                return;
              }
              setValue('');
              setFilterValues(
                Object.fromEntries((filters || []).map((filter) => [filter.name, '']))
              );

              const params = new URLSearchParams(searchParams.toString());
              params.set('page', '1');
              params.delete(search.name);
              (filters || []).forEach((filter) => {
                params.delete(filter.name);
              });
              applyParams(params, 'reset', 'replace');
            }}
          >
            {loadingAction === 'reset' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('reset')
            )}
          </Button>
        </>
      ) : null}
    </div>
  );
}
