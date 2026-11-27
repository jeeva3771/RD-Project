import mongoose from "mongoose";
import vendorModel from "../../models/masters/vendorModel.js";
import vendorBillModel from "../../models/accounts/vendorBillModel.js";
import accountVendorPaymentModel from "../../models/accounts/accountVendorPaymentModel.js";
import BankMaster from "../../models/accounts/bankMasterModel.js";
import BankTransaction from "../../models/accounts/bankTransactionModel.js";
import { generateSignedUrl, uploadToR2 } from "../../helpers/r2helper.js";

const maskAccNo = (str) => {
  if (!str) return "";
  const s = String(str).trim();
  if (s.length <= 4) return s;
  return "•".repeat(s.length - 4) + s.slice(-4);
};

export const getVendorBills = async (req, res) => {
  try {
    const { status, filterType, filterValue, search, page = 1, limit = 50 } = req.query;
    let query = {};
    if (status && status !== "All") {
      if (status === "Pending") {
        query.status = { $in: ["Pending", "Partial Paid"] };
      } else if (status === "Unpaid") {
        query.status = "Pending";
      } else {
        query.status = status;
      }
    }

    if (filterType && filterType !== "all") {
      let startDate = null;
      let endDate = null;

      if (filterType === "overdue") {
        const nowD = new Date();
        const yyyy = nowD.getFullYear();
        const mm = String(nowD.getMonth() + 1).padStart(2, "0");
        const dd = String(nowD.getDate()).padStart(2, "0");
        const todayUtc = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
        query.due_date = { $ne: null, $lt: todayUtc };
        if (!query.status) {
          query.status = { $ne: "Paid" };
        }
      } else if (filterValue) {
        if (filterType === "due_today" || filterType === "due_date") {
          const [year, month, day] = filterValue.split("-");
          startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
          endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
          query.due_date = { $gte: startDate, $lte: endDate };
        } else if (filterType === "sched_today" || filterType === "sched_date") {
          const [year, month, day] = filterValue.split("-");
          startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
          endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
          query.scheduled_date = { $gte: startDate, $lte: endDate };
        } else if (filterType === "today") {
          const [year, month, day] = filterValue.split("-");
          startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
          endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
          query.$or = [
            { due_date: { $gte: startDate, $lte: endDate } },
            { receipt_date: { $gte: startDate, $lte: endDate } },
            { receipt_date: { $in: [null, undefined] }, createdAt: { $gte: startDate, $lte: endDate } }
          ];
        } else if (filterType === "week") {
          const parts = filterValue.split("-W");
          const y = parseInt(parts[0]);
          const w = parseInt(parts[1]);

          const simple = new Date(y, 0, 1 + (w - 1) * 7);
          const dow = simple.getDay();
          const ISOweekStart = simple;
          if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
          else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

          startDate = new Date(ISOweekStart);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          query.$or = [
            { receipt_date: { $gte: startDate, $lte: endDate } },
            { receipt_date: { $in: [null, undefined] }, createdAt: { $gte: startDate, $lte: endDate } }
          ];
        } else if (filterType === "month") {
          const [year, m] = filterValue.split("-");
          startDate = new Date(parseInt(year), parseInt(m) - 1, 1, 0, 0, 0, 0);
          endDate = new Date(parseInt(year), parseInt(m), 0, 23, 59, 59, 999);
          query.$or = [
            { receipt_date: { $gte: startDate, $lte: endDate } },
            { receipt_date: { $in: [null, undefined] }, createdAt: { $gte: startDate, $lte: endDate } }
          ];
        } else if (filterType === "fy") {
          const startYear = parseInt(filterValue);
          startDate = new Date(startYear, 3, 1, 0, 0, 0, 0);
          endDate = new Date(startYear + 1, 2, 31, 23, 59, 59, 999);
          query.$or = [
            { receipt_date: { $gte: startDate, $lte: endDate } },
            { receipt_date: { $in: [null, undefined] }, createdAt: { $gte: startDate, $lte: endDate } }
          ];
        }
      }
    }

    if (search && String(search).trim()) {
      const sEscaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sRegex = new RegExp(sEscaped, "i");
      const matchedVendors = await vendorModel.find({ name: sRegex }).select("_id").lean();
      const matchedVendorIds = matchedVendors.map(v => v._id);

      const sOr = [
        { invoice_no: sRegex },
        { challan_no: sRegex },
        { po_number: sRegex },
        { product_name: sRegex },
        { material: sRegex },
        { vendor_name: sRegex },
        { payment_reference: sRegex },
      ];
      if (matchedVendorIds.length > 0) {
        sOr.push({ vendor_id: { $in: matchedVendorIds } });
      }

      if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: sOr }] };
      } else {
        query.$or = sOr;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const aggregation = await vendorBillModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$vendor_id",
          vendorName: { $first: "$vendor_name" }
        }
      },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendorData"
        }
      },
      {
        $addFields: {
          sortName: {
            $cond: {
              if: { $gt: [{ $size: "$vendorData" }, 0] },
              then: { $arrayElemAt: ["$vendorData.name", 0] },
              else: { $ifNull: ["$vendorName", "Unknown"] }
            }
          }
        }
      },
      { $sort: { sortName: 1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }]
        }
      }
    ]);

    const totalVendors = aggregation[0].metadata[0]?.total || 0;
    const paginatedVendorIds = aggregation[0].data.map(v => v._id);

    const rawBills = await vendorBillModel
      .find({ ...query, vendor_id: { $in: paginatedVendorIds } })
      .populate({
        path: "vendor_id",
        select: "name mobile_no gst_rate tds_rate gst_tax tds_tax",
        populate: [
          { path: "gst_tax", select: "tax_name tax_rate" },
          { path: "tds_tax", select: "tax_name tax_rate" }
        ]
      })
      .populate("rfq_id", "name subJobNo jobNo awards specs")
      .sort({ createdAt: -1 })
      .lean();

    // Normalize bills to ensure paid_amount and balance_due are always consistent (even for legacy rows)
    const bills = rawBills.map(b => {
      const billTotal = Number(b.payable_amount || 0);
      let paid = Number(b.paid_amount || 0);
      let due = b.balance_due !== undefined ? Number(b.balance_due) : Math.max(0, billTotal - paid);
      if (b.status === "Paid" && paid === 0) {
        paid = billTotal;
        due = 0;
      }
      if (b.vendor_id) {
        if (b.vendor_id.gst_tax?.tax_rate !== undefined) {
          b.vendor_id.gst_rate = b.vendor_id.gst_tax.tax_rate;
        }
        if (b.vendor_id.tds_tax?.tax_rate !== undefined) {
          b.vendor_id.tds_rate = b.vendor_id.tds_tax.tax_rate;
        }
      }
      return {
        ...b,
        product_name: b.product_name || b.rfq_id?.name || "",
        product_specs: b.rfq_id?.specs || "",
        paid_amount: paid,
        balance_due: due,
        paid_qty: Number(b.paid_qty || (b.status === "Paid" ? b.received_qty : 0)),
      };
    });

    const totalPages = Math.ceil(totalVendors / limitNum);

    return res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        total: totalVendors,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (err) {
    console.error("Error fetching vendor bills:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /accounts/vendor-bills/:id/pay
export const payVendorBill = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reference_no, ref,
      bank_account_id, bank_account_label,
      amount,
      total_amount, totalAmount,
      paying_qty, payingQty, paid_qty,
      vendorId, vendorName, billNo,
      jobNo, subJobNo,
      notes,
    } = req.body;

    const bill = await vendorBillModel.findById(id);
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    if (bill.status === "Paid") return res.status(400).json({ success: false, message: "Bill is already fully paid" });

    // STRICT CONTROL: Block payment if bill has not reached 'approved', 'scheduled', or 'partial' stage
    const allowedStages = ["approved", "scheduled", "partial", "paid"];
    if (bill.stage && !allowedStages.includes(bill.stage)) {
      return res.status(400).json({
        success: false,
        message: `Payment Blocked: Bill must be marked as 'Approved for Payment' in Purchase Accounts before releasing funds.`,
      });
    }

    const payVal = Number(amount);
    if (isNaN(payVal) || payVal <= 0) {
      return res.status(400).json({ success: false, message: "Please enter a valid payment amount greater than 0" });
    }

    const billTotal = Number(bill.payable_amount || 0);
    const currentPaid = Number(bill.paid_amount || 0);
    const currentDue = bill.balance_due !== undefined ? Number(bill.balance_due) : Math.max(0, billTotal - currentPaid);

    if (payVal > currentDue + 0.05) {
      return res.status(400).json({
        success: false,
        message: `Entered amount (₹ ${payVal.toLocaleString("en-IN")}) exceeds remaining balance due of ₹ ${currentDue.toLocaleString("en-IN")}`
      });
    }

    let newPaid = Math.min(billTotal, Math.round((currentPaid + payVal) * 100) / 100);
    let newDue = Math.max(0, Math.round((billTotal - newPaid) * 100) / 100);

    // Calculate Quantity and Status:
    // If paying quantity completes the invoice received_qty, close the pay option (mark as Paid)
    const reqQty = Number(paying_qty || payingQty || paid_qty || 0);
    const currentPaidQty = Number(bill.paid_qty || 0);
    const billReceivedQty = Number(bill.received_qty || 0);
    let newPaidQty = currentPaidQty + reqQty;

    let newStatus = newDue <= 0 ? "Paid" : "Partial Paid";
    if (billReceivedQty > 0 && newPaidQty >= billReceivedQty) {
      newStatus = "Paid";
      newPaidQty = billReceivedQty;
      newDue = 0;
      newPaid = billTotal;
    } else if (newStatus === "Paid") {
      newPaidQty = billReceivedQty;
    } else {
      newPaidQty = Math.min(billReceivedQty, newPaidQty);
    }

    // Safely resolve tax rates and cash disbursement fields from either snake_case or camelCase
    const resolvedGstRate = Number(req.body.gst_rate !== undefined ? req.body.gst_rate : (req.body.gstRate !== undefined ? req.body.gstRate : (bill.gst_rate || 0)));
    const resolvedGstAmount = Number(req.body.gst_amount !== undefined ? req.body.gst_amount : (req.body.gstAmount !== undefined ? req.body.gstAmount : 0));
    const resolvedTdsRate = Number(req.body.tds_rate !== undefined ? req.body.tds_rate : (req.body.tdsRate !== undefined ? req.body.tdsRate : 0));
    const resolvedTdsAmount = Number(req.body.tds_amount !== undefined ? req.body.tds_amount : (req.body.tdsAmount !== undefined ? req.body.tdsAmount : 0));
    const resolvedTdsSection = req.body.tds_section || req.body.tdsSection || "";
    const resolvedGrossAmount = Number(req.body.gross_amount !== undefined ? req.body.gross_amount : (req.body.grossAmount !== undefined ? req.body.grossAmount : (payVal + resolvedTdsAmount)));
    const resolvedCashVoucherNo = req.body.cash_voucher_no || req.body.cashVoucherNo || "";
    const resolvedCashPaidTo = req.body.cash_paid_to || req.body.cashPaidTo || "";
    const resolvedMode = req.body.payment_mode || req.body.mode || "Bank Transfer";
    const resolvedRef = req.body.reference_no || req.body.ref || resolvedCashVoucherNo || "";
    const resolvedDate = req.body.payment_date || req.body.date ? new Date(req.body.payment_date || req.body.date) : new Date();

    // Calculate total amount = payment amount + GST - TDS (reflects in Bank Master)
    const gstAmt = resolvedGstAmount;
    const tdsAmt = resolvedTdsAmount;
    const totalPayVal = Number(total_amount !== undefined ? total_amount : (totalAmount !== undefined ? totalAmount : Math.round((payVal + gstAmt - tdsAmt) * 100) / 100));

    // Parse vendor ID (can be populated object from frontend)
    let parsedVendorId = bill.vendor_id ? bill.vendor_id.toString() : null;
    if (!parsedVendorId && vendorId) {
      parsedVendorId = typeof vendorId === "object" ? vendorId._id : vendorId;
    }

    // Process file attachments (uploaded to Cloudflare R2 bucket vendor_payment_receipts)
    const uploadedAttachments = [];
    const rawFiles = req.files && Array.isArray(req.files)
      ? req.files
      : (req.file ? [req.file] : []);

    const seenFiles = new Set();
    const filesToProcess = [];
    for (const file of rawFiles) {
      const fileKey = `${file.originalname || "file"}_${file.size || file.buffer?.length || 0}`;
      if (!seenFiles.has(fileKey)) {
        seenFiles.add(fileKey);
        filesToProcess.push(file);
      }
    }

    for (const file of filesToProcess) {
      let fileUrl = "";
      try {
        fileUrl = await uploadToR2(
          "vendor_payment_receipts",
          file.buffer,
          file.originalname,
          file.mimetype
        );
      } catch (uploadErr) {
        console.warn("R2 upload warning for supply vendor receipt, using base64 fallback:", uploadErr.message);
        fileUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      }
      uploadedAttachments.push({
        url: fileUrl,
        name: file.originalname,
      });
    }

    const primaryAttachment = uploadedAttachments[0] || { url: "", name: "" };

    const resolvedUserId = req.user?._id || req.user?.id || req.body?.created_by || req.body?.userId || null;
    const resolvedUserName = req.body?.created_by_name || req.body?.userName || req.user?.name || req.user?.username || "Accounts";

    // Determine bank label and create BankTransaction using totalPayVal (Payment + GST - TDS)
    let finalBankLabel = bank_account_label || "";
    if (bank_account_id) {
      const bank = await BankMaster.findById(bank_account_id);
      if (bank) {
        if (!finalBankLabel) {
          finalBankLabel = `${bank.bank_name} (${maskAccNo(bank.account_number)})`;
        }
        await BankTransaction.create({
          bank_id: bank._id,
          bank_name: bank.bank_name,
          account_number_masked: maskAccNo(bank.account_number),
          type: "debit",
          amount: totalPayVal,
          description: `Supply Vendor ${newStatus === "Paid" ? "Payment" : "Partial Payment"} to ${bill.vendor_name || vendorName || "Vendor"} (Bill: ${billNo || bill.invoice_no || bill.challan_no || "UNKNOWN"})`,
          reference_id: null,
          reference_type: "VendorPayment",
          sub_job_no: subJobNo || "",
          party_name: bill.vendor_name || vendorName || "Unknown",
          txn_date: resolvedDate,
          created_by: resolvedUserId,
          created_by_name: resolvedUserName,
        });
      }
    }

    // Create a payment record with complete audit metadata, taxes, and cash disbursement info
    const payment = new accountVendorPaymentModel({
      vendor_id: parsedVendorId || "UNKNOWN_VENDOR",
      vendor_name: bill.vendor_name || vendorName || "Unknown",
      bill_no: billNo || bill.invoice_no || bill.challan_no || "UNKNOWN",
      job_no: jobNo || "",
      sub_job_no: subJobNo || "",
      amount: payVal,
      paid_qty: reqQty || (newStatus === "Paid" ? Math.max(0, billReceivedQty - currentPaidQty) : 0),
      total_amount: totalPayVal,
      tds_section: resolvedTdsSection,
      tds_rate: resolvedTdsRate,
      tds_amount: resolvedTdsAmount,
      gross_amount: resolvedGrossAmount,
      gst_rate: resolvedGstRate,
      gst_amount: resolvedGstAmount,
      payment_mode: resolvedMode,
      bank_account_id: bank_account_id || null,
      bank_account_label: finalBankLabel,
      payment_date: resolvedDate,
      reference_no: resolvedRef,
      cash_voucher_no: resolvedCashVoucherNo,
      cash_paid_to: resolvedCashPaidTo,
      notes: notes || "",
      attachment: primaryAttachment.url,
      attachment_name: primaryAttachment.name,
      attachments: uploadedAttachments,
      created_by: resolvedUserId,
      created_by_name: resolvedUserName,
    });
    await payment.save();

    // Update bill amounts, paid_qty, and status
    bill.paid_amount = newPaid;
    bill.paid_qty = newPaidQty;
    bill.balance_due = newDue;
    bill.status = newStatus;
    bill.stage = newDue <= 0 ? "paid" : "partial";
    bill.payment_reference = ref || reference_no || bill.payment_reference;
    await bill.save();

    const successMsg = newStatus === "Paid"
      ? `Payment of ₹ ${payVal.toLocaleString("en-IN")} recorded. Bill is now fully cleared!`
      : `Partial payment of ₹ ${payVal.toLocaleString("en-IN")} recorded. Remaining balance due: ₹ ${newDue.toLocaleString("en-IN")}`;

    return res.status(200).json({ success: true, message: successMsg, data: bill });
  } catch (err) {
    console.error("Error paying vendor bill:", err);
    return res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
};

