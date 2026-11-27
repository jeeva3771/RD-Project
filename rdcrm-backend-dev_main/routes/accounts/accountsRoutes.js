import express from "express";
import {
  getClientOutstanding,
  getSalesOrdersForAccounts,
  recordClientPayment,
  getPaymentHistory,
  getSignedAttachment,
  sendWhatsAppPaymentReminder,
  sendEmailPaymentReminder,
  getVendorOutstanding,
  recordVendorPayment,
  getVendorPaymentHistory,
  getAllInvoicesForAccounts,
  createInvoiceForAccounts,
  createAccountsChallan,
  uploadAccountsChallan,
  getAllDeliveryChallansForAccounts,
  uploadAccountsEway,
  getAllEwayBillsForAccounts,
  deleteEwayBillForAccounts,
  getGstTdsSummary,
  getAuditSummary,
  getPLSummary,
} from "../../controllers/accounts/accountsController.js";
import { getGeneralAccountSummary } from "../../controllers/accounts/generalAccountController.js";
import {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankTransactions,
} from "../../controllers/accounts/bankMasterController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";
import {
  getStockLedgerSummary,
  recordStockInwardOrAdjustment,
  seedInitialStockLedger
} from "../../controllers/inventory/stockLedgerController.js";
import { getBomAnalysis } from "../../controllers/accounts/bomAnalysisController.js";
import {
  getVendorBills,
  payVendorBill,
  getPayablesBoardData,
  updateVendorBillStage,
  toggleChallanMatch,
  scheduleVendorBill,
} from "../../controllers/accounts/vendorBillController.js";
import {
  getCollectionsBoardData,
  getCollectionsReceiptsLedger,
  updateCaseStage,
  addCaseHistory,
  scheduleCaseFollowUp,
  recordClientReceipt,
  reconcileUnallocatedPayment,
  updateCaseOwner,
  recordCasePromise,
  getClientUnallocatedReceipts,
} from "../../controllers/accounts/collectionBoardController.js";

const router = express.Router();

// --- CLIENT COLLECTIONS COMMAND CENTER ---
router.get("/collections/board", requireSignIn, getCollectionsBoardData);
router.get("/collections/receipts", requireSignIn, getCollectionsReceiptsLedger);
router.patch("/collections/case/:id/stage", requireSignIn, updateCaseStage);
router.patch("/collections/case/:id/owner", requireSignIn, updateCaseOwner);
router.post("/collections/case/:id/history", requireSignIn, addCaseHistory);
router.patch("/collections/case/:id/follow-up", requireSignIn, scheduleCaseFollowUp);
router.patch("/collections/case/:id/promise", requireSignIn, recordCasePromise);
router.post("/collections/record-receipt", requireSignIn, upload.any(), recordClientReceipt);
router.post("/collections/reconcile", requireSignIn, reconcileUnallocatedPayment);
router.get("/collections/unallocated-receipts", requireSignIn, getClientUnallocatedReceipts);
router.get("/unallocated-receipts", requireSignIn, getClientUnallocatedReceipts);

// --- VENDOR BILLS & PAYABLES COMMAND CENTER ---
router.get("/payables-board", requireSignIn, getPayablesBoardData);
router.patch("/vendor-bills/:id/stage", requireSignIn, updateVendorBillStage);
router.patch("/vendor-bills/:id/challan-match", requireSignIn, toggleChallanMatch);
router.patch("/vendor-bills/:id/schedule", requireSignIn, scheduleVendorBill);
router.get("/vendor-bills", requireSignIn, getVendorBills);
router.post("/vendor-bills/:id/pay", requireSignIn, upload.any(), payVendorBill);


router.get("/bom-analysis", requireSignIn, getBomAnalysis);

/**
 * Route to generate a new tax invoice directly from accounts console
 */
router.post("/create-invoice", requireSignIn, createInvoiceForAccounts);

/**
 * Route to generate a new delivery challan directly from accounts console (with optional file upload)
 */
router.post("/create-challan", requireSignIn, upload.any(), createAccountsChallan);

