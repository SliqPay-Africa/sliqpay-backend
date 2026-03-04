import { Router } from 'express';
import { WaitlistController } from './waitlist.controller.js';

const router = Router();
const controller = new WaitlistController();

router.post('/', controller.join);

export default router;
