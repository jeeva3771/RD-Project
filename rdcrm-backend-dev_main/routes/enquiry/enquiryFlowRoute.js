import express from "express";
import multer from "multer";
import {
  createEnquiryJob,
  getEnquiryJobs,
  getEnquiryJobById,
  updateEnquiryJob,
  getNextEnquiryNumber,
  uploadEnquiryFile,
  toggleHoldSubJob,
  dropSubJob,
  markJobLost,
  getClientEnquiryStats,
  getCoordinators,
} from "../../controllers/enquiry/enquiryFlowController.js";
import { getDtpProofsForEnquiry } from "../../controllers/enquiry/integration/dtpProofIntegrationController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = express.Router();

// 1. Get next sequential job number (e.g. RD21072)
router.get("/next-number", requireSignIn, getNextEnquiryNumber);

// 2. Get Client Servicing Coordinators (Managers & Executives)
router.get("/coordinators", requireSignIn, getCoordinators);

// 3. Client-level live enquiry & trophy statistics (In-Process vs Completed & Realtime Outstanding)
router.get("/client-stats/:clientId", requireSignIn, getClientEnquiryStats);

// 3. File upload directly into Cloudflare R2 (clients/{clientId}/enquiries/{enquiryNo}/{folderType}/{subJobNo?})
router.post("/upload", requireSignIn, upload.single("file"), uploadEnquiryFile);

// 3.1 DTP Live Proofs & Production files integration
router.get("/:id/dtp-proofs", requireSignIn, getDtpProofsForEnquiry);

// 4. Sub-job lifecycle actions: Hold / Unhold
router.post("/:id/sub-job/:subJobNo/hold", requireSignIn, toggleHoldSubJob);

// 5. Sub-job lifecycle actions: Drop / Cancel
router.post("/:id/sub-job/:subJobNo/drop", requireSignIn, dropSubJob);

// 6. Mark enquiry job as lost
router.post("/:id/lost", requireSignIn, markJobLost);

// 7. Core CRUD: Create, Get All, Get By ID, Update
router.post("/", requireSignIn, createEnquiryJob);
router.get("/", requireSignIn, getEnquiryJobs);
router.get("/:id", requireSignIn, getEnquiryJobById);
router.put("/:id", requireSignIn, updateEnquiryJob);

export default router;
