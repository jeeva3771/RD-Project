import express from "express";
import originMasterController from "../../controllers/masters/enquiryFlow/originMasterController.js";
import constructionMasterController from "../../controllers/masters/enquiryFlow/constructionMasterController.js";
import elementMasterController from "../../controllers/masters/enquiryFlow/elementMasterController.js";
import trophyMaterialController from "../../controllers/masters/enquiryFlow/trophyMaterialController.js";
import occasionMasterController from "../../controllers/masters/enquiryFlow/occasionMasterController.js";
import occasionGroupMasterController from "../../controllers/masters/enquiryFlow/occasionGroupMasterController.js";
import trophyTypeMasterController from "../../controllers/masters/enquiryFlow/trophyTypeMasterController.js";
import deliveryScopeMasterController from "../../controllers/masters/enquiryFlow/deliveryScopeMasterController.js";
import readyTrophyMasterController from "../../controllers/masters/enquiryFlow/readyTrophyMasterController.js";
import personalisationMasterController from "../../controllers/masters/enquiryFlow/personalisationMasterController.js";
import packagingMasterController from "../../controllers/masters/enquiryFlow/packagingMasterController.js";
import carrierMasterController from "../../controllers/masters/enquiryFlow/carrierMasterController.js";
import productConfigMasterController from "../../controllers/masters/enquiryFlow/productConfigMasterController.js";
import platingFinishMasterController from "../../controllers/masters/enquiryFlow/platingFinishMasterController.js";
import processMasterController from "../../controllers/masters/enquiryFlow/processMasterController.js";
import attachmentMasterController from "../../controllers/masters/enquiryFlow/attachmentMasterController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

const bindCRUD = (prefix, controller) => {
  router.get(`/${prefix}/active`, requireSignIn, controller.getActive);
  router.get(`/${prefix}`, requireSignIn, controller.getAll);
  router.get(`/${prefix}/:id`, requireSignIn, controller.getById);
  router.post(`/${prefix}`, requireSignIn, controller.create);
  router.put(`/${prefix}/:id`, requireSignIn, controller.update);
  router.delete(`/${prefix}/:id`, requireSignIn, controller.deleteItem);
};

// Bind Master endpoints
bindCRUD("origin", originMasterController);
bindCRUD("construction", constructionMasterController);
router.post("/element/seed-default", requireSignIn, elementMasterController.seedDefault);
bindCRUD("element", elementMasterController);
router.post("/trophy-material/seed-default", requireSignIn, trophyMaterialController.seedDefault);
bindCRUD("trophy-material", trophyMaterialController);
bindCRUD("occasion", occasionMasterController);
bindCRUD("occasion-group", occasionGroupMasterController);
bindCRUD("trophy-type", trophyTypeMasterController);
bindCRUD("delivery-scope", deliveryScopeMasterController);
bindCRUD("ready-trophy", readyTrophyMasterController);
bindCRUD("personalisation-option", personalisationMasterController);
bindCRUD("packaging-option", packagingMasterController);
router.post("/carrier/reset-standard", requireSignIn, carrierMasterController.resetToStandard);
bindCRUD("carrier", carrierMasterController);

// Dynamic Product Config & Specs Masters
router.post("/product-config/reset-defaults", requireSignIn, productConfigMasterController.resetToDefaults);
router.get("/product-config/product/:productId", requireSignIn, productConfigMasterController.getByProductId);
bindCRUD("product-config", productConfigMasterController);
bindCRUD("plating-finish", platingFinishMasterController);
bindCRUD("process", processMasterController);
bindCRUD("attachment", attachmentMasterController);

export default router;
