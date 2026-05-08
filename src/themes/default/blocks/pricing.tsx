'use client';

import { useEffect, useState } from 'react';
import { Check, Lightbulb, Loader2, SendHorizonal, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { SmartIcon } from '@/shared/blocks/common';
import { PaymentModal } from '@/shared/blocks/payment/payment-modal';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useAppContext } from '@/shared/contexts/app';
import { getCookie } from '@/shared/lib/cookie';
import { cn } from '@/shared/lib/utils';
import { Subscription } from '@/shared/models/subscription';
import {
  PricingCurrency,
  PricingItem,
  Pricing as PricingType,
} from '@/shared/types/blocks/pricing';

// Helper function to get all available currencies from a pricing item
function getCurrenciesFromItem(item: PricingItem | null): PricingCurrency[] {
  if (!item) return [];

  // Always include the default currency first
  const defaultCurrency: PricingCurrency = {
    currency: item.currency,
    amount: item.amount,
    price: item.price || '',
    original_price: item.original_price || '',
  };

  // Add additional currencies if available
  if (item.currencies && item.currencies.length > 0) {
    return [defaultCurrency, ...item.currencies];
  }

  return [defaultCurrency];
}

// Helper function to select initial currency based on locale
function getInitialCurrency(
  currencies: PricingCurrency[],
  locale: string,
  defaultCurrency: string
): string {
  if (currencies.length === 0) return defaultCurrency;

  // If locale is 'zh', prefer CNY
  if (locale === 'zh') {
    const cnyCurrency = currencies.find(
      (c) => c.currency.toLowerCase() === 'cny'
    );
    if (cnyCurrency) {
      return cnyCurrency.currency;
    }
  }

  // Otherwise return default currency
  return defaultCurrency;
}

