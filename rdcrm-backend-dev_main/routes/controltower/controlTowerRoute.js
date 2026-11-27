import express from "express";
import {
  getAllControlTowerDepts,
  getControlTowerDeptById,
  createControlTowerDept,
  updateControlTowerDept,
  deleteControlTowerDept,
} from "../../controllers/controltower/controlTowerController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllControlTowerDepts);
router.get("/:id", requireSignIn, getControlTowerDeptById);
router.post("/", requireSignIn, createControlTowerDept);
router.put("/:id", requireSignIn, updateControlTowerDept);
router.delete("/:id", requireSignIn, deleteControlTowerDept);

export default router;
