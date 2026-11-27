import express from "express";
import {
  getAllSampleSalesOrders,
  getSampleSalesOrderById,
  createSampleSalesOrder,
  updateSampleSalesOrder,
  deleteSampleSalesOrder,
  getSampleSalesOrderandlistById,
  sendSalesOrderEmailById,
  sendSalesOrderWhatsAppShare
} from "../../controllers/salesOrder/salesOrderformController.js";

import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

router.get("/", requireSignIn, getAllSampleSalesOrders);
router.get("/:id", requireSignIn, getSampleSalesOrderById);
router.post("/", requireSignIn, createSampleSalesOrder);
router.put(
  "/:id",
  requireSignIn,
  upload.array("product_files"),
  updateSampleSalesOrder
);
router.delete("/:id", requireSignIn, deleteSampleSalesOrder);

router.get("/sso/:ssoid", requireSignIn, getSampleSalesOrderandlistById);

router.get("/mail/:id", requireSignIn, sendSalesOrderEmailById);
router.post("/send-whatsapp", requireSignIn, sendSalesOrderWhatsAppShare);

export default router;
