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
  getDesigners,
  getDesignerEnquiries,
  uploadDesignerOptions,
  requestDesignRework,
  recordSubJobDesignFeedback,
  recordPublicDesignFeedback,
  getPublicDesignView,
  sendDesignEmail,
  recordDesignShared,
  requestCostingForSubJobs,
  submitBOMAndSyncRate,
  sendSubJobQuotes,
  sendQuotationEmail,
  sendDeliveryEmail,
  sendSampleConfirmationEmail,
  recordSampleShared,
  pushToSampleProduction,
  sendSampleProofEmail,
  getPublicSampleProofView,
  recordPublicSampleProofFeedback,
  saveSamplePhysicalDispatch,
  getDtpProofsForEnquiry,
  shareDtpProofWithClient,
  recordClientProofFeedback,
  uploadArtworkProof,
  getPublicProofView,
  recordPublicDeliveryFeedback,
  recordPublicSampleFeedback,
  getPublicQuoteView,
  recordPublicQuoteFeedback,
  updateQuoteDecision,
  getPendingCostingSubJobs,
  uploadSubJobArtwork,
  getSignedPublicLink,
  requestDeliveryCharge,
  getDeliveryChargeRequests,
  submitDeliveryCharge,
  approveDeliveryCharge,
  requestProformaInvoice,
  recordProformaShared,
  sendProformaEmail,
  recordPublicProformaFeedback,
  pushToProductionHub,
} from "../../controllers/enquiry/enquiryFlowIntegrationController.js";
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

// 3. Designers endpoints (Must be declared before /:id)
router.get("/designers", requireSignIn, getDesigners);
router.get("/designer-enquiries", requireSignIn, getDesignerEnquiries);

// 4. Client-level live enquiry & trophy statistics
router.get("/client-stats/:clientId", requireSignIn, getClientEnquiryStats);

// 5. Pending Costings for Quotation Desk Integration
router.get("/pending-costings", requireSignIn, getPendingCostingSubJobs);

// 5b. Delivery & Courier Charges Estimation (Packing Team)
router.get("/delivery-charge-requests", requireSignIn, getDeliveryChargeRequests);
router.post("/:id/request-delivery-charge", requireSignIn, requestDeliveryCharge);
router.post("/:id/submit-delivery-charge", requireSignIn, submitDeliveryCharge);
router.post("/:id/approve-delivery-charge", requireSignIn, approveDeliveryCharge);

// 6. File upload directly into Cloudflare R2
router.post("/upload", requireSignIn, upload.single("file"), uploadEnquiryFile);

// 6. Sub-job lifecycle actions: Hold / Unhold
router.post("/:id/sub-job/:subJobNo/hold", requireSignIn, toggleHoldSubJob);

// 7. Sub-job lifecycle actions: Drop / Cancel
router.post("/:id/sub-job/:subJobNo/drop", requireSignIn, dropSubJob);

// 8. Mark enquiry job as lost
router.post("/:id/lost", requireSignIn, markJobLost);

// 8b. Costing & Quotation Lifecycle Actions
router.post("/:id/request-costing", requireSignIn, requestCostingForSubJobs);
router.post("/:id/submit-bom-rate", requireSignIn, submitBOMAndSyncRate);
router.post("/:id/send-quotes", requireSignIn, sendSubJobQuotes);
router.post("/:id/quote-mail", requireSignIn, sendQuotationEmail);
router.post("/:id/delivery-mail", requireSignIn, sendDeliveryEmail);
router.post("/:id/sample-mail", requireSignIn, sendSampleConfirmationEmail);
router.post("/:id/sample-proof-mail", requireSignIn, sendSampleProofEmail);
router.post("/:id/sample-physical-dispatch", requireSignIn, saveSamplePhysicalDispatch);
router.post("/:id/sample-share", requireSignIn, recordSampleShared);
router.post("/:id/push-sample-production", requireSignIn, pushToSampleProduction);
router.post("/:id/push-production", requireSignIn, pushToProductionHub);
router.post("/:id/quote-decision", requireSignIn, updateQuoteDecision);

// 8d. Proforma Invoice (PI) Lifecycle Actions with Accounts Module
router.post("/:id/request-proforma", requireSignIn, requestProformaInvoice);
router.post("/:id/share-proforma", requireSignIn, recordProformaShared);
router.post("/:id/proforma-mail", requireSignIn, sendProformaEmail);

// 8c. Public quotation preview & decision endpoint for client (no auth required)
router.get("/:id/public-link", requireSignIn, getSignedPublicLink);
router.get("/public/quote-view/:id", getPublicQuoteView);
router.get("/public/proforma-view/:id", getPublicQuoteView);
router.get("/public/proof-view/:id", getPublicProofView);
router.get("/public/sample-proof-view/:id", getPublicSampleProofView);
router.post("/public/quote-feedback/:id", recordPublicQuoteFeedback);
router.post("/public/proforma-feedback/:id", recordPublicProformaFeedback);
router.post("/public/delivery-feedback/:id", recordPublicDeliveryFeedback);
router.post("/public/sample-feedback/:id", recordPublicSampleFeedback);
router.post("/public/sample-proof-feedback/:id", recordPublicSampleProofFeedback);
router.post("/public/proof-feedback/:id", upload.single("reference_file"), recordClientProofFeedback);

// DTP Studio Proofs Fetch & Share
router.get("/:id/dtp-proofs", requireSignIn, getDtpProofsForEnquiry);
router.post("/:id/share-dtp-proof", requireSignIn, shareDtpProofWithClient);
router.post("/:id/upload-artwork-proof", requireSignIn, upload.single("file"), uploadArtworkProof);
router.post("/:id/cs-proof-feedback", requireSignIn, upload.single("reference_file"), recordClientProofFeedback);

// 9. Designer upload, production artwork upload & rework actions
router.post("/:id/designer-upload", requireSignIn, uploadDesignerOptions);
router.post("/:id/artwork-upload", requireSignIn, upload.array("designer_files"), uploadSubJobArtwork);
router.post("/:id/rework", requireSignIn, requestDesignRework);
router.post("/:id/subjob-design-feedback", requireSignIn, recordSubJobDesignFeedback);

// 10. Record design options shared (WhatsApp / Link / other)
router.post("/:id/share-options", requireSignIn, recordDesignShared);

// 11. Send Design Review Email to client via backend mailer
router.post("/:id/mail", requireSignIn, sendDesignEmail);
router.get("/:id/mail", requireSignIn, sendDesignEmail);

// 11. Public design preview & decision endpoint for client (no auth required)
router.get("/public/design-view/:id", getPublicDesignView);
router.post("/public/design-feedback/:id", recordPublicDesignFeedback);

// 12. Core CRUD: Create, Get All, Get By ID, Update (/:id at the end)
router.post("/", requireSignIn, createEnquiryJob);
router.get("/", requireSignIn, getEnquiryJobs);
router.get("/:id", requireSignIn, getEnquiryJobById);
router.put("/:id", requireSignIn, updateEnquiryJob);

export default router;
