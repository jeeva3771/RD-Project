import { nanoid } from "nanoid";
import userModel from "../../../models/users/userModel.js";
import vendorModel from "../../../models/masters/vendorModel.js";
import itemModel from "../../../models/inventory/item/itemModel.js";
import poModel from "../../../models/inventory/purchaseOrder/poModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

// Auto-generate code like PO001 / GRN001
const getNextCode = async (Model, field, prefix) => {
  const last = await Model.findOne({ [field]: { $regex: `^${prefix}\\d+$` } })
    .sort({ createdAt: -1 })
    .select(field);
  let next = 1;
  if (last?.[field]) {
    const match = last[field].match(/\d+$/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
};

//Automatically determine main PO status based on vendor statuses
const updateMainPOStatus = (po) => {
  const vendorStatuses = po.vendors.map((v) => v.order_status);

  const allCompleted = vendorStatuses.every((s) => s === "Completed");
  const allDispatched = vendorStatuses.every((s) => s === "Dispatched");
  const anyDispatched = vendorStatuses.some((s) => s === "Dispatched");
  const anyCompleted = vendorStatuses.some((s) => s === "Completed");

  if (allCompleted) {
    po.status = "Completed";
  } else if (allDispatched || (anyDispatched && anyCompleted)) {
    po.status = "Dispatched";
  } else {
    po.status = "Pending";
  }

  return po.status;
};

export const getAllPO = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({
        success: false,
        message: "User not valid or inactive",
      });

    const search = req.query.search?.trim() || "";
    const status = req.query.status?.trim() || "";

    // Search query
    const query = {};
    if (search) {
      query.$or = [
        { po_number: { $regex: search, $options: "i" } },
        { job_number: { $regex: search, $options: "i" } },
        { "vendors.vendor_name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;

    const pos = await poModel
      .find(query)
      .populate("vendors.vendor_id", "name mobile_no email")
      .populate("vendors.items.item_id", "name category_id unit_id")
      .populate("vendors.items.category_id", "name")
      .populate("vendors.items.unit_id", "name short_code")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = pos.map((po) => {
      const totalQty = po.vendors.reduce((sumV, v) => {
        return (
          sumV + v.items.reduce((sumI, i) => sumI + (i.purchase_qty || 0), 0)
        );
      }, 0);

      const vendorList = po.vendors.map((v) => ({
        vendor_name: v.vendor_name,
        mobile_no: v.mobile_no,
        email: v.email,
        total_amount: v.total_amount,
        order_status: v.order_status,
        share_status: v.share_status,
        notes: v.notes,
        terms: v.terms,
        items: v.items.map((i) => ({
          item_code: i.item_code,
          name: i.name,
          category: i.category_id?.name || "",
          unit: i.unit_id?.short_code || "",
          required_qty: i.required_qty,
          purchase_qty: i.purchase_qty,
          rate: i.rate,
          total: i.total,
          remarks: i.remarks || "",
        })),
      }));

      return {
        id: po.id,
        job_number: po.job_number,
        po_number: po.po_number,
        po_date: po.po_date,
        expected_delivery: po.expected_delivery || "",
        status: po.status,
        grand_total: po.grand_total,
        total_qty: totalQty,
        vendors: vendorList,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching POs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchase orders",
      error: error.message,
    });
  }
};

// CREATE PO
export const createPO = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const validUser = await userModel.exists({ _id: userId, is_active: true });
    if (!validUser)
      return res.status(403).json({ success: false, message: "User invalid" });

    const { job_number, po_date, expected_delivery, vendors } = req.body;
    if (
      !job_number ||
      !po_date ||
      !Array.isArray(vendors) ||
      vendors.length === 0
    )
      return res
        .status(400)
        .json({ success: false, message: "Invalid PO data" });

    for (const v of vendors) {
      const ven = await vendorModel.findById(v.vendor_id);
      if (!ven)
        return res
          .status(404)
          .json({ success: false, message: "Vendor not found" });
      v.vendor_name = ven.name;
      v.email = ven.email;
      v.mobile_no = ven.mobile_no;
      v.total_amount = v.items.reduce(
        (sum, i) => sum + i.purchase_qty * i.rate,
        0
      );
      v.items = await Promise.all(
        v.items.map(async (it) => {
          const item = await itemModel.findById(it.item_id);
          if (!item) throw new Error("Item not found");
          return {
            item_id: item._id,
            item_code: item.item_code,
            name: item.name,
            category_id: item.category_id,
            unit_id: item.unit_id,
            required_qty: it.required_qty,
            purchase_qty: it.purchase_qty,
            rate: it.rate,
            total: it.purchase_qty * it.rate,
          };
        })
      );
    }

    const po_number = await getNextCode(poModel, "po_number", "PO");
    const doc = await poModel.create({
      id: nanoid(16),
      po_number,
      job_number,
      po_date,
      expected_delivery,
      vendors,
      grand_total: vendors.reduce((t, v) => t + v.total_amount, 0),
      created_by: userId,
      created_at: getCurrentDate(),
    });

    res
      .status(201)
      .json({ success: true, message: "PO created successfully", data: doc });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating PO",
      error: error.message,
    });
  }
};