/**
 * Route to upload/attach document directly to Delivery Challan collection
 */
router.post("/upload-challan", requireSignIn, upload.any(), uploadAccountsChallan);

/**
 * Route to get all delivery challans across all sub-jobs from dedicated collection
 */
router.get("/all-challans", requireSignIn, getAllDeliveryChallansForAccounts);
router.get("/delivery-challans", requireSignIn, getAllDeliveryChallansForAccounts);

/**
 * Routes to upload, fetch, and delete E-Way Bill documents (supports multi-file uploads)
 */
router.post("/upload-eway", requireSignIn, upload.any(), uploadAccountsEway);
router.get("/all-eways", requireSignIn, getAllEwayBillsForAccounts);
router.get("/eway-bills", requireSignIn, getAllEwayBillsForAccounts);
router.delete("/eway/:id", requireSignIn, deleteEwayBillForAccounts);

/**
 * Route to get all invoice PDFs across all sub-jobs
 */
router.get("/all-invoices", requireSignIn, getAllInvoicesForAccounts);

/**
 * Route to get client outstanding amount calculated from quotation grand totals
 * Client name is taken from Enquiry only
 */
router.get("/client-outstanding", requireSignIn, getClientOutstanding);

/**
 * Route to get all sales orders / sub-jobs with Production/Sample and Amount/Total+GST
 */
router.get("/sales-orders", requireSignIn, getSalesOrdersForAccounts);

/**
 * Route to record payment for a sub-job (with optional multi-file attachments)
 */
router.post("/record-payment", requireSignIn, upload.any(), recordClientPayment);

/**
 * Route to send WhatsApp payment reminder via 2Factor template
 */
router.post("/send-whatsapp-reminder", requireSignIn, sendWhatsAppPaymentReminder);
router.post("/collections/send-whatsapp-reminder", requireSignIn, sendWhatsAppPaymentReminder);

/**
 * Route to send Email payment reminder via Nodemailer
 */
router.post("/send-email-reminder", requireSignIn, sendEmailPaymentReminder);
router.post("/collections/send-email-reminder", requireSignIn, sendEmailPaymentReminder);

/**
 * Route to get payment history
 */
router.get("/payments", requireSignIn, getPaymentHistory);
router.get("/payments/:subJobNo", requireSignIn, getPaymentHistory);

/**
 * Route to get signed URL for any receipt attachment
 */
router.get("/signed-url", requireSignIn, getSignedAttachment);

/**
 * Routes for Outsource Vendors Ledger & Outstanding
 */
router.get("/vendor-outstanding", requireSignIn, getVendorOutstanding);
router.post("/record-vendor-payment", requireSignIn, upload.any(), recordVendorPayment);
router.get("/vendor-payments", requireSignIn, getVendorPaymentHistory);
router.get("/vendor-payments/:vendorId", requireSignIn, getVendorPaymentHistory);

/**
 * Analytics & Compliance Routes
 */
router.get("/gst-tds-summary", requireSignIn, getGstTdsSummary);
router.get("/audit-summary", requireSignIn, getAuditSummary);
router.get("/pl-summary", requireSignIn, getPLSummary);
router.get("/general-account-summary", requireSignIn, getGeneralAccountSummary);

router.get("/stock-summary", requireSignIn, getStockLedgerSummary);
router.post("/stock-inward", requireSignIn, recordStockInwardOrAdjustment);
router.post("/stock-ledger/seed", requireSignIn, seedInitialStockLedger);
/**
 * Bank Master — CRUD for company bank accounts
 * Balance is computed live from bank_transactions (never stored)
 */
router.get("/bank-master", requireSignIn, getBankAccounts);
router.post("/bank-master", requireSignIn, createBankAccount);
router.get("/bank-master/:id", requireSignIn, getBankAccountById);
router.put("/bank-master/:id", requireSignIn, updateBankAccount);
router.delete("/bank-master/:id", requireSignIn, deleteBankAccount);
router.get("/bank-master/:id/transactions", requireSignIn, getBankTransactions);

export default router;
