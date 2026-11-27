import { nanoid } from "nanoid";
import userModel from "../../../models/users/userModel.js";
import itemModel from "../../../models/inventory/item/itemModel.js";
import poModel from "../../../models/inventory/purchaseOrder/poModel.js";
import grnModel from "../../../models/inventory/grn/grnModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

// Helper to auto-generate GRN number
const getNextGRNCode = async () => {
  const last = await grnModel
    .findOne({ grn_number: { $regex: /^GRN\d+$/ } })
    .sort({ createdAt: -1 })
    .select("grn_number");

  let next = 1;
  if (last?.grn_number) {
    const match = last.grn_number.match(/\d+$/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return "GRN" + String(next).padStart(3, "0");
};

/*
 Create GRN record (Stock Inward)
 Validates PO and Vendor
 Creates GRN record
 Updates Vendor and PO status
 Updates Item stock quantity
 */
export const createGRN = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user" });

    const userValid = await userModel.exists({ _id: userId, is_active: true });
    if (!userValid)
      return res
        .status(403)
        .json({ success: false, message: "User not valid or inactive" });

    const {
      po_number,
      sub_vendor_id,
      invoice_no,
      challan_no,
      min_no,
      date,
      items,
    } = req.body;

    if (!po_number || !sub_vendor_id || !Array.isArray(items) || !items.length)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });

    // Find PO and Vendor
    const po = await poModel.findOne({ po_number });
    if (!po)
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });

    const vendor = po.vendors.id(sub_vendor_id);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found in PO" });

    if (vendor.order_status !== "Accepted")
      return res.status(400).json({
        success: false,
        message: "Vendor must accept PO before inward",
      });

    // Generate GRN number
    const grn_number = await getNextGRNCode();

    // Create GRN entry
    const grn = await grnModel.create({
      id: nanoid(16),
      grn_number,
      po_number,
      job_number: po.job_number,
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      invoice_no,
      challan_no,
      min_no,
      date: date || getCurrentDate(),
      items,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    // Update each item stock
    for (const it of items) {
      if (it.item_id && it.qty_received > 0) {
        await itemModel.updateOne(
          { _id: it.item_id },
          { $inc: { stock: it.qty_received } }
        );
      }
    }

    // Update vendor + PO statuses
    vendor.order_status = "Completed";
    vendor.share_status = "Accepted";

    const allDone = po.vendors.every((v) => v.order_status === "Completed");
    if (allDone) po.status = "Completed";

    po.updated_by = userId;
    po.updated_at = getCurrentDate();
    await po.save();

    res.status(201).json({
      success: true,
      message: "GRN created successfully",
      data: grn,
    });
  } catch (error) {
    console.error("Error creating GRN:", error);
    res.status(500).json({
      success: false,
      message: "Error creating GRN",
      error: error.message,
    });
  }
};

// Get All GRN Records (Paginated + Filter)

export const getAllGRNs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page)) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit))) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const status = req.query.status || "";

    const query = {};
    if (search)
      query.$or = [
        { grn_number: { $regex: search, $options: "i" } },
        { vendor_name: { $regex: search, $options: "i" } },
        { po_number: { $regex: search, $options: "i" } },
      ];
    if (status) query.status = status;

    const total = await grnModel.countDocuments(query);
    const data = await grnModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "vendor_id", select: "name email mobile_no" })
      .populate({ path: "items.item_id", select: "item_code name unit_id" })
      .lean();

    res.json({
      success: true,
      total,
      count: data.length,
      page,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    console.error("Error fetching GRNs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching GRN records",
      error: error.message,
    });
  }
};

// Get GRN by ID or GRN Number
export const getGRNById = async (req, res) => {
  try {
    const { id } = req.params;

    const grn =
      (await grnModel
        .findOne({ grn_number: id })
        .populate("vendor_id", "name email mobile_no")
        .populate("items.item_id", "item_code name unit_id")
        .lean()) ||
      (await grnModel
        .findById(id)
        .populate("vendor_id", "name email mobile_no")
        .populate("items.item_id", "item_code name unit_id")
        .lean());

    if (!grn)
      return res.status(404).json({ success: false, message: "GRN not found" });

    res.json({ success: true, data: grn });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching GRN details",
      error: error.message,
    });
  }
};
