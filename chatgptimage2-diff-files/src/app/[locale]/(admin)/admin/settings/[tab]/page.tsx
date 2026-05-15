import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requireAllPermissions } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getConfigs, saveConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import {
  getDomesticCardConfigKey,
  getDomesticCardEnvironment,
} from '@/shared/lib/domestic-card-payment';
import { AIProviderSettingsCard } from '@/shared/blocks/admin/ai-provider-settings-card';
import { getAIProviderRows } from '@/shared/services/ai_channels';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/shared/services/settings';
import { Crumb } from '@/shared/types/blocks/common';
import { Form as FormType } from '@/shared/types/blocks/form';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>;
}) {
  const { locale, tab } = await params;
  setRequestLocale(locale);

  // Check if user has permission to read settings
  await requireAllPermissions({
    codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const configs = await getConfigs();

  const settingGroups = await getSettingGroups();
  const settings = await getSettings();

  const t = await getTranslations('admin.settings');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.settings'), is_active: true },
  ];

  const tabs = await getSettingTabs(tab ?? 'auth');

  if (tab === 'ai') {
    const aiRows = getAIProviderRows(configs);

    return (
      <>
        <Header crumbs={crumbs} />
        <Main>
          <MainHeader title={t('edit.title')} tabs={tabs} />
          <AIProviderSettingsCard
            title={t('edit.tabs.ai')}
            description={t('ai_table.description')}
            initialRows={aiRows}
            submitText={t('edit.buttons.submit')}
            texts={{
              add_custom_channel: t('ai_table.add_custom_channel'),
              enabled: t('ai_table.columns.enabled'),
              priority: t('ai_table.columns.priority'),
              name: t('ai_table.columns.name'),
              provider: t('ai_table.columns.provider'),
              model: t('ai_table.columns.model'),
              api_key: t('ai_table.columns.api_key'),
              base_url: t('ai_table.columns.base_url'),
              save_failed: t('ai_table.messages.save_failed'),
              settings_updated: t('edit.messages.settings_updated'),
              custom_name: t('ai_table.custom_name'),
              enabled_row_required: t('ai_table.messages.enabled_row_required'),
            }}
          />
        </Main>
      </>
    );
  }

  const handleSubmit = async (data: FormData, passby: any) => {
    'use server';
    const actionT = await getTranslations({
      locale,
      namespace: 'admin.settings',
    });

    const user = await getUserInfo();

    if (!user) {
      throw new Error(actionT('edit.messages.no_auth'));
    }

    data.forEach((value, name) => {
      configs[name] = value as string;
    });

    if (
      passby?.provider === 'domestic_card_payment' &&
      configs.domestic_card_payment_enabled === 'true'
    ) {
      const requiredProductIds = [
        'credits-package',
        'starter-monthly',
        'premium-yearly',
      ];
      const missingFields = requiredProductIds
        .map((productId) =>
          getDomesticCardConfigKey(
            productId,
            getDomesticCardEnvironment(configs)
          )
        )
        .filter((key) => !String(configs[key] || '').trim());

      if (missingFields.length > 0) {
        throw new Error(actionT('payment.messages.domestic_card_links_required'));
      }
    }

    await saveConfigs(configs);

    return {
      status: actionT('edit.messages.success'),
      message: actionT('edit.messages.settings_updated'),
    };
  };

  let forms: FormType[] = [];

  settingGroups.forEach((group) => {
    if (group.tab !== tab) {
      return;
    }

    forms.push({
      title: group.title,
      description: group.description,
      fields: settings
        .filter((setting) => setting.group === group.name)
        .map((setting) => ({
          name: setting.name,
          title: setting.title,
          type: setting.type as any,
          placeholder: setting.placeholder,
          group: setting.group,
          options: setting.options,
          tip: setting.tip,
          value: setting.value,
          attributes: setting.attributes,
          validation: setting.validation,
          metadata: setting.metadata,
        })),
      passby: {
        provider: group.name,
        tab: group.tab,
      },
      data: configs,
      submit: {
        button: {
          title: t('edit.buttons.submit'),
        },
        handler: handleSubmit as any,
      },
    });
  });

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} tabs={tabs} />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          {forms.map((form) => (
            <FormCard
              key={form.title}
              title={form.title}
              description={form.description}
              form={form}
              className="mb-0 min-w-0"
              defaultCollapsed={false}
              collapsible={true}
            />
          ))}
        </div>
      </Main>
    </>
  );
}
