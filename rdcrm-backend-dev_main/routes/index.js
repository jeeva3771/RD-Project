import express from "express";
import AuthRoute from "./auth/authRoute.js";
import UserRoute from "./users/userRoute.js";
import ProcessRoute from "./masters/processRoutes.js";
import DepartmentRoute from "./masters/departmentRoute.js";
import MachineRoute from "./masters/machineRoutes.js";
import RoleRoute from "./masters/roleRoutes.js";
import ShiftTimeRoute from "./masters/shiftTimeRoute.js";
import WorkRoute from "./masters/workRoute.js";
import CompanyRoute from "./masters/companyRoute.js";
import TaxMasterRoute from "./masters/taxMasterRoute.js";
import R2Route from "./R2/r2route.js";
import CourierRoute from "./common/courier/courierRoutes.js";
import PaymentRoute from "./common/paymentterms/paymentTermsRoutes.js";
import DeliveryTypeRoute from "./common/deliverytype/deliveryTypeRoutes.js";
import CustomersRoute from "./masters/customerRoute.js";
import ServiceCategoryRoute from "./common/servicecategory/serviceCategoryRoute.js";
import ContractTypeRoute from "./common/contracttype/contractTypeRoute.js";
import VendorRoute from "./masters/vendorRoute.js";
import OutsourceVendorRoute from "./masters/outsourceVendorRoute.js";
import PackingTypeRoute from "./common/packingtype/packingTypeRoute.js";
import PackingModeRoute from "./common/packingmode/packingModeRoute.js";
import InnerPackingTypeRoute from "./common/innerpackingtype/innerPackingTypeRoute.js";
import PremiumPackingTypeRoute from "./common/premiumpackingtype/premiumPackingTypeRoute.js";
import PriorityClr from "./common/priorityClr/priorityClrRoute.js";

import EnquiryRoute from "./enquiry/enquiryRoute.js";
import DeliveryModeRoute from "./common/delivery_mode/delivery_modeRoute.js";
import EnquiryCategoryRoute from "./masters/enquiryCategoryRoutes.js";
import EnquirySubCategoryRoutes from "./masters/enquirySubCategoryRoutes.js";
// newjob_flow change: Imported route for Standalone Enquiry Job Flow
import EnquiryFlowRoute from "./enquiry/enquiryFlowRoute.js";
import EnquiryFlowIntegrationRoute from "./enquiry/enquiryFlowIntegrationRoute.js";
import EnquiryFlowMastersRoute from "./masters/enquiryFlowMastersRoute.js";

// common (inventory)
import MaterialType from "./inventory/common/materialTypeRoute.js";
import MaterialCategory from "./inventory/common/materialCategoryRoute.js";
import MaterialUnit from "./inventory/common/materialUnitRoute.js";
import StockSize from "./inventory/common/stockSizeRoute.js";
import RateUnit from "./inventory/common/rateUnitRoute.js";

// inventory
import Item from "./inventory/item/itemRoute.js";
import CustomItem from "./inventory/item/customItemRoute.js";
import PurchaseOrder from "./inventory/purchaseOrder/poRoute.js";
import GRN from "./inventory/grn/grnRoute.js";
import StockInward from "./inventory/inward/inwardRoute.js";
import RegisterRoutes from "./shopfloor/registerRoutes.js";

import Whowillpay from "./common/who_will_pay/whowillpayRoute.js";
import ProcessColumnRoute from "./masters/processColumnRoutes.js";
import UnitsRoute from "./masters/unitsRoute.js";

import RateTypeRoute from "./common/process/ratetypeRoutes.js";
import primaryParameterRoute from "./common/process/primaryParameterRoutes.js";
import secondaryParameterRoute from "./common/process/secondaryParameterRoutes.js";
import tertiaryParameterRoute from "./common/process/tertiaryParameterRoutes.js";
import combinedParameterRoute from "./common/process/combinedParameterRoutes.js";
import RateCardRoute from "./masters/rateCardRoute.js";