/**
 * GET /accounts/payables-board
 * Returns bills grouped for Kanban board with KPIs and Vendor Leaderboard
 * Supports backend search and vendor filtering
 */
export const getPayablesBoardData = async (req, res) => {
  try {
    const { search, vendor } = req.query;

    let filterQuery = {};
    const conditions = [];

    if (vendor && String(vendor).trim()) {
      const vEscaped = String(vendor).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const vRegex = new RegExp(`^${vEscaped}$`, "i");
      const vOr = [{ vendor_name: vRegex }];
      if (mongoose.isValidObjectId(vendor)) {
        vOr.push({ vendor_id: vendor });
      }
      conditions.push({ $or: vOr });
    }

    if (search && String(search).trim()) {
      const sEscaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sRegex = new RegExp(sEscaped, "i");

      // Match vendors by name in vendors collection
      const matchedVendors = await vendorModel.find({ name: sRegex }).select("_id").lean();
      const matchedVendorIds = matchedVendors.map(v => v._id);

      const sOr = [
        { invoice_no: sRegex },
        { challan_no: sRegex },
        { po_number: sRegex },
        { product_name: sRegex },
        { material: sRegex },
        { vendor_name: sRegex },
        { payment_reference: sRegex },
      ];

      if (matchedVendorIds.length > 0) {
        sOr.push({ vendor_id: { $in: matchedVendorIds } });
      }

      conditions.push({ $or: sOr });
    }

    if (conditions.length === 1) {
      filterQuery = conditions[0];
    } else if (conditions.length > 1) {
      filterQuery = { $and: conditions };
    }

    const rawBills = await vendorBillModel.find(filterQuery).populate("vendor_id").sort({ createdAt: -1 }).lean();

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const bills = rawBills.map(b => {
      const payable = Number(b.payable_amount || 0);
      const paid = Number(b.paid_amount || 0);
      const balance = b.balance_due !== undefined ? Number(b.balance_due) : Math.max(0, payable - paid);

      // Resolve stage with backwards compatibility
      let stage = b.stage;
      if (b.status === "Paid" || balance <= 0) {
        stage = "paid";
      } else if (b.status === "Partial Paid" || (paid > 0 && balance > 0)) {
        stage = "partial";
      } else if (!stage || stage === "inward_check") {
        stage = "received";
      }

      // Only use due date if explicitly set
      const dueDate = b.due_date ? new Date(b.due_date) : null;

      // Overdue calculation (only applies if due date was explicitly provided)
      let daysOverdue = 0;
      if (stage !== "paid" && dueDate && !isNaN(dueDate.getTime())) {
        const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const diffMs = nowMidnight - dueMidnight;
        if (diffMs > 0) {
          daysOverdue = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      const vendorObj = b.vendor_id || {};
      const vendorName = b.vendor_name || vendorObj.name || "Unknown Vendor";

      // Resolve dynamic GST rate from bill or vendor master
      const effectiveGstRate = Number(b.gst_rate ?? (vendorObj.gst_rate ?? 0));
      let baseAmount = payable;
      let gstAmount = 0;
      if (effectiveGstRate > 0) {
        baseAmount = Math.round((payable / (1 + effectiveGstRate / 100)) * 100) / 100;
        gstAmount = Math.round((payable - baseAmount) * 100) / 100;
      }

      return {
        _id: b._id,
        id: b._id.toString(),
        billNo: b.invoice_no || b.challan_no || `BILL-${b._id.toString().slice(-4)}`,
        vendor: vendorName,
        vendorId: b.vendor_id ? (vendorObj._id || b.vendor_id).toString() : null,
        vendorPhone: vendorObj.mobile_no || "",
        vendorEmail: vendorObj.email || "",
        material: b.material || b.product_name || "General Raw Material",
        billDate: b.receipt_date || b.createdAt,
        dueDate: dueDate,
        daysOverdue,
        gstRate: effectiveGstRate,
        amount: baseAmount,
        gstAmount: gstAmount,
        total: payable,
        paidAmount: paid,
        balanceDue: balance,
        challanMatched: b.challan_matched !== false,
        mismatchNotes: b.mismatch_notes || "",
        poRef: b.po_number || "—",
        challanRef: b.challan_no || "—",
        stage,
        scheduledDate: b.scheduled_date || null,
        invoiceUrl: b.invoice_url ? generateSignedUrl(b.invoice_url) : "",
        challanUrl: b.challan_url ? generateSignedUrl(b.challan_url) : "",
        receivedQty: b.received_qty || 0,
        paidQty: b.paid_qty || 0,
        poUnitRate: b.po_unit_rate || (b.received_qty > 0 ? Math.round((payable / b.received_qty) * 100) / 100 : 0),
      };
    });

    // Compute KPIs on matching bills
    const outstandingTotal = bills.reduce((s, b) => s + (b.stage !== "paid" ? b.balanceDue : 0), 0);
    const overdueTotal = bills.reduce((s, b) => s + (b.stage !== "paid" && b.daysOverdue > 0 ? b.balanceDue : 0), 0);
    const pendingApprovalCount = bills.filter(b => b.stage === "received").length;
    const scheduledCount = bills.filter(b => b.stage === "scheduled").length;
    const partialCount = bills.filter(b => b.stage === "partial").length;
    const paidTotal = bills.reduce((s, b) => s + b.paidAmount, 0);

    // Compute Vendor Leaderboard (use full bill set if search/vendor filter is applied so carousel buttons remain available)
    let leaderboardBills = rawBills;
    if (search || vendor) {
      leaderboardBills = await vendorBillModel.find({}).populate("vendor_id").sort({ createdAt: -1 }).lean();
    }

    const vendorMap = {};
    leaderboardBills.forEach(b => {
      const vendorObj = b.vendor_id || {};
      const v = b.vendor_name || vendorObj.name || "Unknown Vendor";
      if (!vendorMap[v]) {
        vendorMap[v] = {
          vendor: v,
          vendorId: b.vendor_id ? (vendorObj._id || b.vendor_id).toString() : null,
          outstanding: 0,
          totalBills: 0,
          activeBills: 0,
          overdueCount: 0,
        };
      }
      const payable = Number(b.payable_amount || 0);
      const paid = Number(b.paid_amount || 0);
      const balance = b.balance_due !== undefined ? Number(b.balance_due) : Math.max(0, payable - paid);
      let bStage = b.stage;
      if (b.status === "Paid" || balance <= 0) bStage = "paid";

      vendorMap[v].totalBills += 1;
      if (bStage !== "paid") {
        vendorMap[v].activeBills += 1;
        vendorMap[v].outstanding += balance;
        if (b.due_date) {
          const bDueDate = new Date(b.due_date);
          if (!isNaN(bDueDate.getTime())) {
            const dueMid = new Date(bDueDate.getFullYear(), bDueDate.getMonth(), bDueDate.getDate()).getTime();
            const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            if (nowMid > dueMid) {
              vendorMap[v].overdueCount += 1;
            }
          }
        }
      }
    });

    const vendorLeaderboard = Object.values(vendorMap)
      .filter(v => v.activeBills > 0 || v.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    return res.status(200).json({
      success: true,
      data: {
        bills,
        kpis: {
          totalOutstanding: outstandingTotal,
          overdueAmount: overdueTotal,
          pendingApproval: pendingApprovalCount,
          scheduledCount: scheduledCount,
          partialCount: partialCount,
          paidTotal: paidTotal,
          totalVendors: Object.keys(vendorMap).length,
        },
        vendorLeaderboard,
      }
    });
  } catch (err) {
    console.error("Error in getPayablesBoardData:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/vendor-bills/:id/stage
 * Updates Kanban stage of a bill
 */
export const updateVendorBillStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
    const validStages = ["received", "approved", "scheduled", "partial", "paid"];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: `Invalid stage: ${stage}` });
    }

    const bill = await vendorBillModel.findById(id);
    if (!bill) {
      return res.status(404).json({ success: false, message: "Vendor bill not found" });
    }

    bill.stage = stage;
    if (stage === "paid" && bill.balance_due > 0) {
      // If manually marked paid, set balance to 0 and paid to total
      bill.paid_amount = bill.payable_amount;
      bill.balance_due = 0;
      bill.status = "Paid";
    }
    await bill.save();

    return res.status(200).json({ success: true, message: `Stage updated to ${stage}`, data: bill });
  } catch (err) {
    console.error("Error updating bill stage:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/vendor-bills/:id/challan-match
 * Toggles Challan / Store Inward verification status
 */
export const toggleChallanMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { matched, notes } = req.body;

    const bill = await vendorBillModel.findById(id);
    if (!bill) {
      return res.status(404).json({ success: false, message: "Vendor bill not found" });
    }

    bill.challan_matched = matched !== undefined ? Boolean(matched) : !bill.challan_matched;
    if (notes !== undefined) {
      bill.mismatch_notes = notes;
    }
    await bill.save();

    return res.status(200).json({
      success: true,
      message: bill.challan_matched ? "Challan verified and matched" : "Quantity mismatch flagged",
      data: bill
    });
  } catch (err) {
    console.error("Error toggling challan match:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/vendor-bills/:id/schedule
 * Schedules a payment date and updates stage to "scheduled"
 */
export const scheduleVendorBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_date } = req.body;
    if (!scheduled_date) {
      return res.status(400).json({ success: false, message: "scheduled_date is required" });
    }

    const bill = await vendorBillModel.findById(id);
    if (!bill) {
      return res.status(404).json({ success: false, message: "Vendor bill not found" });
    }

    bill.scheduled_date = new Date(scheduled_date);
    bill.stage = "scheduled";
    await bill.save();

    return res.status(200).json({
      success: true,
      message: `Payment scheduled for ${new Date(scheduled_date).toLocaleDateString("en-IN")}`,
      data: bill
    });
  } catch (err) {
    console.error("Error scheduling bill:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

