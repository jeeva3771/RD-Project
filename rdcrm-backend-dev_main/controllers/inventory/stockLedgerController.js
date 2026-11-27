import StockLedger from "../../models/inventory/stockLedgerModel.js";
import itemModel from "../../models/inventory/item/itemModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import StoreMaterialIssue from "../../models/store/materialIssueModel.js";

/**
 * Record a single movement in StockLedger atomically
 */
export const recordStockMovement = async ({
  item_id,
  item_code,
  item_name,
  unit = "pcs",
  type, // "OPENING", "INWARD", "ISSUE", "RETURN", "ADJUSTMENT"
  ref_type = "MANUAL_ADJUSTMENT",
  ref_id = "",
  job_no = "",
  sub_job_no = "",
  qty_in = 0,
  qty_out = 0,
  cost_per_unit = 0,
  location = "G-1",
  remarks = "",
  created_by = null,
  date = new Date()
}) => {
  try {
    const numQtyIn = Math.max(0, Number(qty_in) || 0);
    const numQtyOut = Math.max(0, Number(qty_out) || 0);

    // Find the latest ledger entry for this item to determine previous balance
    const lastEntry = await StockLedger.findOne({ item_id })
      .sort({ date: -1, _id: -1 })
      .lean();

    let previousBalance = 0;
    if (lastEntry) {
      previousBalance = Number(lastEntry.balance_after) || 0;
    } else {
      // Fallback to item.stock if no ledger entry exists yet
      const currentItem = (await itemModel.findById(item_id).lean()) || (await customItemModel.findById(item_id).lean());
      if (currentItem) {
        previousBalance = Number(currentItem.stock) || 0;
      }
    }

    let balance_after = previousBalance;
    if (type === "OPENING") {
      balance_after = numQtyIn > 0 ? numQtyIn : previousBalance;
    } else if (type === "INWARD" || type === "RETURN") {
      balance_after = previousBalance + numQtyIn;
    } else if (type === "ISSUE") {
      balance_after = Math.max(0, previousBalance - numQtyOut);
    } else if (type === "ADJUSTMENT") {
      balance_after = numQtyIn > 0 ? previousBalance + numQtyIn : Math.max(0, previousBalance - numQtyOut);
    }

    const ledgerEntry = await StockLedger.create({
      item_id,
      item_code: item_code || "",
      item_name: item_name || "",
      unit: unit || "pcs",
      date,
      type,
      ref_type,
      ref_id: String(ref_id || ""),
      job_no: job_no || "",
      sub_job_no: sub_job_no || "",
      qty_in: numQtyIn,
      qty_out: numQtyOut,
      balance_after,
      cost_per_unit: Number(cost_per_unit) || 0,
      total_value: balance_after * (Number(cost_per_unit) || 0),
      location: location || "G-1",
      remarks: remarks || "",
      created_by
    });

    return ledgerEntry;
  } catch (error) {
    console.error("[StockLedger] Failed to record stock movement:", error);
    return null;
  }
};

/**
 * Get Stock Summary (Opening, Received, Issued, Closing) for Accounts Console
 */