import salesorderlistRoute from "./salesOrder/sales_orderlistRoute.js";

import salesorderformRoute from "./salesOrder/SalesOrderformRoutes.js";

import BomRoute from "./bom/bomRoute.js";
import StandaloneBomRoute from "./standaloneBom/standalone_bomRoute.js";

import TeamRoutes from "./teams/teamRoutes.js";
import ShiftRoutes from "./teams/shiftAssignRoutes.js";
import DTPStudioRoutes from "./dtp_studio/dtpStudioRoutes.js";
import RFQRoute from "./rfq/rfqRoutes.js";
import MaterialIssueRoutes from "./store/materialIssueRoutes.js";
import MaterialPurchaseRequestRoutes from "./store/materialPurchaseRequestRoutes.js";
import AssemblyTeamRoutes from "./teams/assemblyTeamRoutes.js";
import ShopFloorRoute from "./shopfloor/shopFloorRoute.js";
import ControlTowerRoute from "./controltower/controlTowerRoute.js";
import FgStoreRoute from "./controltower/fgStoreRoutes.js";
import CtQcRoute from "./controltower/ctQcRoutes.js";
import CtPackRoute from "./controltower/ctPackRoutes.js";
import JobLedgerRoutes from "./controltower/jobLedgerRoutes.js";
import AccountsRoute from "./accounts/accountsRoutes.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Authentication and Authorization APIs
 *   - name: Users
 *     description: User Management APIs
 *   - name: Process
 *     description: Process Management APIs
 *   - name: Department
 *     description: Department Management APIs
 *   - name: Machine
 *     description: Machine Management APIs
 *   - name: Role
 *     description: Role Management APIs
 *   - name: Customer
 *     description: Customer Management APIs
 *   - name: Vendor
 *     description: Vendor Management APIs
 *   - name: Units
 *     description: Unit Management APIs
 *   - name: Enquiry Category
 *     description: Enquiry Category Management APIs
 *   - name: Enquiry SubCategory
 *     description: Enquiry Sub Category Management APIs
 *   - name: Enquiry
 *     description: Enquiry Management APIs
 *   - name: Courier
 *     description: Courier Service Management APIs
 *   - name: Payment Terms
 *     description: Payment Terms Management APIs
 *   - name: Delivery Type
 *     description: Delivery Type Management APIs
 *   - name: Delivery Mode
 *     description: Delivery Mode Management APIs
 *   - name: Service Category
 *     description: Service Category Management APIs
 *   - name: Contract Type
 *     description: Contract Type Management APIs
 *   - name: Packing Type
 *     description: Packing Type Management APIs
 *   - name: Priority
 *     description: Priority Color Management APIs
 *   - name: Process Parameters
 *     description: Process Parameter Configuration APIs
 *   - name: Rate Card
 *     description: Rate Card Management APIs
 *   - name: Inventory - Common
 *     description: Inventory Common Configuration APIs
 *   - name: Inventory - Items
 *     description: Item Management APIs
 *   - name: Inventory - Purchase Order
 *     description: Purchase Order Management APIs
 *   - name: Inventory - GRN
 *     description: Goods Receipt Note Management APIs
 *   - name: Inventory - Stock
 *     description: Stock Inward Management APIs
 *   - name: Sample Order
 *     description: Sample Order Management APIs
 *   - name: BOM
 *     description: Bill of Materials Management APIs
 *   - name: Media
 *     description: Image and File Management APIs
 *   - name: Store Module
 *     description: Material Issue and Store Workflow APIs
 */


// Authentication
router.use("/auth", AuthRoute);

// Users
router.use("/user", UserRoute);

