import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.AUTH_SECRET = 'test-auth-secret';
process.env.AI_NOTIFY_TOKENS = 'notify-a,notify-b';
process.env.AI_DISPATCH_TOKENS = 'dispatch-a,dispatch-b';
delete process.env.NEXT_PUBLIC_APP_LOGO;
process.env.NEXT_PUBLIC_APP_URL = 'https://shipany.test';

function toModuleUrl(filePath: string) {
  return `${pathToFileURL(path.resolve(process.cwd(), filePath)).href}?t=${Date.now()}`;
}

async function importConfigModule() {
  return import(toModuleUrl('src/config/index.ts'));
}

async function importBrandingModule() {
  return import(toModuleUrl('src/shared/lib/branding.ts'));
}

async function importPaymentCallbackModule() {
  return import(toModuleUrl('src/app/api/payment/callback/route.ts'));
}

test('envConfigs exposes ai tokens and keeps logo fallback as logo.png', async () => {
  const { envConfigs } = await importConfigModule();
  const { DEFAULT_APP_LOGO } = await importBrandingModule();

  assert.equal(envConfigs.ai_notify_tokens, 'notify-a,notify-b');
  assert.equal(envConfigs.ai_dispatch_tokens, 'dispatch-a,dispatch-b');
  assert.equal(envConfigs.app_logo, '/logo.png');
  assert.equal(DEFAULT_APP_LOGO, '/logo.png');
});

test('resolvePaymentCallbackRedirectUrl rejects invalid callback token', async () => {
  const { resolvePaymentCallbackRedirectUrl } =
    await importPaymentCallbackModule();

  let handled = false;
  const redirectUrl = await resolvePaymentCallbackRedirectUrl(
    new Request(
      'https://shipany.test/api/payment/callback?order_no=order_1&token=bad-token'
    ),
    {
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'user_1',
          status: 'created',
          paymentType: 'payment',
          paymentSessionId: 'sess_1',
          paymentProvider: 'stripe',
          callbackUrl: 'https://shipany.test/settings/payments',
        }) as any,
      getPaymentService: async () => ({
        getProvider: () => ({
          getPaymentSession: async () => {
            throw new Error('should not query session');
          },
        }),
      }) as any,
      handleCheckoutSuccess: async () => {
        handled = true;
      },
    }
  );

  assert.equal(redirectUrl, 'https://shipany.test/pricing');
  assert.equal(handled, false);
});

test('resolvePaymentCallbackRedirectUrl accepts valid callback token', async () => {
  const { buildPaymentCallbackToken, resolvePaymentCallbackRedirectUrl } =
    await importPaymentCallbackModule();

  let handled = false;
  const order = {
    orderNo: 'order_2',
    userId: 'user_2',
    status: 'created',
    paymentType: 'subscription',
    paymentSessionId: 'sess_2',
    paymentProvider: 'stripe',
    callbackUrl: 'https://shipany.test/custom-callback',
  } as any;
  const token = buildPaymentCallbackToken(order);

  const redirectUrl = await resolvePaymentCallbackRedirectUrl(
    new Request(
      `https://shipany.test/api/payment/callback?order_no=${order.orderNo}&token=${token}`
    ),
    {
      findOrderByOrderNo: async () => order,
      getPaymentService: async () => ({
        getProvider: () => ({
          getPaymentSession: async () => ({
            paymentStatus: 'success',
            paymentInfo: {},
          }),
        }),
      }) as any,
      handleCheckoutSuccess: async () => {
        handled = true;
      },
    }
  );

  assert.equal(handled, true);
  assert.equal(redirectUrl, 'https://shipany.test/custom-callback');
});
