import blockedMaterialModel from "../../models/inventory/blocked_materials/blockedMaterialModel.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import EnquiryJob from "../../models/enquiry/enquiryJobIntegrationModel.js";
import { uploadToR2, deleteFromR2, generateSignedUrl } from "../../helpers/r2helper.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import moment from "moment";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import { generateEmailTemplateForPI, generateEmailTemplateForQuoatation, generateEmailTemplateForDtp, transporter } from "../../helpers/mail.js";
import bomModel from "../../models/bom/bomModel.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import assemblyTeamModel from "../../models/teams/assemblyTeamModel.js";
import StoreMaterialIssue from "../../models/store/materialIssueModel.js";
import rfqModel from "../../models/rfq/rfqModel.js";
import { createStoreIssueFromDTPJob } from "../store/materialIssueController.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import { createShopFloorJobsFromSO } from "../shopfloor/shopFloorController.js";
import { triggerBOMRecalculationForPendingQty, approveBOMQtyUpdate, recalculateBOMForNewQty } from "../bom/bomController.js";
import { generateQuotationPDFBuffer } from "../bom/generateQuotationPDFBuffer.js";
import { generateJobSheetPDFBuffer } from "../bom/generateJobSheetPDFBuffer.js";
import fetch from "node-fetch";
// import jwt from "jsonwebtoken";
import userModel from "../../models/users/userModel.js";
import { getAuthUserFromReq } from "../../helpers/auth.js";
import CtPack from "../../models/controltower/ctPackModel.js";
// import FgStore from "../../models/controltower/fgStoreModel.js";

