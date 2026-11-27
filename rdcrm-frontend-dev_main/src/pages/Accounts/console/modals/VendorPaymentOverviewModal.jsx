import React, { useState, useEffect } from "react";
import { axiosInstance } from "../../../../utils/url/config";

export const matchesPaymentToTarget = (p, target) => {
  if (!p || !target) return false;

  const tBill = String(target.bill_no || target.billNo || "").trim().toLowerCase();
  const pBill = String(p.bill_no || p.billNo || "").trim().toLowerCase();
  const isSpecificTBill = tBill && !tBill.startsWith("out-") && !tBill.includes("bills");
  const isSpecificPBill = pBill && !pBill.startsWith("out-") && !pBill.includes("bills");

  // 1. If target is a specific bill/invoice, payment MUST match this bill/invoice
  if (isSpecificTBill) {
    return isSpecificPBill && pBill === tBill;
  }

  // 2. If target is NOT a specific bill, but payment belongs to a specific bill, do NOT match
  if (isSpecificPBill) {
    return false;
  }

  // 3. Strict match by assignment_id if neither has a specific bill
  const tAssign = String(target.assignment_id || target.assignmentId || "").trim();
  const pAssign = String(p.assignment_id || p.assignmentId || "").trim();
  if (tAssign && pAssign) {
    return tAssign === pAssign;
  }

  // 4. Match by sub_job_no
  const tSub = String(target.sub_job_no || target.subJobNo || "").trim().toLowerCase();
  const pSub = String(p.sub_job_no || p.subJobNo || "").trim().toLowerCase();
  if (tSub && pSub && tSub === pSub) {
    // If payment belongs to a distinct known assignment_id, do not claim it
    if (pAssign && tAssign && pAssign !== tAssign) {
      return false;
    }
    // If payment amount matches this target row's amount
    const tAmt = Number(target.amount || 0);
    const pAmt = Number(p.amount || 0);
    if (tAmt > 0 && pAmt > 0 && Math.abs(tAmt - pAmt) < 0.01) {
      return true;
    }
    // If payment has no assignment_id
    if (!pAssign) {
      return true;
    }
  }

  return false;
};

