'use client';

import { useEffect, useMemo, useState } from 'react';

import { useRouter } from '@/core/i18n/navigation';
import { ScrollArea, ScrollBar } from '@/shared/components/ui/scroll-area';
import {
  Tabs as TabsComponent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { cn } from '@/shared/lib/utils';
import { Tab } from '@/shared/types/blocks/common';

export function Tabs({
  tabs,
  size,
}: {
  tabs: Tab[];
  size?: 'sm' | 'md' | 'lg';
}) {
  const router = useRouter();
  const activeTabName = useMemo(
    () => tabs?.find((tab) => tab.is_active)?.name || '',
    [tabs]
  );
  const [tabName, setTabName] = useState(activeTabName);

  useEffect(() => {
    setTabName(activeTabName);
  }, [activeTabName]);

  const handleValueChange = (name: string) => {
    setTabName(name);

    const currentTab = tabs?.find((tab) => tab.name === name) || ({} as Tab);
    if (currentTab.url) {
      router.push(currentTab.url);
    }
  };

  return (
    <div className="relative mb-8">
      <ScrollArea className="w-full lg:max-w-none">
        <div className="flex items-center space-x-2">
          <TabsComponent value={tabName} onValueChange={handleValueChange}>
            <TabsList className={cn(size === 'sm' && 'h-8')}>
              {tabs.map((tab, idx) => (
                <TabsTrigger key={idx} value={tab.name || ''}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </TabsComponent>
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
