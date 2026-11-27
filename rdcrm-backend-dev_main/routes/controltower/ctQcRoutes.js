import express from 'express';
import { getCtQcJobs, arrivalQcJob, inwardQcJob, handoverToPacking, handoverRejection } from '../../controllers/controltower/ctQcController.js';
import { requireSignIn } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', requireSignIn, getCtQcJobs);
router.post('/arrival/:id', requireSignIn, arrivalQcJob);
router.post('/inward/:id', requireSignIn, inwardQcJob);
router.post('/handover-packing/:id', requireSignIn, handoverToPacking);
router.post('/handover-rejection/:id', requireSignIn, handoverRejection);

export default router;
