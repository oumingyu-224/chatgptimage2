import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import { PaymentType } from '@/extensions/payment/types';
import { md5 } from '@/shared/lib/hash';
import { findOrderByOrderNo, Order, OrderStatus } from '@/shared/models/order';
import {
  getPaymentService,
  handleCheckoutSuccess,
} from '@/shared/services/payment';
import { PaymentSession } from '@/extensions/payment/types';

type PaymentCallbackDeps = {
  findOrderByOrderNo: (orderNo: string) => Promise<Order | undefined>;
  getPaymentService: typeof getPaymentService;
  handleCheckoutSuccess: (args: { order: Order; session: PaymentSession }) => Promise<void>;
};

const paymentCallbackDeps: PaymentCallbackDeps = {
  findOrderByOrderNo,
  getPaymentService,
  handleCheckoutSuccess,
};

export function buildPaymentCallbackToken(
  order: Pick<Order, 'orderNo' | 'userId'>
) {
  return md5(`${order.orderNo}:${order.userId}:${envConfigs.auth_secret || ''}`);
}

export async function resolvePaymentCallbackRedirectUrl(
  req: Request,
  deps: PaymentCallbackDeps = paymentCallbackDeps
) {
  let redirectUrl = '';

  try {
    // get callback params
    const { searchParams } = new URL(req.url);
    const orderNo = searchParams.get('order_no');
    const token = searchParams.get('token');

    if (!orderNo || !token) {
      throw new Error('invalid callback params');
    }

    // get order
    const order = await deps.findOrderByOrderNo(orderNo);
    if (!order) {
      throw new Error('order not found');
    }

    if (token !== buildPaymentCallbackToken(order)) {
      throw new Error('invalid callback token');
    }

    if (order.status === OrderStatus.PAID) {
      return (
        order.callbackUrl ||
        (order.paymentType === PaymentType.SUBSCRIPTION
          ? `${envConfigs.app_url}/settings/billing`
          : `${envConfigs.app_url}/settings/payments`)
      );
    }

    // validate order and user
    if (!order.paymentSessionId || !order.paymentProvider) {
      throw new Error('invalid order');
    }

    const paymentService = await deps.getPaymentService();

    const paymentProvider = paymentService.getProvider(order.paymentProvider);
    if (!paymentProvider) {
      throw new Error('payment provider not found');
    }

    // get payment session
    const session = await paymentProvider.getPaymentSession({
      sessionId: order.paymentSessionId,
    });

    // console.log('callback payment session', session);

    await deps.handleCheckoutSuccess({
      order,
      session,
    });

    redirectUrl =
      order.callbackUrl ||
      (order.paymentType === PaymentType.SUBSCRIPTION
        ? `${envConfigs.app_url}/settings/billing`
        : `${envConfigs.app_url}/settings/payments`);
  } catch (e: any) {
    console.log('checkout callback failed:', e);
    redirectUrl = `${envConfigs.app_url}/pricing`;
  }

  return redirectUrl;
}

export async function GET(req: Request) {
  const redirectUrl = await resolvePaymentCallbackRedirectUrl(req);
  redirect(redirectUrl);
}
