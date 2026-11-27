import accountPaymentModel from "../../models/accounts/accountPaymentModel.js";
import accountVendorPaymentModel from "../../models/accounts/accountVendorPaymentModel.js";
import CtInvoice from "../../models/controltower/ctInvoiceModel.js";
import BankMaster from "../../models/accounts/bankMasterModel.js";
import { computeBankBalance } from "./bankMasterController.js";

/**
 * GET /accounts/general-account-summary
 * Returns top KPI cards + bank accounts overview + P&L snapshot with date range
 */
export const getGeneralAccountSummary = async (req, res) => {
  try {
    const now = new Date();
    const fromParam = req.query.from || null;
    const toParam = req.query.to || null;

    let startDate, endDate;
    if (fromParam && toParam) {
      startDate = new Date(fromParam + "T00:00:00.000Z");
      endDate = new Date(toParam + "T23:59:59.999Z");
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Client Payments (inflows)
    const allClientPayments = await accountPaymentModel.find().lean();
    const _periodClientPayments = allClientPayments.filter((cp) => {
      const d = new Date(cp.payment_date || cp.createdAt);
      return d >= startDate && d <= endDate;
    });

    // Vendor Payments (outflows)
    const allVendorPayments = await accountVendorPaymentModel.find().lean();
    const periodVendorPayments = allVendorPayments.filter((vp) => {
      const d = new Date(vp.payment_date || vp.createdAt);
      return d >= startDate && d <= endDate;
    });
    const totalVendorPaid = periodVendorPayments.reduce((s, vp) => s + Number(vp.amount || 0), 0);

    // Invoiced Revenue
    const periodInvoices = await CtInvoice.find({
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { createdAt: { $gte: startDate, $lte: endDate } }
      ]
    }).lean();
    const invoicedRevenue = periodInvoices.reduce((s, inv) => s + Number(inv.subtotal || 0), 0);
    const gstCollected = periodInvoices.reduce((s, inv) => {
      const sub = Number(inv.subtotal || 0);
      const gstRate = Number(inv.gst_percent || inv.gst || 18) / 100;
      return s + sub * gstRate;
    }, 0);

    const inputTaxCredit = totalVendorPaid * 0.18;
    const netGstPayable = Math.max(0, Math.round((gstCollected - inputTaxCredit) * 100) / 100);
    const unreconciledCount = allClientPayments.filter((cp) => !cp.reconciled && !cp.is_reconciled).length;

    // Bank Accounts from Bank Master (Live Balances)
    const activeBanks = await BankMaster.find({ is_active: true }).lean();
    const bankAccounts = await Promise.all(
      activeBanks.map(async (b) => {
        const balance = await computeBankBalance(b._id);
        const isCash = b.account_type === "Cash" || b.account_type === "Cash in Hand";
        return {
          name: isCash ? "Cash in Hand" : `${b.bank_name} — ${b.account_type} A/c (•••• ${String(b.account_number).slice(-4)})`,
          balance: balance,
          type: isCash ? "cash" : "bank",
        };
      })
    );
    bankAccounts.sort((a, b) => b.balance - a.balance);

    const totalCashBank = bankAccounts.reduce((s, b) => s + b.balance, 0);

    // Expense Categories
    const expCat = {
      "Salaries & Wages": 0,
      "Rent": 0,
      "Electricity & Utilities": 0,
      "Marketing & Ads": 0,
      "Office Admin": 0,
      "Freight & Logistics": 0,
      "Vendor Payments": 0,
    };
    periodVendorPayments.forEach((vp) => {
      const n = String(vp.notes || vp.description || "").toLowerCase();
      if (n.includes("salary") || n.includes("wage") || n.includes("payroll")) expCat["Salaries & Wages"] += Number(vp.amount || 0);
      else if (n.includes("rent") || n.includes("lease")) expCat["Rent"] += Number(vp.amount || 0);
      else if (n.includes("electric") || n.includes("utility") || n.includes("water")) expCat["Electricity & Utilities"] += Number(vp.amount || 0);
      else if (n.includes("market") || n.includes("ads") || n.includes("advertis")) expCat["Marketing & Ads"] += Number(vp.amount || 0);
      else if (n.includes("courier") || n.includes("transport") || n.includes("freight") || n.includes("delivery")) expCat["Freight & Logistics"] += Number(vp.amount || 0);
      else if (n.includes("office") || n.includes("stationery") || n.includes("admin")) expCat["Office Admin"] += Number(vp.amount || 0);
      else expCat["Vendor Payments"] += Number(vp.amount || 0);
    });
    const totalExpenses = Object.values(expCat).reduce((s, v) => s + v, 0);
    const expensesBreakdown = Object.entries(expCat)
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const cogsEstimate = invoicedRevenue > 0 ? Math.round(invoicedRevenue * 0.46) : 0;
    const grossProfit = invoicedRevenue - cogsEstimate;
    const netProfit = grossProfit - totalExpenses;

    const nextGstDate = new Date(now.getFullYear(), now.getMonth() + 1, 11);
    const daysToGst = Math.ceil((nextGstDate - now) / (1000 * 60 * 60 * 24));

    const periodLabel = fromParam && toParam
      ? `${fromParam} to ${toParam}`
      : now.toLocaleString("en-IN", { month: "long", year: "numeric" });

    return res.status(200).json({
      success: true,
      data: {
        period: periodLabel,
        fromDate: fromParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        toDate: toParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
        kpis: {
          totalCashBank: Math.round(totalCashBank),
          unreconciledTxns: unreconciledCount,
          netGstPayable: Math.round(netGstPayable),
          nextGstFilingDue: `${daysToGst}d`,
          revenueMtd: Math.round(invoicedRevenue),
          expensesMtd: Math.round(totalExpenses),
        },
        bankAccounts,
        plSnapshot: {
          revenue: Math.round(invoicedRevenue),
          cogsMaterial: Math.round(cogsEstimate),
          grossProfit: Math.round(grossProfit),
          netProfit: Math.round(netProfit),
          totalExpenses: Math.round(totalExpenses),
          expensesBreakdown,
        },
      },
    });
  } catch (err) {
    console.error("Error in getGeneralAccountSummary:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