// Masters
router.use("/process", ProcessRoute);
router.use("/department", DepartmentRoute);
router.use("/machine", MachineRoute);
router.use("/role", RoleRoute);
router.use("/customer", CustomersRoute);
router.use("/vendor", VendorRoute);
router.use("/outsourcevendor", OutsourceVendorRoute);
router.use("/enquirycategory", EnquiryCategoryRoute);
router.use("/enquirysubcategory", EnquirySubCategoryRoutes);
router.use("/processcolumn", ProcessColumnRoute);
router.use("/units", UnitsRoute);
router.use("/ratecard", RateCardRoute);
router.use("/shifttime", ShiftTimeRoute);
router.use("/work", WorkRoute);
router.use("/company", CompanyRoute);
router.use("/enquiry-masters", EnquiryFlowMastersRoute);
router.use("/taxmaster", TaxMasterRoute);

//saleorder uncomment it when we add sales order
// router.use("/salesorder", SalesOrderRoute);

// Media
router.use("/image", R2Route);

// Common - Delivery & Shipping
router.use("/courier", CourierRoute);
router.use("/deliverytype", DeliveryTypeRoute);
router.use("/deliverymode", DeliveryModeRoute);

// Common - Payment & Financial
router.use("/payment", PaymentRoute);
router.use("/whowillpay", Whowillpay);

// Common - Service & Contract
router.use("/servicecategory", ServiceCategoryRoute);
router.use("/contracttype", ContractTypeRoute);

// Common - Packing
router.use("/packingtype", PackingTypeRoute);
router.use("/packingmode", PackingModeRoute);
router.use("/innerpackingtype", InnerPackingTypeRoute);
router.use("/premiumpackingtype", PremiumPackingTypeRoute);

// Common - Priority
router.use("/priorityclr", PriorityClr);

// Enquiry
router.use("/enquiry", EnquiryRoute);
// newjob_flow change: Included route for Standalone Enquiry Job Flow
router.use("/enquiry-flow", EnquiryFlowRoute);
router.use("/enquiry-flow-integration", EnquiryFlowIntegrationRoute);

// Process Parameters
router.use("/ratetype", RateTypeRoute);
router.use("/primaryparameter", primaryParameterRoute);
router.use("/secondaryparameter", secondaryParameterRoute);
router.use("/tertiaryparameter", tertiaryParameterRoute);
router.use("/combinedparameter", combinedParameterRoute);

// Inventory - Common
router.use("/materialtype", MaterialType);
router.use("/materialcategory", MaterialCategory);
router.use("/materialunit", MaterialUnit);
router.use("/stocksizes", StockSize);
router.use("/rateunit", RateUnit);

// Inventory - Operations
router.use("/item", Item);
router.use("/custom-item", CustomItem);
import ClientServicingHubRoutes from "./controltower/clientServicingHubRoutes.js";

router.use("/po", PurchaseOrder);
router.use("/inward", StockInward);
router.use("/grn", GRN);
router.use("/inventory-registers", RegisterRoutes);

// sales Orders
router.use("/sampleorderlist", salesorderlistRoute);
router.use("/samplesalesorder", salesorderformRoute);

router.use("/bom", BomRoute);

router.use("/standalone-bom", StandaloneBomRoute);

router.use("/teams", TeamRoutes);
router.use('/shift-roster', ShiftRoutes);
router.use('/dtp-studio', DTPStudioRoutes);
router.use('/rfq', RFQRoute);
router.use('/store-issue', MaterialIssueRoutes);
router.use('/store/material-purchase-request', MaterialPurchaseRequestRoutes);
router.use('/assembly-job', AssemblyTeamRoutes);
router.use('/shop-floor', ShopFloorRoute);
router.use('/controltower', ControlTowerRoute);
router.use('/fg-store', FgStoreRoute);
router.use('/ct-qc', CtQcRoute);
router.use('/ct-pack', CtPackRoute);
router.use('/job-ledger', JobLedgerRoutes);
router.use('/client-servicing-hub', ClientServicingHubRoutes);
router.use('/accounts', AccountsRoute);

export default router;
