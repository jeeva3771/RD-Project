import express from "express";
import {
  getAllCombinedParameters,
  getCombinedParameterById,
  createCombinedParameter,
  updateCombinedParameter,
  deleteCombinedParameter,
} from "../../../controllers/common/Process/combinedParameterController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllCombinedParameters);
router.get("/:id", requireSignIn, getCombinedParameterById);
router.post("/", requireSignIn, createCombinedParameter);
router.put("/:id", requireSignIn, updateCombinedParameter);
router.delete("/:id", requireSignIn, deleteCombinedParameter);

export default router;
