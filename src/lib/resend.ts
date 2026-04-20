import 'server-only';
import { Resend } from 'resend';

let _client: Resend | null = null;

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set. Add it to .env.local before sending email.');
  }
  if (!_client) _client = new Resend(key);
  return _client;
}

export const resendConfig = {
  from: process.env.RESEND_FROM_EMAIL ?? 'Tibi Concept Store <hello@ismathlauriano.com>',
  adminNotify: process.env.ADMIN_NOTIFY_EMAIL ?? 'hello@ismathlauriano.com',
};
