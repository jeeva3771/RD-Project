import express from "express";
import {
  getAllPremiumPackingTypes,
  getPremiumPackingTypeById,
  createPremiumPackingType,
  updatePremiumPackingType,
  deletePremiumPackingType
} from "../../../controllers/common/premiumPackingTypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllPremiumPackingTypes);
router.get("/:id", requireSignIn, getPremiumPackingTypeById);
router.post("/", requireSignIn, createPremiumPackingType);
router.put("/:id", requireSignIn, updatePremiumPackingType);
router.delete("/:id", requireSignIn, deletePremiumPackingType);

export default router;