export default function VendorPaymentOverviewModal({ target, onClose, onPayAgain }) {
  const isSingleRow = Boolean(
    target.isRowOverview !== undefined
      ? target.isRowOverview
      : (target.assignment_id || target.sub_job_no || (target.bill_no && !String(target.bill_no).includes("Bills")))
  );

  const initialAll = target.allPayments || target.payments || [];
  const initialRowList = isSingleRow
    ? (target.payments && target.payments.length > 0 && target.isRowOverview
      ? target.payments
      : initialAll.filter((p) => matchesPaymentToTarget(p, target)))
    : initialAll;

  const [allHistory, setAllHistory] = useState(initialAll);
  const [filterThisRowOnly, setFilterThisRowOnly] = useState(isSingleRow);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleOpenAttachment = async (item) => {
    const rawUrl = typeof item === "string" ? item : (item?.url || item?.attachment);
    const name = typeof item === "string" ? "Receipt Proof" : (item?.name || item?.attachment_name || "Receipt Proof");
    if (!rawUrl) return;
    setLoadingAttachment(true);
    setImgError(false);

    let url = rawUrl;
    // If not base64, get freshly signed URL from /accounts/signed-url
    if (!url.startsWith("data:")) {
      try {
        const res = await axiosInstance.get("/accounts/signed-url", { params: { url: rawUrl } });
        if (res.data?.success && res.data?.signedUrl) {
          url = res.data.signedUrl;
        }
      } catch (err) {
        console.warn("Could not sign URL on the fly, using original:", err);
      }
    }
    setLoadingAttachment(false);
    setPreviewAttachment({ url, name, rawItem: item });
  };

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      const vId = target.vendorId || target.vendor_id || target.id;
      if (!vId) return;
      setLoadingHistory(true);
      try {
        const res = await axiosInstance.get(`/accounts/vendor-payments/${encodeURIComponent(vId)}`);
        if (res.data?.success && Array.isArray(res.data.data) && isMounted) {
          const list = res.data.data;
          setAllHistory(list);
        }
      } catch (err) {
        console.warn("Could not fetch vendor payment history, using cached:", err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [target]);

  const rowPaymentsList = allHistory.filter((p) => matchesPaymentToTarget(p, target));
  const fallbackList = initialRowList.length > 0 ? initialRowList : (target.payments || []);
  const displayedList = (isSingleRow && filterThisRowOnly)
    ? (rowPaymentsList.length > 0 ? rowPaymentsList : fallbackList)
    : allHistory;

  const amt = Number(target.amount || 0);
  const paid = Number(target.paid || 0);
  const due = Number(target.outstanding !== undefined ? target.outstanding : (target.due !== undefined ? target.due : Math.max(0, amt - paid)));

  const previewUrl = previewAttachment?.url || "";
  const previewName = (previewAttachment?.name || "").toLowerCase();
  const cleanUrl = previewUrl.split("?")[0].toLowerCase();
  const isPdf = previewUrl.startsWith("data:application/pdf") || cleanUrl.endsWith(".pdf") || previewName.endsWith(".pdf");
  const isImage = previewUrl.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(cleanUrl) ||
    /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(previewName);

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(12, 26, 46, 0.65)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(2px)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 14,
            width: 1240,
            maxWidth: "97vw",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            border: "1.5px solid #0D9488",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "#F0FDFA",
              borderBottom: "1.5px solid #99F6E4",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>📑</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isSingleRow ? "Outsource Bill Payment Overview" : "Vendor Payment Vouchers & History"}
                </div>
                <div style={{ fontSize: 11.5, color: "#115E59", fontWeight: 700, marginTop: 2 }}>
                  {target.vendorName || target.vendor}
                  {target.process ? ` · ${target.process}` : ""}
                  {target.sub_job_no ? ` · Sub-Job: ${target.sub_job_no}` : (target.job_no ? ` · Job: ${target.job_no}` : "")}
                  {target.bill_no && !String(target.bill_no).includes("Bills") ? ` · Inv: ${target.bill_no}` : ""}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: "#64748B",
                fontWeight: 900,
              }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 16,
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                  {filterThisRowOnly ? "Bill Amount" : "Total Bills Amount"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0C1A2E", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>
                  {filterThisRowOnly ? "Bill Paid" : "Total Paid"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#059669", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: due > 0 ? "#EF4444" : "#059669", textTransform: "uppercase" }}>
                  {due > 0 ? "Remaining Payable" : "Status"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: due > 0 ? "#EF4444" : "#059669", fontFamily: "monospace", marginTop: 2 }}>
                  {due > 0 ? `Rs ${due.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "✓ Fully Cleared"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#0C1A2E", textTransform: "uppercase" }}>
                  Payment Transactions ({displayedList.length})
                </span>
                {isSingleRow && (
                  <div style={{ display: "inline-flex", background: "#E2E8F0", borderRadius: 6, padding: 2, gap: 2 }}>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        padding: "3px 10px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        background: filterThisRowOnly ? "#0D9488" : "transparent",
                        color: filterThisRowOnly ? "white" : "#475569",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setFilterThisRowOnly(true)}
                    >
                      🎯 This Row Only ({rowPaymentsList.length})
                    </button>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        padding: "3px 10px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        background: !filterThisRowOnly ? "#0D9488" : "transparent",
                        color: !filterThisRowOnly ? "white" : "#475569",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setFilterThisRowOnly(false)}
                    >
                      🏢 All Vendor Payments ({allHistory.length})
                    </button>
                  </div>
                )}
              </div>
              {loadingAttachment && (
                <span style={{ fontSize: 11, color: "#0D9488", fontWeight: 700 }}>
                  ⏳ Generating secure preview link...
                </span>
              )}
            </div>

            {loadingHistory && displayedList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#64748B", fontStyle: "italic" }}>
                Loading payment vouchers...
              </div>
            ) : displayedList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#64748B", background: "#F8FAFC", borderRadius: 8, border: "1px dashed #CBD5E1" }}>
                No payments recorded yet for this {filterThisRowOnly ? "specific row" : "vendor"}.
              </div>
            ) : (
              <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflowX: "auto", background: "white" }}>
                <table style={{ width: "100%", minWidth: 1140, borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", borderBottom: "1.5px solid #CBD5E1" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Sub-Job No</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Paid Qty</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#0F172A", fontWeight: 800, whiteSpace: "nowrap" }}>Base Amt (Rs)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#0284C7", fontWeight: 800, whiteSpace: "nowrap" }}>GST (+)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#7C3AED", fontWeight: 800, whiteSpace: "nowrap" }}>TDS (-)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#15803D", fontWeight: 900, whiteSpace: "nowrap" }}>Total Paid (Rs)</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Mode & Bank</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Reference / UTR</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Receipt Proofs</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Recorded By</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedList.map((p, idx) => {
                      const pDate = p.payment_date || p.createdAt ? new Date(p.payment_date || p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

                      const baseAmt = Number(p.amount || 0);
                      const totalNet = p.total_amount !== undefined && Number(p.total_amount) > 0
                        ? Number(p.total_amount)
                        : Math.max(0, Math.round((baseAmt + (p.gst_amount || 0) - (p.tds_amount || 0)) * 100) / 100);

                      let gRate = Number(p.gst_rate || 0);
                      let gstAmt = p.gst_amount !== undefined && Number(p.gst_amount) > 0
                        ? Number(p.gst_amount)
                        : (gRate > 0 ? Math.round((baseAmt * gRate / 100) * 100) / 100 : 0);

                      let tRate = Number(p.tds_rate || 0);
                      let tdsAmt = p.tds_amount !== undefined && Number(p.tds_amount) > 0
                        ? Number(p.tds_amount)
                        : (tRate > 0 ? Math.round((baseAmt * tRate / 100) * 100) / 100 : 0);

                      // Intelligent legacy fallback: If tax amounts weren't stored directly but totalNet != baseAmt
                      if (tdsAmt === 0 && gstAmt === 0 && baseAmt > totalNet && totalNet > 0) {
                        tdsAmt = Math.round((baseAmt - totalNet) * 100) / 100;
                        tRate = Math.round((tdsAmt / baseAmt * 100) * 10) / 10;
                      } else if (tdsAmt === 0 && gstAmt === 0 && totalNet > baseAmt) {
                        gstAmt = Math.round((totalNet - baseAmt) * 100) / 100;
                        gRate = Math.round((gstAmt / baseAmt * 100) * 10) / 10;
                      }

                      const targetRate = Number(target.unit_rate || (target.amount && target.qty ? target.amount / target.qty : 0));
                      const fallbackQty = (!p.paid_qty && targetRate > 0 && baseAmt > 0) ? Math.round(baseAmt / targetRate) : 0;
                      const paidQty = Math.round(Number(p.paid_qty || fallbackQty || 0));
                      const isCash = (p.payment_mode || "").toLowerCase().includes("cash");

                      const rawAtts = Array.isArray(p.attachments) && p.attachments.length > 0
                        ? p.attachments
                        : (p.attachment ? [{ url: p.attachment, name: p.attachment_name || "Proof" }] : []);

                      // Deduplicate proofs by clean URL or filename to prevent duplicate display
                      const seenProofs = new Set();
                      const attachments = [];
                      rawAtts.forEach((att, aIdx) => {
                        const rawUrl = typeof att === "string" ? att : (att?.url || att?.attachment || "");
                        const cleanKey = rawUrl ? rawUrl.split("?")[0].split("/").pop() : (att?.name || `proof_${aIdx}`);
                        if (cleanKey && !seenProofs.has(cleanKey)) {
                          seenProofs.add(cleanKey);
                          attachments.push({
                            url: rawUrl,
                            name: typeof att === "string" ? `Proof ${attachments.length + 1}` : (att?.name || `Proof ${attachments.length + 1}`),
                          });
                        }
                      });

                      return (
                        <tr key={p._id || idx} style={{ borderBottom: "1px solid #E2E8F0" }}>
                          <td style={{ padding: "8px 10px", color: "#64748B", fontWeight: 600, whiteSpace: "nowrap" }}>{pDate}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 800, color: "#0D9488", whiteSpace: "nowrap" }}>
                            {p.sub_job_no || (p.bill_no && !String(p.bill_no).startsWith("OUT-") ? p.bill_no : p.job_no) || "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {paidQty > 0 ? (
                              <span style={{ background: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC", padding: "2px 7px", borderRadius: 4, fontWeight: 800, fontSize: 11, fontFamily: "monospace" }}>
                                {paidQty} Qty
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>
                            Rs {baseAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {gstAmt > 0 ? (
                              <div>
                                <div style={{ fontWeight: 800, color: "#0284C7" }}>+Rs {gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700 }}>
                                  ({gRate}%)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 10.5 }}>{gRate > 0 ? `${gRate}% (Rs 0)` : "0%"}</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {tdsAmt > 0 ? (
                              <div>
                                <div style={{ fontWeight: 800, color: "#7C3AED" }}>-Rs {tdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 10, color: "#6D28D9", fontWeight: 700 }}>
                                  ({tRate}%)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 10.5 }}>{tRate > 0 ? `${tRate}% (Rs 0)` : "0%"}</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: "#15803D", background: "rgba(240, 253, 244, 0.45)", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 900 }}>
                              Rs {totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px", color: "#1E293B" }}>
                            <div style={{ fontWeight: 800 }}>{p.payment_mode || "Bank Transfer"}</div>
                            {p.bank_account_label && (
                              <div style={{ fontSize: 10, color: "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                                <span>🏦</span> {p.bank_account_label}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#334155" }}>
                            {isCash ? (
                              <div>
                                {(p.cash_voucher_no || p.reference_no) && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: "#92400E", background: "#FEF3C7", border: "1px solid #FCD34D", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                                      🎫 Voucher: {p.cash_voucher_no || p.reference_no}
                                    </span>
                                  </div>
                                )}
                                {p.cash_paid_to && (
                                  <div style={{ fontSize: 10.5, color: "#475569", fontWeight: 700, marginTop: 3 }}>
                                    🤝 <b>Handed To:</b> <span style={{ color: "#0F172A" }}>{p.cash_paid_to}</span>
                                  </div>
                                )}
                                {!p.cash_voucher_no && !p.reference_no && !p.cash_paid_to && (
                                  <span style={{ color: "#94A3B8" }}>—</span>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{p.reference_no || "—"}</div>
                                {p.cash_paid_to && (
                                  <div style={{ fontSize: 10, color: "#64748B" }}>Handed to: {p.cash_paid_to}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            {attachments.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                                {attachments.map((att, attIdx) => (
                                  <button
                                    key={attIdx}
                                    type="button"
                                    onClick={() => handleOpenAttachment(att)}
                                    disabled={loadingAttachment}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                      padding: "3px 7px",
                                      borderRadius: 5,
                                      background: "#F0FDFA",
                                      border: "1px solid #99F6E4",
                                      color: "#0D9488",
                                      fontSize: 10.5,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                    }}
                                    title={att.name || `View Receipt ${attIdx + 1}`}
                                  >
                                    <span>📎</span>
                                    <span>{attachments.length === 1 ? "Proof" : `#${attIdx + 1}`}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", fontSize: 11, color: "#334155", fontWeight: 700 }}>
                            {p.created_by_name || p.created_by?.name || p.created_by?.username ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F1F5F9", padding: "2px 7px", borderRadius: 4, color: "#1E293B", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                                👤 {p.created_by_name || p.created_by?.name || p.created_by?.username}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#64748B", fontSize: 11 }}>
                            {p.notes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {displayedList.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#F8FAFC", borderTop: "2px solid #CBD5E1", fontWeight: 900, fontFamily: "monospace" }}>
                        <td colSpan={2} style={{ padding: "8px 10px", textAlign: "left", color: "#334155", fontFamily: "inherit" }}>
                          Total ({displayedList.length} txns)
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#15803D" }}>
                          {displayedList.reduce((acc, x) => acc + (Number(x.paid_qty) || 0), 0) > 0
                            ? `${displayedList.reduce((acc, x) => acc + (Number(x.paid_qty) || 0), 0)} Qty`
                            : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#0F172A", whiteSpace: "nowrap" }}>
                          Rs {displayedList.reduce((acc, x) => acc + (Number(x.amount) || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#0284C7", whiteSpace: "nowrap" }}>
                          +Rs {displayedList.reduce((acc, x) => {
                            const b = Number(x.amount || 0);
                            const gR = Number(x.gst_rate || 0);
                            const gA = x.gst_amount !== undefined && Number(x.gst_amount) > 0 ? Number(x.gst_amount) : (gR > 0 ? Math.round((b * gR / 100) * 100) / 100 : 0);
                            return acc + gA;
                          }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#7C3AED", whiteSpace: "nowrap" }}>
                          -Rs {displayedList.reduce((acc, x) => {
                            const b = Number(x.amount || 0);
                            const tR = Number(x.tds_rate || 0);
                            const tA = x.tds_amount !== undefined && Number(x.tds_amount) > 0 ? Number(x.tds_amount) : (tR > 0 ? Math.round((b * tR / 100) * 100) / 100 : 0);
                            return acc + tA;
                          }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#15803D", background: "rgba(240, 253, 244, 0.6)", whiteSpace: "nowrap" }}>
                          Rs {displayedList.reduce((acc, x) => {
                            const b = Number(x.amount || 0);
                            const gR = Number(x.gst_rate || 0);
                            const gA = x.gst_amount !== undefined && Number(x.gst_amount) > 0 ? Number(x.gst_amount) : (gR > 0 ? Math.round((b * gR / 100) * 100) / 100 : 0);
                            const tR = Number(x.tds_rate || 0);
                            const tA = x.tds_amount !== undefined && Number(x.tds_amount) > 0 ? Number(x.tds_amount) : (tR > 0 ? Math.round((b * tR / 100) * 100) / 100 : 0);
                            const tot = x.total_amount !== undefined && Number(x.total_amount) > 0 ? Number(x.total_amount) : Math.max(0, Math.round((b + gA - tA) * 100) / 100);
                            return acc + tot;
                          }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td colSpan={5}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 18px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between" }}>
            <button
              type="button"
              className="btn bs"
              onClick={() => window.print()}
              style={{ fontSize: 11.5, fontWeight: 700 }}
            >
              🖨️ Print Voucher
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {due > 0 && typeof onPayAgain === "function" && (
                <button
                  type="button"
                  className="btn bs bg"
                  style={{ background: "#0D9488", borderColor: "#0D9488", color: "white", fontSize: 11.5, fontWeight: 800 }}
                  onClick={() => onPayAgain(target)}
                >
                  💳 Pay Remaining Due
                </button>
              )}
              <button
                type="button"
                className="btn bs"
                onClick={onClose}
                style={{ fontSize: 11.5, fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Attachment Lightbox Preview Modal */}
      {previewAttachment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12, 26, 46, 0.8)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewAttachment(null);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              width: 820,
              maxWidth: "96vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
              border: "1px solid #CBD5E1",
            }}
          >
            {/* Header Toolbar */}
            <div
              style={{
                padding: "12px 18px",
                background: "#0C1A2E",
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 18 }}>🧾</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {previewAttachment.name || "Vendor Payment Receipt / Proof"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 800,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Open proof in a new browser tab"
                >
                  ↗ Open in New Window
                </a>
                {/* <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = previewAttachment.url;
                    a.download = previewAttachment.name || "vendor_proof";
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Download proof to your device"
                >
                  ⬇ Download
                </button> */}
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "white",
                    fontSize: 20,
                    fontWeight: 900,
                    cursor: "pointer",
                    lineHeight: 1,
                    marginLeft: 6,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Content View */}
            <div
              style={{
                padding: 16,
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#F8FAFC",
                minHeight: 380,
              }}
            >
              {isPdf ? (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                  <iframe
                    src={previewAttachment.url}
                    title="Receipt PDF Preview"
                    style={{
                      width: "100%",
                      height: "68vh",
                      border: "1px solid #CBD5E1",
                      borderRadius: 8,
                      background: "white",
                    }}
                  />
                  <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#64748B" }}>
                    Can't see the PDF preview?{" "}
                    <a
                      href={previewAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0D9488", fontWeight: 800, textDecoration: "underline" }}
                    >
                      Click here to open or download the PDF in a new tab
                    </a>
                  </div>
                </div>
              ) : isImage ? (
                imgError ? (
                  <div style={{ textAlign: "center", padding: "30px 20px" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#1E293B", marginBottom: 6 }}>
                      Unable to render image inline
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16, maxWidth: 360, margin: "0 auto 16px" }}>
                      The receipt proof cannot be loaded directly in the modal preview due to storage restrictions. You can still open and view it directly.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <a
                        href={previewAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "#0D9488",
                          color: "white",
                          padding: "8px 18px",
                          borderRadius: 6,
                          fontWeight: 800,
                          fontSize: 12,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        ↗ Open Image in New Tab
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setImgError(false);
                          handleOpenAttachment(previewAttachment.rawItem || previewAttachment);
                        }}
                        style={{
                          background: "#F1F5F9",
                          border: "1px solid #CBD5E1",
                          color: "#334155",
                          padding: "8px 14px",
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        🔄 Retry Load
                      </button>
                    </div>
                  </div>
                ) : (
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    onError={() => setImgError(true)}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "72vh",
                      objectFit: "contain",
                      borderRadius: 8,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                      border: "1px solid #E2E8F0",
                    }}
                  />
                )
              ) : (
                <div style={{ textAlign: "center", padding: "30px 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#1E293B", marginBottom: 6 }}>
                    {previewAttachment.name || "Vendor Attachment"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
                    This file format cannot be viewed inline. Click below to open or download it directly.
                  </div>
                  <a
                    href={previewAttachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "#0D9488",
                      color: "white",
                      padding: "8px 18px",
                      borderRadius: 6,
                      fontWeight: 800,
                      fontSize: 12,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    ↗ Open / Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
