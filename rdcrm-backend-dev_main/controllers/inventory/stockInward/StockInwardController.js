import { nanoid } from "nanoid";
import userModel from "../../../models/users/userModel.js";
import itemModel from "../../../models/inventory/item/itemModel.js";
import inwardModel from "../../../models/inventory/stockInward/StockInwardModel.js";
import poModel from "../../../models/inventory/purchaseOrder/poModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import grnModel from "../../../models/inventory/grn/grnModel.js";
import enquiryModel from "../../../models/enquiry/enquiryModel.js";

// Helper: Generate running inward code like INW001
const getNextInwardCode = async () => {
  const last = await inwardModel
    .findOne({ inward_number: { $regex: /^INW\d+$/ } })
    .sort({ createdAt: -1 })
    .select("inward_number");

  let next = 1;
  if (last?.inward_number) {
    const match = last.inward_number.match(/\d+$/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return "INW" + String(next).padStart(3, "0");
};

const getNextGRNCode = async () => {
  const last = await inwardModel
    .findOne({ inward_number: { $regex: /^INW\d+$/ } })
    .sort({ createdAt: -1 })
    .select("grn_number");

  let next = 1;
  if (last?.grn_number) {
    const match = last.grn_number.match(/\d+$/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return "GRN" + String(next).padStart(3, "0");
};

// CREATE STOCK INWARD
export const createInward = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const validUser = await userModel.exists({ _id: userId, is_active: true });
    if (!validUser)
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
      qc_status, // Completed | Pending | Reject
      remarks,
    } = req.body;

    if (!po_number || !sub_vendor_id || !Array.isArray(items) || !items.length)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });

    // Validate PO
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
    // !["Accepted"].includes(vendor.order_status)
    // if (vendor.order_status !== "Accepted")
    //   return res.status(400).json({
    //     success: false,
    //     message: "Vendor must accept PO before inward",
    //   });

    // Check only for first-time inward creation
    const existingInward = await inwardModel.findOne({
      po_number,
      vendor_id: vendor.vendor_id,
    });

    // If no inward exists yet, vendor must be "Accepted"
    if (!existingInward && vendor.order_status !== "Accepted") {
      return res.status(400).json({
        success: false,
        message: "Vendor must accept PO before creating first inward",
      });
    }

    // Check if there’s already a pending inward for this vendor and PO
    const existingPending = await inwardModel.findOne({
      po_number,
      vendor_id: vendor.vendor_id,
      inward_status: "Pending",
    });

    if (existingPending) {
      // Merge logic: update items and remarks
      const updatedItems = [...existingPending.items];

      for (const it of items) {
        const idx = updatedItems.findIndex(
          (x) => x.item_id.toString() === it.item_id.toString()
        );
        if (idx >= 0) {
          // Update quantities
          updatedItems[idx].qty_received += Number(it.qty_received) || 0;
          updatedItems[idx].qty_rejected += Number(it.qty_rejected) || 0;
          updatedItems[idx].remarks = it.remarks || updatedItems[idx].remarks;
        } else {
          // Add new item if not found before
          const item = await itemModel.findById(it.item_id).lean();
          if (item) {
            updatedItems.push({
              item_id: item._id,
              item_code: item.item_code,
              name: item.name,
              category_id: item.category_id,
              unit_id: item.unit_id,
              qty_received: Number(it.qty_received) || 0,
              qty_rejected: Number(it.qty_rejected) || 0,
              remarks: it.remarks || "",
            });
          }
        }
      }

      // Update existing inward
      existingPending.items = updatedItems;
      existingPending.date = date || getCurrentDate();
      existingPending.remarks = remarks || existingPending.remarks;
      existingPending.updated_by = userId;
      existingPending.updated_at = getCurrentDate();

      await existingPending.save();

      return res.status(200).json({
        success: true,
        message: "Pending inward updated successfully",
        data: existingPending,
      });
    }

    

    // Fetch reference_no from Enquiry
    let reference_no = '';
    if (po.job_number) {
      const enq = await enquiryModel.findOne({ job_no: po.job_number }).select('reference_no').lean();
      if (enq) reference_no = enq.reference_no;
    }

    // Generate inward number
    const inward_number = await getNextInwardCode();

    // Build inward items with fallback details
    const inwardItems = await Promise.all(
      items.map(async (it) => {
        const item = await itemModel.findById(it.item_id).lean();
        if (!item) throw new Error(`Item not found: ${it.item_id}`);

        return {
          item_id: item._id,
          item_code: item.item_code,
          name: item.name,
          category_id: item.category_id,
          unit_id: item.unit_id,
          qty_received: Number(it.qty_received) || 0,
          qty_rejected: Number(it.qty_rejected) || 0,
          remarks: it.remarks || "",
        };
      })
    );

    // Create inward record
    const inward = await inwardModel.create({
      id: nanoid(16),
      inward_number,
      po_number,
      job_number: po.job_number,
      reference_no: reference_no,
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.vendor_name,
      invoice_no,
      challan_no,
      min_no,
      date: date || getCurrentDate(),
      items: inwardItems,
      inward_status: qc_status || "Pending",
      remarks: remarks || "",
      created_by: userId,
      created_at: getCurrentDate(),
    });

    // Always record received qty — even for pending QC
    for (const it of inwardItems) {
      const poItem = vendor.items.find(
        (v) => v.item_id.toString() === it.item_id.toString()
      );
      if (poItem) {
        poItem.received_qty = (poItem.received_qty || 0) + it.qty_received;
        poItem.pending_qty = Math.max(
          0,
          (poItem.purchase_qty || 0) - poItem.received_qty
        );
      }
    }

    // QC Status Based Actions
    if (qc_status === "Completed") {
      for (const it of inwardItems) {
        if (it.item_id && it.qty_received > 0) {
          await itemModel.updateOne(
            { _id: it.item_id },
            { $inc: { stock: it.qty_received } }
          );
        }
      }
      vendor.order_status = "Completed";
      vendor.share_status = "Accepted";
    } else if (qc_status === "Reject") {
      vendor.order_status = "Rejected";
      vendor.share_status = "Rejected";
    } else {
      vendor.order_status = "Pending";
      vendor.share_status = "Accepted";
    }

    // Update PO status
    const allCompleted = po.vendors.every(
      (v) => v.order_status === "Completed"
    );
    const allRejected = po.vendors.every((v) => v.order_status === "Rejected");
    const anyPending = po.vendors.some((v) => v.order_status === "Pending");
    const anyPartial = po.vendors.some(
      (v) => v.order_status === "Partially Received"
    );
    const anyCompleted = po.vendors.some((v) => v.order_status === "Completed");

    if (allCompleted) {
      po.status = "Completed";
    } else if (allRejected) {
      po.status = "Rejected";
    } else if (anyPending) {
      po.status = "Pending";
    } else if (anyPartial || (anyCompleted && !anyPending)) {
      po.status = "Partially Received";
    } else {
      po.status = "Pending";
    }

    po.updated_by = userId;
    po.updated_at = getCurrentDate();
    await po.save();

    if (qc_status === "Completed" || qc_status === "Pending") {
      const grn_number = await getNextGRNCode();

      const grnItems = inwardItems.map((it) => {
        const poItem = vendor.items.find(
          (v) => v.item_id.toString() === it.item_id.toString()
        );

        const ordered = poItem?.purchase_qty || 0;
        const totalReceived = poItem?.received_qty || it.qty_received;
        const pending = Math.max(0, ordered - totalReceived);

        return {
          item_id: it.item_id,
          item_code: it.item_code,
          name: it.name,
          ordered_qty: ordered,
          qty_received: it.qty_received,
          accepted_qty: it.qty_received - (it.qty_rejected || 0),
          qty_rejected: it.qty_rejected || 0,
          pending_qty: pending,
          remarks: it.remarks || "",
        };
      });

      const totalPending = grnItems.reduce(
        (sum, item) => sum + (item.pending_qty || 0),
        0
      );

      // Create GRN record
      await grnModel.create({
        id: nanoid(16),
        grn_number,
        po_number,
        job_number: po.job_number,
        vendor_id: vendor.vendor_id,
        vendor_name: vendor.vendor_name,
        inward_id: inward._id,
        invoice_no: invoice_no || "",
        challan_no: challan_no || "",
        min_no: min_no || "",
        date: date || getCurrentDate(),
        items: grnItems,
        status: totalPending === 0 ? "Completed" : "Partially Received",
        created_by: userId,
        created_at: getCurrentDate(),
      });

      console.log(`GRN ${grn_number} auto-created for PO ${po_number}`);
    }

    res.status(201).json({
      success: true,
      message: `Inward recorded successfully with QC status: ${qc_status}`,
      data: inward,
    });
  } catch (error) {
    console.error("Error creating Inward:", error);
    res.status(500).json({
      success: false,
      message: "Error recording Inward",
      error: error.message,
    });
  }
};

