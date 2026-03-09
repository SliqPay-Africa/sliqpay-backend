import { Router } from 'express';
import {
  payCryptoAirtime,
  payCryptoData,
  payCryptoElectricity,
  payCryptoCableTv,
  custodialAirtime,
  payFiatAirtime,
  payFiatData,
  payFiatElectricity,
  payFiatCableTv,
} from '../controllers/payment.controller.js';
import { authGuard } from '../../../common/middleware/auth.js';

const router = Router();
router.use(authGuard);

// ── Crypto (on-chain) routes ──────────────────────────────
// Client provides a txHash after on-chain payment is confirmed,
// then backend verifies on-chain and triggers VTPass purchase.
router.post('/airtime', payCryptoAirtime);
router.post('/data', payCryptoData);
router.post('/electricity', payCryptoElectricity);
router.post('/cable-tv', payCryptoCableTv);

// ── Custodial (backend signs) ─────────────────────────────
router.post('/custodial-airtime', custodialAirtime);

// ── Fiat (balance deduction) routes ──────────────────────
// These should be called AFTER the frontend has already
// deducted from the account balance. VTPass is still called
// to fulfil the actual utility purchase.
router.post('/fiat/airtime', payFiatAirtime);
router.post('/fiat/data', payFiatData);
router.post('/fiat/electricity', payFiatElectricity);
router.post('/fiat/cable-tv', payFiatCableTv);

export default router;
