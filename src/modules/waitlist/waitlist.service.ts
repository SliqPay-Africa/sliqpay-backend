import { PrismaClient } from '@prisma/client';
import { sendMail } from '../../common/utils/email.js';

const prisma = new PrismaClient();

export class WaitlistService {
  async addToWaitlist(data: { 
    email: string; 
    firstName?: string; 
    lastName?: string;
    phone?: string;
  }) {
    // Check if email already exists
    const existing = await prisma.waitlist.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      throw { code: 'P2002', message: 'Email already exists' };
    }

    const entry = await prisma.waitlist.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone
      }
    });

    // Send confirmation email
    await sendMail({
      to: data.email,
      subject: "You're on the list! Welcome to SliqPay 🚀",
      html: `
        <h2 style="color: #111827; margin-top: 0;">Welcome to the future of payments, ${data.firstName || 'there'}!</h2>
        <p style="color: #374151; line-height: 1.6;">Thanks for joining the SliqPay waitlist. We're building something that will change how you move money forever.</p>
        <p style="color: #374151; line-height: 1.6;">We'll notify you as soon as we're ready to onboard new users. In the meantime, follow us for updates!</p>
        <div style="margin-top: 24px;">
          <a href="#" style="background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Follow our progress</a>
        </div>
      `
    });

    return entry;
  }
}