export const getAllSampleOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = req.query.status?.trim();
    const type = req.query.type?.trim();
    const userId = req.user?._id;
    const countOnly = req.query.countOnly === "true";
    const is_pushed_shop_floor = req.query.is_pushed_shop_floor;
    const createdById = req.query.createdById;
    const designerId = req.query.designerId;

    const is_client_design = req.query.is_client_design;

    const role = req.user?.role;
    const permission = req.user?.permission;
    const is_head = req.user?.is_head;

    const ProductionRole = role?.toLowerCase().includes("production");

    console.log("ProductionRole", ProductionRole)
    console.log("is_head", is_head)

    const query = {};
    if (search) {
      // Find matching enquiries first to support searching by client name / reference_no in sample orders
      const enquiryConditions = [
        { reference_no: { $regex: search, $options: "i" } },
        { referenceNo: { $regex: search, $options: "i" } },
        { reference_number: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { product_name: { $regex: search, $options: "i" } }
      ];

      if (!isNaN(search) && search.trim() !== "") {
        const searchNum = Number(search);
        enquiryConditions.push({ reference_no: searchNum });
        enquiryConditions.push({ referenceNo: searchNum });
        enquiryConditions.push({ reference_number: searchNum });
      }

      const matchingEnquiries = await enquiryModel.find({
        $or: enquiryConditions
      }).select('_id').lean();

      const enquiryIds = matchingEnquiries.map(e => e._id);

      console.log(`[SEARCH] term="${search}" | matching enquiries=${matchingEnquiries.length} | enquiryIds=`, enquiryIds);

      query.$or = [
        { job_no: { $regex: search, $options: "i" } },
        { sub_job_no: { $regex: search, $options: "i" } },
        { enquiry_id: { $in: enquiryIds } }
      ];
    }

    if (createdById) {
      query.created_by = createdById;
    }

    if (designerId) {
      query.designer_person = designerId;
    }

    if (!search) {
      if (is_pushed_shop_floor) {
        query.is_pushed_shop_floor = is_pushed_shop_floor === 'true';
      } else {
        query.is_verified_to_proceed = true;
      }
    } else {
      if (is_pushed_shop_floor) {
        query.is_pushed_shop_floor = is_pushed_shop_floor === 'true';
      }
    }

    if (status === "on_hold" || req.query.is_on_hold === "true" || req.query.is_on_hold === true) {
      query.is_on_hold = true;
      delete query.is_verified_to_proceed;
    }



    if (ProductionRole && !is_head) {
      console.log("check roleeeeeeeeeeeeee")
      query.production_team_person = userId
    }

    // Sales Coordinator / Client Servicing logic
    const userRoleLower = role?.toLowerCase() || "";
    if (userRoleLower.includes("client servicing executive") && !userRoleLower.includes("client servicing manager")) {
      const executiveEnquiries = await enquiryModel.find({
        $or: [
          { created_by: userId },
          { cordinator: userId }
        ]
      }).select("_id").lean();
      const enquiryIds = executiveEnquiries.map(e => e._id);
      query.$or = [
        { created_by: userId },
        { enquiry_id: { $in: enquiryIds } }
      ];
    } else if (userRoleLower.includes("client servicing manager") || userRoleLower.includes("admin executive")) {
      // Managers and Admins see all sample orders
    } else {
      if (role?.toLowerCase() !== "admin executive" && permission.includes(9)) {
        if (!is_head) {
          query.created_by = userId;
        }
      }
    }

    if (type) {
      query.type = type;
    }

    if (is_client_design !== undefined && is_client_design !== "") {
      const isClient = is_client_design === "true" || is_client_design === true;
      if (isClient) {
        query.is_client_design = true;
      } else {
        query.is_client_design = { $ne: true };
      }
    }





    console.log("status", status)


    // Apply status filters even during search so results remain within the active tab
    {
      if (
        status &&
        status !== "quotation_all" &&
        status !== "on_hold" &&
        status !== "approveddesigns" &&
        status !== "designserfilesupload" &&
        status !== "requestedaccountsfiles" &&
        status !== "approveddesignsaccounts" &&
        status !== "requestedquotaion" &&
        status !== "approvedquotation" &&
        status !== "reprocessedquotation" &&
        status !== "bomrework" &&
        status !== "newbom" &&
        status !== "completedandverified" &&
        status !== "bomdraft" &&
        status !== "jobinprogress" &&
        status !== "dispatch" &&
        status !== "complete" &&
        status !== "completed"
      ) {
        query.status = status;
      }

      if (status === "quotation_all") {
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
      }

      if (status === "newbom") {
        query.is_bom_filled = false;
        query.is_bom_rework = false;
        query.bom_id = null;
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
      }

      if (status === "bomdraft") {
        query.is_bom_filled = false;
        query.is_bom_rework = false;
        query.bom_id = { $ne: null };
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
      }

      if (status === "bomrework") {
        query.is_bom_rework = false;
        query.is_bom_filled = true;
        query.is_verified_to_proceed = false;
      }


      if (status === "designserfilesupload") {
        query.is_design_uploaded = false;
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
        query["designer_person"] = userId;
      }

      if (status === "requestedaccountsfiles") {
        // query.is_pi_uploaded = false; 
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;

        query.is_pi_verified = false;
        query.is_pi_rework = false;

        query.is_bom_verified = true;

        // Accounts Desk is a company-wide department: clear individual creator constraints
        delete query.created_by;
        if (query.$or && !search) {
          delete query.$or;
        }
      }

      if (status === "requestedquotaion") {
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
        query.is_design_uploaded = true;
        // query.is_bom_rework = false;
        // query.is_bom_verified = false;
      }

      if (status === "approvedquotation") {
        query.is_bom_filled = true;
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
        query.is_bom_verified = false;
        query.is_bom_rework = true;
      }

      if (status === "reprocessedquotation") {
        query.is_qty_pending_approval = true;
        query.is_sales_order_filled = true;
      }


      if (status === "completedandverified") {
        query.is_bom_filled = true;
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
        query.is_bom_verified = true;
        query.is_bom_rework = true;
      }

      if (status === "approveddesignsaccounts") {
        query.is_pi_uploaded = true;
        query.is_verified_to_proceed = false;
        query.is_sales_order_filled = true;
        query.is_pi_verified = false;
        query.is_pi_rework = true;

        delete query.created_by;
        if (query.$or && !search) {
          delete query.$or;
        }
      }

      if (status === "approveddesigns") {
        query.status = "pending";
        query.is_verified_to_proceed = false;
      }

      if (status === "dispatch" || status === "complete" || status === "completed") {
        const dispatchedPacks = await CtPack.find({
          is_on_hold: { $ne: true },
          $or: [
            { is_dispatched: true },
            { status: { $in: ['Dispatched', 'dispatched', 'Shipped', 'shipped', 'Packed', 'packed', 'Complete', 'complete', 'Done', 'done'] } },
            { stage: { $in: ['dispatched', 'shipped', 'dispatch', 'complete', 'completed', 'done', 'logistics'] } },
            { dispatchDt: { $exists: true, $ne: null } },
            {
              $and: [
                { total_qty: { $gt: 0 } },
                { $expr: { $gte: ["$deliveredQty", "$total_qty"] } }
              ]
            }
          ]
        }).distinct('sub_job_no');

        const dispatchedShopJobs = await shopFloorJobModel.find({
          is_hold: { $ne: true },
          $or: [
            { is_dispatched: true },
            { status: { $in: ['dispatched', 'shipped', 'completed', 'complete'] } },
            {
              $and: [
                { planned_qty: { $gt: 0 } },
                { $expr: { $gte: ["$delivered_qty", "$planned_qty"] } }
              ]
            }
          ]
        }).distinct('job_no');

        const allDispatchedNos = [...new Set([...dispatchedPacks, ...dispatchedShopJobs].filter(Boolean))];

        delete query.is_verified_to_proceed;
        query.$or = [
          { sub_job_no: { $in: allDispatchedNos } },
          { job_no: { $in: allDispatchedNos } },
          { status: { $in: ['dispatched', 'shipped', 'complete', 'completed'] } },
          { is_dispatched: true }
        ];
      }

      if (status === "jobinprogress" || status === "process") {
        const dispatchedPacks = await CtPack.find({
          is_on_hold: { $ne: true },
          $or: [
            { is_dispatched: true },
            { status: { $in: ['Dispatched', 'dispatched', 'Shipped', 'shipped', 'Packed', 'packed', 'Complete', 'complete', 'Done', 'done'] } },
            { stage: { $in: ['dispatched', 'shipped', 'dispatch', 'complete', 'completed', 'done', 'logistics'] } },
            { dispatchDt: { $exists: true, $ne: null } },
            {
              $and: [
                { total_qty: { $gt: 0 } },
                { $expr: { $gte: ["$deliveredQty", "$total_qty"] } }
              ]
            }
          ]
        }).distinct('sub_job_no');

        const dispatchedShopJobs = await shopFloorJobModel.find({
          is_hold: { $ne: true },
          $or: [
            { is_dispatched: true },
            { status: { $in: ['dispatched', 'shipped', 'completed', 'complete'] } },
            {
              $and: [
                { planned_qty: { $gt: 0 } },
                { $expr: { $gte: ["$delivered_qty", "$planned_qty"] } }
              ]
            }
          ]
        }).distinct('job_no');

        const allDispatchedNos = [...new Set([...dispatchedPacks, ...dispatchedShopJobs].filter(Boolean))];

        delete query.is_verified_to_proceed;
        query.is_on_hold = { $ne: true };
        query.$or = [
          { is_verified_to_proceed: true },
          { is_pushed_shop_floor: true }
        ];
        if (allDispatchedNos.length > 0) {
          query.sub_job_no = { $nin: allDispatchedNos };
          query.job_no = { $nin: allDispatchedNos };
        }
      }

    }



    console.log("MongoDB Query:", query);
    console.log("query.status", query.status)





    const total = await salesorderlistModel.countDocuments(query);

    if (countOnly) {
      return res.status(200).json({
        success: true,
        total,
      });
    }
    const orders = await salesorderlistModel
      .find(query)
      .populate("created_by", "name")
      .populate("updated_by.user", "name")
      .populate({
        path: "enquiry_id",
        select: "job_no name client_name product_name id reference_no marketing_cordinator created_by cordinator accepted_date_time created_at images email mobile_no wp_number product_quantity delivery_date",
        populate: [
          { path: "marketing_cordinator", select: "name" },
          { path: "created_by", select: "name" },
          { path: "cordinator", select: "name" },
        ]
      })
      .populate("production_team_person", "name")
      .populate("designer_person", "name")
      .populate("price_approved_by", "name")
      .populate("hold_history.hold_by", "name")
      .populate("hold_history.unhold_by", "name")
      .populate("edit_remarks.edited_by", "name")
      .populate("bom_history.action_by_user", "name role")
      .populate("blocked_materials")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // const data = orders.map((o) => {
    //   const obj = o.toObject();
    //   obj.image = obj.image ? generateSignedUrl(obj.image) : null;
    //   return obj;
    // });

    // Merge salesorderformModel data

    const dispatchedPacksList = await CtPack.find({
      $or: [
        { is_dispatched: true },
        { status: { $in: ['Packed', 'packed', 'Complete', 'complete', 'Dispatched', 'dispatched', 'Shipped', 'shipped', 'Done', 'done'] } },
        { stage: { $in: ['dispatch', 'dispatched', 'complete', 'completed', 'shipped', 'done', 'logistics'] } },
        { dispatchDt: { $exists: true, $ne: "" } },
        {
          $and: [
            { total_qty: { $gt: 0 } },
            { $expr: { $gte: ["$deliveredQty", "$total_qty"] } }
          ]
        }
      ]
    }).distinct('sub_job_no');
    const dispatchedPacksSet = new Set(dispatchedPacksList.map(s => String(s || "").trim()));

    const data = await Promise.all(
      orders.map(async (order) => {
        const obj = order.toObject();

        if (obj.sub_job_no && dispatchedPacksSet.has(String(obj.sub_job_no).trim())) {
          obj.is_dispatched = true;
          if (obj.status !== "closed") {
            obj.status = "dispatch";
          }
        }

        // Extract matched enquiry_approved_datetime from enquiryDoc.images
        const rawSampleImage = order.image;
        const enquiryDoc = order.enquiry_id;
        let foundAcceptedDt = null;

        if (enquiryDoc && Array.isArray(enquiryDoc.images)) {
          const matchedImg = enquiryDoc.images.find(img => {
            if (!img || !img.url) return false;
            return (rawSampleImage && img.url === rawSampleImage) ||
              (rawSampleImage && (img.url.includes(rawSampleImage) || rawSampleImage.includes(img.url)));
          });

          if (matchedImg) {
            foundAcceptedDt = matchedImg.accepted_date_time;
          }
        }

        obj.enquiry_approved_datetime = foundAcceptedDt || enquiryDoc?.accepted_date_time || enquiryDoc?.created_at || order.createdAt;

        // Add signed URL for image
        obj.image = obj.image ? generateSignedUrl(obj.image) : null;

        // Add signed URL for sample trophy image
        obj.sample_trophy_image = obj.sample_trophy_image ? generateSignedUrl(obj.sample_trophy_image) : null;

        obj.designer_files = Array.isArray(obj.designer_files)
          ? obj.designer_files.map((file) => generateSignedUrl(file))
          : [];

        obj.Pi_files = Array.isArray(obj.Pi_files)
          ? obj.Pi_files.map((file) => generateSignedUrl(file))
          : [];

        obj.quatation_files = Array.isArray(obj.quatation_files)
          ? obj.quatation_files.map((file) => generateSignedUrl(file))
          : [];

        if (Array.isArray(obj.bom_history)) {
          obj.bom_history = obj.bom_history.map((log) => {
            if (log && log.file_url) {
              return {
                ...log,
                file_url: generateSignedUrl(log.file_url)
              };
            }
            return log;
          });
        }

        obj.additional_files = Array.isArray(obj.additional_files)
          ? obj.additional_files.map((item) => {
            if (typeof item === 'string') {
              return generateSignedUrl(item);
            } else if (item && item.file_url) {
              return {
                ...item,
                file_url: generateSignedUrl(item.file_url)
              };
            }
            return item;
          })
          : [];


        obj.margin = null;
        obj.marginType = null;
        obj.finalUnitPrice = null;

        if (obj.bom_nanoid) {
          const bom = await bomModel.findOne({
            id: obj.bom_nanoid
          }).lean();

          if (bom) {
            obj.margin = bom.quotation?.margin ?? null;
            obj.marginType = bom.quotation?.marginType ?? null;
            obj.finalUnitPrice = bom.quotation?.finalUnitPrice ?? null;
            obj.job_quantity = bom.job_quantity;
            obj.artwork_pdf = bom.artwork_pdf ? generateSignedUrl(bom.artwork_pdf) : null;
            obj.artwork_cdr = bom.artwork_cdr ? generateSignedUrl(bom.artwork_cdr) : null;

            // Populate qty_update from the BOM if it exists
            if (bom.qty_update) {
              obj.qty_update = JSON.parse(JSON.stringify(bom.qty_update));
              if (obj.qty_update.recalculated_data) {
                if (obj.qty_update.recalculated_data.quotation_pdf) {
                  obj.qty_update.recalculated_data.quotation_pdf = generateSignedUrl(obj.qty_update.recalculated_data.quotation_pdf);
                }
                if (obj.qty_update.recalculated_data.job_sheet_pdf) {
                  obj.qty_update.recalculated_data.job_sheet_pdf = generateSignedUrl(obj.qty_update.recalculated_data.job_sheet_pdf);
                }
                if (obj.qty_update.recalculated_data.cost_sheet_pdf) {
                  obj.qty_update.recalculated_data.cost_sheet_pdf = generateSignedUrl(obj.qty_update.recalculated_data.cost_sheet_pdf);
                }
              }
            }
          }
        }



        // Find matching salesorderform
        let form = null;
        if (obj.enquiry_id?._id) {
          form = await salesorderformModel.findOne({
            job_no: obj.job_no,
            sub_job_no: obj.sub_job_no,
            enquiry_id: obj.enquiry_id._id,
          })
            .populate("marketing_cordinator", "name")
            .lean();
        }
        if (!form && obj.sub_job_no) {
          form = await salesorderformModel.findOne({
            job_no: obj.job_no,
            sub_job_no: obj.sub_job_no,
          })
            .populate("marketing_cordinator", "name")
            .lean();
        }

        if (form) {
          obj.job_quantity = obj.job_quantity || form.job_quantity;
          obj.delivery_date = form.delivery_date || obj.delivery_date;
          obj.job_completion_datetime = form.job_completion_datetime || obj.job_completion_datetime;
          obj.client_name = form.client_name || obj.client_name || obj.enquiry_id?.name;
          obj.product_name = form.product_name || obj.product_name || obj.enquiry_id?.product_name;
          obj.category = form.category || obj.category;
          obj.subcategory = form.subcategory || obj.subcategory;
          obj.mobile_no = form.mobile_no || obj.mobile_no;
          obj.wp_number = form.wp_number || obj.wp_number;
          obj.email = form.email || obj.email;
          obj.billing_address_1 = form.billing_address_1;
          obj.billing_address_2 = form.billing_address_2 === 'undefined' ? '' : form.billing_address_2;
          obj.billing_city = form.billing_city;
          obj.billing_state = form.billing_state;
          obj.billing_postal_code = form.billing_postal_code;
          obj.billing_gst_no = form.billing_gst_no === 'undefined' ? '' : form.billing_gst_no;

          obj.delivery_address = form.delivery_address;
          obj.delivery_type = form.delivery_type;
          obj.delivery_mode = form.delivery_mode;
          obj.who_will_pay = form.who_will_pay;
          obj.marketing_cordinator = form.marketing_cordinator;
          obj.product_files = Array.isArray(form.product_files)
            ? form.product_files.map((file) => generateSignedUrl(file))
            : [];
        } else {
          obj.job_qty = obj.job_quantity || null;
          obj.delivery_date = obj.delivery_date || null;
          obj.client_name = obj.client_name || obj.enquiry_id?.name;
          obj.product_name = obj.product_name || obj.enquiry_id?.product_name;
        }

        if (obj.sub_job_no) {
          const sfJobs = await shopFloorJobModel.find({ sub_job_no: obj.sub_job_no }).lean();
          obj.shop_floor_jobs = sfJobs || [];
        } else {
          obj.shop_floor_jobs = [];
        }

        return obj;
      })
    );

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    console.error("getAllSampleOrders error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


export const getSampleOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    let order = await salesorderlistModel
      .findOne({ $or: [{ id: id }, { sub_job_no: { $regex: new RegExp(`^${id}$`, "i") } }] })
      .populate("created_by", "name")
      .populate({
        path: "enquiry_id",
        select: "job_no name reference_no marketing_cordinator accepted_date_time created_at images",
        populate: { path: "marketing_cordinator", select: "name" }
      });

    if (!order) {
      // FALLBACK: Search in salesorderformModel directly
      const fallbackForm = await salesorderformModel
        .findOne({ $or: [{ id: id }, { sub_job_no: { $regex: new RegExp(`^${id}$`, "i") } }, { sample_order_nanoid: id }] })
        .populate("created_by", "name")
        .populate({
          path: "enquiry_id",
          select: "job_no name reference_no marketing_cordinator accepted_date_time created_at images",
          populate: { path: "marketing_cordinator", select: "name" }
        })
        .populate("marketing_cordinator", "name")
        .lean();

      if (!fallbackForm) {
        return res.status(404).json({ success: false, message: "Sample order not found" });
      }

      const fallbackObj = { ...fallbackForm };
      fallbackObj.image = fallbackObj.image ? generateSignedUrl(fallbackObj.image) : null;
      fallbackObj.product_files = Array.isArray(fallbackObj.product_files)
        ? fallbackObj.product_files.map((file) => generateSignedUrl(file))
        : [];
      return res.status(200).json({ success: true, data: fallbackObj });
    }

    const obj = order.toObject();

    // Compute enquiry_approved_datetime
    const rawSampleImage = order.image;
    const enquiryDoc = order.enquiry_id;
    let foundAcceptedDt = null;

    if (enquiryDoc && Array.isArray(enquiryDoc.images)) {
      const matchedImg = enquiryDoc.images.find(img => {
        if (!img || !img.url) return false;
        return (rawSampleImage && img.url === rawSampleImage) ||
          (rawSampleImage && (img.url.includes(rawSampleImage) || rawSampleImage.includes(img.url)));
      });

      if (matchedImg) {
        foundAcceptedDt = matchedImg.accepted_date_time;
      }
    }

    obj.enquiry_approved_datetime = foundAcceptedDt || enquiryDoc?.accepted_date_time || enquiryDoc?.created_at || order.createdAt;

    obj.image = obj.image ? generateSignedUrl(obj.image) : null;

    obj.designer_files = Array.isArray(obj.designer_files)
      ? obj.designer_files.map((file) => generateSignedUrl(file))
      : [];

    obj.Pi_files = Array.isArray(obj.Pi_files)
      ? obj.Pi_files.map((file) => generateSignedUrl(file))
      : [];

    obj.quatation_files = Array.isArray(obj.quatation_files)
      ? obj.quatation_files.map((file) => generateSignedUrl(file))
      : [];

    if (Array.isArray(obj.bom_history)) {
      obj.bom_history = obj.bom_history.map((log) => {
        if (log && log.file_url) {
          return {
            ...log,
            file_url: generateSignedUrl(log.file_url)
          };
        }
        return log;
      });
    }

    obj.additional_files = Array.isArray(obj.additional_files)
      ? obj.additional_files.map((item) => {
        if (typeof item === 'string') {
          return generateSignedUrl(item);
        } else if (item && item.file_url) {
          return {
            ...item,
            file_url: generateSignedUrl(item.file_url)
          };
        }
        return item;
      })
      : [];

    const form = await salesorderformModel.findOne({
      job_no: obj.job_no,
      sub_job_no: obj.sub_job_no,
      enquiry_id: obj.enquiry_id?._id,
    })
      .populate("marketing_cordinator", "name")
      .lean();

    if (form) {
      obj.job_quantity = obj.job_quantity || form.job_quantity;
      obj.delivery_date = form.delivery_date;
      obj.job_completion_datetime = form.job_completion_datetime;
      obj.client_name = form.client_name || obj.enquiry_id?.name;
      obj.product_name = form.product_name || obj.enquiry_id?.product_name;
      obj.category = form.category || obj.category;
      obj.subcategory = form.subcategory || obj.subcategory;
      obj.mobile_no = form.mobile_no;
      obj.wp_number = form.wp_number;
      obj.email = form.email;
      obj.billing_address_1 = form.billing_address_1;
      obj.billing_address_2 = form.billing_address_2 === 'undefined' ? '' : form.billing_address_2;
      obj.billing_city = form.billing_city;
      obj.billing_state = form.billing_state;
      obj.billing_postal_code = form.billing_postal_code;
      obj.billing_gst_no = form.billing_gst_no === 'undefined' ? '' : form.billing_gst_no;

      obj.delivery_address = form.delivery_address;
      obj.delivery_type = form.delivery_type;
      obj.delivery_mode = form.delivery_mode;
      obj.who_will_pay = form.who_will_pay;
      obj.marketing_cordinator = form.marketing_cordinator;
      // also ensure enquiry_id has its marketing_cordinator if not already there
      if (!obj.enquiry_id.marketing_cordinator && form.marketing_cordinator) {
        obj.enquiry_id.marketing_cordinator = form.marketing_cordinator;
      }
      obj.product_files = Array.isArray(form.product_files)
        ? form.product_files.map((file) => generateSignedUrl(file))
        : [];
    } else {
      obj.job_qty = null;
      obj.delivery_date = null;
      obj.client_name = obj.enquiry_id?.name;
      obj.product_name = obj.enquiry_id?.product_name;
    }

    if (obj.sub_job_no) {
      const sfJobs = await shopFloorJobModel.find({ sub_job_no: obj.sub_job_no }).lean();
      obj.shop_floor_jobs = sfJobs || [];
    } else {
      obj.shop_floor_jobs = [];
    }

    return res.status(200).json({ success: true, data: obj });
  } catch (error) {
    console.error("getSampleOrderById error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// export const createSampleOrder = async (req, res) => {
//   try {
//     let {
//       enquiry_id,
//       job_no,
//       sub_job_no,
//       recipe_materials = [],
//       consumables = [],
//       packing_materials = [],
//       process_priority = [],
//       material_total,
//       consumable_total,
//       packing_total,
//       labour_total,
//       shipping_total,
//       final_total,
//     } = req.body;

//     const userId = req.user?._id;
//     if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

//     const enquiry = await enquiryModel.findOne({ id: enquiry_id });
//     if (!enquiry) return res.status(404).json({ success: false, message: "Linked enquiry not found" });


//     const lastSample = await salesorderlistModel.findOne({ enquiry_id }).sort({ createdAt: -1 });

//     if (!lastSample) {
//       job_no = enquiry.job_no;              
//       sub_job_no = enquiry.job_no + 'a';      
//     } else {
//       job_no = lastSample.job_no;             
//       const lastChar = lastSample.sub_job_no.slice(-1).toLowerCase();
//       sub_job_no = job_no + String.fromCharCode(lastChar.charCodeAt(0) + 1); 
//     }

//     let imageUrl = null;
//     if (req.file) {
//       const path = `${enquiry.category}/${enquiry.subcategory}/${enquiry.job_no}/${sub_job_no}`;
//       imageUrl = await uploadToR2(path, req.file.buffer, req.file.originalname, req.file.mimetype);
//     }

//     const newSample = new salesorderlistModel({
//       id: nanoid(16),
//       enquiry_id,
//       job_no,
//       sub_job_no,
//       image: imageUrl,
//       recipe_materials,
//       consumables,
//       packing_materials,
//       process_priority,
//       material_total,
//       consumable_total,
//       packing_total,
//       labour_total,
//       shipping_total,
//       final_total,
//       created_by: userId,
//       created_at: getCurrentDate(),
//     });

//     const saved = await newSample.save();
//     return res.status(201).json({ success: true, message: "Sample order created", data: saved });
//   } catch (error) {
//     console.error("createSampleOrder error:", error);
//     return res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };


// Helper method to cascade sample order quantity/date changes to other collections
export const syncSampleOrderCascades = async ({ existing, updates, userId }) => {
  // If job_quantity changed, also update the BOM linked to this order
  if (updates.job_quantity !== undefined && (existing.bom_nanoid || existing.bom_id)) {
    const bomQuery = existing.bom_nanoid
      ? { id: existing.bom_nanoid }
      : { _id: existing.bom_id };

    const bomDoc = await bomModel.findOne(bomQuery).lean();
    if (bomDoc) {
      const recalculatedFields = recalculateBOMForNewQty(bomDoc, updates.job_quantity);

      await bomModel.findOneAndUpdate(bomQuery, {
        $set: {
          ...recalculatedFields,
          job_quantity: Number(updates.job_quantity),
          updated_at: getCurrentDate(),
        },
        $push: {
          updated_by: { user: userId, date: getCurrentDate() }
        }
      });
      console.log(`Synced and Recalculated BOM for ${existing.sub_job_no}:`, Number(updates.job_quantity));
    }
  }

  // Sync to DTP Studio if it exists
  const dtpJob = await dtpStudioModel.findOne({ sample_order_id: existing._id });
  if (dtpJob) {
    let dtpUpdated = false;

    if (updates.is_on_hold !== undefined) {
      dtpJob.is_on_hold = updates.is_on_hold;
      dtpUpdated = true;
    }

    if (updates.job_quantity !== undefined) {
      const newQty = Number(updates.job_quantity);
      if (dtpJob.job_quantity !== newQty) {
        dtpJob.job_quantity = newQty;
        dtpJob.is_qty_changed = true;
        dtpJob.history.push({
          action: "Quantity Updated",
          description: `Quantity updated from Sales Order edit. New Qty: ${newQty}`,
          user: userId,
          date: getCurrentDate()
        });
        dtpUpdated = true;
      }
    }

    if (updates.delivery_date !== undefined || updates.job_completion_datetime !== undefined) {
      let dateChanged = false;
      let datePreponed = false;

      const parseStringToDate = (d) => {
        if (!d) return null;
        const parsed = moment(d, ['DD-MM-YYYY', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm', 'DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY HH:mm']);
        return parsed.isValid() ? parsed : null;
      };

      if (updates.delivery_date && dtpJob.delivery_date !== updates.delivery_date) {
        // Only flag as changed if the new date is EARLIER than the current one (preponed)
        const oldDate = parseStringToDate(dtpJob.delivery_date);
        const newDate = parseStringToDate(updates.delivery_date);
        if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
          datePreponed = true;
        }
        dtpJob.delivery_date = updates.delivery_date;
        dateChanged = true;
      }

      if (updates.job_completion_datetime && dtpJob.job_completion_date !== updates.job_completion_datetime) {
        // Only flag as changed if the new date is EARLIER than the current one (preponed)
        const oldDate = parseStringToDate(dtpJob.job_completion_date);
        const newDate = parseStringToDate(updates.job_completion_datetime);
        if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
          datePreponed = true;
        }
        dtpJob.job_completion_date = updates.job_completion_datetime;
        dateChanged = true;
      }

      if (dateChanged) {
        if (datePreponed) {
          dtpJob.is_date_changed = true;
        }

        dtpJob.history.push({
          action: "Dates Updated",
          description: `Dates updated from Sales Order edit. ${datePreponed ? '(Preponed)' : '(Postponed/Updated)'}`,
          user: userId,
          date: getCurrentDate()
        });
        dtpUpdated = true;
      }
    }

    if (dtpUpdated) {
      dtpJob.updated_at = getCurrentDate();
      await dtpJob.save();
      console.log(`Synced DTP Job for ${existing.sub_job_no}`);
    }
  }

  // Sync to Store Material Issue if it exists
  const storeIssue = await StoreMaterialIssue.findOne({ sample_order_id: existing._id });
  if (storeIssue) {
    if (updates.is_on_hold !== undefined) {
      storeIssue.is_on_hold = updates.is_on_hold;
    }
    if (updates.job_quantity !== undefined && Number(updates.job_quantity) !== storeIssue.job_quantity) {
      storeIssue.job_quantity = Number(updates.job_quantity);
      storeIssue.is_qty_changed = true;
    }
    if (updates.delivery_date !== undefined) {
      const oldDate = moment(storeIssue.delivery_date, "DD-MM-YYYY");
      const newDate = moment(updates.delivery_date, "DD-MM-YYYY");
      if (newDate.isValid() && oldDate.isValid() && newDate.isBefore(oldDate, 'day')) {
        storeIssue.is_date_changed = true;
      }
      storeIssue.delivery_date = updates.delivery_date;
    }
    if (updates.job_completion_datetime !== undefined) {
      const oldDate = moment(storeIssue.job_completion_date, "DD-MM-YYYY");
      const newDate = moment(updates.job_completion_datetime, "DD-MM-YYYY");
      if (newDate.isValid() && oldDate.isValid() && newDate.isBefore(oldDate, 'day')) {
        storeIssue.is_date_changed = true;
      }
      storeIssue.job_completion_date = updates.job_completion_datetime;
    }
    storeIssue.updated_at = getCurrentDate();
    await storeIssue.save();
    console.log(`Synced Store Issue for Sales Order ${existing.job_no}`);
  }

  // Sync to Shop Floor Jobs if they exist
  const shopFloorJobs = await shopFloorJobModel.find({ sub_job_no: existing.sub_job_no });
  if (shopFloorJobs.length > 0) {
    for (const sfJob of shopFloorJobs) {
      let sfUpdated = false;

      if (updates.job_quantity !== undefined) {
        const newQty = Number(updates.job_quantity);
        if (sfJob.total_qty !== newQty) {
          sfJob.total_qty = newQty;
          sfJob.is_qty_changed = true;
          sfUpdated = true;
        }
      }

      if (updates.delivery_date !== undefined || updates.job_completion_datetime !== undefined) {
        let dateChanged = false;
        let datePreponed = false;

        const parseStringToDate = (d) => {
          if (!d) return null;
          const parsed = moment(d, ['DD-MM-YYYY', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm', 'DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY HH:mm']);
          return parsed.isValid() ? parsed : null;
        };

        if (updates.delivery_date && sfJob.delivery_date !== updates.delivery_date) {
          const oldDate = parseStringToDate(sfJob.delivery_date);
          const newDate = parseStringToDate(updates.delivery_date);
          if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
            datePreponed = true;
          }
          sfJob.delivery_date = updates.delivery_date;
          dateChanged = true;
        }

        if (updates.job_completion_datetime && sfJob.job_completion_date !== updates.job_completion_datetime) {
          const oldDate = parseStringToDate(sfJob.job_completion_date);
          const newDate = parseStringToDate(updates.job_completion_datetime);
          if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
            datePreponed = true;
          }
          sfJob.job_completion_date = updates.job_completion_datetime;
          dateChanged = true;
        }

        if (dateChanged) {
          if (datePreponed) {
            sfJob.is_date_changed = true;
          }
          sfUpdated = true;
        }
      }

      if (sfUpdated) {
        sfJob.updated_at = getCurrentDate();
        await sfJob.save();
        console.log(`Synced Shop Floor Job ${sfJob._id} for ${existing.sub_job_no}`);
      }
    }
  }

  // Sync to RFQ (Procurement Coordination) awards if it exists
  const rfqJobs = await rfqModel.find({
    jobNo: existing.job_no,
    subJobNo: existing.sub_job_no
  });

  if (rfqJobs.length > 0) {
    for (const rfq of rfqJobs) {
      let rfqUpdated = false;

      if (updates.is_on_hold !== undefined) {
        rfq.is_on_hold = updates.is_on_hold;
        rfqUpdated = true;
      }

      if (rfq.awards && Array.isArray(rfq.awards)) {
        for (const award of rfq.awards) {
          // 1. QTY ALERT: sync ONLY if actually changed in this update
          if (updates.job_quantity !== undefined && Number(updates.job_quantity) !== Number(existing.job_quantity)) {
            const newQty = Number(updates.job_quantity);

            // Strict separation: only compare with job baseline
            if (award.currentJobQty === undefined) {
              let currentSOQty = existing.job_quantity;
              if (currentSOQty === undefined) {
                const form = await salesorderformModel.findOne({
                  job_no: existing.job_no,
                  sub_job_no: existing.sub_job_no
                }).select('job_quantity').lean();
                currentSOQty = form?.job_quantity || 0;
              }
              award.currentJobQty = Number(currentSOQty || 0);
            }

            award.newQtyRequest = newQty;
            if (newQty !== award.currentJobQty) {
              award.pendingQtyChange = true;
            } else {
              award.pendingQtyChange = false;
            }
            rfqUpdated = true;
          }

          // 2. DATE ALERT (Proposed Delivery Date): Alert ONLY if preponed relative to the PREVIOUS state
          if (updates.delivery_date !== undefined && updates.delivery_date !== existing.delivery_date) {
            const newDate = moment(updates.delivery_date, "DD-MM-YYYY");
            const oldDate = moment(existing.delivery_date, "DD-MM-YYYY");

            if (newDate.isValid()) {
              award.newDateRequest = newDate.toDate();
              // Alert ON if preponed (new < old), Alert OFF if postponed or equal (new >= old)
              if (oldDate.isValid() && newDate.isBefore(oldDate, 'day')) {
                award.pendingDateChange = true;
              } else {
                award.pendingDateChange = false;
              }
              rfqUpdated = true;
            }
          }

          // 3. JOB COMPLETION ALERT: Alert ONLY if preponed relative to the PREVIOUS state
          if (updates.job_completion_datetime !== undefined && updates.job_completion_datetime !== existing.job_completion_datetime) {
            const newCompDate = moment(updates.job_completion_datetime, "DD-MM-YYYY");
            const oldCompDate = moment(existing.job_completion_datetime, "DD-MM-YYYY");

            if (newCompDate.isValid()) {
              award.newJobCompletionRequest = newCompDate.toDate();
              // Alert ON if preponed
              if (oldCompDate.isValid() && newCompDate.isBefore(oldCompDate, 'day')) {
                award.pendingJobCompletionChange = true;
              } else {
                award.pendingJobCompletionChange = false;
              }
              rfqUpdated = true;
            }
          }
        }
      }
      if (rfqUpdated) {
        rfq.markModified('awards');
        await rfq.save();
        console.log(`Synced RFQ Alerts for Job ${existing.job_no} [${rfq.uid}]`);
      }
    }
  }
};


export const updateSampleOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // Try finding by nanoid 'id' first, then fallback to mongoose '_id'
    let existing = await salesorderlistModel.findOne({ id }).populate("enquiry_id").populate("bom_id");
    if (!existing && id && id.length === 24) { // Basic ObjectId length check
      existing = await salesorderlistModel.findById(id).populate("enquiry_id").populate("bom_id");
    }

    if (!existing) return res.status(404).json({ success: false, message: "Sample order not found" });

    let existingform = await salesorderlistModel.findOne({ id });
    if (!existingform && id && id.length === 24) {
      existingform = await salesorderlistModel.findById(id);
    }

    if (!existingform) return res.status(404).json({ success: false, message: "Sample order form not found" });

    // Block updates if on hold, unless we are toggling hold status
    const isTogglingHold = updates.is_on_hold !== undefined;
    if (existing.is_on_hold && !isTogglingHold) {
      return res.status(400).json({ success: false, message: "Sample order is on hold. Unhold to perform actions." });
    }

    // Intercept deferred reprocessed quantity commit when coordinator clicks Proceed
    const isProceed = updates.is_verified_to_proceed === true || updates.is_verified_to_proceed === "true";
    if (isProceed) {
      if (!updates.proceed_to_production_datetime) {
        updates.proceed_to_production_datetime = getCurrentDate();
      }
    }

    if (isProceed && existing.is_reprocessed_approved) {
      console.log(`[ProceedQuantityCommit] Committing deferred quantity revision for sales order: ${existing.sub_job_no}`);

      const bomObj = await bomModel.findById(existing.bom_id);
      if (!bomObj) {
        return res.status(404).json({ success: false, message: "Associated BOM not found for quantity commit" });
      }

      if (!bomObj.qty_update || bomObj.qty_update.status !== "approved") {
        return res.status(400).json({ success: false, message: "BOM quantity update is not in approved state" });
      }

      const newQty = bomObj.qty_update.new_qty;
      const recalculated = bomObj.qty_update.recalculated_data.toObject
        ? bomObj.qty_update.recalculated_data.toObject()
        : JSON.parse(JSON.stringify(bomObj.qty_update.recalculated_data));

      if (!recalculated || !recalculated.material_specification) {
        return res.status(500).json({ success: false, message: "Recalculated sandbox data is missing or corrupt" });
      }

      // 1. Overwrite primary BOM fields with the sandboxed recalculated data
      bomObj.material_specification = recalculated.material_specification;
      bomObj.material_groups = recalculated.material_groups;
      bomObj.materialprocess = recalculated.materialprocess;
      bomObj.packingdatas = recalculated.packingdatas;
      bomObj.costdetails = recalculated.costdetails;
      bomObj.jobSheet = recalculated.jobSheet;
      bomObj.quotation = recalculated.quotation;
      bomObj.job_quantity = newQty;

      // Save R2 PDF url to primary quotation_pdf
      if (recalculated.quotation_pdf) {
        if (!Array.isArray(bomObj.quotation_pdf)) {
          bomObj.quotation_pdf = [];
        }
        bomObj.quotation_pdf.push(recalculated.quotation_pdf);
        bomObj.markModified("quotation_pdf");
      }

      // 2. Clear the sandbox state
      bomObj.qty_update = {
        old_qty: 0,
        new_qty: 0,
        status: "none",
        is_admin_approved: false,
        is_client_approved: false,
        recalculated_data: {}
      };

      // 3. Mark fields modified
      bomObj.markModified("material_specification");
      bomObj.markModified("material_groups");
      bomObj.markModified("materialprocess");
      bomObj.markModified("packingdatas");
      bomObj.markModified("costdetails");
      bomObj.markModified("jobSheet");
      bomObj.markModified("quotation");
      bomObj.markModified("qty_update");

      // Regenerate main primary Quotation and Job Sheet PDFs with new qty
      try {
        const reference_no = existing.enquiry_id?.reference_no || "";

        // 1. Quotation PDF
        const pdfBuffer = await generateQuotationPDFBuffer({
          product_name: bomObj.product_name,
          job_quantity: newQty,
          totalUnitCost: recalculated.quotation?.finalUnitPrice || 0,
          sub_job_no: bomObj.sub_job_no,
          reference_no: reference_no,
          quotation: recalculated.quotation || {},
          packingdatas: recalculated.packingdatas || [],
          jobDescription: bomObj.jobDescription,
          orgimage: bomObj.org_image ? generateSignedUrl(bomObj.org_image) : null,
        });

        // Fetch sales order existing files to increment version
        const existingFiles = existing.quatation_files || [];
        let version = 1;
        existingFiles.forEach((file) => {
          const match = file.match(/quotation-.*-v(\d+)\.pdf$/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num >= version) version = num + 1;
          }
        });

        const filename = reference_no
          ? `quotation-${bomObj.sub_job_no}-${reference_no}-v${version}.pdf`
          : `quotation-${bomObj.sub_job_no}-v${version}.pdf`;

        const quotation_pdf_url = await uploadToR2(
          `/quotation/${bomObj.job_no}/quotationpdf`,
          pdfBuffer,
          filename,
          "application/pdf"
        );

        if (!Array.isArray(bomObj.quotation_pdf)) {
          bomObj.quotation_pdf = [];
        }
        bomObj.quotation_pdf.push(quotation_pdf_url);
        bomObj.markModified("quotation_pdf");
        updates.$push = updates.$push || {};
        updates.$push.quatation_files = quotation_pdf_url;

        // 2. Job Sheet PDF
        try {
          const jobSheetBuffer = await generateJobSheetPDFBuffer({
            job_quantity: newQty,
            product_name: bomObj.product_name,
            sub_job_no: bomObj.sub_job_no,
            reference_no: reference_no,
            materialSpecification: recalculated.material_specification || [],
            materialprocess: recalculated.materialprocess || [],
            packingdatas: recalculated.packingdatas || [],
            orgimage: bomObj.org_image ? generateSignedUrl(bomObj.org_image) : null,
            materialGroups: recalculated.material_groups || [],
          });

          const existingJobSheets = existing.job_sheet_files || [];
          let jsVersion = 1;
          existingJobSheets.forEach((file) => {
            const match = file.match(/job-sheet-.*-v(\d+)\.pdf$/);
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (num >= jsVersion) jsVersion = num + 1;
            }
          });

          const jsFilename = reference_no
            ? `job-sheet-${bomObj.sub_job_no}-${reference_no}-v${jsVersion}.pdf`
            : `job-sheet-${bomObj.sub_job_no}-v${jsVersion}.pdf`;

          const job_sheet_pdf_url = await uploadToR2(
            `/quotation/${bomObj.job_no}/jobsheet`,
            jobSheetBuffer,
            jsFilename,
            "application/pdf"
          );

          updates.$push.job_sheet_files = job_sheet_pdf_url;
        } catch (jsErr) {
          console.error("[ProceedQuantityCommit] Primary Job Sheet PDF Generation failed:", jsErr);
        }
      } catch (pdfErr) {
        console.error("[ProceedQuantityCommit] Primary PDF Generation failed:", pdfErr);
      }

      await bomObj.save();

      // 4. DOWNSTREAM CASCADE updates
      // 4a. Update target quantities on related collections
      // Update DTP Studio Job target quantities and trigger blink alert
      await dtpStudioModel.updateMany(
        { bom_id: bomObj._id },
        { $set: { job_quantity: newQty, is_qty_changed: true } }
      );

      // Update Shopfloor Job target quantities
      await shopFloorJobModel.updateMany(
        { bom_id: bomObj._id },
        { $set: { job_quantity: newQty } }
      );

      // Flag Store Material Issue for quantity change (without scaling materials required quantities yet)
      try {
        const storeIssue = await StoreMaterialIssue.findOne({ sub_job_no: existing.sub_job_no });
        if (storeIssue) {
          storeIssue.job_quantity = newQty;
          storeIssue.is_qty_changed = true;
          storeIssue.updated_at = getCurrentDate();
          await storeIssue.save();
          console.log(`[ProceedQuantityCommit] Flagged Store Material Issue for quantity change, sub_job_no: ${existing.sub_job_no}`);
        }
      } catch (storeErr) {
        console.error("[ProceedQuantityCommit] Flagging Store Material Issue failed:", storeErr);
      }

      // Also set the correct flags in updates so it is written back to the sales order document
      updates.job_quantity = newQty;
      updates.is_qty_pending_approval = false;
      updates.is_reprocessed_approved = false;
      updates.remark = "Quantity Revision Finalized and Committed.";

      console.log(`[ProceedQuantityCommit] GLOBALLY COMMITTED deferred quantity update for BOM ${bomObj.id}. New Qty: ${newQty}`);
    }

    // Build base path for R2 uploads
    const basePath = existingform
      ? `${existingform.category}/${existingform.subcategory}/${existing.job_no}/${existing.sub_job_no}`
      : `samples/${existing.job_no}/${existing.sub_job_no}`;

    console.log("updates", updates)

    if (updates.blocked_materials && typeof updates.blocked_materials === 'string') {
      try {
        updates.blocked_materials = JSON.parse(updates.blocked_materials);
        console.log("parsed blocked_materials", updates.blocked_materials);
      } catch (err) {
        console.error("Failed to parse blocked_materials:", err);
      }
    }

    if (updates.generator_rfq && typeof updates.generator_rfq === 'string') {
      try {
        updates.generator_rfq = JSON.parse(updates.generator_rfq);
        console.log("parsed generator_rfq", updates.generator_rfq);
      } catch (err) {
        console.error("Failed to parse generator_rfq:", err);
      }
    }

    if (updates.blocked_materials && Array.isArray(updates.blocked_materials)) {
      const savedBlockedIds = [];
      const userId = req.user?._id;
      for (const b of updates.blocked_materials) {
        // If already an ID, just keep it
        if (typeof b === 'string' && b.length === 24) {
          savedBlockedIds.push(b);
        } else if (typeof b === 'object' && b !== null) {
          // Check if it's already a saved document (has _id)
          if (b._id) {
            savedBlockedIds.push(b._id);
            continue;
          }
          // If a new object, create a new document in blocked_materials collection
          const newBlocked = new blockedMaterialModel({
            sales_order_id: existing._id,
            job_no: existing.job_no,
            item_id: b.item_id,
            materialId: b.materialId,
            material_name: b.material_name,
            sheet_size: b.sheet_size,
            sheet_size_id: b.sheet_size_id,
            quantity: b.quantity,
            unit: b.unit,
            blocked_by: userId,
            blocked_at: b.blocked_at || getCurrentDate()
          });
          const saved = await newBlocked.save();
          savedBlockedIds.push(saved._id);
        }
      }
      updates.blocked_materials = savedBlockedIds;
    }
    const filesMap = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        if (!filesMap[f.fieldname]) filesMap[f.fieldname] = [];
        filesMap[f.fieldname].push(f);
      });
    } else if (req.files) {
      Object.assign(filesMap, req.files);
    }

    let designer_files = [];

    // Process new designer files
    if (filesMap?.designer_files?.length > 0) {

      if (existing.designer_files?.length > 0) {
        for (const fileUrl of existing.designer_files) {
          try {
            await deleteFromR2(fileUrl);
          } catch (err) {
            console.error(`Failed to delete old file ${fileUrl}:`, err);
          }
        }
      }

      for (const file of filesMap.designer_files) {
        const url = await uploadToR2(
          `${basePath}/designer_files`,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        designer_files.push(url);
      }
    } else {
      designer_files = existing.designer_files || [];
    }


    let pi_files = existing.Pi_files || [];


    if (filesMap?.pi_files?.length > 0) {
      for (const file of filesMap.pi_files) {
        const url = await uploadToR2(
          `${basePath}/pi_files`,
          file.buffer,
          file.originalname,
          file.mimetype
        );
        pi_files.push(url);
      }
      updates.is_pi_uploaded = true;

      // Sync official PI upload to parent Enquiry Flow Integration if linked
      if (existing.enquiry_flow_id) {
        try {
          const linkedFlow = await EnquiryJob.findById(existing.enquiry_flow_id);
          if (linkedFlow) {
            const latestUploadedPiUrl = pi_files[pi_files.length - 1];
            const signedPiUrl = generateSignedUrl(latestUploadedPiUrl);
            const generatedPiNo = req.body.pi_no || req.body.invoice_no || `PI/${new Date().getFullYear()}/${existing.job_no}`;
            linkedFlow.wizard_state = {
              ...(linkedFlow.wizard_state || {}),
              pi: {
                ...(linkedFlow.wizard_state?.pi || {}),
                status: "uploaded",
                file_url: latestUploadedPiUrl,
                signed_file_url: signedPiUrl,
                file_name: req.body.file_name || "Official_PI.pdf",
                no: generatedPiNo,
                uploaded_at: new Date().toISOString(),
                uploaded_by: req.user?.name || "Accounts Desk",
                uploaded_by_id: userId,
              },
            };
            linkedFlow.markModified("wizard_state");
            linkedFlow.history.push({
              action: "PI_UPLOADED_BY_ACCOUNTS",
              step: 6,
              remarks: `Official Proforma Invoice PDF uploaded by Accounts for Job ${existing.job_no} (PI No: ${generatedPiNo})`,
              changed_by: {
                user_id: userId,
                user_name: req.user?.name || "Accounts Desk",
                role: req.user?.role || "Accounts",
              },
              timestamp: new Date(),
            });
            await linkedFlow.save();
            console.log(`Synced uploaded PI to EnquiryFlowIntegration ${linkedFlow._id}`);
          }
        } catch (syncErr) {
          console.error("Error syncing PI upload to EnquiryFlowIntegration:", syncErr);
        }
      }
    }


    let additional_files = existing.additional_files || [];

    console.log("Files received in backend:", req.files);
    console.log("Body received in backend:", req.body);

    const tag = req.body.tag || 'additional_files';

    // Process additional files (for DTP uploads)
    if (filesMap?.additional_files?.length > 0) {
      for (const file of filesMap.additional_files) {

        // If it's a specific field like artwork_pdf or artwork_cdr, we handle it separately
        if (tag === 'artwork_pdf' || tag === 'artwork_cdr') {
          const fieldName = tag; // 'artwork_pdf' or 'artwork_cdr'

          // Upload to a specific path for designs
          const url = await uploadToR2(
            `/quotation/${existing.job_no}/designs/${tag === 'artwork_pdf' ? 'pdf' : 'cdr'}`,
            file.buffer,
            file.originalname,
            file.mimetype
          );

          // Update BOM if it exists
          if (existing.bom_id) {
            // Delete old file from R2 if it exists to strictly REPLACE
            const fieldKey = tag; // 'artwork_pdf' or 'artwork_cdr'
            const oldFileUrl = existing.bom_id[fieldKey];

            if (oldFileUrl) {
              try {
                await deleteFromR2(oldFileUrl);
                console.log(`Deleted old BOM artwork ${tag}: ${oldFileUrl}`);
              } catch (err) {
                console.error(`Failed to delete old BOM artwork file ${oldFileUrl}:`, err);
              }
            }

            await bomModel.findByIdAndUpdate(existing.bom_id || existing.bom_nanoid, {
              [fieldName]: url,
              updated_at: getCurrentDate(),
              $push: {
                updated_by: { user: userId, date: getCurrentDate() }
              }
            });
            console.log(`Updated BOM ${existing.bom_id || existing.bom_nanoid} ${fieldName} with ${url}`);
          }

          // Add to additional_files (wrapped in object to match strict schema)
          // additional_files.push({
          //   tag_name: tag,
          //   file_url: url,
          //   uploaded_at: getCurrentDate(),
          //   uploaded_by: userId
          // });

        } else {
          // For material groups, note, logo, signed image, etc.
          // Store in additional files as an OBJECT
          const url = await uploadToR2(
            `${basePath}/additional_files`,
            file.buffer,
            file.originalname,
            file.mimetype
          );

          additional_files.push({
            tag_name: tag,
            file_url: url,
            uploaded_at: getCurrentDate(),
            uploaded_by: userId
          });
        }
      }
    }

    // Process section and process files (production/dtp)
    let processFiles = existing.process_files ? [...existing.process_files] : [];
    const parsedMaterialProcess = req.body.materialprocess ? JSON.parse(req.body.materialprocess) : null;

    if (parsedMaterialProcess && filesMap) {
      for (const fieldName of Object.keys(filesMap)) {
        if (fieldName.startsWith("process|")) {
          const parts = fieldName.split("|");
          if (parts.length >= 4) {
            const groupId = parts[1];
            const processId = parts[2];
            const fileType = parts[3]; // "production" or "dtp"
            const file = filesMap[fieldName][0];

            if (file) {
              const uploadedUrl = await uploadToR2(
                `${basePath}/processes/${fileType}`,
                file.buffer,
                file.originalname,
                file.mimetype
              );

              // Find names
              let sectionName = "";
              let processName = "";
              if (Array.isArray(parsedMaterialProcess)) {
                parsedMaterialProcess.forEach(group => {
                  if (String(group.material_group_id || group._id) === String(groupId)) {
                    sectionName = group.material_group_name;
                    if (Array.isArray(group.processes)) {
                      group.processes.forEach(proc => {
                        if (String(proc.process_id || proc._id) === String(processId)) {
                          processName = proc.process_name;
                        }
                      });
                    }
                  }
                });
              }

              // Check if already exists in processFiles
              const existingProcessIndex = processFiles.findIndex(
                pf => pf.section_id === groupId && pf.process_id === processId
              );

              if (existingProcessIndex >= 0) {
                // Determine old url to delete if required
                const oldUrl = fileType === "production" ? processFiles[existingProcessIndex].production_file : processFiles[existingProcessIndex].dtp_file;
                if (oldUrl) {
                  try {
                    await deleteFromR2(oldUrl);
                  } catch (err) {
                    console.error("Failed to delete old process file", err);
                  }
                }

                if (fileType === "production") {
                  processFiles[existingProcessIndex].production_file = uploadedUrl;
                  if (req.body.process_instruction !== undefined) processFiles[existingProcessIndex].production_instruction = req.body.process_instruction;
                }

                if (fileType === "dtp") {
                  processFiles[existingProcessIndex].dtp_file = uploadedUrl;
                  if (req.body.process_instruction !== undefined) processFiles[existingProcessIndex].dtp_instruction = req.body.process_instruction;
                }

                // Ensure names are captured just in case
                processFiles[existingProcessIndex].section_name = sectionName || processFiles[existingProcessIndex].section_name;
                processFiles[existingProcessIndex].process_name = processName || processFiles[existingProcessIndex].process_name;
              } else {
                // Push new definition
                processFiles.push({
                  section_id: groupId,
                  process_id: processId,
                  section_name: sectionName,
                  process_name: processName,
                  production_file: fileType === "production" ? uploadedUrl : null,
                  dtp_file: fileType === "dtp" ? uploadedUrl : null,
                  production_instruction: fileType === "production" ? (req.body.process_instruction || "") : "",
                  dtp_instruction: fileType === "dtp" ? (req.body.process_instruction || "") : ""
                });
              }
            }
          }
        }
      }
    }


    // Handle explicitly deleted process files
    if (req.body.deleted_process_file) {
      const delReq = JSON.parse(req.body.deleted_process_file);
      const existingProcessIndex = processFiles.findIndex(
        pf => pf.section_id === delReq.section_id && pf.process_id === delReq.process_id
      );

      if (existingProcessIndex >= 0) {
        const fileType = delReq.type.toLowerCase();
        const oldUrl = fileType === "production" ? processFiles[existingProcessIndex].production_file : processFiles[existingProcessIndex].dtp_file;

        if (oldUrl) {
          try {
            await deleteFromR2(oldUrl);
          } catch (err) {
            console.error("Failed to delete process file from R2 on explicit delete request", err);
          }
        }

        if (fileType === "production") processFiles[existingProcessIndex].production_file = null;
        if (fileType === "dtp") processFiles[existingProcessIndex].dtp_file = null;

        // If both files are null, you can optionally remove the object from the array entirely
        if (!processFiles[existingProcessIndex].production_file && !processFiles[existingProcessIndex].dtp_file) {
          processFiles.splice(existingProcessIndex, 1);
        }
      }
    }

    // console.log("updates.production_team_person",updates.production_team_person)
    //  if (updates.production_team_person) {
    //     updates.production_team_person = Array.isArray(updates.production_team_person) ? updates.production_team_person : [];
    //   }

    console.log("updates.production_team_person", updates.production_team_person)

    console.log("designer_files", designer_files)

    updates.Pi_files = pi_files;

    updates.additional_files = additional_files;

    updates.designer_files = designer_files;

    updates.process_files = processFiles;

    updates.updated_at = getCurrentDate();
    updates.updated_by =
      { user: userId, date: getCurrentDate() };

    if (updates.is_on_hold !== undefined) {
      if (updates.is_on_hold === true || updates.is_on_hold === "true") {
        updates.is_on_hold = true;
        // Putting on Hold
        updates.hold_history = [
          ...(existing.hold_history || []),
          {
            reason: updates.hold_reason,
            start_time: getCurrentDate(),
            hold_by: userId,
          }
        ];

        // Cascade hold to DTP jobs
        const dtpJob = await dtpStudioModel.findOne({ sample_order_id: existing._id });
        if (dtpJob && !dtpJob.is_on_hold) {
          dtpJob.is_on_hold = true;
          dtpJob.hold_history.push({
            reason: updates.hold_reason || "Production/Sales Order Hold",
            start_time: getCurrentDate(),
            hold_by: userId,
          });
          dtpJob.history.push({
            action: "System Hold",
            description: `Cascaded from Sales Order Hold: ${updates.hold_reason}`,
            user: userId,
            date: getCurrentDate()
          });
          dtpJob.updated_at = getCurrentDate();
          await dtpJob.save();
          console.log(`Cascaded hold to DTP Job ${dtpJob.job_no}`);
        }

        // Cascade hold to Store Material Issue
        await StoreMaterialIssue.updateMany(
          { sample_order_id: existing._id },
          { $set: { is_on_hold: true } }
        );

        // Cascade hold to RFQ
        await rfqModel.updateMany(
          { jobNo: existing.job_no },
          { $set: { is_on_hold: true } }
        );

        // Cascade hold to Shop Floor Jobs
        await shopFloorJobModel.updateMany(
          { sub_job_no: existing.sub_job_no },
          {
            $set: { is_hold: true, hold_remarks: updates.hold_reason || "Job hold from Production floor" },
            $push: {
              escalation_hold_history: {
                type: 'Hold',
                remarks: updates.hold_reason || "Job hold from Production floor",
                at: getCurrentDate(),
                by: userId
              }
            }
          }
        );
      } else {
        // Unholding
        updates.is_on_hold = false;
        const history = existing.hold_history || [];
        if (history.length > 0) {
          const lastHold = history[history.length - 1];
          lastHold.end_time = getCurrentDate();
          lastHold.unhold_by = userId;
          updates.hold_history = history;
        }

        // Cascade unhold to DTP jobs
        const dtpJob = await dtpStudioModel.findOne({ sample_order_id: existing._id });
        if (dtpJob && dtpJob.is_on_hold) {
          dtpJob.is_on_hold = false;

          // Update DTP hold history
          const dtpHistory = dtpJob.hold_history || [];
          if (dtpHistory.length > 0) {
            const lastDtpHold = dtpHistory[dtpHistory.length - 1];
            if (!lastDtpHold.end_time) {
              lastDtpHold.end_time = getCurrentDate();
              lastDtpHold.unhold_by = userId;
            }
          }

          // Update dates in DTP if provided
          if (updates.delivery_date) dtpJob.delivery_date = updates.delivery_date;
          if (updates.job_completion_datetime) dtpJob.job_completion_date = updates.job_completion_datetime;

          dtpJob.history.push({
            action: "System Unhold",
            description: "Cascaded from Sales Order Unhold",
            user: userId,
            date: getCurrentDate()
          });
          dtpJob.updated_at = getCurrentDate();
          await dtpJob.save();
          console.log(`Cascaded unhold to DTP Job ${dtpJob.job_no}`);
        }

        // Cascade unhold to Store Material Issue
        await StoreMaterialIssue.updateMany(
          { sample_order_id: existing._id },
          { $set: { is_on_hold: false } }
        );

        // Cascade unhold to RFQ
        await rfqModel.updateMany(
          { jobNo: existing.job_no },
          { $set: { is_on_hold: false } }
        );

        // Cascade unhold to Shop Floor Jobs
        await shopFloorJobModel.updateMany(
          { sub_job_no: existing.sub_job_no },
          {
            $set: { is_hold: false },
            $push: {
              escalation_hold_history: {
                type: 'Resume',
                remarks: "Job resumed from Production floor",
                at: getCurrentDate(),
                by: userId
              }
            }
          }
        );

        // Update delivery_date and job_completion_datetime in salesorderform if provided
        if (updates.delivery_date || updates.job_completion_datetime) {
          const formUpdates = {};
          if (updates.delivery_date) formUpdates.delivery_date = updates.delivery_date;
          if (updates.job_completion_datetime) formUpdates.job_completion_datetime = updates.job_completion_datetime;

          if (Object.keys(formUpdates).length > 0) {
            await salesorderformModel.findOneAndUpdate(
              { sample_order_nanoid: id },
              { $set: formUpdates }
            );
          }
        }

        // Logic to Unhold Parent Enquiry if it is on Hold
        // "If any sub-job is unheld, the parent enquiry should automatically transition to unheld status."
        if (existing.enquiry_id) {
          const parentEnquiry = await enquiryModel.findById(existing.enquiry_id);
          if (parentEnquiry && parentEnquiry.is_on_hold) {
            parentEnquiry.is_on_hold = false;

            // Update parent history
            const parentHistory = parentEnquiry.hold_history || [];
            if (parentHistory.length > 0) {
              const lastHold = parentHistory[parentHistory.length - 1];
              if (!lastHold.end_time) {
                lastHold.end_time = getCurrentDate();
                lastHold.unhold_by = userId;
                parentEnquiry.hold_history = parentHistory;
              }
            }
            await parentEnquiry.save();
            console.log(`Parent enquiry ${parentEnquiry.job_no} unheld because sub-job ${existing.sub_job_no} was unheld.`);
          }
        }
      }
    }

    // Check if pushed to shop floor
    if (updates.is_pushed_shop_floor === 'true' || updates.is_pushed_shop_floor === true) {
      if (!updates.pushed_to_shop_floor_datetime) {
        updates.pushed_to_shop_floor_datetime = getCurrentDate();
      }
      const existingDTP = await dtpStudioModel.findOne({ sample_order_id: existing._id });
      // Fetch BOM to get jobSheet data
      const bomData = await bomModel.findById(existing.bom_id);

      // Fetch specific sales order form data
      const salesOrderForm = await salesorderformModel.findOne({
        job_no: existing.job_no,
        sub_job_no: existing.sub_job_no,
        enquiry_id: existing.enquiry_id?._id
      });

      let client_name = salesOrderForm?.client_name || existing.enquiry_id?.name;
      let product_name = salesOrderForm?.product_name;

      // Prepare job_sheet with process status
      const jobSheetData = bomData?.jobSheet ? {
        materialSpecification: bomData.jobSheet.materialSpecification || [],
        packingdatas: bomData.jobSheet.packingdatas || [],
        materialprocess: bomData.jobSheet.materialprocess?.map(group => ({
          ...group,
          processes: group.processes?.map(proc => ({
            ...proc,
            status: 'Pending',
            status_by: null,
            updated_at: getCurrentDate()
          })) || []
        })) || []
      } : {};



      // Determine if this is a sample job or bulk production job
      const isSampleJob = existing.type === "sample" ||
        existing.category === "Sample" ||
        String(existing.type || "").toLowerCase() === "sample" ||
        String(existing.category || "").toLowerCase() === "sample";

      // Determine job_quantity from BOM or Form (strictly sample count for sample jobs)
      let job_quantity = existing.job_quantity || salesOrderForm?.job_quantity;
      if (isSampleJob) {
        job_quantity = existing.job_quantity || 1;
      } else if (bomData && bomData.job_quantity) {
        job_quantity = bomData.job_quantity;
      }

      const artwork_files = [bomData?.artwork_pdf, bomData?.artwork_cdr];

      const newDTP = new dtpStudioModel({
        sample_order_id: existing._id,
        bom_id: existing.bom_id,
        job_no: existing.job_no,
        sub_job_no: existing.sub_job_no,
        client_name: client_name,
        product_name: product_name,
        job_quantity: job_quantity,
        image: existing.image,
        artwork_files: artwork_files,
        delivery_date: salesOrderForm?.delivery_date,
        job_completion_date: salesOrderForm?.job_completion_datetime,
        reference_enquiry: existing.enquiry_id?.job_no,
        enquiry_id: existing.enquiry_id?._id,
        status: 'Pending',
        job_sheet: jobSheetData,
        history: [{
          action: "Created",
          description: "Job pushed to Shop Floor - DTP Studio initialized",
          user: userId,
          date: getCurrentDate()
        }],
        created_by: userId,
        created_at: getCurrentDate()
      });

      // DTP STUDIO ENTRY:
      // Always create for all PRODUCTION jobs. Do NOT create for Sample jobs.
      if (!existingDTP && !isSampleJob) {
        await newDTP.save();
        console.log("DTP Studio entry created for Production job:", existing.job_no);
      }

      const existingAssembly = await assemblyTeamModel.findOne({ sub_job_no: existing.sub_job_no });
      if (!existingAssembly) {
        // CREATE ASSEMBLY TEAM RECORD (Operation Planning) immediately
        const assemblyJob = new assemblyTeamModel({
          job_no: existing.job_no,
          sub_job_no: existing.sub_job_no,
          client_name: client_name,
          product_name: product_name,
          type: existing.type,
          image: existing.image,
          qty: job_quantity,
          sales_order_id: existing._id,
          enquiry_id: existing.enquiry_id?._id,
          reference_no: existing.enquiry_id?.reference_no,
          status: 'pending',
          opQty: job_quantity, // Snapshot at push
          opJobCompDate: salesOrderForm?.job_completion_datetime // Snapshot at push
        });

        await assemblyJob.save();
        console.log("Assembly Team record created for job:", existing.job_no);
      }

      // STORE MATERIAL ISSUE:
      // Always create for all PRODUCTION jobs. Do NOT create for Sample jobs.
      let createdStoreIssueDoc = null;
      if (!isSampleJob) {
        const existingStoreIssue = await StoreMaterialIssue.findOne({ sub_job_no: existing.sub_job_no });
        if (!existingStoreIssue) {
          createdStoreIssueDoc = await createStoreIssueFromDTPJob(newDTP, userId);
          console.log("Store Material Issue entry created for Production job:", existing.job_no);
        } else {
          createdStoreIssueDoc = existingStoreIssue;
        }
      }

      const existingShopFloorJobs = await shopFloorJobModel.findOne({ sub_job_no: existing.sub_job_no });
      // CREATE SHOP FLOOR PROCESS JOBS (Grouped by Process)
      if (!existingShopFloorJobs) {
        if (bomData?.materialprocess) {
          try {
            await createShopFloorJobsFromSO({ ...existing.toObject(), ...updates, job_quantity }, bomData);
            console.log(`Created ShopFloorJob entries for ${existing.job_no}`);
          } catch (shopFloorError) {
            console.error("Error creating shop floor jobs during SO push:", shopFloorError);
          }
        }
      }

      // Link created IDs directly into enquiry_flows_integration sub_jobs
      try {
        const enqQuery = existing.enquiry_flow_id
          ? { _id: existing.enquiry_flow_id }
          : { $or: [{ enquiry_no: existing.job_no }, { enquiry_no: `RD${String(existing.job_no || '').replace(/^RD/i, '')}` }] };
        const enqDoc = await EnquiryJob.findOne(enqQuery);
        if (enqDoc) {
          const updateSet = {
            "sub_jobs.$.is_pushed_shop_floor": true,
            "sub_jobs.$.pushed_to_shop_floor_at": getCurrentDate(),
            "sub_jobs.$.production_status": "process",
          };
          if (!isSampleJob && newDTP?._id) {
            updateSet["sub_jobs.$.dtp_id"] = newDTP._id;
          }
          if (!isSampleJob && createdStoreIssueDoc?._id) {
            updateSet["sub_jobs.$.material_issue_id"] = createdStoreIssueDoc._id;
          }
          await EnquiryJob.updateOne(
            { _id: enqDoc._id, "sub_jobs.sub_job_no": existing.sub_job_no },
            { $set: updateSet }
          );
        }
      } catch (enqSyncErr) {
        console.error("Error syncing enquiry_flows_integration sub-job on push:", enqSyncErr);
      }
    }

    // Sync delivery_date, job_completion_datetime, and job_quantity to salesorderformModel
    // when they are part of a direct edit (not triggered by hold/unhold)
    if (updates.is_on_hold === undefined) {
      const isSensitiveFieldEdited =
        updates.delivery_date !== undefined ||
        updates.job_completion_datetime !== undefined ||
        updates.job_quantity !== undefined;

      if (isSensitiveFieldEdited) {
        const remark = updates.remark ? String(updates.remark).trim() : "";
        if (!remark) {
          return res.status(400).json({ success: false, message: "Remark is required when editing delivery date, job completion date and qty." });
        }

        // Fetch the current "before" values from the linked sales order form
        const existingForm = await salesorderformModel.findOne({
          job_no: existing.job_no,
          sub_job_no: existing.sub_job_no,
          enquiry_id: existing.enquiry_id?._id,
        }).lean();

        // Build per-field before/after change log
        const field_changes = [];

        if (updates.delivery_date !== undefined) {
          field_changes.push({
            field: "Delivery Date",
            before: existingForm?.delivery_date || existing.delivery_date || "—",
            after: updates.delivery_date || "—",
          });
        }
        if (updates.job_completion_datetime !== undefined) {
          field_changes.push({
            field: "Job Completion Date",
            before: existingForm?.job_completion_datetime || existing.job_completion_datetime || "—",
            after: updates.job_completion_datetime || "—",
          });
        }
        if (updates.job_quantity !== undefined) {
          // Get the current qty from BOM if linked, else from form
          let currentQty = existingForm?.job_quantity ?? null;
          if (currentQty === null && (existing.bom_nanoid || existing.bom_id)) {
            const bomQuery = existing.bom_nanoid ? { id: existing.bom_nanoid } : { _id: existing.bom_id };
            const bom = await bomModel.findOne(bomQuery).lean();
            if (bom) currentQty = bom.job_quantity;
          }
          field_changes.push({
            field: "Quantity",
            before: currentQty != null ? String(currentQty) : "—",
            after: String(updates.job_quantity),
          });
        }

        // Push remark + field_changes to edit_remarks history
        updates.$push = updates.$push || {};
        updates.$push.edit_remarks = {
          remark,
          edited_by: userId,
          edited_at: getCurrentDate(),
          field_changes,
        };
      }

      // Remove remark from flat updates so it doesn't interfere with $set
      delete updates.remark;

      if (updates.job_quantity !== undefined) {
        let currentQty = existing.job_quantity;
        if (existing.bom_nanoid || existing.bom_id) {
          const bomQuery = existing.bom_nanoid ? { id: existing.bom_nanoid } : { _id: existing.bom_id };
          const bomObj = await bomModel.findOne(bomQuery);
          if (bomObj) currentQty = bomObj.job_quantity;
        }

        const newQtyVal = Number(updates.job_quantity);
        if (currentQty !== undefined && newQtyVal !== currentQty) {
          if (existing.is_pushed_shop_floor === true || existing.is_pushed_shop_floor === 'true') {
            // Sandbox the quantity update inside the BOM's qty_update field
            if (existing.bom_id || existing.bom_nanoid) {
              const bomQuery = existing.bom_nanoid ? { id: existing.bom_nanoid } : { _id: existing.bom_id };
              const bomObj = await bomModel.findOne(bomQuery);
              if (bomObj) {
                bomObj.qty_update = {
                  old_qty: currentQty,
                  new_qty: newQtyVal,
                  status: "pending",
                  is_admin_approved: false,
                  is_client_approved: false,
                  requested_by: userId,
                  requested_at: getCurrentDate()
                };
                await bomObj.save();
                console.log(`[QtyInterception] Sandboxed quantity update to BOM qty_update for ${existing.sub_job_no}: ${currentQty} -> ${newQtyVal}`);

                // Instantly trigger detailed recalculation and PDF draft generation
                await triggerBOMRecalculationForPendingQty({ _id: bomObj._id }, newQtyVal);
              }
            }

            // Mark quantity change pending approval on the sales order list model
            updates.is_qty_pending_approval = true;
            updates.is_reprocessed_approved = false;

            // Set job_quantity to the active old quantity (currentQty)
            updates.job_quantity = Number(currentQty);
          } else {
            // Directly update the quantity without sandboxing/approvals
            updates.job_quantity = newQtyVal;
            console.log(`[QtyUpdateDirect] Direct quantity update for ${existing.sub_job_no}: ${currentQty} -> ${newQtyVal}`);
          }
        } else {
          updates.job_quantity = Number(currentQty);
        }
      }

      const formSyncUpdates = {};
      if (updates.delivery_date !== undefined) formSyncUpdates.delivery_date = updates.delivery_date;
      if (updates.job_completion_datetime !== undefined) formSyncUpdates.job_completion_datetime = updates.job_completion_datetime;
      if (updates.job_quantity !== undefined) formSyncUpdates.job_quantity = Number(updates.job_quantity);

      if (Object.keys(formSyncUpdates).length > 0) {
        await salesorderformModel.findOneAndUpdate(
          {
            job_no: existing.job_no,
            sub_job_no: existing.sub_job_no,
            enquiry_id: existing.enquiry_id?._id,
          },
          { $set: formSyncUpdates }
        );
        console.log(`Synced form fields for ${existing.sub_job_no}:`, formSyncUpdates);
      }


      // Cascade quantity and date changes to other collections
      await syncSampleOrderCascades({ existing, updates, userId });
    }

    // Capture bom_history for Allowed Actions: "Approved", "Rework", "Rejected", "Reprocess Approved"
    if (updates.is_bom_verified !== undefined || updates.is_bom_rework !== undefined) {
      let actionName = null;
      const isVerifiedTrue = updates.is_bom_verified === true || updates.is_bom_verified === "true";
      const isVerifiedFalse = updates.is_bom_verified === false || updates.is_bom_verified === "false";
      const isReworkFalse = updates.is_bom_rework === false || updates.is_bom_rework === "false";
      const isReworkTrue = updates.is_bom_rework === true || updates.is_bom_rework === "true";

      if (isVerifiedTrue) {
        actionName = "Approved";
      } else if (isReworkFalse || isReworkTrue) {
        actionName = "Rework";
      } else if (isVerifiedFalse) {
        actionName = "Rejected";
      }

      if (actionName && ["Approved", "Rework", "Rejected", "Reprocess Approved"].includes(actionName)) {
        const actorUser = req.user || (userId ? await userModel.findById(userId).select("name role") : null);
        updates.$push = updates.$push || {};
        updates.$push.bom_history = {
          action: actionName,
          action_by_type: actorUser ? "Internal User" : "Client",
          action_by_user: actorUser ? actorUser._id : null,
          action_by_name: actorUser ? actorUser.name : "Client",
          action_by_role: actorUser ? actorUser.role : "Client",
          remarks: updates.is_bom_verified_remarks || updates.reprocessed_remarks || "",
          date_time: getCurrentDate(),
        };
      }
    }

    // Separate $push from flat fields before applying $set
    const pushOps = updates.$push || {};
    delete updates.$push;
    const mongoUpdate = { $set: updates };
    if (Object.keys(pushOps).length > 0) mongoUpdate.$push = pushOps;

    const updated = await salesorderlistModel.findOneAndUpdate({ id }, mongoUpdate, { new: true })
      .populate("blocked_materials");
    if (!updated) return res.status(404).json({ success: false, message: "Sample order not found" });

    const obj = updated.toObject();
    obj.image = obj.image ? generateSignedUrl(obj.image) : null;

    obj.designer_files = Array.isArray(obj.designer_files)
      ? obj.designer_files.map((file) => generateSignedUrl(file))
      : [];

    obj.Pi_files = Array.isArray(obj.Pi_files)
      ? obj.Pi_files.map((file) => generateSignedUrl(file))
      : [];

    obj.quatation_files = Array.isArray(obj.quatation_files)
      ? obj.quatation_files.map((file) => generateSignedUrl(file))
      : [];

    if (Array.isArray(obj.bom_history)) {
      obj.bom_history = obj.bom_history.map((log) => {
        if (log && log.file_url) {
          return {
            ...log,
            file_url: generateSignedUrl(log.file_url)
          };
        }
        return log;
      });
    }

    obj.additional_files = Array.isArray(obj.additional_files)
      ? obj.additional_files.map((item) => {
        if (typeof item === 'string') {
          return generateSignedUrl(item);
        } else if (item && item.file_url) {
          return {
            ...item,
            file_url: generateSignedUrl(item.file_url)
          };
        }
        return item;
      })
      : [];

    // Merge salesorderform data so the response carries the correct delivery_date,
    // job_completion_datetime, etc. — same as getAllSampleOrders does.
    const updatedForm = await salesorderformModel.findOne({
      job_no: updated.job_no,
      sub_job_no: updated.sub_job_no,
      enquiry_id: updated.enquiry_id,
    }).lean();

    if (updatedForm) {
      obj.delivery_date = updatedForm.delivery_date;
      obj.job_completion_datetime = updatedForm.job_completion_datetime;
      obj.job_quantity = obj.job_quantity || updatedForm.job_quantity;
      obj.client_name = updatedForm.client_name || obj.client_name;
      obj.product_name = updatedForm.product_name || obj.product_name;
    }

    return res.status(200).json({ success: true, message: "Sample order updated", data: obj });
  } catch (error) {
    console.error("updateSampleOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}


export const deleteSampleOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await salesorderlistModel.findOne({ id });
    if (!existing) return res.status(404).json({ success: false, message: "Sample order not found" });

    if (existing.image) {
      try {
        await deleteFromR2(existing.image);
      } catch (err) {
        console.warn("Failed to delete image from R2:", err.message);
      }
    }

    await salesorderlistModel.deleteOne({ id });
    return res.status(200).json({ success: true, message: "Sample order deleted" });
  } catch (error) {
    console.error("deleteSampleOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


export const sendPIEmailById = async (req, res) => {
  try {
    const { id } = req.params;

    const so = await salesorderlistModel.findOne({ id })
      .populate("enquiry_id", "name product_name id")
      .lean();

    if (!so) {
      return res.status(404).json({
        success: false,
        message: "Sample order PI not found",
      });
    }


    const form = await salesorderformModel.findOne({
      job_no: so.job_no,
      sub_job_no: so.sub_job_no,
      enquiry_id: so.enquiry_id?._id,
    }).lean();

    const signedPiFiles = await Promise.all(so.Pi_files.map(file => generateSignedUrl(file)));


    const enrichedSO = {
      ...so,
      Pi_files: signedPiFiles,
      job_quantity: form?.job_quantity || null,
      delivery_date: form?.delivery_date || null,
      client_name: form?.client_name || so.enquiry_id?.name || null,
      product_name: form?.product_name || so.enquiry_id?.product_name || null,
      wp_number: form?.wp_number || null,
      email: form?.email || so.email || null,
    };

    if (!enrichedSO.email) {
      return res.status(400).json({
        success: false,
        message: "No email found to send the PI",
      });
    }


    const emailHTML = await generateEmailTemplateForPI(enrichedSO, 43200);

    await transporter.sendMail({
      from: `"RD Custom Awards" <${process.env.EMAIL_SENDER}>`,
      to: Array.isArray(enrichedSO.email) ? enrichedSO.email.join(",") : enrichedSO.email,
      subject: `PI for ${enrichedSO.product_name ? enrichedSO.product_name.charAt(0).toUpperCase() + enrichedSO.product_name.slice(1) : "Product"}`,
      html: emailHTML,
    });

    res.status(200).json({
      success: true,
      message: "PI email sent successfully",
      enquiryId: id,
    });
  } catch (error) {
    console.error("Error sending Pi email:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



export const sendQuotationEmailById = async (req, res) => {
  try {
    const { id } = req.params;

    const so = await salesorderlistModel.findOne({ id })
      .populate("enquiry_id", "name product_name id")
      .lean();

    if (!so) {
      return res.status(404).json({
        success: false,
        message: "Sample order quotation not found",
      });
    }


    const form = await salesorderformModel.findOne({
      job_no: so.job_no,
      sub_job_no: so.sub_job_no,
      enquiry_id: so.enquiry_id?._id,
    }).lean();

    const signedQuotationFiles = await Promise.all(so.quatation_files.map(file => generateSignedUrl(file)));


    const enrichedSO = {
      ...so,
      quatation_files: signedQuotationFiles,
      job_quantity: form?.job_quantity || null,
      delivery_date: form?.delivery_date || null,
      client_name: form?.client_name || so.enquiry_id?.name || null,
      product_name: form?.product_name || so.enquiry_id?.product_name || null,
      wp_number: form?.wp_number || null,
      email: form?.email || so.email || null,
    };

    if (!enrichedSO.email) {
      return res.status(400).json({
        success: false,
        message: "No email found to send the PI",
      });
    }


    const emailHTML = await generateEmailTemplateForQuoatation(enrichedSO, 43200);

    await transporter.sendMail({
      from: `"RD Custom Awards" <${process.env.EMAIL_SENDER}>`,
      to: Array.isArray(enrichedSO.email) ? enrichedSO.email.join(",") : enrichedSO.email,
      subject: `Quotation for ${enrichedSO.product_name ? enrichedSO.product_name.charAt(0).toUpperCase() + enrichedSO.product_name.slice(1) : "Product"}`,
      html: emailHTML,
    });

    res.status(200).json({
      success: true,
      message: "Quotataion email sent successfully",
      enquiryId: id,
    });
  } catch (error) {
    console.error("Error sending Quotation email:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const updateSampleOrderBOM = async (req, res) => {
  try {
    const { csid } = req.params;
    const {
      is_bom_verified,
      is_bom_verified_remarks,
      is_bom_rework,
      is_pi_verified,
      is_pi_verified_remarks,
      is_pi_rework,
      is_reprocessed_approved,
      reprocessed_remarks
    } = req.body;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(csid);
    const query = isObjectId ? { $or: [{ _id: csid }, { id: csid }] } : { id: csid };

    const existing = await salesorderlistModel.findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Sample order not found" });
    }

    if (existing.is_on_hold) {
      return res.status(400).json({ success: false, message: "Sample order is on hold. Unhold to perform actions." });
    }

    // Programmatic routing for reprocessed quantity approval
    if (is_reprocessed_approved !== undefined) {
      const bomObj = await bomModel.findOne({ sales_order_nanoid: existing.id });
      if (bomObj && bomObj.qty_update && bomObj.qty_update.status === "pending") {
        const actionType = (is_reprocessed_approved === true || is_reprocessed_approved === "true" || is_reprocessed_approved === "Approve" || is_reprocessed_approved === "approve") ? "approve" : "reject";

        let responseStatus = 200;
        let responseData = {};

        const mockReq = {
          params: { id: bomObj.id },
          body: { role: "client", action: actionType, remarks: reprocessed_remarks },
          user: { _id: "client-gate-public-portal" }
        };

        const mockRes = {
          status: (code) => {
            responseStatus = code;
            return mockRes;
          },
          json: (data) => {
            responseData = data;
            return mockRes;
          }
        };

        await approveBOMQtyUpdate(mockReq, mockRes);
        return res.status(responseStatus).json(responseData);
      }
    }

    const actor = await getAuthUserFromReq(req);
    const action_by_type = actor ? "Internal User" : "Client";
    const action_by_user = actor ? actor._id : null;
    const action_by_name = actor ? actor.name : "Client";
    const action_by_role = actor ? actor.role : "Client";

    const updates = {
      is_bom_verified,
      is_bom_verified_remarks,
      is_bom_rework,
      is_pi_verified,
      is_pi_verified_remarks,
      is_pi_rework,
      updated_at: getCurrentDate(),
    };

    const nowDt = getCurrentDate();
    const pushOps = {};

    if (is_bom_verified !== undefined || is_bom_rework !== undefined) {
      let actionName = null;
      const isVerifiedTrue = is_bom_verified === true || is_bom_verified === "true";
      const isVerifiedFalse = is_bom_verified === false || is_bom_verified === "false";
      const isReworkFalse = is_bom_rework === false || is_bom_rework === "false";
      const isReworkTrue = is_bom_rework === true || is_bom_rework === "true";

      if (isVerifiedTrue) {
        actionName = "Approved";
      } else if (isReworkFalse || isReworkTrue) {
        actionName = "Rework";
      } else if (isVerifiedFalse) {
        actionName = "Rejected";
      }

      if (actionName && ["Approved", "Rework", "Rejected", "Reprocess Approved"].includes(actionName)) {
        pushOps.bom_history = {
          action: actionName,
          action_by_type,
          action_by_user,
          action_by_name,
          action_by_role,
          remarks: is_bom_verified_remarks || "",
          date_time: nowDt,
        };
      }
    }

    if (is_pi_verified !== undefined || is_pi_rework !== undefined) {
      let actionName = "Updated";
      if (is_pi_verified === true || is_pi_verified === "true") {
        actionName = "Approved";
      } else if (is_pi_rework === true || is_pi_rework === "true") {
        actionName = "Rework";
      } else if (is_pi_verified === false || is_pi_verified === "false") {
        actionName = "Rejected";
      }

      pushOps.pi_history = {
        action: actionName,
        action_by_type,
        action_by_user,
        action_by_name,
        action_by_role,
        remarks: is_pi_verified_remarks || "",
        date_time: nowDt,
      };
    }

    const updateQuery = { $set: updates };
    if (Object.keys(pushOps).length > 0) {
      updateQuery.$push = pushOps;
    }

    const updated = await salesorderlistModel.findOneAndUpdate(
      query,
      updateQuery,
      { new: true }
    );

    return res.status(200).json({ success: true, message: "Sample order BOM updated", data: updated });
  } catch (error) {
    console.error("updateSampleOrderBOM error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


export const deleteAdditionalFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_url, file_id } = req.body;

    if (!file_url && !file_id) return res.status(400).json({ success: false, message: "File identifier (URL or ID) is required" });

    // Find by nanoid 'id' first, then fallback to mongoose '_id'
    let order = await salesorderlistModel.findOne({ id });
    if (!order && id.length === 24) {
      order = await salesorderlistModel.findById(id);
    }

    if (!order) return res.status(404).json({ success: false, message: "Sample order not found" });

    const originalLength = (order.additional_files || []).length;
    let urlToDelete = file_url;
    let newFiles = [];

    if (file_id) {
      // Delete by specific MongoDB Object ID inside the array
      newFiles = (order.additional_files || []).filter(item => {
        // If item is object and has _id
        if (item && item._id && item._id.toString() === file_id) {
          urlToDelete = item.file_url; // Capture URL for R2 deletion
          return false;
        }
        return true;
      });
    } else {
      // Fallback to strict/fuzzy URL matching if no ID provided
      const normalizeUrl = (u) => {
        if (!u) return '';
        try { return u.split('?')[0]; } catch { return u; }
      };

      const targetUrl = normalizeUrl(file_url);

      newFiles = (order.additional_files || []).filter(item => {
        const itemUrl = typeof item === 'string' ? item : item.file_url;
        const currentUrl = normalizeUrl(itemUrl);

        if (currentUrl === targetUrl) return false;
        if (itemUrl === file_url) return false;
        return true;
      });
    }

    if (newFiles.length === originalLength) {
      return res.status(404).json({ success: false, message: "File not found in order record" });
    }

    // Update the order with the filtered list
    order.additional_files = newFiles;
    await order.save();

    // Delete from R2 if we have a URL
    // For legacy string items, the item itself is the URL.
    // urlToDelete might be set from ID finding block, or passed in body
    if (urlToDelete) {
      try {
        await deleteFromR2(urlToDelete);
      } catch (err) {
        console.error("Failed to delete from R2:", err);
      }
    }

    return res.status(200).json({ success: true, message: "File deleted successfully", data: order });
  } catch (error) {
    console.error("deleteAdditionalFile error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export const sendDtpEmailById = async (req, res) => {
  try {
    const { id } = req.params; // sampleOrderId
    const { type, dtpId } = req.query; // type: 'master' | 'proofing'

    const so = await salesorderlistModel.findOne({ id })
      .populate("enquiry_id", "name product_name id")
      .lean();

    if (!so) {
      return res.status(404).json({
        success: false,
        message: "Sample order not found",
      });
    }

    const form = await salesorderformModel.findOne({
      job_no: so.job_no,
      sub_job_no: so.sub_job_no,
      enquiry_id: so.enquiry_id?._id,
    }).lean();

    const enrichedSO = {
      ...so,
      job_quantity: form?.job_quantity || null,
      delivery_date: form?.delivery_date || null,
      client_name: form?.client_name || so.enquiry_id?.name || null,
      product_name: form?.product_name || so.enquiry_id?.product_name || null,
      wp_number: form?.wp_number || null,
      email: form?.email || so.email || null,
    };

    if (!enrichedSO.email) {
      return res.status(400).json({
        success: false,
        message: "No email found to send the update",
      });
    }

    let finalDtpId = dtpId;
    if (!finalDtpId) {
      const dtpJob = await dtpStudioModel.findOne({ sample_order_id: so._id });
      if (dtpJob) finalDtpId = dtpJob._id;
    }

    const emailHTML = generateEmailTemplateForDtp(enrichedSO, finalDtpId, type);

    // Subject Configuration
    let subjectPrefix = "Product Update";
    if (type === 'master') subjectPrefix = "Master Template Update";
    if (type === 'proofing') subjectPrefix = "Content Proofing Update";

    // Format: "Subject Prefix - SubJobNo - ProductName"
    const productName = enrichedSO.product_name ? `${enrichedSO.product_name.charAt(0).toUpperCase() + enrichedSO.product_name.slice(1)}` : "Product";
    const subject = `${subjectPrefix} - ${enrichedSO.sub_job_no} - ${productName}`;

    await transporter.sendMail({
      from: `"RD Custom Awards" <${process.env.EMAIL_SENDER}>`,
      to: Array.isArray(enrichedSO.email) ? enrichedSO.email.join(",") : enrichedSO.email,
      subject: subject,
      html: emailHTML,
    });

    res.status(200).json({
      success: true,
      message: `${subjectPrefix} email sent successfully`,
      enquiryId: id,
    });
  } catch (error) {
    console.error("Error sending DTP email:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const sendDtpWhatsAppById = async (req, res) => {
  try {
    const { id } = req.params; // sampleOrderId
    const { type, dtpId, phone } = req.query; // type: 'master' | 'proofing'

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const so = await salesorderlistModel.findOne({ id })
      .populate("enquiry_id", "name product_name id wp_number")
      .lean();

    if (!so) {
      return res.status(404).json({ success: false, message: "Sample order not found" });
    }

    const form = await salesorderformModel.findOne({
      job_no: so.job_no,
      sub_job_no: so.sub_job_no,
      enquiry_id: so.enquiry_id?._id,
    }).lean();

    const clientName = form?.client_name || so.enquiry_id?.name || "Customer";
    const productName = form?.product_name || so.enquiry_id?.product_name || "Product";
    const subJobNo = so.sub_job_no || "N/A";

    // Capitalize names
    const displayClientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);
    const displayProductName = productName.charAt(0).toUpperCase() + productName.slice(1);

    let finalDtpId = dtpId;
    if (!finalDtpId) {
      const dtpJob = await dtpStudioModel.findOne({ sample_order_id: so._id });
      if (dtpJob) finalDtpId = dtpJob._id;
    }

    // Determine Variables
    let var1 = `Update – Sub Job No: ${subJobNo}`;
    let var3 = `Files`;
    let var5 = `files`;

    if (type === 'master') {
      var1 = `Master Template Update – Sub Job No: ${subJobNo}`;
      var3 = `Master Template`;
      var5 = `design files`;
    } else if (type === 'proofing') {
      var1 = `Content Proofing Update – Sub Job No: ${subJobNo}`;
      var3 = `Content Proof`;
      var5 = `proofing files`;
    } else if (type === 'sample') {
      var1 = `Sample Trophy Update – Job No: ${subJobNo}`;
      var3 = `details`;
      var5 = `product details`;
    }

    // Link Generation
    const enquiryId = so.enquiry_id?.id || so.enquiry_id?._id || so.enquiry_id;
    const expiryTimestamp = Date.now() + 24 * 60 * 60 * 1000;
    const encodedExpiry = Buffer.from(expiryTimestamp.toString()).toString("base64");

    let link = `${process.env.CLIENT_CONFIRMATION_SCREEN_URL}/rd/clientconfirmation/${enquiryId}/${id}`;
    if (finalDtpId) {
      link += `/${finalDtpId}`;
    }
    link += `/?v=1&exp=${encodedExpiry}`;

    const expiryDate = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const payload = {
      receiver: phone.replace(/\D/g, ''),
      values: {
        "1": var1,
        "2": displayClientName,
        "3": var3,
        "4": displayProductName,
        "5": var5,
        "6": link,
        "7": expiryDate
      }
    };

    console.log(`Sending DTP WhatsApp (${type}) to ${payload.receiver}...`, payload);

    const url = process.env.TWOFACTOR_WHATSAPP_PRODUCT_REVIEW_FILE_UPDATE_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("2Factor API Error:", errorText);
      throw new Error(`WhatsApp API responded with status ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({
      success: true,
      message: `WhatsApp ${type} proof sent successfully.`,
      data
    });
  } catch (error) {
    console.error("Error sending DTP WhatsApp:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
