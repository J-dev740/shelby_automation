import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';

let razorpayInstance: Razorpay | null = null;

if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

export const razorpayService = {
  isConfigured() {
    return razorpayInstance !== null;
  },

  async createPaymentLink(
    orderId: string, 
    orderCode: string, 
    amountInr: number, 
    customerPhone: string
  ) {
    if (!razorpayInstance) {
      throw new Error('Razorpay is not configured (missing env vars)');
    }

    const payload = {
      amount: amountInr * 100, // INR to Paise
      currency: "INR",
      accept_partial: false,
      description: `Shelby Order ${orderCode}`,
      customer: {
        contact: customerPhone,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      reference_id: orderId, // The internal DB order.id
    };

    const paymentLink = await razorpayInstance.paymentLink.create(payload);
    
    return {
      id: paymentLink.id, // e.g. plink_xyz
      short_url: paymentLink.short_url,
      status: paymentLink.status,
    };
  },

  verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch {
      return false;
    }
  }
};
