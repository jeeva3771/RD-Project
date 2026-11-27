import express from "express";
import {
    deletewillpaydataCategory,
  getAllwillpaydataCategories,
  getwillpaydataCategoryById,
  insertwillpaydataCategory,
  updatewillpaydataCategory,
} from "../../../controllers/common/whowillpayController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllwillpaydataCategories);
router.get("/:id", requireSignIn, getwillpaydataCategoryById);
router.post("/", requireSignIn, insertwillpaydataCategory);
router.put("/:id", requireSignIn, updatewillpaydataCategory);
router.delete("/:id", requireSignIn, deletewillpaydataCategory);

export default router;