// GET ALL INWARD RECORDS

export const getAllInwards = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page)) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit))) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const query = {};

    if (search) {
      query.$or = [
        { inward_number: { $regex: search, $options: "i" } },
        { vendor_name: { $regex: search, $options: "i" } },
        { po_number: { $regex: search, $options: "i" } },
        { reference_no: { $regex: search, $options: "i" } },
      ];
    }

    const total = await inwardModel.countDocuments(query);
    const data = await inwardModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("vendor_id", "name email mobile_no")
      .populate("items.item_id", "item_code name unit_id")
      .lean();

    res.status(200).json({
      success: true,
      total,
      count: data.length,
      page,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    console.error("Error fetching Inwards:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching Inward records",
      error: error.message,
    });
  }
};

// GET SINGLE INWARD BY ID or INWARD NUMBER
export const getInwardById = async (req, res) => {
  try {
    const { id } = req.params;

    const inward =
      (await inwardModel
        .findOne({ inward_number: id })
        .populate("vendor_id", "name email mobile_no")
        .populate("items.item_id", "item_code name unit_id")
        .lean()) ||
      (await inwardModel
        .findById(id)
        .populate("vendor_id", "name email mobile_no")
        .populate("items.item_id", "item_code name unit_id")
        .lean());

    if (!inward)
      return res
        .status(404)
        .json({ success: false, message: "Inward record not found" });

    res.status(200).json({ success: true, data: inward });
  } catch (error) {
    console.error("Error fetching Inward:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching Inward details",
      error: error.message,
    });
  }
};