// SHARE PO TO VENDOR
export const shareVendorPO = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const validUser = await userModel.exists({ _id: userId, is_active: true });
    if (!validUser)
      return res.status(403).json({ success: false, message: "User invalid" });
    const { poId, subVendorId } = req.params;

    // find by your custom 'id' field
    const po = await poModel.findById(poId);
    if (!po)
      return res.status(404).json({ success: false, message: "PO not found" });

    const vendor = po.vendors.id(subVendorId);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor entry not found" });

    // update vendor-level statuses
    vendor.share_status = "Shared";
    vendor.order_status = "Dispatched";

    // automatically update main PO status
    const newStatus = updateMainPOStatus(po);
    po.updated_at = getCurrentDate();
    po.updated_by = userId;
    await po.save();

    res.json({
      success: true,
      message: "PO shared to vendor",
      overAll_po_status: newStatus,
    });
  } catch (error) {
    console.error("Error sharing PO:", error);
    res.status(500).json({
      success: false,
      message: "Error sharing PO",
      error: error.message,
    });
  }
};

// VENDOR ACCEPT / REJECT
export const vendorAction = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const validUser = await userModel.exists({ _id: userId, is_active: true });
    if (!validUser)
      return res.status(403).json({ success: false, message: "User invalid" });

    const { action } = req.body; // "Accepted" | "Rejected"
    const { poId, subVendorId } = req.params;

    const po = await poModel.findById(poId);
    if (!po)
      return res.status(404).json({ success: false, message: "PO not found" });

    const vendor = po.vendors.id(subVendorId);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor entry not found" });

    if (action === "Accepted") {
      vendor.share_status = "Accepted";
      vendor.order_status = "Accepted"; // Vendor accepted PO
    } else if (action === "Rejected") {
      vendor.share_status = "Rejected";
      vendor.order_status = "Rejected"; // Vendor rejected PO
    }

    // Update parent PO status if all vendors accepted or rejected
    const allAccepted = po.vendors.every((v) => v.order_status === "Accepted");
    const allRejected = po.vendors.every((v) => v.order_status === "Rejected");
    if (allAccepted) po.status = "Dispatched";
    if (allRejected) po.status = "Rejected";

    po.updated_at = getCurrentDate();
    po.updated_by = userId;
    await po.save();

    // UI hint for frontend
    const nextAction =
      action === "Accepted"
        ? "Show Stock Inward button"
        : "Show Create New PO button";

    res.json({
      success: true,
      message: `Vendor ${action}`,
      vendor_status: vendor.order_status,
      next_action: nextAction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating vendor status",
      error: error.message,
    });
  }
};

// LIST GRN
// export const listGRNs = async (req, res) => {
//   try {
//     const list = await grnModel.find().sort({ createdAt: -1 });
//     res.json({ success: true, data: list });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error listing GRNs",
//       error: error.message,
//     });
//   }
// };
