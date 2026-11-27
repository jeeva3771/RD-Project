import mongoose from "mongoose";
import CollectionCase from "../../models/accounts/collectionCaseModel.js";
import UnallocatedReceipt from "../../models/accounts/unallocatedReceiptModel.js";
import AccountPayment from "../../models/accounts/accountPaymentModel.js";
import CtInvoice from "../../models/controltower/ctInvoiceModel.js";
import Customer from "../../models/masters/customerModel.js";
import userModel from "../../models/users/userModel.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import BankMaster from "../../models/accounts/bankMasterModel.js";
import BankTransaction from "../../models/accounts/bankTransactionModel.js";
import { maskAccNo } from "./bankMasterController.js";

import departmentModel from "../../models/masters/departmentModel.js";
import roleModel from "../../models/masters/roleModel.js";
import { uploadToR2, generateSignedUrl } from "../../helpers/r2helper.js";
import { invalidateClientOutstandingCache } from "./accountsController.js";

/**
 * Helper to safely convert R2 URLs or file keys into pre-signed URLs
 */
const convertToSignedUrl = (url, forceDownload = false, filename = null) => {
  if (!url || typeof url !== "string" || !url.trim()) return "";
  if (url.startsWith("data:")) return url; // base64 data url
  try {
    return generateSignedUrl(url.trim(), 86400, forceDownload, filename);
  } catch (err) {
    console.error("Error generating signed URL in collectionBoardController:", err.message);
    return url;
  }
};

