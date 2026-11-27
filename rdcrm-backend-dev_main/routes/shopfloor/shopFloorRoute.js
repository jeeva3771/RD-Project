import express from "express";
import {
    getShopFloorJobs,
    getShopFloorJobById,
    updateProcessStatus,
    syncShopFloorJobs,
    clearShopFloorFlags,
    recordMaterialInward,
    getShopFloorInwardLogs,
    logShopFloorActivity,
    escalateShopFloorJob,
    deEscalateShopFloorJob,
    createReadyJob,
    getReadyJobs,
    confirmHandover,
    createMaterialReturn,
    getMaterialReturns,
    getVendorOutsourceView,
    submitVendorOutsourceResponse,
    uploadOutsourceInvoice
} from "../../controllers/shopfloor/shopFloorController.js";
import {
    submitExtraMaterialEMR,
    getExtraMaterialEMRList,
    confirmEMRReceipt,
    approveExtraMaterialEMR,
    rejectExtraMaterialEMR
} from "../../controllers/shopfloor/shopFloorEMRController.js";
import {
    startSampleCycle,
    completeSampleCycle,
    submitSampleForApproval,
    processSampleAction,
    getSalesSampleQueue,
    startPrimaryCycle,
    getProcessFlow,
    updateSessionState,
    confirmCompletionPopup,
    authorizeWriteOff,
    getRejectedMaterials,
    updateDisposalStatus,
    updateResoldStatus,
    createRejectedMaterialDisposal,
    sendSampleApprovalEmail
} from "../../controllers/shopfloor/shopFloorProcessFlowController.js";
import upload from "../../middleware/multer.js";

import { requireSignIn } from "../../middleware/authMiddleware.js";
import {
    createRequisition,
    getRequisitionsList,
    updateRequisitionStatus
} from "../../controllers/shopfloor/shopFloorRequisitionController.js";
import { getShopFloorInventory, getShopFloorInventoryItem } from "../../controllers/shopfloor/shopFloorInventoryController.js";

const router = express.Router();

// Public: Outsource confirmation endpoints (unauthenticated)
router.get("/outsource/vendor-view/:token", getVendorOutsourceView);
router.post("/outsource/vendor-response/:token", submitVendorOutsourceResponse);

router.get("/jobs", requireSignIn, getShopFloorJobs);
router.post("/outsource/upload-invoice", requireSignIn, upload.single("invoice_file"), uploadOutsourceInvoice);
router.get("/jobs/:id", requireSignIn, getShopFloorJobById);
router.put("/jobs/:id/status", requireSignIn, updateProcessStatus);
router.put("/jobs/:id/clear-flags", requireSignIn, clearShopFloorFlags);
router.post("/jobs/:id/escalate", requireSignIn, escalateShopFloorJob);
router.post("/jobs/:id/de-escalate", requireSignIn, deEscalateShopFloorJob);
// router.put("/jobs/:id/hold", requireSignIn, holdUnholdShopFloorJob);
router.post("/jobs/:id/inward", requireSignIn, recordMaterialInward);
router.get("/inward-logs", requireSignIn, getShopFloorInwardLogs);
router.post("/sync", requireSignIn, syncShopFloorJobs);
router.post("/jobs/:id/log-activity", requireSignIn, logShopFloorActivity);

// Process Flow Routes
router.get("/process-flow/:shopfloor_job_id/:group_id", requireSignIn, getProcessFlow);
router.post("/process-flow/start-sample", requireSignIn, startSampleCycle);
router.post("/process-flow/complete-sample", requireSignIn, completeSampleCycle);
router.post("/process-flow/submit-approval", requireSignIn, upload.single('sample_image'), submitSampleForApproval);
router.post("/process-flow/process-action", requireSignIn, processSampleAction);
router.get("/process-flow/sales-sample-queue", requireSignIn, getSalesSampleQueue);
router.post("/process-flow/send-sample-email", requireSignIn, sendSampleApprovalEmail);
router.post("/process-flow/start-primary", requireSignIn, startPrimaryCycle);
router.put("/process-flow/sync-session", requireSignIn, updateSessionState);
router.post("/process-flow/confirm-completion-popup", requireSignIn, confirmCompletionPopup);
router.post("/process-flow/authorize-write-off", requireSignIn, authorizeWriteOff);

// Rejected Materials Routes
router.get("/rejected-materials", requireSignIn, getRejectedMaterials);
router.put("/rejected-materials/:id/dispose", requireSignIn, updateDisposalStatus);
router.put("/rejected-materials/:id/resold", requireSignIn, updateResoldStatus);
router.post("/rejected-materials/disposal", requireSignIn, createRejectedMaterialDisposal);


// Ready Jobs Routes
router.post("/ready-jobs", requireSignIn, createReadyJob);
router.get("/ready-jobs", requireSignIn, getReadyJobs);
router.put("/ready-jobs/:id/handover", requireSignIn, confirmHandover);

// Extra Material EMR Routes
router.post("/emr", requireSignIn, submitExtraMaterialEMR);
router.get("/emr/list", requireSignIn, getExtraMaterialEMRList);
router.post("/emr/:id/receive", requireSignIn, confirmEMRReceipt);
router.post("/emr/:id/approve", requireSignIn, approveExtraMaterialEMR);
router.post("/emr/:id/reject", requireSignIn, rejectExtraMaterialEMR);
// Material Returns
router.post("/material-returns", requireSignIn, createMaterialReturn);
router.get("/material-returns", requireSignIn, getMaterialReturns);

// Material Requisitions
router.post("/requisitions", requireSignIn, createRequisition);
router.get("/requisitions", requireSignIn, getRequisitionsList);
router.put("/requisitions/:id/status", requireSignIn, updateRequisitionStatus);

// Shop Floor Inventory
router.get("/inventory", requireSignIn, getShopFloorInventory);
router.get("/inventory/:id", requireSignIn, getShopFloorInventoryItem);

export default router;

