import express from "express";
import { requireSignIn } from "../../../middleware/authMiddleware.js";
import {
  createInward,
  getAllInwards,
  getInwardById,
} from "../../../controllers/inventory/stockInward/StockInwardController.js";

const router = express.Router();

router.post("/", requireSignIn, createInward);
router.get("/", requireSignIn, getAllInwards);
router.get("/:id", requireSignIn, getInwardById);

export default router;
