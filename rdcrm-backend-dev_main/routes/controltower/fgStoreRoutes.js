import express from 'express';
import { syncFgStore, getFgStoreJobs, inwardJob, handoverToQc, generateInvoice } from '../../controllers/controltower/fgStoreController.js';
import { requireSignIn } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post('/sync', requireSignIn, syncFgStore);
router.get('/', requireSignIn, getFgStoreJobs);
router.post('/inward/:id', requireSignIn, inwardJob);
router.post('/handover/:id', requireSignIn, handoverToQc);
router.post('/invoice/:id', requireSignIn, generateInvoice);

export default router;
