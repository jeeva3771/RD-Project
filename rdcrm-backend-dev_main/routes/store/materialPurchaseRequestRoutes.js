import express from "express";
import {
    createMaterialPurchaseRequest,
    getAllMaterialPurchaseRequests,
    approveMaterialPurchaseRequest,
    rejectMaterialPurchaseRequest,
    updateMaterialPurchaseRequest
} from "../../controllers/store/materialPurchaseRequestController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(requireSignIn);

router.post("/", createMaterialPurchaseRequest);
router.get("/", getAllMaterialPurchaseRequests);
router.put("/approve/:requestId", approveMaterialPurchaseRequest);
router.put("/reject/:requestId", rejectMaterialPurchaseRequest);
router.put("/:requestId", updateMaterialPurchaseRequest);

export default router;
