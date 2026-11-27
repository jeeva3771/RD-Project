import express from "express";
import {
  getTaxList,
  getTaxById,
  createTax,
  updateTax,
  deleteTax,
} from "../../controllers/masters/taxMasterController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Tax Master Routes
 * Base: /taxmaster or /taxmaster
 */
router.get("/", requireSignIn, getTaxList);
router.post("/", requireSignIn, createTax);
router.get("/:id", requireSignIn, getTaxById);
router.put("/:id", requireSignIn, updateTax);
router.delete("/:id", requireSignIn, deleteTax);

export default router;
