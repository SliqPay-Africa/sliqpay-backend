import { Request, Response } from 'express';
import { WaitlistService } from './waitlist.service.js';
import { z } from 'zod';

const waitlistSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export class WaitlistController {
  private waitlistService: WaitlistService;

  constructor() {
    this.waitlistService = new WaitlistService();
  }

  join = async (req: Request, res: Response) => {
    try {
      const parsed = waitlistSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: parsed.error.errors 
        });
      }

      const entry = await this.waitlistService.addToWaitlist(parsed.data);
      
      return res.status(201).json({
        message: 'Joined waitlist successfully',
        data: entry
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Email already on waitlist' });
      }
      console.error('Waitlist error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
