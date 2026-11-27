import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import {
  createWork,
  getAllWorks,
  getWorkById,
  updateWork,
  deleteWork,
} from "../../controllers/masters/workController.js";

const router = express.Router();

router.post("/create", requireSignIn, createWork);
router.get("/get", requireSignIn, getAllWorks);
router.get("/get/:id", requireSignIn, getWorkById);
router.put("/update/:id", requireSignIn, updateWork);
router.delete("/delete/:id", requireSignIn, deleteWork);

export default router;
