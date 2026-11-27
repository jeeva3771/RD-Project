import express from "express";
import {
  getAllEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
  getDesignerSummary,
  sendDesignEmailById,
  updateenquiryimageApprovalforclient,
  getEnquiryByIdforclient,
  sendEnquiryWhatsAppShare,
  getUniqueClients,
  getUniqueProducts,
  getEnquiryCountsByUser,
  getEnquiryKPIStats,
} from "../../controllers/enquiry/enquiryController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

router.post("/send-enquiry-template", sendEnquiryWhatsAppShare);



router.get("/designersummary", requireSignIn, getDesignerSummary);
router.get("/mail/:id", sendDesignEmailById);

router.put("/clientaccess/:id",
  upload.fields([
    { name: "images", maxCount: 1000 },
    { name: "attachments", maxCount: 1000 },
    { name: "additional_files", maxCount: 1000 },
    { name: "rejection_reference_file", maxCount: 1 },
  ]), updateenquiryimageApprovalforclient);

router.get("/clientaccess/:id", getEnquiryByIdforclient);


router.get("/clients", requireSignIn, getUniqueClients);
router.get("/products", requireSignIn, getUniqueProducts);
router.get("/user-counts", requireSignIn, getEnquiryCountsByUser);
router.get("/kpi-stats", requireSignIn, getEnquiryKPIStats);

router.get("/", requireSignIn, getAllEnquiries);
router.get("/:id", requireSignIn, getEnquiryById);
// router.post("/", requireSignIn, upload.array("images"), createEnquiry);
router.post(
  "/",
  requireSignIn,
  upload.fields([
    { name: "images", maxCount: 1000 },
    { name: "attachments", maxCount: 1000 },
    { name: "client_design_files", maxCount: 1000 },

  ]),
  createEnquiry
);

// router.put("/:id", requireSignIn, upload.array("images"), updateEnquiry);
router.put("/:id", requireSignIn,
  upload.fields([
    { name: "images", maxCount: 1000 },
    { name: "attachments", maxCount: 1000 },
    { name: "additional_files", maxCount: 1000 },


  ]), updateEnquiry);

router.delete("/:id", requireSignIn, deleteEnquiry);

export default router;

