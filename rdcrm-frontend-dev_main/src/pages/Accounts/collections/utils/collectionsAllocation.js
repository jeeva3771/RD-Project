/**
 * FIFO receipt allocation engine for collections invoices
 */
export function allocateReceiptsToInvoices(invoices = [], receiptsList = []) {
  if (!invoices || invoices.length === 0) return [];
  // If receiptsList is empty / not loaded yet, preserve backend-computed received & balance
  if (!receiptsList || receiptsList.length === 0) return invoices;

  // Sort invoices chronologically (FIFO - oldest invoice date or lowest invoiceNo first)
  const sorted = [...invoices].map((inv) => ({
    ...inv,
    amount: Number(inv.amount || 0),
    received: 0,
    balance: Number(inv.amount || 0),
  })).sort((a, b) => {
    const da = a.rawDate || a.date ? new Date(a.rawDate || a.date).getTime() : 0;
    const db = b.rawDate || b.date ? new Date(b.rawDate || b.date).getTime() : 0;
    if (da !== db) return da - db;
    return String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""));
  });

  // Map every known invoice identifier (_id, id, invoiceNo) to canonical invoice ID
  const invCanonicalMap = new Map();
  sorted.forEach((inv) => {
    const cId = String(inv.id || inv._id || "").trim().toLowerCase();
    if (cId) invCanonicalMap.set(cId, cId);
    if (inv.invoiceNo) {
      invCanonicalMap.set(String(inv.invoiceNo).trim().toLowerCase(), cId);
    }
  });

  // Separate receipts into direct invoice receipts vs subjob/job level pools
  const directPayments = new Map();
  const subJobPool = new Map();

  (receiptsList || []).forEach((r) => {
    const gross = Number(r.gross_amount || 0);
    const a = Number(r.amount || 0);
    const tds = Number(r.tds_amount || 0);
    const net = Number(r.total_payable || 0);
    const amt = (gross > a)
      ? gross
      : (net > 0 && Math.abs(a - (net + tds)) < 0.05)
        ? a
        : (a + tds);
    if (amt <= 0) return;
    const invId = String(r.invoiceId || "").trim().toLowerCase();
    const invNo = String(r.invoiceNo || "").trim().toLowerCase();
    const sub = String(r.sub_job_no || "").trim().toLowerCase();

    // Check if directly matches a known canonical invoice
    let matchedCanonical = invCanonicalMap.get(invId) || invCanonicalMap.get(invNo);

    if (!matchedCanonical && r.notes) {
      const notesMatch = String(r.notes).match(/(?:invoice|against)\s*[:#]?\s*([A-Za-z0-9\-_]+)/i);
      if (notesMatch && notesMatch[1]) {
        matchedCanonical = invCanonicalMap.get(notesMatch[1].trim().toLowerCase());
      }
    }

    if (matchedCanonical) {
      directPayments.set(matchedCanonical, (directPayments.get(matchedCanonical) || 0) + amt);
    } else {
      const poolKey = sub || invId;
      if (poolKey) {
        subJobPool.set(poolKey, (subJobPool.get(poolKey) || 0) + amt);
      }
    }
  });

  // Group by sub_job_no / job_no
  const subJobGroups = new Map();
  sorted.forEach((inv) => {
    const key = (inv.sub_job_no || inv.job_no || "general").trim().toLowerCase();
    if (!subJobGroups.has(key)) subJobGroups.set(key, []);
    subJobGroups.get(key).push(inv);
  });

  const allocatedInvoices = [];
  for (const [subKey, groupInvs] of subJobGroups.entries()) {
    let pool = subJobPool.get(subKey) || 0;
    if (pool === 0) {
      for (const inv of groupInvs) {
        const jn = (inv.job_no || "").trim().toLowerCase();
        if (jn && subJobPool.has(jn)) {
          pool = subJobPool.get(jn);
          subJobPool.set(jn, 0);
          break;
        }
      }
    }

    for (const inv of groupInvs) {
      const cId = String(inv.id || inv._id || "").trim().toLowerCase();
      const directPaid = directPayments.get(cId) || (inv.invoiceNo ? directPayments.get(String(inv.invoiceNo).trim().toLowerCase()) : 0) || 0;
      let allocated = directPaid;
      if (pool > 0) {
        const needed = Math.max(0, Number(inv.amount || 0) - allocated);
        const fromPool = Math.min(needed, pool);
        allocated += fromPool;
        pool -= fromPool;
      }
      const balance = Math.max(0, Math.round((Number(inv.amount || 0) - allocated) * 100) / 100);
      let stationId = "outstanding";
      if (balance <= 0) {
        stationId = "paid";
      } else if (inv.daysOverdue > 0) {
        stationId = "overdue";
      } else if (inv.dueIn !== null && inv.dueIn <= 5) {
        stationId = "duesoon";
      }

      allocatedInvoices.push({
        ...inv,
        received: allocated,
        balance,
        stationId,
      });
    }
  }

  return allocatedInvoices;
}

export function receivedForInvoice(invOrId) {
  if (invOrId && typeof invOrId === "object" && typeof invOrId.received === "number") {
    return invOrId.received;
  }
  return 0;
}

export function computeRepeatOffenderIntel(escalationCount = 0, invoicesForClient = []) {
  const unpaid = (invoicesForClient || []).filter((i) => (Number(i.balance) || 0) > 0);
  const overdueCount = unpaid.filter((i) => (i.daysOverdue || 0) > 0).length;
  const avgDaysOverdue = (invoicesForClient || []).length
    ? Math.round(
      invoicesForClient.reduce((s, i) => s + (i.daysOverdue || 0), 0) /
      invoicesForClient.length
    )
    : 0;
  const oldestOverdue = unpaid.reduce((m, i) => Math.max(m, i.daysOverdue || 0), 0);
  let score =
    (escalationCount || 0) * 30 +
    overdueCount * 10 +
    avgDaysOverdue * 0.5 +
    (oldestOverdue > 60 ? 25 : oldestOverdue > 30 ? 15 : 0);
  score = Math.round(score);
  const tier = score >= 60 ? "Repeat Offender" : score >= 30 ? "Watch" : "Normal";
  return { score, tier, escalationCount: escalationCount || 0, overdueCount, avgDaysOverdue, oldestOverdue };
}