// Helper date formatter
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formatDate = (d) => {
  if (!d) return "—";
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return `${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
};

/**
 * GET /accounts/collections/board
 * 100% Dynamic - Fetches live collection cases, invoices, receipts, unallocated payments,
 * GST proofs, and real system officers from MongoDB. Zero static/mock data.
 */
export const getCollectionsBoardData = async (req, res) => {
  try {
    // 1. Fetch real active users belonging to Accounts / Finance department, role, or permissions
    const [accountsDepts, accountsRoles] = await Promise.all([
      departmentModel
        .find({ name: { $regex: /account|finance/i } })
        .select("_id")
        .lean(),
      roleModel
        .find({ name: { $regex: /account|finance/i } })
        .select("_id")
        .lean(),
    ]);

    const accountsDeptIds = accountsDepts.map((d) => d._id);
    const accountsRoleIds = accountsRoles.map((r) => r._id);

    const accountsUserQuery = {
      is_active: { $ne: false },
      $or: [
        { department_id: { $in: accountsDeptIds } },
        { role: { $in: accountsRoleIds } },
        { permission: { $in: ["20", "47", "48", 20, 47, 48] } },
      ],
    };

    let accountsUsers = await userModel
      .find(accountsUserQuery)
      .select("name username email")
      .lean();

    // Fallback if no specific accounts user found
    if (!accountsUsers || accountsUsers.length === 0) {
      accountsUsers = await userModel
        .find({ is_active: { $ne: false } })
        .select("name username email")
        .lean();
    }

    const officers = Array.from(
      new Set(
        accountsUsers
          .map((u) => (u.name || u.username || "").trim())
          .filter(Boolean)
      )
    );

    const defaultOwner = officers.length > 0 ? officers[0] : "Accounts Officer";

    // 2. Fetch live data from all operational collections in parallel
    const [
      existingCases,
      customers,
      enquiries,
      soForms,
      soOrders,
      liveInvoices,
      livePayments,
      unallocated,
      bankAccountsList,
    ] = await Promise.all([
      CollectionCase.find().sort({ updatedAt: -1 }).lean(),
      Customer.find({ is_active: { $ne: false } })
        .select("name contact_person mobile_no email address is_active")
        .lean(),
      enquiryModel
        .find()
        .select("job_no name mobile_no wp_number email contact_person reference_no")
        .lean(),
      salesorderformModel
        .find()
        .select("job_no sub_job_no client_name contact_person mobile_no billing_gst_no")
        .lean(),
      salesorderlistModel
        .find()
        .populate({ path: "enquiry_id", select: "name mobile_no email wp_number job_no" })
        .populate({ path: "bom_id", select: "product_name quotation.finalUnitPrice totalUnitCost job_quantity" })
        .sort({ createdAt: -1 })
        .lean(),
      CtInvoice.find().sort({ date: -1 }).lean(),
      AccountPayment.find().sort({ payment_date: -1 }).lean(),
      UnallocatedReceipt.find().sort({ payment_date: -1 }).lean(),
      BankMaster.find({ is_active: { $ne: false } }).lean(),
    ]);

    // Build client contact & info map from real database sources
    const clientContactMap = new Map();

    // Seed contacts from Customer master
    customers.forEach((c) => {
      const name = (c.name || "").trim();
      if (!name) return;
      const billingAddr = (c.address || []).find((a) => a.is_billing) || c.address?.[0];
      clientContactMap.set(name.toLowerCase(), {
        client_name: name,
        client_id: c._id,
        contact_person: c.contact_person || billingAddr?.site_contact || "Finance Dept",
        phone: c.mobile_no ? `+91 ${c.mobile_no}` : (billingAddr?.site_phone ? `+91 ${billingAddr.site_phone}` : "—"),
        email: c.email || "accounts@client.com",
        gst_no: billingAddr?.gst_no || "",
      });
    });

    // Merge contacts from Enquiries (higher fidelity for recent jobs)
    enquiries.forEach((e) => {
      const name = (e.name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = clientContactMap.get(key);
      const phoneVal = e.mobile_no || (Array.isArray(e.wp_number) ? e.wp_number[0] : e.wp_number);
      const emailVal = Array.isArray(e.email) ? e.email[0] : e.email;
      clientContactMap.set(key, {
        client_name: existing?.client_name || name,
        client_id: existing?.client_id || null,
        contact_person: e.contact_person || existing?.contact_person || "Contact Person",
        phone: phoneVal ? `+91 ${phoneVal}` : (existing?.phone || "—"),
        email: emailVal || existing?.email || "accounts@client.com",
        gst_no: existing?.gst_no || "",
      });
    });

    // Merge contacts from SO Forms
    soForms.forEach((f) => {
      const name = (f.client_name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = clientContactMap.get(key);
      clientContactMap.set(key, {
        client_name: existing?.client_name || name,
        client_id: existing?.client_id || null,
        contact_person: f.contact_person || existing?.contact_person || "Contact Person",
        phone: f.mobile_no ? `+91 ${f.mobile_no}` : (existing?.phone || "—"),
        email: existing?.email || "accounts@client.com",
        gst_no: f.billing_gst_no || existing?.gst_no || "",
      });
    });

    // Build job_no & sub_job_no to Client Name map
    const jobToClientMap = new Map();
    soOrders.forEach((ord) => {
      const clientName = ord.enquiry_id?.name || "";
      if (clientName) {
        if (ord.job_no) jobToClientMap.set(ord.job_no.trim().toLowerCase(), clientName.trim());
        if (ord.sub_job_no) jobToClientMap.set(ord.sub_job_no.trim().toLowerCase(), clientName.trim());
      }
    });

    enquiries.forEach((e) => {
      if (e.job_no && e.name) {
        jobToClientMap.set(e.job_no.trim().toLowerCase(), e.name.trim());
      }
    });

    soForms.forEach((f) => {
      if (f.client_name) {
        if (f.job_no) jobToClientMap.set(f.job_no.trim().toLowerCase(), f.client_name.trim());
        if (f.sub_job_no) jobToClientMap.set(f.sub_job_no.trim().toLowerCase(), f.client_name.trim());
      }
    });

    // Also map CtInvoice job_no / sub_job_no
    liveInvoices.forEach((inv) => {
      const sub = (inv.sub_job_no || "").trim().toLowerCase();
      const jn = (inv.job_no || "").trim().toLowerCase();
      if (inv.remarks && !jobToClientMap.has(sub) && !jobToClientMap.has(jn)) {
        // If remarks contain client name
        jobToClientMap.set(sub, inv.remarks.trim());
      }
    });

    // 3. Ensure Collection Cases exist for all active clients
    let cases = [...existingCases];
    const existingCaseClientSet = new Set(
      cases.map((c) => (c.client_name || "").trim().toLowerCase())
    );

    // Identify clients that should have collection cases
    const newCasesToCreate = [];
    let officerIdx = 0;

    for (const [key, clientData] of clientContactMap.entries()) {
      if (!existingCaseClientSet.has(key)) {
        const assignedOwner = officers.length > 0
          ? officers[officerIdx % officers.length]
          : defaultOwner;
        officerIdx += 1;

        newCasesToCreate.push({
          client_name: clientData.client_name,
          client_id: clientData.client_id,
          contact_person: clientData.contact_person,
          phone: clientData.phone,
          email: clientData.email,
          owner: assignedOwner,
          stage: "new",
          escalation_count: 0,
          history: [
            {
              type: "note",
              text: `Collection case initialized for ${clientData.client_name}. Assigned to ${assignedOwner}.`,
              by: assignedOwner,
              date: new Date(),
              date_label: formatDate(new Date()),
            },
          ],
        });
        existingCaseClientSet.add(key);
      }
    }

    if (newCasesToCreate.length > 0) {
      const inserted = await CollectionCase.insertMany(newCasesToCreate);
      cases = [...cases, ...inserted.map((doc) => doc.toObject())];
    }

    // 3b. Ensure all existing cases belong to valid Accounts officers
    // Re-allocate any historical cases that were previously assigned to non-accounts staff
    const validOfficerSet = new Set(officers);
    const casesToReassign = [];
    cases.forEach((c, idx) => {
      if (!validOfficerSet.has(c.owner)) {
        const reallocated = officers.length > 0 ? officers[idx % officers.length] : defaultOwner;
        c.owner = reallocated;
        if (c._id) {
          casesToReassign.push({
            updateOne: {
              filter: { _id: c._id },
              update: { $set: { owner: reallocated } },
            },
          });
        }
      }
    });

    if (casesToReassign.length > 0) {
      try {
        await CollectionCase.bulkWrite(casesToReassign);
      } catch (e) {
        console.warn("Notice updating non-accounts case owners:", e.message);
      }
    }

    // 4. Map Live Receipts from AccountPayment (Only if requested by includeReceipts query, otherwise fetched on-demand by /collections/receipts)
    const shouldIncludeReceipts = req.query.includeReceipts === "true";
    const receipts = shouldIncludeReceipts
      ? livePayments.map((p) => {
        const subJob = (p.sub_job_no || "").trim();
        const job = (p.job_no || "").trim();
        const client = p.client_name ||
          jobToClientMap.get(subJob.toLowerCase()) ||
          jobToClientMap.get(job.toLowerCase()) ||
          "Client";

        const a = Number(p.amount || 0);
        const tds = Number(p.tds_amount || 0);
        const gross = Number(p.gross_amount || (a + tds));

        return {
          id: p._id.toString(),
          receiptNo: p.cash_voucher_no || p.receipt_no || "",
          date: formatDate(p.payment_date),
          dateObj: p.payment_date,
          invoiceId: p.invoice_id || subJob || job || p._id.toString(),
          invoiceNo: p.invoice_no || (subJob ? `RDINV-${subJob}` : (job ? `RDINV-${job}` : "INVOICE")),
          sub_job_no: subJob,
          client,
          amount: a || Number(p.total_payable || 0),
          tds_amount: tds,
          tds_rate: Number(p.tds_rate || 0),
          gross_amount: gross,
          total_payable: Number(p.total_payable || a),
          mode: p.payment_mode || "NEFT",
          refNo: p.reference_no || "",
          attachment: convertToSignedUrl(p.attachment),
          attachmentName: p.attachment_name || "",
          attachments: (p.attachments || []).map((att) => ({
            name: typeof att === "object" ? (att.name || "Payment Proof") : "Payment Proof",
            url: convertToSignedUrl(typeof att === "object" ? att.url : att),
          })),
          confirmedBy: p.created_by_name || "Accounts Team",
        };
      })
      : [];

    // 5. Structure Invoices by Client with Accurate FIFO Payment Allocation
    // Group raw invoices by client first
    const invoicesByClientMap = new Map();

    liveInvoices.forEach((inv) => {
      const sub = (inv.sub_job_no || "").trim().toLowerCase();
      const jn = (inv.job_no || "").trim().toLowerCase();

      let clientName = jobToClientMap.get(sub) || jobToClientMap.get(jn) || inv.remarks || "";
      if (!clientName) {
        const matchCust = customers.find(
          (c) => c.name.toLowerCase() === jn || c.name.toLowerCase() === sub
        );
        if (matchCust) clientName = matchCust.name;
      }
      if (!clientName) {
        clientName = inv.job_no || "Unassigned Client";
      }

      const clientKey = clientName.trim().toLowerCase();
      if (!invoicesByClientMap.has(clientKey)) {
        invoicesByClientMap.set(clientKey, []);
      }

      const invAmt = Number(inv.totalAmt || 0);
      const dueDateObj = inv.dueDate ? new Date(inv.dueDate) : null;
      let daysOverdue = 0;
      let dueIn = null;

      if (dueDateObj && !isNaN(dueDateObj.getTime())) {
        const diffMs = Date.now() - dueDateObj.getTime();
        if (diffMs > 0) {
          daysOverdue = Math.floor(diffMs / 86400000);
        } else {
          dueIn = Math.ceil(Math.abs(diffMs) / 86400000);
        }
      } else if (inv.date) {
        const invDateObj = new Date(inv.date);
        const creditExpiry = invDateObj.getTime() + 30 * 86400000;
        const diff = Date.now() - creditExpiry;
        if (diff > 0) {
          daysOverdue = Math.floor(diff / 86400000);
        } else {
          dueIn = Math.ceil(Math.abs(diff) / 86400000);
        }
      }

      invoicesByClientMap.get(clientKey).push({
        id: inv._id.toString(),
        sub_job_no: inv.sub_job_no || "",
        job_no: inv.job_no || "",
        invoiceNo: inv.invoiceNo || (inv.sub_job_no ? `RDINV-${inv.sub_job_no}` : `RDINV-${inv.job_no}`),
        client: clientName,
        refNo: inv.sub_job_no || inv.job_no || "",
        amount: invAmt,
        rawDate: inv.date || null,
        received: 0,
        balance: invAmt,
        stationId: "outstanding",
        daysOverdue,
        dueIn,
        lastFollowUp: inv.date ? formatDate(inv.date) : "—",
      });
    });

    // Also include confirmed sales orders without CtInvoice yet generated
    soOrders.forEach((ord) => {
      const clientName = ord.enquiry_id?.name || "";
      if (!clientName) return;
      const clientKey = clientName.trim().toLowerCase();
      const sub = (ord.sub_job_no || "").trim().toLowerCase();

      const existingInvs = invoicesByClientMap.get(clientKey) || [];
      const alreadyHas = existingInvs.some(
        (i) => i.id === ord._id.toString() || (sub && i.refNo.toLowerCase().includes(sub))
      );
      if (alreadyHas) return;

      const qty = Number(ord.bom_id?.job_quantity || ord.job_quantity || 1);
      const unitPrice = Number(ord.bom_id?.quotation?.finalUnitPrice) || Number(ord.bom_id?.totalUnitCost) || 0;
      const orderAmt = Math.round(qty * unitPrice * 1.18);

      if (orderAmt > 0) {
        const invObj = {
          id: ord._id.toString(),
          sub_job_no: ord.sub_job_no || "",
          job_no: ord.job_no || "",
          invoiceNo: ord.sub_job_no ? `SO-${ord.sub_job_no}` : `SO-${ord.job_no}`,
          client: clientName,
          refNo: ord.sub_job_no || ord.job_no || "",
          amount: orderAmt,
          rawDate: ord.createdAt || null,
          received: 0,
          balance: orderAmt,
          stationId: "outstanding",
          daysOverdue: 0,
          dueIn: null,
          lastFollowUp: ord.createdAt ? formatDate(ord.createdAt) : "—",
        };

        if (!invoicesByClientMap.has(clientKey)) {
          invoicesByClientMap.set(clientKey, []);
        }
        invoicesByClientMap.get(clientKey).push(invObj);
      }
    });

    // Helper map of payments: Direct Invoice Payments vs Sub-Job Pool
    // Map every known invoice identifier (_id and invoiceNo) to canonical invoice ID
    const invoiceCanonicalMap = new Map();
    liveInvoices.forEach((inv) => {
      const cId = inv._id.toString().toLowerCase();
      invoiceCanonicalMap.set(cId, cId);
      if (inv.invoiceNo) {
        invoiceCanonicalMap.set(inv.invoiceNo.trim().toLowerCase(), cId);
      }
    });

    const directInvoicePayments = new Map();
    const subJobPaymentPool = new Map();

    livePayments.forEach((p) => {
      const sub = (p.sub_job_no || "").trim().toLowerCase();
      const jn = (p.job_no || "").trim().toLowerCase();
      const amt = (p.gross_amount && Number(p.gross_amount) > Number(p.amount || 0))
        ? Number(p.gross_amount)
        : (Number(p.total_payable || 0) > 0 && Math.abs(Number(p.amount || 0) - (Number(p.total_payable || 0) + Number(p.tds_amount || 0))) < 0.05)
          ? Number(p.amount || 0)
          : (Number(p.amount || 0) + Number(p.tds_amount || 0));
      if (amt <= 0) return;

      const invIdKey = p.invoice_id ? String(p.invoice_id).trim().toLowerCase() : "";
      const invNoKey = p.invoice_no ? String(p.invoice_no).trim().toLowerCase() : "";

      let matchedCanonical = invoiceCanonicalMap.get(invIdKey) || invoiceCanonicalMap.get(invNoKey);

      if (!matchedCanonical && p.notes) {
        const notesMatch = p.notes.match(/(?:invoice|against)\s*[:#]?\s*([A-Za-z0-9\-_]+)/i);
        if (notesMatch && notesMatch[1]) {
          matchedCanonical = invoiceCanonicalMap.get(notesMatch[1].trim().toLowerCase());
        }
      }

      if (matchedCanonical) {
        directInvoicePayments.set(matchedCanonical, (directInvoicePayments.get(matchedCanonical) || 0) + amt);
      } else {
        const poolKey = sub || jn;
        if (poolKey) {
          subJobPaymentPool.set(poolKey, (subJobPaymentPool.get(poolKey) || 0) + amt);
        }
      }
    });

    // Allocate payments FIFO across each client's invoices
    for (const [clientKey, rawInvs] of invoicesByClientMap.entries()) {
      // Sort chronologically (oldest invoice date first)
      rawInvs.sort((a, b) => {
        const da = a.rawDate ? new Date(a.rawDate).getTime() : 0;
        const db = b.rawDate ? new Date(b.rawDate).getTime() : 0;
        if (da !== db) return da - db;
        return String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""));
      });

      // Group invoices by sub_job_no (or job_no)
      const subJobInvsMap = new Map();
      rawInvs.forEach((inv) => {
        const key = (inv.sub_job_no || inv.job_no || "general").trim().toLowerCase();
        if (!subJobInvsMap.has(key)) subJobInvsMap.set(key, []);
        subJobInvsMap.get(key).push(inv);
      });

      const allocatedClientInvoices = [];
      for (const [subKey, groupInvs] of subJobInvsMap.entries()) {
        let pool = subJobPaymentPool.get(subKey) || 0;
        if (pool === 0) {
          for (const inv of groupInvs) {
            const jn = (inv.job_no || "").trim().toLowerCase();
            if (jn && subJobPaymentPool.has(jn)) {
              pool = subJobPaymentPool.get(jn);
              subJobPaymentPool.set(jn, 0);
              break;
            }
          }
        }

        for (const inv of groupInvs) {
          const cId = inv.id.toLowerCase();
          const direct = directInvoicePayments.get(cId) || 0;
          let allocated = direct;
          if (pool > 0) {
            const needed = Math.max(0, inv.amount - allocated);
            const fromPool = Math.min(needed, pool);
            allocated += fromPool;
            pool -= fromPool;
          }

          const balance = Math.max(0, inv.amount - allocated);
          let stationId = "outstanding";
          if (balance <= 0) {
            stationId = "paid";
          } else if (inv.daysOverdue > 0) {
            stationId = "overdue";
          } else if (inv.dueIn !== null && inv.dueIn <= 5) {
            stationId = "duesoon";
          }

          allocatedClientInvoices.push({
            ...inv,
            received: allocated,
            balance,
            stationId,
          });
        }
      }

      invoicesByClientMap.set(clientKey, allocatedClientInvoices);
    }

    // 6. Format Cases Response
    const formattedCases = cases.map((c) => {
      const clientKey = (c.client_name || "").trim().toLowerCase();
      const contactInfo = clientContactMap.get(clientKey);
      const clientInvs = invoicesByClientMap.get(clientKey) || [];

      // Determine if case is fully paid
      const allSettled = clientInvs.length > 0 && clientInvs.every((i) => i.balance <= 0);

      return {
        id: c._id.toString(),
        _id: c._id.toString(),
        client: c.client_name,
        clientId: c.client_id ? c.client_id.toString() : null,
        stage: allSettled ? "closed" : (c.stage || "new"),
        owner: c.owner || defaultOwner,
        contact: {
          contactPerson: c.contact_person || contactInfo?.contact_person || "Contact Person",
          phone: c.phone || contactInfo?.phone || "—",
          email: c.email || contactInfo?.email || "—",
        },
        escalationCount: c.escalation_count || 0,
        nextFollowUp: c.next_followup_label || (c.next_followup_date ? formatDate(c.next_followup_date) : null),
        nextFollowUpIso: c.next_followup_date ? c.next_followup_date.toISOString() : null,
        promisedDate: c.promised_date ? formatDate(c.promised_date) : null,
        promisedDateIso: c.promised_date ? c.promised_date.toISOString() : null,
        promisedAmount: c.promised_amount != null ? Number(c.promised_amount) : null,
        promisedNote: c.promised_note || "",
        history: (c.history || []).map((h) => ({
          id: h._id ? h._id.toString() : `h-${Date.now()}-${Math.random()}`,
          type: h.type || "note",
          text: h.text,
          by: h.by || "Accounts Officer",
          date: h.date_label || formatDate(h.date),
        })),
        invoices: clientInvs,
      };
    });

    // Auto-migrate legacy date_label without year in UnallocatedReceipt in MongoDB
    const unallocNeedsUpdate = unallocated.filter((u) => u.date_label && !/\d{4}/.test(u.date_label));
    if (unallocNeedsUpdate.length > 0) {
      const bulkOps = unallocNeedsUpdate.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { date_label: formatDate(u.payment_date || u.createdAt) } },
        },
      }));
      UnallocatedReceipt.bulkWrite(bulkOps).catch((err) =>
        console.warn("Notice updating unallocated date_labels with year:", err.message)
      );
    }

    // 7. Format Unallocated Receipts
    const formattedUnallocated = unallocated.map((u) => ({
      id: u._id.toString(),
      receiptNo: u.receipt_no,
      date: formatDate(u.payment_date) || u.date_label,
      dateObj: u.payment_date,
      client: u.client_name,
      amount: Number(u.amount || 0),
      mode: u.mode || "NEFT",
      refNo: u.reference_no || "",
      attachment: convertToSignedUrl(u.attachment),
      attachmentName: u.attachment_name || "",
      attachments: (u.attachments || []).map((att) => ({
        name: typeof att === "object" ? (att.name || "Payment Proof") : "Payment Proof",
        url: convertToSignedUrl(typeof att === "object" ? att.url : att),
      })),
      confirmedBy: u.confirmed_by || "Accounts Team",
      allocations: (u.allocations || []).map((a) => ({
        invoiceId: a.invoice_id,
        invoiceNo: a.invoice_no,
        amount: Number(a.amount || 0),
        allocatedAt: a.allocated_at,
        allocatedBy: a.allocated_by,
      })),
    }));

    // 8. Format Active Bank Accounts
    const formattedBankAccounts = (bankAccountsList || []).map((b) => ({
      _id: b._id.toString(),
      bank_name: b.bank_name,
      account_number_masked: maskAccNo(b.account_number),
      branch: b.branch || "",
      label: `${b.bank_name} (${maskAccNo(b.account_number)})`,
    }));

    // Total Receipts collected across all account payments
    const totalReceiptsAmount = livePayments.reduce((s, p) => s + Number(p.amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        cases: formattedCases,
        receipts,
        totalReceiptsAmount: Math.round(totalReceiptsAmount * 100) / 100,
        unallocatedReceipts: formattedUnallocated,
        officers,
        bankAccounts: formattedBankAccounts,
      },
    });
  } catch (err) {
    console.error("Error fetching dynamic collections board data:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/collections/case/:id/stage
 * Updates case follow-up stage and auto-increments escalation counter if moved to escalated.
 */
export const updateCaseStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    const validStages = ["new", "contacted", "promised", "followup", "escalated", "closed"];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: `Invalid stage: ${stage}` });
    }

    const c = await CollectionCase.findById(id);
    if (!c) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    // Auto increment escalation count
    if (stage === "escalated" && c.stage !== "escalated") {
      c.escalation_count = (c.escalation_count || 0) + 1;
    }

    c.stage = stage;
    if (stage === "promised" && req.body.promisedDate) {
      const pDate = new Date(req.body.promisedDate);
      if (!isNaN(pDate.getTime())) {
        c.promised_date = pDate;
      }
      if (req.body.promisedAmount !== undefined) {
        c.promised_amount = req.body.promisedAmount ? Number(req.body.promisedAmount) : null;
      }
      if (req.body.promisedNote) {
        c.promised_note = req.body.promisedNote.trim();
      }
    }

    await c.save();

    return res.status(200).json({
      success: true,
      message: `Case stage updated to ${stage}`,
      data: {
        id: c._id,
        stage: c.stage,
        escalationCount: c.escalation_count,
        promisedDate: c.promised_date ? formatDate(c.promised_date) : null,
        promisedDateIso: c.promised_date ? c.promised_date.toISOString() : null,
        promisedAmount: c.promised_amount,
        promisedNote: c.promised_note || "",
      },
    });
  } catch (err) {
    console.error("Error updating case stage:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/collections/case/:id/promise
 * Records a client commitment/promise to pay with date, optional amount, and notes.
 */
export const recordCasePromise = async (req, res) => {
  try {
    const { id } = req.params;
    const { promisedDate, promisedAmount, note } = req.body;

    if (!promisedDate) {
      return res.status(400).json({ success: false, message: "Promised payment date is required" });
    }

    const c = await CollectionCase.findById(id);
    if (!c) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    const resolvedDate = new Date(promisedDate);
    if (isNaN(resolvedDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid promised date" });
    }

    const dateLabel = formatDate(resolvedDate);
    const amtNum = promisedAmount ? Number(promisedAmount) : null;
    const author = req.user?.name || c.owner || "Accounts Officer";

    c.stage = "promised";
    c.promised_date = resolvedDate;
    c.promised_amount = amtNum;
    c.promised_note = note ? note.trim() : "";

    const amtStr = amtNum ? `₹ ${amtNum.toLocaleString("en-IN")}` : "full outstanding balance";
    const historyText = `Payment promised: ${amtStr} on ${dateLabel}.${note && note.trim() ? ` Note: "${note.trim()}"` : ""}`;

    c.history.push({
      type: "note",
      text: historyText,
      by: author,
      date: new Date(),
      date_label: formatDate(new Date()),
    });

    await c.save();

    return res.status(200).json({
      success: true,
      message: `Payment promise recorded for ${dateLabel}`,
      data: {
        id: c._id,
        stage: c.stage,
        promisedDate: dateLabel,
        promisedDateIso: resolvedDate.toISOString(),
        promisedAmount: c.promised_amount,
        promisedNote: c.promised_note,
        history: c.history.map((h) => ({
          id: h._id ? h._id.toString() : `h-${Date.now()}-${Math.random()}`,
          type: h.type || "note",
          text: h.text,
          by: h.by || "Accounts Officer",
          date: h.date_label || formatDate(h.date),
        })),
      },
    });
  } catch (err) {
    console.error("Error recording case promise:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /accounts/collections/case/:id/history
 * Logs a call, email, WhatsApp, or internal note to case history.
 */
export const addCaseHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, text, by } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Note text is required" });
    }

    const c = await CollectionCase.findById(id);
    if (!c) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    const author = by || req.user?.name || "Accounts Officer";
    const dateNow = new Date();

    c.history.push({
      type: type || "note",
      text: text.trim(),
      by: author,
      date: dateNow,
      date_label: formatDate(dateNow),
    });

    // Auto-promote new to contacted
    if (c.stage === "new") {
      c.stage = "contacted";
    }

    await c.save();

    return res.status(200).json({
      success: true,
      message: "Discussion logged successfully",
      data: c.history,
    });
  } catch (err) {
    console.error("Error adding case history:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/collections/case/:id/follow-up
 * Schedules follow-up date and transitions stage to 'followup'.
 */
export const scheduleCaseFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { followUpDate, dateLabel } = req.body;

    const c = await CollectionCase.findById(id);
    if (!c) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    const resolvedDate = followUpDate ? new Date(followUpDate) : null;
    const resolvedLabel = dateLabel || formatDate(resolvedDate);

    c.next_followup_date = resolvedDate;
    c.next_followup_label = resolvedLabel;
    c.stage = "followup";

    c.history.push({
      type: "note",
      text: `Follow-up scheduled for ${resolvedLabel}.`,
      by: req.user?.name || c.owner || "Accounts Officer",
      date: new Date(),
      date_label: formatDate(new Date()),
    });

    await c.save();

    return res.status(200).json({
      success: true,
      message: `Follow-up scheduled for ${resolvedLabel}`,
      data: {
        nextFollowUp: resolvedLabel,
        stage: c.stage,
      },
    });
  } catch (err) {
    console.error("Error scheduling follow-up:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Helper to resolve invoiceId into real operational identifiers
 */
const resolveInvoiceIdentifiers = async (invoiceId) => {
  let resolvedSubJobNo = "";
  let resolvedJobNo = "";
  let resolvedInvoiceNo = "";

  if (!invoiceId) {
    return { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo };
  }

  const rawId = String(invoiceId).trim();
  const isObjectId = mongoose.Types.ObjectId.isValid(rawId) && /^[0-9a-fA-F]{24}$/.test(rawId);

  if (isObjectId) {
    const ctInv = await CtInvoice.findById(rawId).lean();
    if (ctInv) {
      resolvedSubJobNo = ctInv.sub_job_no || "";
      resolvedJobNo = ctInv.job_no || "";
      resolvedInvoiceNo = ctInv.invoiceNo || (resolvedSubJobNo ? `RDINV-${resolvedSubJobNo}` : "");
      return { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo };
    }

    const soOrder = await salesorderlistModel.findById(rawId).lean();
    if (soOrder) {
      resolvedSubJobNo = soOrder.sub_job_no || "";
      resolvedJobNo = soOrder.job_no || "";
      resolvedInvoiceNo = soOrder.sub_job_no ? `SO-${soOrder.sub_job_no}` : (soOrder.job_no ? `SO-${soOrder.job_no}` : "");
      return { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo };
    }
  }

  // Search by sub_job_no, invoiceNo, or job_no in CtInvoice
  const ctInv = await CtInvoice.findOne({
    $or: [
      { sub_job_no: new RegExp(`^${rawId}$`, "i") },
      { invoiceNo: new RegExp(`^${rawId}$`, "i") },
      { job_no: new RegExp(`^${rawId}$`, "i") },
    ],
  }).lean();

  if (ctInv) {
    resolvedSubJobNo = ctInv.sub_job_no || rawId;
    resolvedJobNo = ctInv.job_no || "";
    resolvedInvoiceNo = ctInv.invoiceNo || (resolvedSubJobNo ? `RDINV-${resolvedSubJobNo}` : "");
    return { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo };
  }

  // Search in salesorderlistModel
  const soOrder = await salesorderlistModel.findOne({
    $or: [
      { sub_job_no: new RegExp(`^${rawId}$`, "i") },
      { job_no: new RegExp(`^${rawId}$`, "i") },
    ],
  }).lean();

  if (soOrder) {
    resolvedSubJobNo = soOrder.sub_job_no || rawId;
    resolvedJobNo = soOrder.job_no || "";
    resolvedInvoiceNo = soOrder.sub_job_no ? `SO-${soOrder.sub_job_no}` : (soOrder.job_no ? `SO-${soOrder.job_no}` : "");
    return { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo };
  }

  return {
    resolvedSubJobNo: rawId,
    resolvedJobNo: rawId,
    resolvedInvoiceNo: rawId,
  };
};

/**
 * POST /accounts/collections/record-receipt
 * Records confirmed client payment or unmatched cash and syncs with general accounts and bank transactions.
 */
export const recordClientReceipt = async (req, res) => {
  try {
    const {
      caseId,
      invoiceId,
      sub_job_no,
      amount,
      mode,
      refNo,
      confirmedBy,
      isUnallocated,
      clientName,
      bankAccountId,
    } = req.body;

    const payVal = Number(amount);
    if (!payVal || payVal <= 0) {
      return res.status(400).json({ success: false, message: "Valid receipt amount is required" });
    }

    // Process mandatory payment proof attachments
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
          "payment_receipts",
          file.buffer,
          file.originalname,
          file.mimetype
        );
      } catch (uploadErr) {
        console.warn("R2 upload warning for payment receipt, using base64 fallback:", uploadErr.message);
        fileUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      }
      uploadedAttachments.push({
        url: fileUrl,
        name: file.originalname,
      });
    }

    if (uploadedAttachments.length === 0) {
      if (req.body.attachments) {
        try {
          const parsed = typeof req.body.attachments === "string" ? JSON.parse(req.body.attachments) : req.body.attachments;
          if (Array.isArray(parsed)) {
            parsed.forEach((a) => {
              if (typeof a === "string") uploadedAttachments.push({ url: a, name: "proof" });
              else if (a && a.url) uploadedAttachments.push({ url: a.url, name: a.name || "proof" });
            });
          }
        } catch {
          if (typeof req.body.attachments === "string") {
            uploadedAttachments.push({ url: req.body.attachments, name: req.body.attachment_name || "proof" });
          }
        }
      } else if (req.body.attachment) {
        uploadedAttachments.push({
          url: req.body.attachment,
          name: req.body.attachment_name || "proof",
        });
      }
    }

    // MANDATORY PROOF CHECK
    if (uploadedAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Payment proof is mandatory. Please attach a payment receipt or transaction screenshot.",
      });
    }

    const primaryAttachment = uploadedAttachments[0];

    const c = caseId ? await CollectionCase.findById(caseId) : null;
    const client = clientName || c?.client_name || "Unknown Client";
    const author = confirmedBy || req.user?.name || "Accounts Team";
    const incomingDate = req.body.date || req.body.payment_date || req.body.paymentDate;
    const paymentDate = incomingDate && !isNaN(new Date(incomingDate).getTime()) ? new Date(incomingDate) : new Date();

    if (isUnallocated) {
      // Record as unmatched receipt
      const unallocCount = await UnallocatedReceipt.countDocuments();
      const receiptNo = `RCPT-UN-${unallocCount + 1}`;

      const unalloc = new UnallocatedReceipt({
        receipt_no: receiptNo,
        client_name: client,
        client_id: c?.client_id || null,
        amount: payVal,
        mode: mode || "NEFT",
        reference_no: refNo || "",
        payment_date: paymentDate,
        date_label: formatDate(paymentDate),
        confirmed_by: author,
        attachment: primaryAttachment.url,
        attachment_name: primaryAttachment.name,
        attachments: uploadedAttachments,
        allocations: [],
      });
      await unalloc.save();

      // If bank account provided for unallocated payment, record credit in bank_transactions
      if (bankAccountId) {
        const bank = await BankMaster.findById(bankAccountId);
        if (bank) {
          await BankTransaction.create({
            bank_id: bank._id,
            bank_name: bank.bank_name,
            account_number_masked: maskAccNo(bank.account_number),
            type: "credit",
            amount: payVal,
            description: `Unallocated Client Payment from ${client} (Receipt: ${receiptNo})`,
            reference_id: unalloc._id.toString(),
            reference_type: "ClientPayment",
            sub_job_no: "",
            party_name: String(client).trim(),
            txn_date: unalloc.payment_date,
            created_by: req.user?._id || null,
            created_by_name: author,
          });
        }
      }

      if (c) {
        c.history.push({
          type: "note",
          text: `Unmatched payment received: ₹ ${payVal.toLocaleString("en-IN")} via ${mode || "NEFT"}${refNo ? " (Ref: " + refNo + ")" : ""} [Proof: ${primaryAttachment.name}] — not yet linked to an invoice.`,
          by: author,
          date: paymentDate,
          date_label: formatDate(paymentDate),
        });
        await c.save();
      }

      return res.status(200).json({
        success: true,
        message: `Unmatched payment of ₹ ${payVal.toLocaleString("en-IN")} recorded with proof`,
        data: unalloc,
      });
    }

    // Resolve invoice identifiers
    const { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo } = await resolveInvoiceIdentifiers(invoiceId || sub_job_no);

    // Matched receipt: Create record in AccountPayment so it reflects across full CRM!
    const payment = new AccountPayment({
      sub_job_no: resolvedSubJobNo || String(invoiceId).trim(),
      job_no: resolvedJobNo || resolvedSubJobNo || "",
      client_name: client,
      invoice_id: invoiceId ? String(invoiceId).trim() : "",
      invoice_no: req.body.invoiceNo || resolvedInvoiceNo || (invoiceId ? String(invoiceId).trim() : ""),
      amount: payVal,
      tds_amount: Number(req.body.tds_amount || 0),
      tds_rate: Number(req.body.tds_rate || 0),
      tds_tax: req.body.tds_tax || null,
      total_payable: Number(req.body.total_payable || payVal),
      gross_amount: Number(req.body.gross_amount || (payVal + Number(req.body.tds_amount || 0))),
      payment_mode: mode || "NEFT",
      reference_no: refNo || "",
      payment_date: paymentDate,
      bank_account_id: bankAccountId || null,
      attachment: primaryAttachment.url,
      attachment_name: primaryAttachment.name,
      attachments: uploadedAttachments,
      created_by_name: author,
      notes: `Recorded via Collections Command Center (Invoice: ${req.body.invoiceNo || resolvedInvoiceNo || invoiceId}, Ref: ${refNo || "N/A"})`,
    });
    await payment.save();
    invalidateClientOutstandingCache();

    // Create BankTransaction if bankAccountId is provided
    if (bankAccountId) {
      const bank = await BankMaster.findById(bankAccountId);
      if (bank) {
        await BankTransaction.create({
          bank_id: bank._id,
          bank_name: bank.bank_name,
          account_number_masked: maskAccNo(bank.account_number),
          type: "credit",
          amount: payVal,
          description: `Client Payment received from ${client} (Sub-Job: ${resolvedSubJobNo || invoiceId})`,
          reference_id: payment._id.toString(),
          reference_type: "ClientPayment",
          sub_job_no: String(resolvedSubJobNo || invoiceId).trim(),
          party_name: String(client).trim(),
          txn_date: payment.payment_date,
          created_by: req.user?._id || null,
          created_by_name: author,
        });
      }
    }

    // Log in case history
    if (c) {
      c.history.push({
        type: "receipt",
        text: `Receipt confirmed: ₹ ${payVal.toLocaleString("en-IN")} via ${mode || "NEFT"}${refNo ? " (Ref: " + refNo + ")" : ""} against invoice ${resolvedInvoiceNo || resolvedSubJobNo || invoiceId} [Proof: ${primaryAttachment.name}].`,
        by: author,
        date: paymentDate,
        date_label: formatDate(paymentDate),
      });
      await c.save();
    }

    return res.status(200).json({
      success: true,
      message: `Receipt of ₹ ${payVal.toLocaleString("en-IN")} recorded successfully with proof`,
      data: payment,
    });
  } catch (err) {
    console.error("Error recording client receipt:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /accounts/collections/reconcile
 * Allocates unmatched payment to a specific invoice.
 */
export const reconcileUnallocatedPayment = async (req, res) => {
  try {
    const { unallocatedId, invoiceId, sub_job_no, amount, caseId, invoiceNo, receiptNo } = req.body;

    let unalloc = null;
    if (unallocatedId && mongoose.Types.ObjectId.isValid(unallocatedId) && /^[0-9a-fA-F]{24}$/.test(String(unallocatedId))) {
      unalloc = await UnallocatedReceipt.findById(unallocatedId);
    }
    if (!unalloc && unallocatedId) {
      unalloc = await UnallocatedReceipt.findOne({
        $or: [
          { receipt_no: unallocatedId },
          { reference_no: unallocatedId },
        ],
      });
    }
    if (!unalloc && receiptNo) {
      unalloc = await UnallocatedReceipt.findOne({ receipt_no: receiptNo });
    }
    // Fallback search by case client_name for the most recent unallocated receipt with remaining balance
    if (!unalloc && caseId) {
      const c = await CollectionCase.findById(caseId).lean();
      if (c && c.client_name) {
        const candidates = await UnallocatedReceipt.find({
          client_name: new RegExp(`^${c.client_name.trim()}$`, "i"),
        }).sort({ createdAt: -1 });
        for (const cand of candidates) {
          const used = (cand.allocations || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
          if (cand.amount - used >= Number(amount) - 0.01) {
            unalloc = cand;
            break;
          }
        }
      }
    }

    if (!unalloc) {
      return res.status(404).json({ success: false, message: "Unmatched receipt record not found on server" });
    }

    const allocVal = Number(amount);
    const alreadyAllocated = (unalloc.allocations || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    const remaining = Math.max(0, unalloc.amount - alreadyAllocated);

    if (allocVal <= 0 || allocVal > remaining + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Allocation amount must be between 1 and ₹ ${remaining.toLocaleString("en-IN")}`,
      });
    }

    const author = req.user?.name || "Accounts Team";

    // Resolve invoice identifiers using the specific invoiceId first
    const { resolvedSubJobNo, resolvedJobNo, resolvedInvoiceNo } = await resolveInvoiceIdentifiers(invoiceId || sub_job_no);
    const targetSubJobNo = (sub_job_no && String(sub_job_no).trim()) || resolvedSubJobNo || String(invoiceId || "").trim();
    const displayInvoiceNo = invoiceNo || resolvedInvoiceNo || targetSubJobNo || invoiceId;

    // Add allocation record to UnallocatedReceipt
    unalloc.allocations.push({
      invoice_id: String(invoiceId || targetSubJobNo).trim(),
      invoice_no: displayInvoiceNo,
      amount: allocVal,
      allocated_at: new Date(),
      allocated_by: author,
    });
    await unalloc.save();

    // Create AccountPayment with explicit invoice_id & invoice_no so it matches directly
    const payment = new AccountPayment({
      sub_job_no: targetSubJobNo,
      job_no: resolvedJobNo || targetSubJobNo || "",
      client_name: unalloc.client_name,
      invoice_id: String(invoiceId || "").trim(),
      invoice_no: displayInvoiceNo,
      amount: allocVal,
      tds_amount: Number(req.body.tds_amount || 0),
      tds_rate: Number(req.body.tds_rate || 0),
      tds_tax: req.body.tds_tax || null,
      total_payable: Number(req.body.total_payable || allocVal),
      gross_amount: allocVal + Number(req.body.tds_amount || 0),
      payment_mode: unalloc.mode,
      reference_no: unalloc.reference_no,
      payment_date: unalloc.payment_date,
      attachment: unalloc.attachment || "",
      attachment_name: unalloc.attachment_name || "",
      attachments: unalloc.attachments || [],
      created_by_name: author,
      notes: req.body.notes || `Reconciled from unmatched receipt ${unalloc.receipt_no} against invoice ${displayInvoiceNo}`,
    });
    await payment.save();
    invalidateClientOutstandingCache();

    // Log in case history if caseId provided, or find by client_name
    let c = null;
    if (caseId) {
      c = await CollectionCase.findById(caseId);
    }
    if (!c && unalloc.client_name) {
      c = await CollectionCase.findOne({
        client_name: new RegExp(`^${unalloc.client_name.trim()}$`, "i"),
      });
    }
    if (c) {
      c.history.push({
        type: "receipt",
        text: `Reconciled ₹ ${allocVal.toLocaleString("en-IN")} from unmatched payment (${unalloc.receipt_no}) against invoice ${displayInvoiceNo}.`,
        by: author,
        date: new Date(),
        date_label: formatDate(new Date()),
      });
      await c.save();
    }

    return res.status(200).json({
      success: true,
      message: `Successfully allocated ₹ ${allocVal.toLocaleString("en-IN")} to invoice ${displayInvoiceNo}`,
      data: unalloc,
    });
  } catch (err) {
    console.error("Error reconciling unallocated payment:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /accounts/collections/case/:id/owner
 * Reassigns case to an Accounts officer.
 */
export const updateCaseOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { owner } = req.body;
    if (!owner || !owner.trim()) {
      return res.status(400).json({ success: false, message: "Owner is required" });
    }

    const c = await CollectionCase.findById(id);
    if (!c) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    const prevOwner = c.owner;
    c.owner = owner.trim();
    c.history.push({
      type: "note",
      text: `Case portfolio reassigned from ${prevOwner} to ${c.owner}.`,
      by: req.user?.name || "Accounts Team",
      date: new Date(),
      date_label: formatDate(new Date()),
    });

    await c.save();

    return res.status(200).json({
      success: true,
      message: `Case reassigned to ${c.owner}`,
      data: { id: c._id, owner: c.owner },
    });
  } catch (err) {
    console.error("Error updating case owner:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /accounts/unallocated-receipts
 * Fetches unallocated/unmatched receipts with remaining balance > 0 for a client or sub-job
 */
export const getClientUnallocatedReceipts = async (req, res) => {
  try {
    const { client, clientName, clientId, sub_job_no, subJobNo } = req.query;
    const cName = (client || clientName || "").trim();
    const sJob = (sub_job_no || subJobNo || "").trim();

    const candidateNames = new Set();
    if (cName) candidateNames.add(cName);

    // If sub_job_no is passed, resolve all candidate client names across forms, enquiry, invoices, cases
    if (sJob) {
      const baseJob = sJob.split("-")[0].trim().replace(/[a-zA-Z]$/, "");
      try {
        const [forms, enqs, invs, cases, payments] = await Promise.all([
          salesorderformModel.find({
            $or: [
              { sub_job_no: new RegExp(`^${sJob}$`, "i") },
              { job_no: new RegExp(`^${baseJob}$`, "i") },
            ],
          }).select("client_name").lean(),
          enquiryModel.find({
            $or: [
              { job_no: new RegExp(`^${baseJob}$`, "i") },
              { job_no: new RegExp(`^${sJob}$`, "i") },
            ],
          }).select("name").lean(),
          CtInvoice.find({
            $or: [
              { sub_job_no: new RegExp(`^${sJob}$`, "i") },
              { job_no: new RegExp(`^${baseJob}$`, "i") },
            ],
          }).select("client_name remarks").lean(),
          CollectionCase.find({
            $or: [
              { "invoices.sub_job_no": new RegExp(`^${sJob}$`, "i") },
              { "invoices.refNo": new RegExp(sJob, "i") },
            ],
          }).select("client_name").lean(),
          AccountPayment.find({
            $or: [
              { sub_job_no: new RegExp(`^${sJob}$`, "i") },
              { job_no: new RegExp(`^${baseJob}$`, "i") },
            ],
          }).select("client_name").lean(),
        ]);

        forms.forEach((f) => { if (f.client_name) candidateNames.add(f.client_name.trim()); });
        enqs.forEach((e) => { if (e.name) candidateNames.add(e.name.trim()); });
        invs.forEach((i) => {
          if (i.client_name) candidateNames.add(i.client_name.trim());
          if (i.remarks) candidateNames.add(i.remarks.trim());
        });
        cases.forEach((c) => { if (c.client_name) candidateNames.add(c.client_name.trim()); });
        payments.forEach((p) => { if (p.client_name) candidateNames.add(p.client_name.trim()); });
      } catch (err) {
        console.warn("Notice resolving candidate client names for unallocated receipts:", err.message);
      }
    }

    const nameRegexList = Array.from(candidateNames)
      .filter(Boolean)
      .map((n) => {
        const escaped = n.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`^${escaped}$`, "i");
      });

    let filter = {};
    if (nameRegexList.length > 0) {
      filter = {
        $or: [
          { client_name: { $in: nameRegexList } },
          ...(clientId && mongoose.Types.ObjectId.isValid(clientId) ? [{ client_id: clientId }] : []),
        ],
      };
    } else if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      filter = { client_id: clientId };
    }

    let receipts = await UnallocatedReceipt.find(filter)
      .sort({ payment_date: -1, createdAt: -1 })
      .lean();

    // Fallback: if exact match didn't find anything, try substring
    if (receipts.length === 0 && candidateNames.size > 0) {
      const partialList = Array.from(candidateNames)
        .filter(Boolean)
        .map((n) => {
          const escaped = n.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(escaped, "i");
        });
      receipts = await UnallocatedReceipt.find({
        client_name: { $in: partialList },
      })
        .sort({ payment_date: -1, createdAt: -1 })
        .lean();
    }

    const openReceipts = receipts
      .map((u) => {
        const allocated = (u.allocations || []).reduce((s, a) => s + Number(a.amount || 0), 0);
        const remaining = Math.max(0, Math.round((Number(u.amount || 0) - allocated) * 100) / 100);
        return {
          id: u._id.toString(),
          _id: u._id.toString(),
          receiptNo: u.receipt_no,
          date: u.date_label || (u.payment_date ? formatDate(u.payment_date) : "—"),
          paymentDate: u.payment_date,
          client: u.client_name,
          client_name: u.client_name,
          amount: Number(u.amount || 0),
          allocated,
          remaining,
          mode: u.mode || "NEFT",
          referenceNo: u.reference_no || "",
          attachment: convertToSignedUrl(u.attachment),
          attachmentName: u.attachment_name || "",
          attachments: (u.attachments || []).map((att) => ({
            name: typeof att === "object" ? (att.name || "Payment Proof") : "Payment Proof",
            url: convertToSignedUrl(typeof att === "object" ? att.url : att),
          })),
          confirmedBy: u.confirmed_by || "Accounts Team",
          allocations: u.allocations || [],
        };
      })
      .filter((u) => u.remaining > 0.01);

    const totalRemaining = Math.round(openReceipts.reduce((s, u) => s + u.remaining, 0) * 100) / 100;

    return res.status(200).json({
      success: true,
      data: openReceipts,
      totalRemaining,
    });
  } catch (err) {
    console.error("Error fetching unallocated receipts:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /accounts/collections/receipts
 * Dedicated endpoint for Receipts Ledger with server-side pagination, search, and filtering.
 */
export const getCollectionsReceiptsLedger = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const isAll = req.query.limit === "all";
    const limit = isAll ? 0 : Math.max(1, parseInt(req.query.limit, 10) || 25);
    const search = (req.query.search || "").trim();
    const mode = (req.query.mode || "all").trim().toLowerCase();
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const clientFilter = (req.query.client || "").trim();
    const ownerFilter = (req.query.owner || "").trim();

    const mongoFilter = {};

    // 1. Payment Mode Filter
    if (mode && mode !== "all") {
      if (mode === "cash") {
        mongoFilter.payment_mode = { $regex: /cash/i };
      } else if (mode === "cheque") {
        mongoFilter.payment_mode = { $regex: /cheque/i };
      } else if (mode === "upi") {
        mongoFilter.payment_mode = { $regex: /upi|gpay|phonepe/i };
      } else if (mode === "bank") {
        mongoFilter.payment_mode = { $regex: /bank|neft|rtgs|transfer/i };
      } else {
        mongoFilter.payment_mode = { $regex: new RegExp(mode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
      }
    }

    // 2. Date Range Filter
    if (startDate || endDate) {
      mongoFilter.payment_date = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) mongoFilter.payment_date.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          mongoFilter.payment_date.$lte = e;
        }
      }
      if (Object.keys(mongoFilter.payment_date).length === 0) {
        delete mongoFilter.payment_date;
      }
    }

    // 3. Officer / Confirmed By Filter
    if (ownerFilter) {
      const ownerRegex = new RegExp(ownerFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      mongoFilter.created_by_name = ownerRegex;
    }

    // 4. Client Filter
    if (clientFilter) {
      const clientRegex = new RegExp(clientFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const [matchingForms, matchingInvoices, matchingEnquiries] = await Promise.all([
        salesorderformModel.find({ client_name: clientRegex }).select("job_no sub_job_no").lean(),
        CtInvoice.find({ $or: [{ client_name: clientRegex }, { remarks: clientRegex }] }).select("job_no sub_job_no").lean(),
        enquiryModel.find({ name: clientRegex }).select("job_no").lean(),
      ]);
      const matchedJobs = new Set();
      const matchedSubJobs = new Set();
      matchingForms.forEach((f) => {
        if (f.job_no) matchedJobs.add(f.job_no.trim());
        if (f.sub_job_no) matchedSubJobs.add(f.sub_job_no.trim());
      });
      matchingInvoices.forEach((i) => {
        if (i.job_no) matchedJobs.add(i.job_no.trim());
        if (i.sub_job_no) matchedSubJobs.add(i.sub_job_no.trim());
      });
      matchingEnquiries.forEach((e) => {
        if (e.job_no) matchedJobs.add(e.job_no.trim());
      });

      const clientOr = [{ client_name: clientRegex }];
      if (matchedSubJobs.size > 0) clientOr.push({ sub_job_no: { $in: Array.from(matchedSubJobs) } });
      if (matchedJobs.size > 0) clientOr.push({ job_no: { $in: Array.from(matchedJobs) } });

      if (mongoFilter.$or) {
        mongoFilter.$and = [{ $or: mongoFilter.$or }, { $or: clientOr }];
        delete mongoFilter.$or;
      } else {
        mongoFilter.$or = clientOr;
      }
    }

    // 5. Search Filter (searches across receipt_no, cash_voucher_no, reference_no, sub_job_no, job_no, invoice_no, client, notes)
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");

      // Check if search matches any client name in other collections
      const [matchingForms, matchingInvoices, matchingEnquiries] = await Promise.all([
        salesorderformModel.find({ client_name: searchRegex }).select("job_no sub_job_no").lean(),
        CtInvoice.find({ $or: [{ client_name: searchRegex }, { remarks: searchRegex }] }).select("job_no sub_job_no").lean(),
        enquiryModel.find({ name: searchRegex }).select("job_no").lean(),
      ]);
      const searchMatchedJobs = new Set();
      const searchMatchedSubJobs = new Set();
      matchingForms.forEach((f) => {
        if (f.job_no) searchMatchedJobs.add(f.job_no.trim());
        if (f.sub_job_no) searchMatchedSubJobs.add(f.sub_job_no.trim());
      });
      matchingInvoices.forEach((i) => {
        if (i.job_no) searchMatchedJobs.add(i.job_no.trim());
        if (i.sub_job_no) searchMatchedSubJobs.add(i.sub_job_no.trim());
      });
      matchingEnquiries.forEach((e) => {
        if (e.job_no) searchMatchedJobs.add(e.job_no.trim());
      });

      const searchOr = [
        { client_name: searchRegex },
        { sub_job_no: searchRegex },
        { job_no: searchRegex },
        { invoice_no: searchRegex },
        { invoice_id: searchRegex },
        { reference_no: searchRegex },
        { cash_voucher_no: searchRegex },
        { created_by_name: searchRegex },
        { notes: searchRegex },
      ];
      if (searchMatchedSubJobs.size > 0) {
        searchOr.push({ sub_job_no: { $in: Array.from(searchMatchedSubJobs) } });
      }
      if (searchMatchedJobs.size > 0) {
        searchOr.push({ job_no: { $in: Array.from(searchMatchedJobs) } });
      }

      if (mongoFilter.$or) {
        mongoFilter.$and = [{ $or: mongoFilter.$or }, { $or: searchOr }];
        delete mongoFilter.$or;
      } else if (mongoFilter.$and) {
        mongoFilter.$and.push({ $or: searchOr });
      } else {
        mongoFilter.$or = searchOr;
      }
    }

    // 6. Total Counts & Aggregated Stats
    const [totalFilteredCount, totalAllCount, statsResult] = await Promise.all([
      AccountPayment.countDocuments(mongoFilter),
      AccountPayment.countDocuments(),
      AccountPayment.aggregate([
        { $match: mongoFilter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            totalGross: { $sum: { $ifNull: ["$gross_amount", "$amount"] } },
            totalTds: { $sum: { $ifNull: ["$tds_amount", 0] } },
          },
        },
      ]),
    ]);

    const stats = statsResult[0] || {};
    const totalAmount = Math.round((stats.totalAmount || 0) * 100) / 100;
    const totalSettled = Math.round((stats.totalGross || 0) * 100) / 100;
    const totalTds = Math.round((stats.totalTds || 0) * 100) / 100;

    // 7. Paginated Query
    const skip = limit > 0 ? (page - 1) * limit : 0;
    let paymentsQuery = AccountPayment.find(mongoFilter).sort({ payment_date: -1, createdAt: -1 });
    if (limit > 0) {
      paymentsQuery = paymentsQuery.skip(skip).limit(limit);
    }
    const pagedPayments = await paymentsQuery.lean();

    // 8. Resolve Client Names specifically for the paged batch
    const pagedSubJobs = [...new Set(pagedPayments.map((p) => (p.sub_job_no || "").trim()).filter(Boolean))];
    const pagedJobs = [...new Set(pagedPayments.map((p) => (p.job_no || "").trim()).filter(Boolean))];

    const [enquiries, soForms, soOrders, liveInvoices] = await Promise.all([
      enquiryModel.find({ job_no: { $in: pagedJobs } }).select("job_no name").lean(),
      salesorderformModel.find({ $or: [{ sub_job_no: { $in: pagedSubJobs } }, { job_no: { $in: pagedJobs } }] }).select("job_no sub_job_no client_name").lean(),
      salesorderlistModel.find({ $or: [{ sub_job_no: { $in: pagedSubJobs } }, { job_no: { $in: pagedJobs } }] }).populate({ path: "enquiry_id", select: "name job_no" }).lean(),
      CtInvoice.find({ $or: [{ sub_job_no: { $in: pagedSubJobs } }, { job_no: { $in: pagedJobs } }] }).select("sub_job_no job_no invoiceNo client_name remarks").lean(),
    ]);

    const jobToClientMap = new Map();
    soOrders.forEach((ord) => {
      const cName = ord.enquiry_id?.name || "";
      if (cName) {
        if (ord.job_no) jobToClientMap.set(ord.job_no.trim().toLowerCase(), cName.trim());
        if (ord.sub_job_no) jobToClientMap.set(ord.sub_job_no.trim().toLowerCase(), cName.trim());
      }
    });
    enquiries.forEach((e) => {
      if (e.job_no && e.name) {
        jobToClientMap.set(e.job_no.trim().toLowerCase(), e.name.trim());
      }
    });
    soForms.forEach((f) => {
      if (f.client_name) {
        if (f.job_no) jobToClientMap.set(f.job_no.trim().toLowerCase(), f.client_name.trim());
        if (f.sub_job_no) jobToClientMap.set(f.sub_job_no.trim().toLowerCase(), f.client_name.trim());
      }
    });
    liveInvoices.forEach((inv) => {
      const cName = inv.client_name || inv.remarks || "";
      if (cName) {
        if (inv.job_no) jobToClientMap.set(inv.job_no.trim().toLowerCase(), cName.trim());
        if (inv.sub_job_no) jobToClientMap.set(inv.sub_job_no.trim().toLowerCase(), cName.trim());
      }
    });

    const receipts = pagedPayments.map((p) => {
      const subJob = (p.sub_job_no || "").trim();
      const job = (p.job_no || "").trim();
      const client = p.client_name ||
        jobToClientMap.get(subJob.toLowerCase()) ||
        jobToClientMap.get(job.toLowerCase()) ||
        "Client";

      const a = Number(p.amount || 0);
      const tds = Number(p.tds_amount || 0);
      const gross = Number(p.gross_amount || (a + tds));

      return {
        id: p._id.toString(),
        receiptNo: p.cash_voucher_no || p.receipt_no || "",
        date: formatDate(p.payment_date),
        dateObj: p.payment_date,
        invoiceId: p.invoice_id || subJob || job || p._id.toString(),
        invoiceNo: p.invoice_no || (subJob ? `RDINV-${subJob}` : (job ? `RDINV-${job}` : "INVOICE")),
        sub_job_no: subJob,
        client,
        amount: a || Number(p.total_payable || 0),
        tds_amount: tds,
        tds_rate: Number(p.tds_rate || 0),
        gross_amount: gross,
        total_payable: Number(p.total_payable || a),
        mode: p.payment_mode || "NEFT",
        refNo: p.reference_no || "",
        attachment: convertToSignedUrl(p.attachment),
        attachmentName: p.attachment_name || "",
        attachments: (p.attachments || []).map((att) => ({
          name: typeof att === "object" ? (att.name || "Payment Proof") : "Payment Proof",
          url: convertToSignedUrl(typeof att === "object" ? att.url : att),
        })),
        confirmedBy: p.created_by_name || "Accounts Team",
      };
    });

    const totalPages = limit === 0 ? 1 : Math.max(1, Math.ceil(totalFilteredCount / limit));

    return res.status(200).json({
      success: true,
      data: receipts,
      pagination: {
        currentPage: page,
        pageSize: limit === 0 ? totalFilteredCount : limit,
        totalPages,
        totalItems: totalFilteredCount,
        totalAll: totalAllCount,
        hasNextPage: limit > 0 && page < totalPages,
        hasPrevPage: page > 1,
      },
      totals: {
        totalAmount,
        totalSettled,
        totalTds,
      },
      totalCount: totalFilteredCount,
      totalReceipts: totalAmount,
      totalSettled,
      totalTds,
    });
  } catch (err) {
    console.error("Error fetching collections receipts ledger:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