export const getStockLedgerSummary = async (req, res) => {
  try {
    const { month, search, filterType, filterValue } = req.query;

    // Determine period date range
    let startDate;
    let endDate;

    if (filterType && filterType !== 'all' && filterValue) {
        if (filterType === 'today') {
            const [year, month, day] = filterValue.split('-');
            startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            endDate.setHours(23, 59, 59, 999);
        } else if (filterType === 'week') {
            const parts = filterValue.split('-W');
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
            
        } else if (filterType === 'month') {
            const [year, m] = filterValue.split('-');
            startDate = new Date(parseInt(year), parseInt(m) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(m), 0);
            endDate.setHours(23, 59, 59, 999);
            
        } else if (filterType === 'fy') {
            const startYear = parseInt(filterValue);
            startDate = new Date(startYear, 3, 1);
            endDate = new Date(startYear + 1, 2, 31);
            endDate.setHours(23, 59, 59, 999);
        }
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split("-").map(Number);
      startDate = new Date(year, m - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, m, 0, 23, 59, 59, 999);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Auto-seed initial ledger if empty
    const ledgerCount = await StockLedger.countDocuments();
    if (ledgerCount === 0) {
      await internalSeedInitialStockLedger();
    }

    // Fetch all items
    const query = { is_active: { $ne: false } };
    
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: "i" } },
        { item_code: { $regex: s, $options: "i" } }
      ];
    }

    const items = await itemModel
      .find(query)
      .populate("unit", "name unit_name")
      .lean();

    // Fetch all ledger transactions across all time to know true history existence
    const allLedgers = await StockLedger.find({}).lean();

    // Group ledgers by item_id
    const ledgersByItem = {};
    for (const l of allLedgers) {
      const idStr = String(l.item_id);
      if (!ledgersByItem[idStr]) ledgersByItem[idStr] = [];
      ledgersByItem[idStr].push(l);
    }

    let totalStockValue = 0;
    let lowStockAlerts = 0;
    let zeroStockCount = 0;

    const stockList = items.map((item) => {
      const idStr = String(item._id);
      
      // Filter out items that were created after the selected period's end date
      let itemCreatedDate = null;
      if (item.createdAt) {
          itemCreatedDate = new Date(item.createdAt);
      } else if (item.created_at) {
          const datePart = item.created_at.split(' ')[0];
          const parts = datePart.split('-');
          if (parts.length === 3 && parts[0].length <= 2) {
             // Handle "DD-MM-YYYY" legacy format
             itemCreatedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
          } else {
             itemCreatedDate = new Date(item.created_at);
          }
      }
      
      if (itemCreatedDate && !isNaN(itemCreatedDate.getTime()) && itemCreatedDate > endDate) {
        return null;
      }

      const entries = ledgersByItem[idStr] || [];

      // Sort entries chronologically
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));

      const priorEntries = entries.filter((e) => new Date(e.date) < startDate);
      const currentPeriodEntries = entries.filter(
        (e) => new Date(e.date) >= startDate && new Date(e.date) <= endDate
      );

      let opening = 0;
      let received = 0;
      let issued = 0;

      if (entries.length === 0) {
        // Fallback for legacy items with absolutely zero ledger history
        opening = Number(item.stock) || 0;
      } else {
        if (priorEntries.length > 0) {
          // Last known balance before this period
          opening = priorEntries[priorEntries.length - 1].balance_after || 0;
        }

        for (const e of currentPeriodEntries) {
          if (e.type === "OPENING") {
            if (priorEntries.length === 0) {
              opening = Number(e.qty_in) || Number(e.balance_after) || 0;
            } else {
              received += Number(e.qty_in) || 0;
            }
          } else if (e.type === "INWARD" || e.type === "RETURN") {
            received += Number(e.qty_in) || 0;
          } else if (e.type === "ISSUE") {
            issued += Number(e.qty_out) || 0;
          } else if (e.type === "ADJUSTMENT") {
            if (e.qty_in > 0) received += Number(e.qty_in) || 0;
            if (e.qty_out > 0) issued += Number(e.qty_out) || 0;
          }
        }
      }

      let closing = opening + received - issued;

      // Determine if item should be completely hidden (e.g., viewing August but item was created in September)
      if (entries.length > 0 && priorEntries.length === 0 && currentPeriodEntries.length === 0 && opening === 0 && closing === 0) {
        return null; // Return null so we can filter it out
      }

      const cost = Number(item.cost) || Number(item.price) || 0;
      const val = closing * cost;
      const min = Number(item.min_stock) || 0;
      const isLow = closing <= min;

      totalStockValue += val;
      if (isLow && closing > 0) lowStockAlerts++;
      if (closing <= 0) zeroStockCount++;

      // Resolve human-friendly unit
      let unitLabel = "pcs";
      if (item.unit?.name) {
        unitLabel = item.unit.name.toLowerCase().includes("sq")
          ? "sqin"
          : item.unit.name.toLowerCase().includes("sheet")
          ? "sheet"
          : item.unit.name.toLowerCase().includes("kilo")
          ? "kg"
          : "pcs";
      }

      return {
        _id: item._id,
        id: item.item_code || item.id,
        n: item.name,
        u: unitLabel,
        op: opening,
        rcv: received,
        iss: issued,
        cl: closing,
        min: min,
        val: Math.round(val),
        cost: cost,
        loc: item.location || "G-1",
        status: isLow ? "Low" : "OK"
      };
    }).filter(item => item !== null);

    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = parseInt(req.query.limit) || 10;
    const totalCount = stockList.length;
    
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedStockList = stockList.slice(startIndex, startIndex + limitNum);

    res.status(200).json({
      success: true,
      period: {
        month: month || `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}`,
        startDate,
        endDate
      },
      metrics: {
        totalStockValue: Math.round(totalStockValue),
        totalItems: stockList.length,
        lowStockAlerts,
        zeroStock: zeroStockCount
      },
      stock: paginatedStockList,
      totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum)
    });
  } catch (error) {
    console.error("getStockLedgerSummary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record a Manual Inward or Stock Adjustment from Accounts Console
 */
export const recordStockInwardOrAdjustment = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { item_id, type = "INWARD", qty, cost_per_unit, location, remarks } = req.body;

    if (!item_id) {
      return res.status(400).json({ success: false, message: "item_id is required" });
    }

    const numQty = Number(qty);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: "A valid positive quantity is required" });
    }

    const item = await itemModel.findById(item_id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const qty_in = type === "INWARD" || type === "OPENING" ? numQty : 0;
    const qty_out = type === "ADJUSTMENT" && req.body.is_reduction ? numQty : 0;
    const actualQtyIn = type === "ADJUSTMENT" && !req.body.is_reduction ? numQty : qty_in;

    // Update item.stock in item collection
    if (type === "OPENING") {
      item.stock = numQty;
    } else if (actualQtyIn > 0) {
      item.stock = (Number(item.stock) || 0) + actualQtyIn;
    } else if (qty_out > 0) {
      item.stock = Math.max(0, (Number(item.stock) || 0) - qty_out);
    }

    if (cost_per_unit !== undefined && !isNaN(Number(cost_per_unit))) {
      item.cost = String(cost_per_unit);
    }

    await item.save();

    // Record in StockLedger
    const entry = await recordStockMovement({
      item_id: item._id,
      item_code: item.item_code,
      item_name: item.name,
      unit: item.unit?.name || "pcs",
      type,
      ref_type: type === "INWARD" ? "INWARD_RECEIPT" : "MANUAL_ADJUSTMENT",
      ref_id: `MANUAL-${Date.now().toString().slice(-6)}`,
      qty_in: actualQtyIn,
      qty_out,
      cost_per_unit: cost_per_unit || Number(item.cost) || 0,
      location: location || item.location || "G-1",
      remarks: remarks || `Recorded via Accounts Console by user`,
      created_by: userId
    });

    res.status(200).json({
      success: true,
      message: `Successfully recorded ${type.toLowerCase()} of ${numQty} units`,
      data: entry
    });
  } catch (error) {
    console.error("recordStockInwardOrAdjustment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Internal Helper & Endpoint to seed initial StockLedger records
 */
export async function internalSeedInitialStockLedger() {
  try {
    const existingCount = await StockLedger.countDocuments();
    if (existingCount > 0) return { count: existingCount, seeded: false };

    const items = await itemModel.find({ is_active: { $ne: false } }).lean();
    const allStoreIssues = await StoreMaterialIssue.find({}).lean();

    // Calculate historical issues per material_id
    const issuedMap = {};
    for (const issue of allStoreIssues) {
      for (const mat of issue.materials || []) {
        const matIdStr = String(mat.material_id || mat.item_id);
        const q = Number(mat.issued_qty) || 0;
        if (q > 0) {
          if (!issuedMap[matIdStr]) issuedMap[matIdStr] = [];
          issuedMap[matIdStr].push({
            job_no: issue.job_no,
            sub_job_no: issue.sub_job_no,
            qty: q,
            date: issue.createdAt || new Date("2026-08-15")
          });
        }
      }
    }

    const ledgerDocs = [];
    const seedDate = new Date("2026-08-01T00:00:00.000Z");

    for (const item of items) {
      const idStr = String(item._id);
      const issues = issuedMap[idStr] || [];
      const totalIssued = issues.reduce((sum, i) => sum + i.qty, 0);
      const currentStock = Number(item.stock) || 0;
      const initialOpening = currentStock + totalIssued;

      // 1. Initial Opening balance record
      ledgerDocs.push({
        item_id: item._id,
        item_code: item.item_code || item.id,
        item_name: item.name,
        unit: "pcs",
        date: seedDate,
        type: "OPENING",
        ref_type: "INITIAL_SEED",
        ref_id: "INIT-SEED",
        qty_in: initialOpening,
        qty_out: 0,
        balance_after: initialOpening,
        cost_per_unit: Number(item.cost) || 0,
        total_value: initialOpening * (Number(item.cost) || 0),
        location: "G-1",
        remarks: "Initial stock balance seeded"
      });

      // 2. Historical issue records
      let runningBalance = initialOpening;
      for (const iss of issues) {
        runningBalance = Math.max(0, runningBalance - iss.qty);
        ledgerDocs.push({
          item_id: item._id,
          item_code: item.item_code || item.id,
          item_name: item.name,
          unit: "pcs",
          date: iss.date,
          type: "ISSUE",
          ref_type: "STORE_ISSUE",
          ref_id: iss.sub_job_no || iss.job_no || "ISSUE",
          job_no: iss.job_no,
          sub_job_no: iss.sub_job_no,
          qty_in: 0,
          qty_out: iss.qty,
          balance_after: runningBalance,
          cost_per_unit: Number(item.cost) || 0,
          total_value: runningBalance * (Number(item.cost) || 0),
          location: "G-1",
          remarks: `Issued to job ${iss.sub_job_no || iss.job_no}`
        });
      }
    }

    if (ledgerDocs.length > 0) {
      await StockLedger.insertMany(ledgerDocs);
      console.log(`[StockLedger] Successfully seeded ${ledgerDocs.length} initial ledger entries.`);
    }

    return { count: ledgerDocs.length, seeded: true };
  } catch (error) {
    console.error("[StockLedger] Error seeding initial ledger:", error);
    return { error: error.message };
  }
};

export const seedInitialStockLedger = async (req, res) => {
  try {
    const result = await internalSeedInitialStockLedger();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
