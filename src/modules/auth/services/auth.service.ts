import { UserRepositoryPrisma } from '../../users/repositories/user.prisma.repository.js';
import { AccountRepositoryPrisma } from '../../users/repositories/account.prisma.repository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../../../config/env.js';
import { sendMail } from '../../../common/utils/email.js';
import { generateWallet } from '../../../common/utils/wallet.js';
import { registerSliqIdOnChain } from '../../../common/utils/sliqIdRegistry.js';

const Repo = UserRepositoryPrisma;

function sign(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '15m' });
}

export function publicUser(u: any) {
  return { 
    id: u.id, 
    email: u.email, 
    firstName: u.first_name, 
    lastName: u.last_name, 
    sliqId: u.sliq_id,
    walletAddress: u.wallet_address || null,
    walletType: u.wallet_type || null,
    createdAt: u.created_at 
  };
}

export async function signup(fname: string, lname: string, email: string, password: string, phone?: string, sliqId?: string, referralCode?: string) {
  const existing = await Repo.findByEmail(email);
  if (existing) {
    throw { status: 400, message: 'Email already registered' };
  }
  
  // Check if sliqId is already taken
  if (sliqId) {
    const sliqIdExists = await Repo.findBySliqId(sliqId);
    if (sliqIdExists) {
      throw { status: 400, message: 'SliqID already taken. Please choose another.' };
    }
  }
  
  // Phone is optional - generate a unique placeholder if not provided
  const phoneToUse = phone || `+000${randomUUID().replace(/-/g, '').slice(0, 11)}`;

  // Check if phone is already registered
  if (phone) {
    const phoneExists = await Repo.findByPhone(phoneToUse);
    if (phoneExists) {
      throw { status: 400, message: 'Phone number already registered' };
    }
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);
  
  // Auto-generate a custodial EVM wallet
  const wallet = generateWallet();
  
  const user = await Repo.create({ 
    email, firstName: fname, lastName: lname, passwordHash, phone: phoneToUse, sliqId, referralCode,
    walletAddress: wallet.address,
    walletType: 'custodial',
    encryptedPrivateKey: wallet.encryptedPrivateKey,
  });
  // Create a default NGN account with 25,000 starting balance
  try {
    await AccountRepositoryPrisma.create({ userId: user.id, balance: 25000, currency: 'NGN' });
  } catch (e) {
    // Non-fatal: account can be created later, but log in real system
  }

  // Register SliqID on-chain (fire-and-forget, non-blocking)
  if (user.sliq_id && user.wallet_address) {
    registerSliqIdOnChain(user.sliq_id, user.wallet_address).catch(() => {
      // Already logged inside the utility — swallow here
    });
  }

  const token = sign(user.id);

  // Send Welcome Email
  await sendMail({
    to: user.email,
    subject: 'Welcome to SliqPay! 🚀 Your wallet is ready.',
    html: `
      <h2 style="color: #111827; margin-top: 0;">Welcome aboard, ${fname}!</h2>
      <p style="color: #374151; line-height: 1.6;">Your SliqPay account has been successfully created. We've also set up your default wallet and assigned you your unique SliqID.</p>
      <div style="margin: 24px 0; padding: 16px; background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
        <p style="margin: 0; color: #0c4a6e; font-size: 14px; font-weight: 600;">Your SliqID</p>
        <p style="margin: 8px 0 0 0; color: #0369a1; font-size: 18px; font-weight: 700;">${user.sliq_id}</p>
      </div>
      <p style="color: #374151; line-height: 1.6;">You can now start sending, receiving, and managing your money with ease. Your account comes with <strong>₦25,000</strong> to get you started!</p>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${env.FRONTEND_URL || 'https://sliqpay-frontend.vercel.app'}/dashboard" style="background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Go to Dashboard</a>
      </div>
    `
  });

  return { user: publicUser(user), token };
}

export async function login(email: string, password: string) {
  const user = await Repo.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw { status: 401, message: 'Invalid credentials' };
  }
  const token = sign(user.id);
  return { user: publicUser(user), token };
}

export { Repo };
