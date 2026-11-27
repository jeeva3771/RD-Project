import express from "express";
import {
  getAllPrimaryParameters,
  getPrimaryParameterById,
  createPrimaryParameter,
  updatePrimaryParameter,
  deletePrimaryParameter,
} from "../../../controllers/common/Process/primaryParameterController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllPrimaryParameters);
router.get("/:id", requireSignIn, getPrimaryParameterById);
router.post("/", requireSignIn, createPrimaryParameter);
router.put("/:id", requireSignIn, updatePrimaryParameter);
router.delete("/:id", requireSignIn, deletePrimaryParameter);

export default router;
