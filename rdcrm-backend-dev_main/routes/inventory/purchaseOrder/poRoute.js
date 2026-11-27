import express from "express";
import { requireSignIn } from "../../../middleware/authMiddleware.js";
import {
  getAllPO,
  createPO,
  shareVendorPO,
  vendorAction,
  // listGRNs,
} from "../../../controllers/inventory/purchaseOrder/poController.js";

const router = express.Router();

router.get("/", requireSignIn, getAllPO);
router.post("/", requireSignIn, createPO);
router.patch("/:poId/share/:subVendorId", requireSignIn, shareVendorPO);
router.patch("/:poId/vendor-action/:subVendorId", requireSignIn, vendorAction); // vendor-facing
// router.get("/grn", requireSignIn, listGRNs);

export default router;
