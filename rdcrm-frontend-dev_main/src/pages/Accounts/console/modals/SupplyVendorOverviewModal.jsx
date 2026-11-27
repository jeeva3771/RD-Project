import React, { useState, useEffect } from "react";
import { axiosInstance } from "../../../../utils/url/config";
import { fmt } from "../utils/accountsFormatters";

export default function SupplyVendorOverviewModal({ target, onClose, onPayAgain }) {
  const [allHistory, setAllHistory] = useState(target.allPayments || target.payments || []);
  const [history, setHistory] = useState(target.payments || target.allPayments || []);
  const [filterThisBillOnly, setFilterThisBillOnly] = useState(Boolean(target.bill_no && !String(target.bill_no).includes("Bills")));
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [searchTxn, setSearchTxn] = useState("");

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
      const vId = target.vendorId || target.vendor_id || target.id || target.vendorName || target.vendor;
      if (!vId) return;
      setLoadingHistory(true);
      try {
        const res = await axiosInstance.get(`/accounts/vendor-payments/${encodeURIComponent(vId)}`);
        if (res.data?.success && Array.isArray(res.data.data) && isMounted) {
          const list = res.data.data;
          setAllHistory(list);
          if (target.bill_no && filterThisBillOnly) {
            const bNo = String(target.bill_no).trim().toLowerCase();
            const filtered = list.filter((p) => {
              const pBill = String(p.bill_no || "").trim().toLowerCase();
              return bNo && pBill === bNo;
            });
            setHistory(filtered.length > 0 ? filtered : list);
          } else {
            setHistory(list);
          }
        }
      } catch (err) {
        console.warn("Could not fetch supply vendor payment history:", err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [target, filterThisBillOnly]);

  let displayedList = filterThisBillOnly && target.bill_no && !String(target.bill_no).includes("Bills")
    ? allHistory.filter((p) => {
      const bNo = String(target.bill_no).trim().toLowerCase();
      const pBill = String(p.bill_no || "").trim().toLowerCase();
      return bNo && pBill === bNo;
    })
    : (history.length > 0 ? history : allHistory);

  if (searchTxn.trim()) {
    const q = searchTxn.trim().toLowerCase();
    displayedList = displayedList.filter((p) => {
      const ref = String(p.reference_no || "").toLowerCase();
      const mode = String(p.payment_mode || "").toLowerCase();
      const bank = String(p.bank_account_label || "").toLowerCase();
      const notes = String(p.notes || "").toLowerCase();
      const bill = String(p.bill_no || "").toLowerCase();
      const user = String(p.created_by_name || "").toLowerCase();
      return ref.includes(q) || mode.includes(q) || bank.includes(q) || notes.includes(q) || bill.includes(q) || user.includes(q);
    });
  }

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
          background: "rgba(15, 23, 42, 0.7)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(3px)",
          padding: 16,
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
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(15, 23, 42, 0.35)",
            border: "1.5px solid #0D9488",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "#F0FDFA",
              borderBottom: "1.5px solid #99F6E4",
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: "#0D9488",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                🚚
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Supply Vendor Payment Vouchers & History
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#0F766E", background: "#CCFBF1", border: "1px solid #5EEAD4", borderRadius: 4, padding: "2px 7px" }}>
                    SUPPLY VENDOR
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginTop: 3 }}>
                  <span style={{ color: "#0F172A", fontWeight: 900 }}>{target.vendorName || target.vendor}</span>
                  {target.bill_no && <span> · Invoice: <span style={{ fontFamily: "monospace", color: "#0D9488" }}>{target.bill_no}</span></span>}
                  {target.productName && <span style={{ color: "#0F766E" }}> · 📦 {target.productName}</span>}
                  {target.subJobNo ? <span> · Sub-Job: {target.subJobNo}</span> : (target.jobNo ? <span> · Job: {target.jobNo}</span> : "")}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#F1F5F9",
                border: "none",
                width: 32,
                height: 32,
                borderRadius: "50%",
                fontSize: 16,
                cursor: "pointer",
                color: "#475569",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
              title="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Financial Summary KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Total Bill Amount</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", fontFamily: "monospace", marginTop: 2 }}>
                  ₹ {fmt(amt)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>Total Paid So Far</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#16A34A", fontFamily: "monospace", marginTop: 2 }}>
                  ₹ {fmt(paid)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: due > 0 ? "#DC2626" : "#166534", textTransform: "uppercase" }}>
                  {due > 0 ? "Outstanding Payable Due" : "Settlement Status"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: due > 0 ? "#DC2626" : "#16A34A", fontFamily: "monospace", marginTop: 2 }}>
                  {due > 0 ? `₹ ${fmt(due)}` : "✓ Fully Cleared"}
                </div>
              </div>
            </div>

            {/* Filter and Search Action Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  Payment Transactions ({displayedList.length})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  placeholder="🔍 Search UTR, mode, bank..."
                  value={searchTxn}
                  onChange={(e) => setSearchTxn(e.target.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 11.5,
                    outline: "none",
                    width: 210,
                  }}
                />
                {loadingAttachment && (
                  <span style={{ fontSize: 11, color: "#0D9488", fontWeight: 700 }}>
                    ⏳ Generating preview...
                  </span>
                )}
              </div>
            </div>

            {/* Transactions Table */}
            {loadingHistory && displayedList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#64748B", fontStyle: "italic" }}>
                Loading supply vendor payment vouchers...
              </div>
            ) : displayedList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#64748B", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1" }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>🧾</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>
                  No payments recorded yet for this {target.bill_no ? "supply bill" : "vendor"}.
                </div>
              </div>
            ) : (
              <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflowX: "auto", background: "white" }}>
                <table style={{ width: "100%", minWidth: 1140, borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", borderBottom: "1.5px solid #CBD5E1" }}>
                      <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Payment Date</th>
                      <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Invoice / Bill No</th>
                      <th style={{ padding: "9px 10px", textAlign: "center", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Paid Qty</th>
                      <th style={{ padding: "9px 10px", textAlign: "right", color: "#0F172A", fontWeight: 800, whiteSpace: "nowrap" }}>Base Amt (₹)</th>
                      <th style={{ padding: "9px 10px", textAlign: "right", color: "#0284C7", fontWeight: 800, whiteSpace: "nowrap" }}>GST (+)</th>
                      <th style={{ padding: "9px 10px", textAlign: "right", color: "#7C3AED", fontWeight: 800, whiteSpace: "nowrap" }}>TDS (-)</th>
                      <th style={{ padding: "9px 10px", textAlign: "right", color: "#15803D", fontWeight: 900, whiteSpace: "nowrap" }}>Total Paid (₹)</th>
                      <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Mode & Bank</th>
                      <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Reference / UTR</th>
                      <th style={{ padding: "9px 10px", textAlign: "center", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Receipt Proofs</th>
                      <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Recorded By</th>
                      <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569", fontWeight: 800, whiteSpace: "nowrap" }}>Notes</th>
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

                      const paidQty = Number(p.paid_qty || 0);
                      const isCash = (p.payment_mode || "").toLowerCase().includes("cash");

                      const rawAtts = Array.isArray(p.attachments) && p.attachments.length > 0
                        ? p.attachments
                        : (p.attachment ? [{ url: p.attachment, name: p.attachment_name || "Receipt Proof" }] : []);

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
                        <tr key={p._id || idx} style={{ borderBottom: "1px solid #F1F5F9", background: idx % 2 === 1 ? "#FAFAFA" : "white" }}>
                          {/* Date */}
                          <td style={{ padding: "10px 10px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>{pDate}</td>

                          {/* Invoice / Bill No */}
                          <td style={{ padding: "10px 10px", fontFamily: "monospace", fontWeight: 800, whiteSpace: "nowrap" }}>
                            {p.bill_no ? <span style={{ color: "#0F766E", background: "#F0FDFA", border: "1px solid #99F6E4", borderRadius: 4, padding: "2px 6px" }}>{p.bill_no}</span> : "—"}
                          </td>

                          {/* Paid Qty */}
                          <td style={{ padding: "10px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {paidQty > 0 ? (
                              <span style={{ background: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC", padding: "2px 7px", borderRadius: 4, fontWeight: 800, fontSize: 11, fontFamily: "monospace" }}>
                                {paidQty} Qty
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>

                          {/* Base Payment Amount */}
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>
                            ₹ {baseAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* GST (+) */}
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {gstAmt > 0 ? (
                              <div>
                                <div style={{ fontWeight: 800, color: "#0284C7" }}>+₹ {gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700 }}>
                                  ({gRate}%)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 10.5 }}>{gRate > 0 ? `${gRate}% (₹0)` : "0%"}</span>
                            )}
                          </td>

                          {/* TDS (-) */}
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {tdsAmt > 0 ? (
                              <div>
                                <div style={{ fontWeight: 800, color: "#7C3AED" }}>-₹ {tdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: 10, color: "#6D28D9", fontWeight: 700 }}>
                                  ({tRate}%)
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 10.5 }}>{tRate > 0 ? `${tRate}% (₹0)` : "0%"}</span>
                            )}
                          </td>

                          {/* Total Paid (₹) */}
                          <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", color: "#15803D", background: "rgba(240, 253, 244, 0.45)", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 900 }}>
                              ₹ {totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Mode & Bank */}
                          <td style={{ padding: "10px 10px", color: "#1E293B" }}>
                            <div style={{ fontWeight: 800 }}>{p.payment_mode || "Bank Transfer"}</div>
                            {p.bank_account_label && (
                              <div style={{ fontSize: 10, color: "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                                <span>🏦</span> {p.bank_account_label}
                              </div>
                            )}
                          </td>

                          {/* Reference / UTR / Cash Voucher & Handed To */}
                          <td style={{ padding: "10px 10px", color: "#334155" }}>
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

                          {/* Receipt Proofs */}
                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
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
                                      color: "#0F766E",
                                      fontSize: 10.5,
                                      fontWeight: 800,
                                      cursor: "pointer",
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

                          {/* Recorded By */}
                          <td style={{ padding: "10px 10px", fontSize: 11, color: "#334155" }}>
                            {p.created_by_name || p.created_by?.name || p.created_by?.username ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F1F5F9", padding: "2px 7px", borderRadius: 4, color: "#1E293B", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                                👤 {p.created_by_name || p.created_by?.name || p.created_by?.username}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>

                          {/* Notes */}
                          <td style={{ padding: "10px 10px", color: "#64748B", fontSize: 11 }}>
                            {p.notes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {displayedList.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#F8FAFC", borderTop: "2px solid #CBD5E1", fontWeight: 900, fontFamily: "monospace" }}>
                        <td colSpan={2} style={{ padding: "10px 10px", textAlign: "left", color: "#334155", fontFamily: "inherit" }}>
                          Total ({displayedList.length} txns)
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: "#15803D" }}>
                          {displayedList.reduce((acc, x) => acc + (Number(x.paid_qty) || 0), 0) > 0
                            ? `${displayedList.reduce((acc, x) => acc + (Number(x.paid_qty) || 0), 0)} Qty`
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#0F172A", whiteSpace: "nowrap" }}>
                          ₹ {displayedList.reduce((acc, x) => acc + (Number(x.amount) || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#0284C7", whiteSpace: "nowrap" }}>
                          +₹ {displayedList.reduce((acc, x) => {
                            const b = Number(x.amount || 0);
                            const gR = Number(x.gst_rate || 0);
                            const gA = x.gst_amount !== undefined && Number(x.gst_amount) > 0 ? Number(x.gst_amount) : (gR > 0 ? Math.round((b * gR / 100) * 100) / 100 : 0);
                            return acc + gA;
                          }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#7C3AED", whiteSpace: "nowrap" }}>
                          -₹ {displayedList.reduce((acc, x) => {
                            const b = Number(x.amount || 0);
                            const tR = Number(x.tds_rate || 0);
                            const tA = x.tds_amount !== undefined && Number(x.tds_amount) > 0 ? Number(x.tds_amount) : (tR > 0 ? Math.round((b * tR / 100) * 100) / 100 : 0);
                            return acc + tA;
                          }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", color: "#15803D", background: "rgba(240, 253, 244, 0.6)", whiteSpace: "nowrap" }}>
                          ₹ {displayedList.reduce((acc, x) => {
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

          {/* Modal Footer */}
          <div
            style={{
              padding: "12px 20px",
              background: "#F8FAFC",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
              {due > 0 ? (
                <span>⚠️ Remaining due of <b style={{ color: "#DC2626" }}>₹ {fmt(due)}</b> can be paid in full or partial installments.</span>
              ) : (
                <span style={{ color: "#15803D" }}>✓ All payments reconciled. No pending balance due.</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {due > 0 && typeof onPayAgain === "function" && (
                <button
                  type="button"
                  onClick={() => onPayAgain(target)}
                  style={{
                    background: "#10B981",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 16px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  💳 Pay Remaining Due (₹ {fmt(due)})
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "white",
                  border: "1px solid #CBD5E1",
                  borderRadius: 6,
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.85)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              width: 820,
              maxWidth: "96vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div
              style={{
                background: "#0F172A",
                color: "white",
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                <span>📎</span>
                <span style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {previewAttachment.name || "Payment Receipt Proof"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    textDecoration: "none",
                  }}
                >
                  ↗ Open in New Window
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "white",
                    fontSize: 18,
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div style={{ padding: 16, flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", alignItems: "center", background: "#F8FAFC", minHeight: 400 }}>
              {isPdf ? (
                <iframe
                  src={previewAttachment.url}
                  title="PDF Preview"
                  style={{ width: "100%", height: "65vh", border: "1px solid #CBD5E1", borderRadius: 8, background: "white" }}
                />
              ) : isImage ? (
                imgError ? (
                  <div style={{ textAlign: "center", padding: 30 }}>
                    <p style={{ color: "#DC2626", fontWeight: 700 }}>Unable to render image preview directly.</p>
                    <a
                      href={previewAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0D9488", fontWeight: 800, textDecoration: "underline" }}
                    >
                      Click here to open image in new tab
                    </a>
                  </div>
                ) : (
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    onError={() => setImgError(true)}
                    style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 8 }}
                  />
                )
              ) : (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <p style={{ color: "#475569", fontWeight: 700 }}>File type cannot be previewed inline.</p>
                  <a
                    href={previewAttachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: "#0D9488", color: "white", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 800, fontSize: 12 }}
                  >
                    ↗ Open / Download Document
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
