import express from "express";
import { requireSignIn } from "../../../middleware/authMiddleware.js";
import {
  createGRN,
  getAllGRNs,
  getGRNById,
} from "../../../controllers/inventory/grn/grnController.js";

const router = express.Router();

// Create new GRN
router.post("/", requireSignIn, createGRN);

// Get paginated list
router.get("/", requireSignIn, getAllGRNs);

// Get single GRN by ID or number
router.get("/:id", requireSignIn, getGRNById);

export default router;
