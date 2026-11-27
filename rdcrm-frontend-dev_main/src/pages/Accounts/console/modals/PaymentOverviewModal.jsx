import React, { useState, useEffect } from "react";
import { axiosInstance, backendUrl } from "../../../../utils/url/config";

export default function PaymentOverviewModal({ target = {}, onClose, onPayAgain }) {
  const safeTarget = target || {};
  const [history, setHistory] = useState(safeTarget.payments || []);
  const [invoices, setInvoices] = useState(safeTarget.invoices || []);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [loadingAttachment, setLoadingAttachment] = useState(false);

  const handleOpenAttachment = async (item) => {
    let url = item?.url || item?.attachment;
    if (!url) return;
    setLoadingAttachment(true);
    // If not base64 and not already signed, fetch signed URL from /accounts/signed-url
    if (!url.startsWith("data:") && !url.includes("X-Amz-Signature") && !url.includes("AWSAccessKeyId")) {
      try {
        const res = await axiosInstance.get("/accounts/signed-url", { params: { url } });
        if (res.data?.success && res.data?.signedUrl) {
          url = res.data.signedUrl;
        }
      } catch (err) {
        console.warn("Could not sign URL on the fly:", err);
      }
      if (!url.includes("X-Amz-Signature") && !url.includes("AWSAccessKeyId") && !url.startsWith("data:")) {
        const base = backendUrl ? backendUrl.replace(/\/$/, "") : "";
        url = `${base}/image/view?url=${encodeURIComponent(url)}`;
      }
    }
    setLoadingAttachment(false);
    setPreviewAttachment({
      url: url,
      name: item?.name || item?.attachment_name || "Payment Receipt / Proof",
    });
  };

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      if (!safeTarget.sub_job_no || safeTarget.sub_job_no.includes("Sub-Jobs")) return;
      setLoadingHistory(true);
      try {
        const res = await axiosInstance.get(`/accounts/payments/${encodeURIComponent(safeTarget.sub_job_no)}`);
        if (res.data?.success && isMounted) {
          if (Array.isArray(res.data.data)) {
            setHistory(res.data.data);
          }
          if (Array.isArray(res.data.invoices) && res.data.invoices.length > 0) {
            setInvoices(res.data.invoices);
          }
        }
      } catch (err) {
        console.warn("Could not fetch payment history, using cached:", err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [safeTarget.sub_job_no]);

  const amt = Number(safeTarget.amount || safeTarget.amt || safeTarget.grandTotal || 0);

  // Invoice & GST Totals
  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.totalAmt || 0), 0);
  const totalInvoiceSubtotal = invoices.reduce((s, inv) => s + Number(inv.subtotal || 0), 0);
  const totalInvoiceGst = invoices.reduce((s, inv) => s + Number(inv.gstAmt || 0), 0);
  const resolvedGstRate = Number(safeTarget.gstRate ?? invoices[0]?.gstPct ?? 18) || 18;
  const resolvedGstAmount = Number(
    totalInvoiceGst > 0
      ? totalInvoiceGst
      : safeTarget.gstAmount !== undefined && safeTarget.gstAmount !== null
        ? safeTarget.gstAmount
        : amt > 0
          ? (amt * resolvedGstRate) / (100 + resolvedGstRate)
          : 0
  );
  const resolvedSubtotal = Number(
    totalInvoiceSubtotal > 0
      ? totalInvoiceSubtotal
      : safeTarget.subtotal !== undefined && safeTarget.subtotal !== null
        ? safeTarget.subtotal
        : Math.max(0, amt - resolvedGstAmount)
  );

  // Payment & TDS Totals (Computed from loaded payment records with gross settlement logic)
  const computedSettledFromHistory = history.reduce((s, tx) => {
    const gross = Number(tx.gross_amount || 0);
    const a = Number(tx.amount || 0);
    const tds = Number(tx.tds_amount || 0);
    const net = Number(tx.total_payable || 0);
    const settled = (gross > a)
      ? gross
      : (net > 0 && Math.abs(a - (net + tds)) < 0.05)
        ? a
        : (a + tds);
    return s + settled;
  }, 0);

  const totalSettledAmt = history.length > 0 ? computedSettledFromHistory : Number(target.paid || 0);
  const totalTdsAmt = history.reduce((s, tx) => s + Number(tx.tds_amount || 0), 0);
  const totalBankCredit = history.reduce((s, tx) => {
    const gross = Number(tx.gross_amount || 0);
    const a = Number(tx.amount || 0);
    const tds = Number(tx.tds_amount || 0);
    const net = Number(tx.total_payable || 0);
    const bankVal = net > 0 ? net : (gross > a ? a : Math.max(0, a - tds));
    return s + bankVal;
  }, 0) || Math.max(0, totalSettledAmt - totalTdsAmt);

  const paid = totalSettledAmt;
  const due = amt > 0 ? Math.max(0, Math.round((amt - totalSettledAmt) * 100) / 100) : 0;
  const isPaid = due === 0 && amt > 0;

  const isClientOverview = Boolean(
    target.isClientOverview ||
    target.product === "Consolidated Client Payments" ||
    (target.sub_job_no && (target.sub_job_no.includes("Sub-Jobs") || target.sub_job_no.includes("Consolidated")))
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="payment-overview-backdrop"
      className="payment-overview-backdrop"
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
      <style>{`
        @page {
          size: auto;
          margin: 10mm 10mm 12mm 10mm;
        }
        @media print {
          /* 1. Hide everything on the page except the overview modal */
          body * {
            visibility: hidden !important;
          }
          #payment-overview-backdrop,
          #payment-overview-backdrop * {
            visibility: visible !important;
          }

          /* 2. Reset backdrop so document flows across pages naturally */
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          #payment-overview-backdrop {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            backdrop-filter: none !important;
            z-index: 999999 !important;
          }

          /* 3. Reset card to full width document without fixed max-height or scrollbars */
          #payment-overview-card {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 4. Reset scrollable body so all items paginate across pages */
          #payment-overview-body {
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          /* 5. Hide screen-only buttons and controls */
          .no-print,
          .no-print * {
            display: none !important;
          }

          /* 6. Show print-only header elements */
          .print-only {
            display: block !important;
          }

          /* 7. Metric cards layout for print */
          .metric-cards-grid {
            display: grid !important;
            gap: 6px !important;
            margin-bottom: 12px !important;
            page-break-inside: avoid !important;
          }
          .metric-cards-grid.cards-3 {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .metric-cards-grid.cards-6 {
            grid-template-columns: repeat(6, 1fr) !important;
          }
          .metric-card {
            padding: 6px 8px !important;
            border: 1px solid #CBD5E1 !important;
            border-radius: 6px !important;
          }

          /* 8. Table wrappers and pagination rules across multiple pages */
          .table-responsive-wrapper {
            border: 1px solid #CBD5E1 !important;
            border-radius: 6px !important;
            overflow: visible !important;
            margin-bottom: 14px !important;
            width: 100% !important;
          }

          table.print-table {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }

          table.print-table thead {
            display: table-header-group !important; /* Repeats table header on every page */
          }

          table.print-table tfoot {
            display: table-footer-group !important;
            page-break-inside: avoid !important;
          }

          table.print-table tr {
            page-break-inside: avoid !important; /* Prevents rows from splitting */
            page-break-after: auto !important;
          }

          table.print-table th,
          table.print-table td {
            padding: 5px 6px !important;
            font-size: 10px !important;
            word-break: break-word !important;
          }

          /* 9. Preserve colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div
        id="payment-overview-card"
        className="payment-overview-card"
        style={{
          background: "white",
          borderRadius: 14,
          width: 1080,
          maxWidth: "97vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          border: "1.5px solid #0D9488",
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
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
            <span style={{ fontSize: 24 }}>📄</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Financial Overview &amp; Payment Ledger
              </div>
              <div style={{ fontSize: 11.5, color: "#115E59", fontWeight: 700, marginTop: 2 }}>
                {target.clientName || target.client} · Sub-Job: <b style={{ fontFamily: "monospace" }}>{target.sub_job_no}</b>
                {target.product ? ` (${target.product})` : ""}
              </div>
              <div className="print-only" style={{ display: "none", fontSize: 9.5, color: "#64748B", marginTop: 2, fontWeight: 600 }}>
                Printed on: {new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · RD Custom Awards
              </div>
            </div>
          </div>
          <button
            className="no-print"
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

        {/* Modal Body */}
        <div id="payment-overview-body" className="payment-overview-body scrollbar-thin scrollbar-thumb-slate-300" style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          {/* Summary Metric Cards */}
          <div
            className={`metric-cards-grid ${isClientOverview ? "cards-3" : "cards-6"}`}
            style={{
              display: "grid",
              gridTemplateColumns: isClientOverview ? "repeat(3, 1fr)" : "repeat(6, 1fr)",
              gap: 8,
              marginBottom: 18,
            }}
          >
            {/* 1. Order Total with GST */}
            <div className="metric-card" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 10px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Order Total</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0C1A2E", fontFamily: "monospace", marginTop: 2 }}>
                Rs {amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              {/* <div style={{ fontSize: 9, color: "#64748B", marginTop: 3, fontWeight: 700 }}>
                Subtotal: Rs {Math.round(resolvedSubtotal).toLocaleString("en-IN")}
              </div> */}
            </div>

            {/* 2. Invoice GST - HIDE on Client Payments Overview */}
            {!isClientOverview && (
              <div className="metric-card" style={{ background: "#FAF5FF", border: "1px solid #E9D5FF", borderRadius: 10, padding: "10px 10px" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#7C3AED", textTransform: "uppercase" }}>Invoice GST ({resolvedGstRate}%)</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#6D28D9", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {resolvedGstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 9, color: "#7C3AED", marginTop: 3, fontWeight: 700 }}>
                  {invoices.length > 0 ? `${invoices.length} Inv (Rs ${Math.round(totalInvoiced).toLocaleString()})` : "Tax Rate Active"}
                </div>
              </div>
            )}

            {/* 3. Total Settled */}
            <div className="metric-card" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "10px 10px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "#047857", textTransform: "uppercase" }}>Total Settled</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#059669", fontFamily: "monospace", marginTop: 2 }}>
                Rs {totalSettledAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 9, color: "#047857", marginTop: 3, fontWeight: 700 }}>
                Bill Cleared
              </div>
            </div>

            {/* 4. TDS Deducted - HIDE on Client Payments Overview */}
            {!isClientOverview && (
              <div className="metric-card" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 10px" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#B45309", textTransform: "uppercase" }}>TDS Deducted (-)</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#D97706", fontFamily: "monospace", marginTop: 2 }}>
                  {totalTdsAmt > 0 ? `- Rs ${totalTdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "Rs 0.00"}
                </div>
                {/* <div style={{ fontSize: 9, color: "#B45309", marginTop: 3, fontWeight: 700 }}>
                  Govt Tax Credit (PAN)
                </div> */}
              </div>
            )}

            {/* 5. Net Bank Credit - HIDE on Client Payments Overview */}
            {!isClientOverview && (
              <div className="metric-card" style={{ background: "#F0FDFA", border: "1px solid #99F6E4", borderRadius: 10, padding: "10px 10px" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "#0F766E", textTransform: "uppercase" }}>Net Bank Credit</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0D9488", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {totalBankCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 9, color: "#0F766E", marginTop: 3, fontWeight: 700 }}>
                  Real Bank Balance
                </div>
              </div>
            )}

            {/* 6. Balance Due */}
            <div className="metric-card" style={{ background: due > 0 ? "#FEF2F2" : "#ECFDF5", border: "1px solid " + (due > 0 ? "#FECACA" : "#A7F3D0"), borderRadius: 10, padding: "10px 10px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: due > 0 ? "#B91C1C" : "#047857", textTransform: "uppercase" }}>
                {due > 0 ? "Outstanding Due" : "Balance Due"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: due > 0 ? "#EF4444" : "#059669", fontFamily: "monospace", marginTop: 2 }}>
                Rs {due.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ marginTop: 2 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    background: isPaid ? "#ECFDF5" : paid > 0 ? "#F5F3FF" : "#FFFBEB",
                    color: isPaid ? "#059669" : paid > 0 ? "#8B5CF6" : "#F59E0B",
                  }}
                >
                  {isPaid ? "Fully Paid" : paid > 0 ? "Partial Paid" : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: INVOICES & GST BREAKDOWN - HIDE on Client Payments Overview and hide if 0 invoices */}
          {!isClientOverview && invoices.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#0C1A2E", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🧾</span>
                  <span>Tax Invoices &amp; GST Breakdown ({invoices.length})</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", background: "#FAF5FF", border: "1px solid #E9D5FF", padding: "2px 8px", borderRadius: 6 }}>
                  Total Invoiced: Rs {totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (GST: Rs {totalInvoiceGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                </div>
              </div>

              <div className="table-responsive-wrapper" style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", background: "white", marginBottom: 6 }}>
                <table className="print-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #CBD5E1", color: "#475569" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800 }}>INVOICE NO</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800 }}>DATE</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>QTY</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800 }}>SUBTOTAL (RS)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#7C3AED", fontWeight: 800 }}>GST %</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#7C3AED", fontWeight: 800 }}>GST AMOUNT (RS)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", color: "#0F172A", fontWeight: 900 }}>TOTAL WITH GST (RS)</th>
                      <th className="no-print" style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>PDF ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => {
                      const invDate = inv.date || inv.createdAt ? new Date(inv.date || inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                      return (
                        <tr key={inv._id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 900, color: "#0D9488", fontFamily: "monospace" }}>
                            {inv.invoiceNo}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#334155", fontWeight: 700 }}>
                            {invDate}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#0F172A" }}>
                            {inv.qty}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: "#475569", fontWeight: 700 }}>
                            Rs {Number(inv.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#7C3AED" }}>
                            {inv.gstPct || inv.gst || resolvedGstRate}%
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#7C3AED" }}>
                            Rs {Number(inv.gstAmt || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#0F172A" }}>
                            Rs {Number(inv.totalAmt || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="no-print" style={{ padding: "8px 10px", textAlign: "center" }}>
                            {inv.pdf_url ? (
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment({ url: inv.pdf_url, name: `${inv.invoiceNo}.pdf` })}
                                style={{
                                  background: "#FAF5FF",
                                  border: "1px solid #D8B4FE",
                                  color: "#7C3AED",
                                  padding: "3px 8px",
                                  borderRadius: 5,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                🖨️ View PDF
                              </button>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 11 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                      <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 900, color: "#0C1A2E", fontSize: 11 }}>
                        TOTAL INVOICED
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 900 }}>
                        {invoices.reduce((s, i) => s + Number(i.qty || 0), 0)}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#475569" }}>
                        Rs {totalInvoiceSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td />
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#7C3AED" }}>
                        Rs {totalInvoiceGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#0F172A" }}>
                        Rs {totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 2: PAYMENT TRANSACTIONS & TDS BREAKDOWN */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#0C1A2E", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                <span>💳</span>
                <span>Payment Transactions &amp; TDS Ledger ({history.length})</span>
              </div>
              {loadingHistory && (
                <span className="no-print" style={{ fontSize: 11, color: "#0D9488", fontWeight: 700 }}>
                  Loading live history...
                </span>
              )}
            </div>

            {/* Payments Table */}
            <div className="table-responsive-wrapper" style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflowX: "auto", background: "white" }}>
              <table className="print-table" style={{ width: "100%", minWidth: 950, borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "#0C1A2E", color: "white" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>DATE</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>INVOICE NO</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>MODE &amp; BANK</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>REFERENCE / UTR</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 800 }}>SETTLED (RS)</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#FDE68A", fontSize: 11, fontWeight: 800 }}>TDS (-) (RS)</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#A7F3D0", fontSize: 11, fontWeight: 900 }}>BANK CREDIT (RS)</th>
                    <th className="no-print" style={{ padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 800 }}>RECEIPTS / PROOFS</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>RECORDED BY</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 800 }}>NOTES</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? (
                    history.map((tx, i) => {
                      const txDate = tx.payment_date || tx.createdAt ? new Date(tx.payment_date || tx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                      const a = Number(tx.amount || 0);
                      const tdsAmtVal = Number(tx.tds_amount || 0);
                      const tdsRateVal = Number(tx.tds_rate || 0);
                      const gross = Number(tx.gross_amount || 0);
                      const net = Number(tx.total_payable || 0);

                      const grossAmt = (gross > a)
                        ? gross
                        : (net > 0 && Math.abs(a - (net + tdsAmtVal)) < 0.05)
                          ? a
                          : (a + tdsAmtVal);

                      const bankCreditVal = net > 0
                        ? net
                        : (gross > a ? a : Math.max(0, grossAmt - tdsAmtVal));

                      const bankLabel = tx.bank_account_label || (tx.payment_mode === "Cash" ? "Cash in Hand" : "");

                      return (
                        <tr key={tx._id || i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "8px 10px", color: "#64748B", fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: "8px 10px", color: "#0C1A2E", fontWeight: 700, whiteSpace: "nowrap" }}>{txDate}</td>
                          <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                            {tx.invoice_no ? (
                              <span style={{ background: "#F0FDFA", border: "1px solid #99F6E4", color: "#0D9488", padding: "2px 6px", borderRadius: 4, fontWeight: 800, fontFamily: "monospace", fontSize: 11 }}>
                                🧾 {tx.invoice_no}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 10.5, fontStyle: "italic" }}>
                                General / Advance
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <div>
                              <span style={{ background: "#F1F5F9", color: "#334155", padding: "2px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 800 }}>
                                {tx.payment_mode || "Bank Transfer"}
                              </span>
                            </div>
                            {bankLabel && (
                              <div style={{ fontSize: 10, color: "#0F766E", fontWeight: 700, marginTop: 3 }}>
                                🏦 {bankLabel}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#0D9488", fontWeight: 700 }}>
                            {tx.reference_no || tx.cash_voucher_no || "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#059669" }}>
                            Rs {grossAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            {tdsAmtVal > 0 ? (
                              <span style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#B45309", padding: "2px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 800, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                                {tdsRateVal > 0 ? `${tdsRateVal}% ` : ""}(-Rs {tdsAmtVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 11 }}>— (0%)</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#0D9488", fontSize: 12 }}>
                            Rs {bankCreditVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="no-print" style={{ padding: "8px 10px", textAlign: "center" }}>
                            {(() => {
                              const rawAttList = Array.isArray(tx.attachments) && tx.attachments.length > 0
                                ? tx.attachments
                                : (tx.attachment ? [{ url: tx.attachment, name: tx.attachment_name || "Receipt Proof" }] : []);

                              // Deduplicate proofs by clean URL or filename
                              const seenProofs = new Set();
                              const attList = [];
                              for (const att of rawAttList) {
                                const rawUrl = att?.url || att?.attachment || (typeof att === "string" ? att : "");
                                const cleanKey = rawUrl ? rawUrl.split("?")[0].split("/").pop() : (att?.name || JSON.stringify(att));
                                if (cleanKey && !seenProofs.has(cleanKey)) {
                                  seenProofs.add(cleanKey);
                                  attList.push(att);
                                } else if (!cleanKey) {
                                  attList.push(att);
                                }
                              }

                              if (attList.length === 0) {
                                return <span style={{ color: "#94A3B8", fontSize: 11 }}>—</span>;
                              }

                              return (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                                  {attList.map((att, attIdx) => (
                                    <button
                                      key={attIdx}
                                      type="button"
                                      onClick={() => handleOpenAttachment(att)}
                                      disabled={loadingAttachment}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                        padding: "3px 8px",
                                        borderRadius: 5,
                                        background: "#F0FDFA",
                                        border: "1px solid #99F6E4",
                                        color: "#0D9488",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                      }}
                                      title={att.name || `View Receipt ${attIdx + 1}`}
                                    >
                                      📎 {attList.length === 1 ? "Proof" : `Proof ${attIdx + 1}`}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: "8px 10px", fontSize: 11, color: "#334155", fontWeight: 700 }}>
                            {tx.created_by_name || tx.created_by?.name || tx.created_by?.username ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F1F5F9", padding: "2px 7px", borderRadius: 4, color: "#1E293B", fontSize: 10.5, fontWeight: 700 }}>
                                👤 {tx.created_by_name || tx.created_by?.name || tx.created_by?.username}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#64748B", fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.notes || ""}>
                            {tx.notes || "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} style={{ padding: "20px", textAlign: "center", color: "#64748B" }}>
                        {paid > 0 ? (
                          <span>
                            Payment of <b>Rs {paid.toLocaleString("en-IN")}</b> recorded. Detailed transaction receipt will appear on next entry.
                          </span>
                        ) : (
                          <span>No payments recorded yet for this sub-job.</span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                    <td colSpan={5} style={{ padding: "8px 10px", fontWeight: 900, fontSize: 11, color: "#0C1A2E" }}>
                      TOTALS
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#059669", fontSize: 12 }}>
                      Rs {totalSettledAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#B45309", fontSize: 12 }}>
                      {totalTdsAmt > 0 ? `- Rs ${totalTdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "Rs 0.00"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 900, color: "#0D9488", fontSize: 12 }}>
                      Rs {totalBankCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="no-print" />
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="no-print"
          style={{
            background: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className="btn bs"
            style={{ background: "white", borderColor: "#CBD5E1", color: "#0F766E", display: "flex", alignItems: "center", gap: 6 }}
            onClick={handlePrint}
          >
            🖨️ Print Overview / Receipt
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {due > 0 && typeof onPayAgain === "function" && (
              <button
                type="button"
                className="btn bs bg"
                style={{ fontSize: 11.5, padding: "6px 14px" }}
                onClick={() => {
                  onClose();
                  onPayAgain(target);
                }}
              >
                💳 Pay Remaining (Rs {Math.round(due).toLocaleString("en-IN")})
              </button>
            )}
            <button
              type="button"
              className="btn bs"
              style={{ background: "#0C1A2E", color: "white", borderColor: "#0C1A2E" }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Attachment Lightbox Preview Modal */}
      {previewAttachment && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "none",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backdropFilter: "blur(3px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewAttachment(null);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              width: 780,
              maxWidth: "96vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
              border: "1px solid #CBD5E1",
            }}
          >
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
                  {previewAttachment.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <a
                  href={
                    previewAttachment.url.startsWith("data:") || previewAttachment.url.includes("X-Amz-Signature") || previewAttachment.url.includes("AWSAccessKeyId")
                      ? previewAttachment.url
                      : `${backendUrl ? backendUrl.replace(/\/$/, "") : ""}/image/view?url=${encodeURIComponent(previewAttachment.url)}`
                  }
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
                    fontSize: 20,
                    fontWeight: 900,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                flex: 1,
                overflowY: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#F8FAFC",
                minHeight: 350,
              }}
            >
              {previewAttachment.url.toLowerCase().includes(".pdf") ||
                previewAttachment.name.toLowerCase().endsWith(".pdf") ? (
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
              ) : (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "72vh",
                    objectFit: "contain",
                    borderRadius: 8,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    border: "1px solid #E2E8F0",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