export function Pricing({
  pricing,
  className,
  currentSubscription,
}: {
  pricing: PricingType;
  className?: string;
  currentSubscription?: Subscription;
}) {
  const locale = useLocale();
  const t = useTranslations('pages.pricing.messages');
  const {
    user,
    isShowPaymentModal,
    setIsShowSignModal,
    setIsShowPaymentModal,
    configs,
  } = useAppContext();

  const [group, setGroup] = useState(() => {
    // find current pricing item
    const currentItem = pricing.items?.find(
      (i) => i.product_id === currentSubscription?.productId
    );

    const yearlyGroup = pricing.groups?.find((g) => g.name === 'yearly');
    // First look for a group with is_featured set to true
    const featuredGroup = pricing.groups?.find((g) => g.is_featured);
    // If no featured group exists, fall back to the first group
    return (
      currentItem?.group ||
      yearlyGroup?.name ||
      featuredGroup?.name ||
      pricing.groups?.[0]?.name
    );
  });

  // current pricing item
  const [pricingItem, setPricingItem] = useState<PricingItem | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  // Currency state management for each item
  // Store selected currency and displayed item for each product_id
  const [itemCurrencies, setItemCurrencies] = useState<
    Record<string, { selectedCurrency: string; displayedItem: PricingItem }>
  >({});

  // Initialize currency states for all items
  useEffect(() => {
    if (pricing.items && pricing.items.length > 0) {
      const initialCurrencyStates: Record<
        string,
        { selectedCurrency: string; displayedItem: PricingItem }
      > = {};

      pricing.items.forEach((item) => {
        const currencies = getCurrenciesFromItem(item);
        const selectedCurrency = getInitialCurrency(
          currencies,
          locale,
          item.currency
        );

        // Create displayed item with selected currency
        const currencyData = currencies.find(
          (c) => c.currency.toLowerCase() === selectedCurrency.toLowerCase()
        );

        const displayedItem = currencyData
          ? {
              ...item,
              currency: currencyData.currency,
              amount: currencyData.amount,
              price: currencyData.price,
              original_price: currencyData.original_price,
              // Override with currency-specific payment settings if available
              payment_product_id:
                currencyData.payment_product_id || item.payment_product_id,
              payment_providers:
                currencyData.payment_providers || item.payment_providers,
            }
          : item;

        initialCurrencyStates[item.product_id] = {
          selectedCurrency,
          displayedItem,
        };
      });

      setItemCurrencies(initialCurrencyStates);
    }
  }, [pricing.items, locale]);

  // Handler for currency change
  const handleCurrencyChange = (productId: string, currency: string) => {
    const item = pricing.items?.find((i) => i.product_id === productId);
    if (!item) return;

    const currencies = getCurrenciesFromItem(item);
    const currencyData = currencies.find(
      (c) => c.currency.toLowerCase() === currency.toLowerCase()
    );

    if (currencyData) {
      const displayedItem = {
        ...item,
        currency: currencyData.currency,
        amount: currencyData.amount,
        price: currencyData.price,
        original_price: currencyData.original_price,
        // Override with currency-specific payment settings if available
        payment_product_id:
          currencyData.payment_product_id || item.payment_product_id,
        payment_providers:
          currencyData.payment_providers || item.payment_providers,
      };

      setItemCurrencies((prev) => ({
        ...prev,
        [productId]: {
          selectedCurrency: currency,
          displayedItem,
        },
      }));
    }
  };

  const handlePayment = async (item: PricingItem) => {
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    // Use displayed item with selected currency
    const displayedItem =
      itemCurrencies[item.product_id]?.displayedItem || item;

    if (configs.select_payment_enabled === 'true') {
      setPricingItem(displayedItem);
      setIsShowPaymentModal(true);
    } else {
      handleCheckout(displayedItem, configs.default_payment_provider);
    }
  };

  const getAffiliateMetadata = ({
    paymentProvider,
  }: {
    paymentProvider: string;
  }) => {
    const affiliateMetadata: Record<string, string> = {};

    // get Affonso referral
    if (
      configs.affonso_enabled === 'true' &&
      ['stripe', 'creem'].includes(paymentProvider)
    ) {
      const affonsoReferral = getCookie('affonso_referral') || '';
      affiliateMetadata.affonso_referral = affonsoReferral;
    }

    // get PromoteKit referral
    if (
      configs.promotekit_enabled === 'true' &&
      ['stripe'].includes(paymentProvider)
    ) {
      const promotekitReferral =
        typeof window !== 'undefined' && (window as any).promotekit_referral
          ? (window as any).promotekit_referral
          : getCookie('promotekit_referral') || '';
      affiliateMetadata.promotekit_referral = promotekitReferral;
    }

    return affiliateMetadata;
  };

  const handleCheckout = async (
    item: PricingItem,
    paymentProvider?: string
  ) => {
    try {
      if (!user) {
        setIsShowSignModal(true);
        return;
      }

      const affiliateMetadata = getAffiliateMetadata({
        paymentProvider: paymentProvider || '',
      });

      const params = {
        product_id: item.product_id,
        currency: item.currency,
        locale: locale || 'en',
        payment_provider: paymentProvider || '',
        metadata: affiliateMetadata,
      };

      setIsLoading(true);
      setProductId(item.product_id);

      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (response.status === 401) {
        setIsLoading(false);
        setProductId(null);
        setPricingItem(null);
        setIsShowSignModal(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`request failed with status ${response.status}`);
      }

      const { code, message, data } = await response.json();
      if (code !== 0) {
        throw new Error(message);
      }

      const { checkoutUrl } = data;
      if (!checkoutUrl) {
        throw new Error('checkout url not found');
      }

      window.location.href = checkoutUrl;
    } catch (e: any) {
      console.log('checkout failed: ', e);
      toast.error('checkout failed: ' + e.message);

      setIsLoading(false);
      setProductId(null);
    }
  };

  useEffect(() => {
    if (pricing.items) {
      const visibleItems = pricing.items.filter(
        (item) => !item.group || item.group === group
      );
      const featuredItem = visibleItems.find((i) => i.is_featured);
      setProductId(
        featuredItem?.product_id ||
          visibleItems[0]?.product_id ||
          pricing.items[0]?.product_id
      );
      setIsLoading(false);
    }
  }, [pricing.items, group]);

  return (
    <section
      id={pricing.id}
      className={cn('py-24 md:py-36', pricing.className, className)}
    >
      <div className="mx-auto mb-12 px-4 text-center md:px-8">
        {pricing.sr_only_title && (
          <h1 className="sr-only">{pricing.sr_only_title}</h1>
        )}
        <h2 className="landing-title mb-6 text-3xl font-bold text-pretty lg:text-4xl">
          {pricing.title}
        </h2>
        <p className="landing-body mx-auto mb-4 max-w-xl lg:max-w-none lg:text-lg">
          {pricing.description}
        </p>
      </div>

      <div className="container">
        {pricing.groups && pricing.groups.length > 0 && (
          <div className="mx-auto mt-8 mb-16 flex w-full justify-center md:max-w-lg">
            <Tabs value={group} onValueChange={setGroup}>
              <TabsList className="landing-input-surface h-auto rounded-full border p-1">
                {pricing.groups.map((item, i) => {
                  return (
                    <TabsTrigger
                      key={i}
                      value={item.name || ''}
                      className="rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-[#1773ea] data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                      {item.title}
                      {item.label && (
                        <Badge className="ml-2 bg-[#dff6e8] text-[#169c53] shadow-none">
                          {item.label}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        <div className="mx-auto mt-0 grid w-full gap-6 lg:grid-cols-3">
          {pricing.items?.map((item: PricingItem, idx) => {
            if (item.group && item.group !== group) {
              return null;
            }

            let isCurrentPlan = false;
            if (
              currentSubscription &&
              currentSubscription.productId === item.product_id
            ) {
              isCurrentPlan = true;
            }

            // Get currency state for this item
            const currencyState = itemCurrencies[item.product_id];
            const displayedItem = currencyState?.displayedItem || item;
            const selectedCurrency =
              currencyState?.selectedCurrency || item.currency;
            const currencies = getCurrenciesFromItem(item);

            return (
              <Card
                key={idx}
                className={cn(
                  'landing-panel relative mx-auto w-full rounded-[24px] border shadow-none',
                  item.is_featured &&
                    'border-[#1773ea] shadow-[0_0_0_1px_rgba(23,115,234,0.28),0_18px_42px_rgba(23,115,234,0.14)]'
                )}
              >
                {item.label && (
                  <span className="absolute top-4 right-4 flex h-6 w-fit items-center rounded-full bg-[#1773ea] px-3 py-1 text-xs font-medium text-white">
                    {item.label}
                  </span>
                )}

                <CardHeader className="p-6 pb-4">
                  <CardTitle className="font-medium">
                    <h3 className="landing-strong text-sm font-medium">
                      {item.title}
                    </h3>
                  </CardTitle>

                  <div className="my-3 flex items-baseline gap-2">
                    {displayedItem.original_price && (
                      <span className="landing-muted text-sm line-through">
                        {displayedItem.original_price}
                      </span>
                    )}

                    <div className="my-3 block text-2xl font-semibold">
                      <span className="text-[#1773ea]">
                        {displayedItem.price}
                      </span>{' '}
                      {displayedItem.unit ? (
                        <span className="landing-muted text-sm font-normal">
                          {displayedItem.unit}
                        </span>
                      ) : (
                        ''
                      )}
                    </div>

                    {currencies.length > 1 && (
                      <Select
                        value={selectedCurrency}
                        onValueChange={(currency) =>
                          handleCurrencyChange(item.product_id, currency)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="landing-input-surface h-6 min-w-[60px] border px-2 text-xs shadow-none"
                        >
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem
                              key={currency.currency}
                              value={currency.currency}
                              className="text-xs"
                            >
                              {currency.currency.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <CardDescription className="landing-body text-sm">
                    {item.description}
                  </CardDescription>
                  {item.tip && (
                    <span className="landing-muted text-sm">
                      {item.tip}
                    </span>
                  )}

                  {isCurrentPlan ? (
                    <Button
                      disabled
                      className={cn(
                        'mt-4 h-10 w-full rounded-xl border px-4 py-2 text-sm font-medium',
                        'bg-[#cfd6e2] text-white opacity-60'
                      )}
                    >
                      <span className="text-sm">
                        {t('current_plan')}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePayment(item)}
                      disabled={isLoading}
                      className={cn(
                        'mt-4 h-10 w-full rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                        'bg-[#1773ea] hover:bg-[#1569d5]'
                      )}
                    >
                      {isLoading && item.product_id === productId ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span className="block">{t('processing')}</span>
                        </>
                      ) : (
                        <>
                          {item.button?.icon && (
                            <SmartIcon
                              name={item.button?.icon as string}
                              className="size-4"
                            />
                          )}
                          <span className="block">{item.button?.title}</span>
                        </>
                      )}
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="space-y-4 px-6 pb-6">
                  <hr className="landing-divider border-dashed" />

                  {item.features_title && (
                    <p className="landing-strong text-sm font-medium">
                      {item.features_title}
                    </p>
                  )}
                  <ul className="landing-body list-outside space-y-3 text-sm">
                    {item.features?.map((item, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="size-3 text-[#1773ea]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <PaymentModal
        isLoading={isLoading}
        pricingItem={pricingItem}
        onCheckout={(item, paymentProvider) =>
          handleCheckout(item, paymentProvider)
        }
      />
    </section>
  );
}
