import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import { generateCashVoucherPDF } from "../utils/generateCashVoucherPDF";

export default function ManualVendorPaymentModal({ target, onClose, onSave, isSaving }) {
  const initialMaxDue = Number(target.outstanding !== undefined ? target.outstanding : (target.due !== undefined ? target.due : target.amount || 0));
  const [maxDue, setMaxDue] = useState(initialMaxDue);
  const [payAmount, setPayAmount] = useState(initialMaxDue);
  const [payMode, setPayMode] = useState("Bank Transfer (NEFT/RTGS)");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState("");
  const [cashVoucherNo, setCashVoucherNo] = useState("");
  const [cashPaidTo, setCashPaidTo] = useState("");
  const [notes, setNotes] = useState("");

  // Quantity Management (Invoice Qty, Paid Qty, Remaining Qty - strictly integers)
  const totalInvoiceQty = Math.round(Number(target.received_qty !== undefined ? target.received_qty : (target.qty !== undefined ? target.qty : 0)));
  const rawTargetPaidQty = Math.round(Number(target.paid_qty !== undefined ? target.paid_qty : (target.paidQty !== undefined ? target.paidQty : 0)));
  const unitRate = Number(target.unit_rate || (totalInvoiceQty > 0 ? (target.amount || initialMaxDue) / totalInvoiceQty : 0));
  const derivedPaidQty = rawTargetPaidQty > 0
    ? rawTargetPaidQty
    : (unitRate > 0 && Number(target.paid || 0) > 0 ? Math.round(Number(target.paid) / unitRate) : 0);

  const [alreadyPaidQty, setAlreadyPaidQty] = useState(derivedPaidQty);
  const remainingQty = Math.max(0, Math.round(totalInvoiceQty - alreadyPaidQty));
  const [payingQty, setPayingQty] = useState(remainingQty > 0 ? remainingQty : 0);

  // Vendor Tax Rates (Readonly from Supply/Outsource Vendor Master)
  const [gstRate, setGstRate] = useState(Number(target.gst_rate ?? (target.gstRate ?? 0)));
  const [tdsRate, setTdsRate] = useState(Number(target.tds_rate ?? (target.tdsRate ?? 0)));
  const [loadingRates, setLoadingRates] = useState(false);

  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [checkingLive, setCheckingLive] = useState(false);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState("");

  const isBusy = Boolean(isSaving || isSubmitting);

  const vId = target.vendorId || target.vendor_id || target.id;
  const vName = target.vendorName || target.vendor_name || target.vendor || "";
  const assignId = target.assignment_id || target.assignmentId;
  const billNo = target.bill_no || target.billNo;
  const targetAmount = target.amount;

  // Amount & Qty synchronization (Quantity is strictly an integer)
  const handleAmountChange = (newAmt) => {
    setPayAmount(newAmt);
    const num = parseFloat(newAmt);
    if (!isNaN(num) && num > 0) {
      if (unitRate > 0 && remainingQty > 0) {
        const estQty = Math.min(remainingQty, Math.round(num / unitRate));
        setPayingQty(estQty);
      }
    } else {
      if (unitRate > 0) setPayingQty(0);
    }
  };

  const handleQtyChange = (newQty) => {
    if (newQty === "" || newQty === undefined || newQty === null) {
      setPayingQty("");
      return;
    }
    const cleanStr = String(newQty).replace(/[^0-9]/g, "");
    const q = parseInt(cleanStr, 10);
    if (!isNaN(q)) {
      const boundedQ = remainingQty > 0 ? Math.min(remainingQty, q) : q;
      setPayingQty(boundedQ);
      if (boundedQ > 0 && unitRate > 0) {
        const computedAmt = Math.min(maxDue, Math.round(boundedQ * unitRate * 100) / 100);
        setPayAmount(computedAmt);
      } else if (boundedQ === 0) {
        if (unitRate > 0) setPayAmount(0);
      }
    } else {
      setPayingQty(0);
      if (unitRate > 0) setPayAmount(0);
    }
  };

  // Live tax calculations: based on payment amount and vendor rates
  const numericPayAmt = parseFloat(payAmount) || 0;
  const currentGstAmt = Math.round((numericPayAmt * (gstRate || 0) / 100) * 100) / 100;
  const currentTdsAmt = Math.round((numericPayAmt * (tdsRate || 0) / 100) * 100) / 100;
  const totalPayAmt = Math.round((numericPayAmt + currentGstAmt - currentTdsAmt) * 100) / 100;

  // Proactive check on modal mount: verify live balance and vendor rates
  useEffect(() => {
    let isMounted = true;
    const verifyLiveVendorBalance = async () => {
      if (!vId) return;
      setCheckingLive(true);
      try {
        const res = await axiosInstance.get(`/accounts/vendor-payments/${encodeURIComponent(vId)}`);
        if (res.data?.data && Array.isArray(res.data.data)) {
          const cleanTargetBill = String(billNo || "").trim().toLowerCase();
          const isSpecificTargetBill = cleanTargetBill && !cleanTargetBill.startsWith("out-") && !cleanTargetBill.includes("bills");

          const matched = res.data.data.filter((p) => {
            const pBill = String(p.bill_no || "").trim().toLowerCase();
            const isSpecificPBill = pBill && !pBill.startsWith("out-") && !pBill.includes("bills");

            // 1. If target row is for a specific invoice, payment MUST match this invoice number
            if (isSpecificTargetBill) {
              return isSpecificPBill && pBill === cleanTargetBill;
            }

            // 2. If target row is not a specific invoice, but payment belongs to a specific invoice, do not match
            if (isSpecificPBill) {
              return false;
            }

            // 3. Match by assignment_id if neither is an invoice-level payment
            if (assignId && p.assignment_id && String(p.assignment_id).trim() === String(assignId).trim()) {
              return true;
            }

            // 4. Fallback match by sub_job_no only if both have no specific bill and matching sub_job_no
            if (target.sub_job_no && p.sub_job_no && String(p.sub_job_no).trim().toLowerCase() === String(target.sub_job_no).trim().toLowerCase()) {
              if (assignId && p.assignment_id && String(p.assignment_id).trim() !== String(assignId).trim()) {
                return false;
              }
              return true;
            }

            return false;
          });
          const livePaid = matched.reduce((s, p) => s + Number(p.amount || 0), 0);
          const livePaidQty = Math.round(matched.reduce((s, p) => s + Number(p.paid_qty || (unitRate > 0 ? Math.round(Number(p.amount || 0) / unitRate) : 0) || 0), 0));
          if (livePaidQty > 0) {
            setAlreadyPaidQty(livePaidQty);
            const liveRemaining = Math.max(0, Math.round(totalInvoiceQty - livePaidQty));
            setPayingQty(liveRemaining);
          }
          const billAmt = Number(targetAmount || 0);
          if (billAmt > 0) {
            const liveDue = Math.max(0, Math.round((billAmt - livePaid) * 100) / 100);
            setMaxDue(liveDue);
            if (liveDue <= 0) {
              setIsAlreadyPaid(true);
              setPayAmount(0);
              setPayingQty(0);
              toast.warning(`Notice: This outsource assignment was already fully paid by another user!`);
            } else if (liveDue < initialMaxDue) {
              setPayAmount(liveDue);
              toast.info(`Notice: Live outstanding balance updated to Rs ${liveDue.toLocaleString("en-IN")}`);
            }
          }
        }
      } catch (err) {
        console.warn("Could not check live vendor payment balance:", err);
      } finally {
        if (isMounted) setCheckingLive(false);
      }
    };

    const loadBanks = async () => {
      try {
        const res = await axiosInstance.get("/accounts/bank-master");
        if (res.data?.success && isMounted) {
          setBanks(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedBankId(res.data.data[0]._id);
          }
        }
      } catch (e) {
        console.warn("Failed to load banks", e);
      }
    };

    const loadVendorTaxRates = async () => {
      if (target.gst_rate !== undefined) setGstRate(Number(target.gst_rate || 0));
      if (target.tds_rate !== undefined) setTdsRate(Number(target.tds_rate || 0));

      setLoadingRates(true);
      try {
        let vData = null;
        if (vId) {
          try {
            const res = target.isSupplyVendor !== false
              ? await axiosInstance.get(`/vendor/${vId}`)
              : await axiosInstance.get(`/outsourcevendor/${vId}`);
            if (res.data?.success && res.data.data) {
              vData = res.data.data;
            }
          } catch {
            try {
              const res2 = target.isSupplyVendor !== false
                ? await axiosInstance.get(`/outsourcevendor/${vId}`)
                : await axiosInstance.get(`/vendor/${vId}`);
              if (res2.data?.success && res2.data.data) {
                vData = res2.data.data;
              }
            } catch {
              /* ignore */
            }
          }
        }

        // If not found by ID or vId missing, fallback lookup by vendor name
        if (!vData && vName && vName !== "Vendor" && vName !== "Unknown") {
          try {
            const sRes = await axiosInstance.get("/vendor", { params: { search: vName, limit: 10 } });
            if (sRes.data?.success && Array.isArray(sRes.data.data)) {
              const match = sRes.data.data.find(
                (item) => (item.name || "").toLowerCase().trim() === vName.toLowerCase().trim()
              );
              if (match) vData = match;
            }
          } catch {
            /* ignore */
          }
        }

        if (isMounted && vData) {
          const gRate = Number(vData.gst_tax?.tax_rate !== undefined ? vData.gst_tax.tax_rate : (vData.gst_rate || 0));
          const tRate = Number(vData.tds_tax?.tax_rate !== undefined ? vData.tds_tax.tax_rate : (vData.tds_rate || 0));
          setGstRate(gRate);
          setTdsRate(tRate);
        }
      } catch (e) {
        console.warn("Failed to load vendor tax rates", e);
      } finally {
        if (isMounted) setLoadingRates(false);
      }
    };

    verifyLiveVendorBalance();
    loadBanks();
    loadVendorTaxRates();

    return () => {
      isMounted = false;
    };
  }, [vId, vName, assignId, billNo, targetAmount, initialMaxDue, target.gst_rate, target.tds_rate, target.isSupplyVendor, target.sub_job_no, totalInvoiceQty, unitRate]);

  const handleFileChange = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (!rawFiles.length) return;

    // Deduplicate within the newly selected batch
    const uniqueFiles = [];
    const seenBatch = new Set();
    rawFiles.forEach((f) => {
      const key = `${f.name}_${f.size}`;
      if (!seenBatch.has(key)) {
        seenBatch.add(key);
        uniqueFiles.push(f);
      }
    });

    setAttachmentFiles((prev) => {
      const existingKeys = new Set(prev.map((item) => `${item.name}_${item.size}`));
      const newItems = [];

      uniqueFiles.forEach((file) => {
        const key = `${file.name}_${file.size}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          const id = `${file.name}_${file.size}_${Date.now()}_${Math.random()}`;
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => {
              setAttachmentFiles((current) =>
                current.map((it) => (it.id === id ? { ...it, preview: reader.result } : it))
              );
            };
            reader.readAsDataURL(file);
            newItems.push({ file, id, name: file.name, size: file.size, preview: "", isImage: true });
          } else {
            const objectUrl = URL.createObjectURL(file);
            newItems.push({ file, id, name: file.name, size: file.size, preview: objectUrl, isImage: false });
          }
        }
      });

      return [...prev, ...newItems];
    });
  };

  const handleRemoveFile = (indexToRemove) => {
    setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isBusy || isAlreadyPaid || maxDue <= 0) return;
    const val = parseFloat(payAmount);
    if (isNaN(val) || val <= 0) {
      toast.warning("Please enter a valid payment amount greater than 0");
      return;
    }
    if (val > maxDue && maxDue > 0) {
      toast.error(
        `Entered payment amount (Rs ${val.toLocaleString("en-IN")}) cannot exceed the remaining outstanding balance of Rs ${maxDue.toLocaleString("en-IN")}.`
      );
      return;
    }
    if (!attachmentFiles || attachmentFiles.length === 0) {
      toast.warning("Please attach Payment Voucher / Receipt Proof.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (typeof onSave === "function") {
        await onSave({
          vendorId: target.vendorId || target.vendor_id || target.id,
          vendor_id: target.vendorId || target.vendor_id || target.id,
          vendorName: target.vendorName || target.vendor,
          vendor_name: target.vendorName || target.vendor,
          billNo: target.bill_no || target.billNo || "",
          bill_no: target.bill_no || target.billNo || "",
          assignmentId: target.assignment_id || target.assignmentId || "",
          assignment_id: target.assignment_id || target.assignmentId || "",
          jobNo: target.job_no || target.jobNo || "",
          job_no: target.job_no || target.jobNo || "",
          subJobNo: target.sub_job_no || target.subJobNo || "",
          sub_job_no: target.sub_job_no || target.subJobNo || "",
          amount: val,
          total_amount: totalPayAmt,
          totalAmount: totalPayAmt,
          paying_qty: Number(payingQty || 0),
          payingQty: Number(payingQty || 0),
          paid_qty: Number(payingQty || 0),
          tds_section: "",
          tdsSection: "",
          tds_rate: Number(tdsRate || 0),
          tdsRate: Number(tdsRate || 0),
          tds_amount: Number(currentTdsAmt || 0),
          tdsAmount: Number(currentTdsAmt || 0),
          gross_amount: val + Number(currentTdsAmt || 0),
          grossAmount: val + Number(currentTdsAmt || 0),
          gst_rate: Number(gstRate || 0),
          gstRate: Number(gstRate || 0),
          gst_amount: Number(currentGstAmt || 0),
          gstAmount: Number(currentGstAmt || 0),
          mode: payMode,
          payment_mode: payMode,
          bank_account_id: payMode !== "Cash" ? selectedBankId : (banks.find(b => b.account_type === "Cash in Hand")?._id || null),
          bank_account_label: payMode !== "Cash" ? banks.find(b => b._id === selectedBankId)?.bank_name : "Cash in Hand",
          date: payDate,
          payment_date: payDate,
          ref: refNo || cashVoucherNo || "",
          reference_no: refNo || cashVoucherNo || "",
          cash_voucher_no: cashVoucherNo || refNo || "",
          cashVoucherNo: cashVoucherNo || refNo || "",
          cash_paid_to: cashPaidTo || "",
          cashPaidTo: cashPaidTo || "",
          notes: notes,
          attachments: attachmentFiles.map((f) => f.file),
          attachment: attachmentFiles[0]?.file || null,
        });
      }
    } catch (err) {
      console.error("Error submitting vendor payment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
        className="manual-vendor-modal accounts-console-wrapper"
        style={{
          background: "white",
          borderRadius: 14,
          width: 530,
          maxWidth: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          border: "1.5px solid #0D9488",
          margin: "12px",
        }}
      >
        <style>{`
          .manual-vendor-modal input.inp,
          .manual-vendor-modal select.sel,
          .manual-vendor-modal textarea.txa {
            width: 100% !important;
            border: 1.5px solid #CBD5E1 !important;
            border-radius: 8px !important;
            padding: 8px 12px !important;
            font-size: 13px !important;
            color: #0F172A !important;
            background-color: #FFFFFF !important;
            outline: none !important;
            box-sizing: border-box !important;
            transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
          }
          .manual-vendor-modal input.inp:focus,
          .manual-vendor-modal select.sel:focus,
          .manual-vendor-modal textarea.txa:focus {
            border-color: #0D9488 !important;
            box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.18) !important;
          }
          .manual-vendor-modal select.sel {
            appearance: auto !important;
            cursor: pointer !important;
          }
          .manual-vendor-modal input.inp::placeholder,
          .manual-vendor-modal textarea.txa::placeholder {
            color: #94A3B8 !important;
            font-size: 12px !important;
          }
        `}</style>
        <div
          style={{
            background: "#F0FDFA",
            borderBottom: "1.5px solid #99F6E4",
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>💸</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Record Vendor Payment {target.isSupplyVendor ? "(Supply)" : "(Outsource)"}
              </div>
              <div style={{ fontSize: 11.5, color: "#115E59", fontWeight: 700, marginTop: 2 }}>
                {target.vendorName || target.vendor}
                {(target.productName || target.product_name) ? ` · 📦 ${target.productName || target.product_name}` : ""}
                {target.sub_job_no ? ` · Sub-Job: ${target.sub_job_no}` : (target.job_no ? ` · Job: ${target.job_no}` : "")}
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

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              overflowY: "auto",
              flex: 1,
            }}
            className="scrollbar-thin scrollbar-thumb-slate-300"
          >
            {/* Live Alert when already paid */}
            {isAlreadyPaid && (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#991B1B" }}>
                    This outsource assignment has already been fully paid by another user!
                  </div>
                  <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 2 }}>
                    Payable due is Rs 0. Please close this modal and refresh the page.
                  </div>
                </div>
              </div>
            )}

            {/* Summary Balance Metrics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 16,
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Bill Amount</div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0C1A2E", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {Number(target.amount || 0).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>Paid So Far</div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#059669", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {Number(target.paid || 0).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#EF4444", textTransform: "uppercase" }}>Payable Due</div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#EF4444", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {Number(maxDue).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Amount to Pay */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase" }}>
                  Payment Amount (Rs) *
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(() => {
                    const isFull = Number(payAmount) === Number(maxDue) && maxDue > 0;
                    const isHalf = Number(payAmount) === Math.round(maxDue / 2) && maxDue > 0 && !isFull;
                    return (
                      <>
                        <button
                          type="button"
                          style={{
                            background: isFull ? "#0D9488" : "#F0FDFA",
                            border: isFull ? "1.5px solid #0D9488" : "1px solid #99F6E4",
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 10.5,
                            fontWeight: 900,
                            color: isFull ? "#FFFFFF" : "#0D9488",
                            cursor: "pointer",
                            boxShadow: isFull ? "0 2px 4px rgba(13,148,136,0.25)" : "none",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => handleAmountChange(maxDue)}
                        >
                          {isFull ? "✓ " : ""}Clear Full (Rs {Math.round(maxDue).toLocaleString("en-IN")})
                        </button>
                        {maxDue > 1000 && (
                          <button
                            type="button"
                            style={{
                              background: isHalf ? "#2563EB" : "#F8FAFC",
                              border: isHalf ? "1.5px solid #2563EB" : "1px solid #CBD5E1",
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 10.5,
                              fontWeight: 900,
                              color: isHalf ? "#FFFFFF" : "#475569",
                              cursor: "pointer",
                              boxShadow: isHalf ? "0 2px 4px rgba(37,99,235,0.25)" : "none",
                              transition: "all 0.15s ease",
                            }}
                            onClick={() => handleAmountChange(Math.round(maxDue / 2))}
                          >
                            {isHalf ? "✓ 50%" : "50%"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <input
                type="number"
                className="inp"
                required
                min="0.01"
                max={maxDue > 0 ? maxDue : undefined}
                step="any"
                value={payAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    handleAmountChange("");
                    return;
                  }
                  const num = parseFloat(v);
                  if (!isNaN(num) && maxDue > 0 && num > maxDue) {
                    handleAmountChange(maxDue);
                  } else {
                    handleAmountChange(v);
                  }
                }}
                placeholder={`Exact max: Rs ${Number(maxDue).toLocaleString("en-IN")}`}
                style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#0D9488", padding: "8px 12px" }}
                autoFocus
              />
              {Number(payAmount) > maxDue && maxDue > 0 && (
                <div style={{ color: "#EF4444", fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                  ⚠️ Payment cannot exceed remaining balance of Rs {Number(maxDue).toLocaleString("en-IN")}
                </div>
              )}
            </div>

            {/* Invoice Quantity Section (for Partial / Full Payment) */}
            {totalInvoiceQty > 0 && (
              <div
                style={{
                  marginBottom: 14,
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase" }}>
                    Invoice Quantity (Partial / Full)
                  </label>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                    Total: <b style={{ color: "#0C1A2E" }}>{totalInvoiceQty}</b> · Paid: <b style={{ color: "#059669" }}>{alreadyPaidQty}</b> · Due: <b style={{ color: "#EF4444" }}>{remainingQty}</b>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    className="inp"
                    min="1"
                    max={remainingQty > 0 ? remainingQty : undefined}
                    step="1"
                    value={payingQty}
                    onKeyDown={(e) => {
                      if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    placeholder={`Qty (Max: ${remainingQty})`}
                    style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "monospace", padding: "7px 10px", flex: 1 }}
                  />
                  <button
                    type="button"
                    style={{
                      background: Number(payingQty) === Number(remainingQty) ? "#0D9488" : "#F0FDFA",
                      border: "1px solid #99F6E4",
                      color: Number(payingQty) === Number(remainingQty) ? "#FFFFFF" : "#0D9488",
                      borderRadius: 4,
                      padding: "7px 10px",
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => {
                      handleQtyChange(remainingQty);
                      handleAmountChange(maxDue);
                    }}
                  >
                    Clear Qty ({remainingQty})
                  </button>
                </div>
              </div>
            )}

            {/* Readonly Vendor Tax Rates & Dynamic Tax Amounts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {/* GST Details */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                    GST Rate (Vendor)
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#0F766E", fontFamily: "monospace" }}>
                    {loadingRates ? "..." : `${gstRate}%`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                    GST Amount (+)
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#0F766E", fontFamily: "monospace" }}>
                    ₹ {currentGstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* TDS Details */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                    TDS Rate (Vendor)
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#DC2626", fontFamily: "monospace" }}>
                    {loadingRates ? "..." : `${tdsRate}%`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                    TDS Amount (-)
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#DC2626", fontFamily: "monospace" }}>
                    ₹ {currentTdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Net Payable Banner: Total Amt = Payment Amt + GST - TDS */}
            <div
              style={{
                background: "#F0FDFA",
                border: "1.5px solid #0D9488",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  Total Payable (Bank Debit)
                </div>
                <div style={{ fontSize: 10, color: "#115E59", marginTop: 2 }}>
                  Payment (₹{numericPayAmt.toLocaleString("en-IN")}) + GST (₹{currentGstAmt.toLocaleString("en-IN")}) - TDS (₹{currentTdsAmt.toLocaleString("en-IN")})
                </div>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0D9488", fontFamily: "monospace" }}>
                ₹ {totalPayAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Payment Mode
                </label>
                <select
                  className="sel"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  style={{ padding: "8px 10px" }}
                >
                  <option>Bank Transfer (NEFT/RTGS)</option>
                  <option>UPI / GPay / PhonePe</option>
                  <option>Cheque</option>
                  <option>Cash</option>
                  <option>Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Payment Date
                </label>
                <input
                  type="date"
                  className="inp"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={{ padding: "7px 10px" }}
                />
              </div>
            </div>

            {payMode !== "Cash" && banks.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Debit From Bank Account *
                </label>
                <select
                  className="sel"
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  style={{ padding: "8px 10px", width: "100%" }}
                  required
                >
                  <option value="">Select Bank Account</option>
                  {banks.filter(b => b.account_type !== "Cash in Hand").map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.bank_name} {b.account_number ? `(${b.account_number})` : ""} (Bal: Rs {Number(b.balance || 0).toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {payMode === "Cash" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Cash Disbursement Voucher No *
                  </label>
                  <input
                    type="text"
                    className="inp"
                    value={cashVoucherNo || refNo}
                    onChange={(e) => {
                      setCashVoucherNo(e.target.value);
                      setRefNo(e.target.value);
                    }}
                    placeholder="e.g. CV-2026-0018"
                    style={{ padding: "7px 10px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Handed Over To (Receiver Name)
                  </label>
                  <input
                    type="text"
                    className="inp"
                    value={cashPaidTo}
                    onChange={(e) => setCashPaidTo(e.target.value)}
                    placeholder="e.g. Vendor Representative Name"
                    style={{ padding: "7px 10px" }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Reference / UTR / Cheque No
                </label>
                <input
                  type="text"
                  className="inp"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="e.g. UTR20260908001 / Cheque #918234"
                  style={{ padding: "7px 10px" }}
                />
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Notes / Remarks (Optional)
              </label>
              <input
                type="text"
                className="inp"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional vendor payment remarks"
                style={{ padding: "7px 10px" }}
              />
            </div>

            {/* Optional Multi-File Attachment Upload */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 2 }}>
                  <span>Payment Voucher / Receipt Proof</span>
                  <span style={{ color: "#DC2626", fontSize: 13, fontWeight: 900 }}>*</span>
                </label>
              </div>

              <div
                style={{
                  border: "1.5px dashed #CBD5E1",
                  borderRadius: 8,
                  padding: "10px 14px",
                  background: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <label
                  style={{
                    background: "#0D9488",
                    color: "white",
                    padding: "6px 14px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📎 Attach Proofs
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>
                <div style={{ fontSize: 11, color: "#64748B" }}>
                  {attachmentFiles.length > 0 ? `${attachmentFiles.length} file(s) chosen` : "Upload vendor remittance or bank receipt (JPG, PNG, PDF)"}
                </div>
              </div>

              {/* Selected files preview */}
              {attachmentFiles.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {attachmentFiles.map((fileObj, idx) => (
                    <div
                      key={fileObj.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#F0FDFA",
                        border: "1px solid #99F6E4",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: "#0F766E",
                      }}
                    >
                      <span>{fileObj.isImage ? "🖼️" : "📄"}</span>
                      <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fileObj.name}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#DC2626",
                          fontWeight: 900,
                          padding: 0,
                          marginLeft: 4,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              alignItems: "center",
              padding: "12px 18px",
              background: "#F8FAFC",
              borderTop: "1px solid #E2E8F0",
              flexShrink: 0,
            }}
          >
            {payMode === "Cash" && (
              <button
                type="button"
                className="btn bs"
                style={{ background: "#F0FDFA", borderColor: "#99F6E4", color: "#0D9488", fontWeight: 800 }}
                onClick={() =>
                  generateCashVoucherPDF({
                    subJobNo: target.sub_job_no || target.subJobNo || target.job_no,
                    vendorName: target.vendorName || target.vendor_name,
                    amount: payAmount,
                    tdsAmount: currentTdsAmt,
                    grossAmount: Number(payAmount || 0) + Number(currentTdsAmt || 0),
                    personName: cashPaidTo,
                    voucherNo: cashVoucherNo || refNo,
                    date: payDate,
                    notes: notes,
                  })
                }
              >
                📄 Print Cash Voucher PDF
              </button>
            )}
            <button
              type="button"
              className="btn bs"
              onClick={onClose}
              style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700 }}
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn bs bg"
              style={{
                padding: "8px 20px",
                fontSize: 12,
                fontWeight: 900,
                background: isAlreadyPaid ? "#94A3B8" : (isBusy ? "#0F766E" : "#0D9488"),
                borderColor: isAlreadyPaid ? "#94A3B8" : (isBusy ? "#0F766E" : "#0D9488"),
                color: "white",
                opacity: (isBusy || isAlreadyPaid || maxDue <= 0) ? 0.6 : 1,
                cursor: (isBusy || isAlreadyPaid || maxDue <= 0) ? "not-allowed" : "pointer",
              }}
              disabled={isBusy || isAlreadyPaid || maxDue <= 0}
            >
              {isBusy ? "⏳ Recording Payment..." : isAlreadyPaid ? "✓ Already Fully Paid" : "✓ Confirm & Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
