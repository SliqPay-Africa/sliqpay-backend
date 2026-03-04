import { env } from '../../config/env.js';

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!env.PLUNK_API_KEY) {
    console.warn('PLUNK_API_KEY is missing. Email will not be sent.', { to, subject });
    return;
  }

  // A generic wrapper for emails to look nice, matching the Plunk + SliqPay brand.
  const emailTemplate = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        <div style="padding: 24px; text-align: center; background-color: #111827;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">SliqPay</h1>
        </div>
        <div style="padding: 32px 24px;">
          ${html}
        </div>
        <div style="padding: 24px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Secure Payments, Global Reality.</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">&copy; ${new Date().getFullYear()} SliqPay. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.useplunk.com/v1/send', {
      method: 'POST',
      body: JSON.stringify({
        to,
        subject,
        body: emailTemplate,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.PLUNK_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to send email via Plunk:', await response.text());
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
