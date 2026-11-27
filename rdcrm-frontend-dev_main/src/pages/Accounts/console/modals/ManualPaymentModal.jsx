import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { axiosInstance, backendUrl } from "../../../../utils/url/config";
import { generateCashVoucherPDF } from "../utils/generateCashVoucherPDF";

export default function ManualPaymentModal({ target, onClose, onSave, isSaving }) {
  const initialMaxDue = Number(target.outstanding !== undefined ? target.outstanding : (target.due !== undefined ? target.due : target.amount || 0));
  const [maxDue, setMaxDue] = useState(initialMaxDue);
  const [payAmount, setPayAmount] = useState(initialMaxDue);
  const [payMode, setPayMode] = useState("Bank Transfer (NEFT/RTGS)");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState("");
  const [cashVoucherNo, setCashVoucherNo] = useState("");
  const [cashCollectedBy, setCashCollectedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [tdsTaxes, setTdsTaxes] = useState([]);
  const [selectedTdsTaxId, setSelectedTdsTaxId] = useState("");
  const [tdsRate, setTdsRate] = useState(0);
  const [customerDefaultTax, setCustomerDefaultTax] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [checkingLive, setCheckingLive] = useState(false);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState("");

  // Unmatched / Unallocated receipts states
  const [unallocatedList, setUnallocatedList] = useState([]);
  const [loadingUnallocated, setLoadingUnallocated] = useState(false);
  const [paymentSource, setPaymentSource] = useState("direct"); // "direct" | "unmatched"
  const [selectedUnallocatedId, setSelectedUnallocatedId] = useState("");

  // Invoice-based payment states
  const [invoicesList, setInvoicesList] = useState(target.invoices || []);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [previewProof, setPreviewProof] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);

  const selectedUnallocated = useMemo(() => {
    if (!unallocatedList || unallocatedList.length === 0) return null;
    return (
      unallocatedList.find(
        (u) => String(u.id || u._id) === String(selectedUnallocatedId)
      ) || unallocatedList[0]
    );
  }, [unallocatedList, selectedUnallocatedId]);

  const totalUnallocated = useMemo(() => {
    return (unallocatedList || []).reduce(
      (sum, u) => sum + (Number(u.remaining) || 0),
      0
    );
  }, [unallocatedList]);

  const isBusy = Boolean(isSaving || isSubmitting);

  // Invoice / Sub-job Total & Advance / Already Paid amounts
  const selectedInvoiceTotal = Number(selectedInvoice ? selectedInvoice.totalAmt : (target.amount || target.amt || target.grandTotal || target.quotationTotal || 0));
  const selectedInvoicePaid = Number(selectedInvoice ? selectedInvoice.paid : (target.paid || 0));

  const numericPayAmt = parseFloat(payAmount) || 0;
  // TDS is always calculated on the partial allocation / payment amount (e.g. Rs 8,000 @ 3% = Rs 240)
  const currentTdsAmt = Math.round((numericPayAmt * (Number(tdsRate) || 0) / 100) * 100) / 100;

  // In Direct Payment: Total Payable (Bank Credit) = Payment Amount - TDS Amount
  const totalPayable = useMemo(() => {
    return Math.max(0, Math.round((numericPayAmt - currentTdsAmt) * 100) / 100);
  }, [numericPayAmt, currentTdsAmt]);

  const handleAmountChange = (newAmt) => {
    setPayAmount(newAmt);
  };

  const handleViewProof = async (item) => {
    let url = item?.url || (typeof item === "string" ? item : "");
    if (!url) return;
    setLoadingProof(true);
    // If not base64 and not already signed with AWS/R2 v4 auth, request signed URL from backend
    if (!url.startsWith("data:") && !url.includes("X-Amz-Signature") && !url.includes("AWSAccessKeyId")) {
      try {
        const res = await axiosInstance.get("/accounts/signed-url", { params: { url } });
        if (res.data?.success && res.data?.signedUrl) {
          url = res.data.signedUrl;
        }
      } catch (err) {
        console.warn("Could not sign proof URL:", err);
      }
      if (!url.includes("X-Amz-Signature") && !url.includes("AWSAccessKeyId") && !url.startsWith("data:")) {
        const base = backendUrl ? backendUrl.replace(/\/$/, "") : "";
        url = `${base}/image/view?url=${encodeURIComponent(url)}`;
      }
    }
    setLoadingProof(false);
    setPreviewProof({
      url,
      name: item?.name || "Payment Proof / Receipt",
    });
  };

  const handleTdsChange = (taxId) => {
    setSelectedTdsTaxId(taxId);
    if (!taxId) {
      setTdsRate(0);
    } else {
      const selectedTax = tdsTaxes.find((t) => String(t._id) === String(taxId));
      setTdsRate(selectedTax ? Number(selectedTax.tax_rate || 0) : 0);
    }
  };

  const subJobNo = target.sub_job_no;
  const targetAmount = target.amount;
  const targetAmt = target.amt;
  const targetGrandTotal = target.grandTotal;
  const targetQuotationTotal = target.quotationTotal;

  // Proactive check on modal mount: verify if another user has already paid this sub-job
  useEffect(() => {
    let isMounted = true;
    const verifyLiveBalance = async () => {
      if (!subJobNo || subJobNo.includes("Sub-Jobs")) return;
      setCheckingLive(true);
      try {
        const res = await axiosInstance.get(`/accounts/payments/${encodeURIComponent(subJobNo)}`);
        if (res.data?.success && Array.isArray(res.data.data) && isMounted) {
          const payments = res.data.data || [];
          setPaymentHistory(payments);

          const fetchedInvoices = Array.isArray(res.data.invoices) && res.data.invoices.length > 0
            ? res.data.invoices
            : (target.invoices || []);
          if (fetchedInvoices.length > 0) {
            setInvoicesList(fetchedInvoices);
          }

          const livePaid = payments.reduce((s, p) => {
            const gross = Number(p.gross_amount || 0);
            const a = Number(p.amount || 0);
            const tds = Number(p.tds_amount || 0);
            const net = Number(p.total_payable || 0);
            const settled = (gross > a)
              ? gross
              : (net > 0 && Math.abs(a - (net + tds)) < 0.05)
                ? a
                : (a + tds);
            return s + settled;
          }, 0);
          const totalAmt = Number(targetAmount || targetAmt || targetGrandTotal || targetQuotationTotal || 0);
          if (totalAmt > 0) {
            const liveDue = Math.max(0, Math.round((totalAmt - livePaid) * 100) / 100);
            setMaxDue(liveDue);
            if (liveDue <= 0) {
              setIsAlreadyPaid(true);
              setPayAmount(0);
              toast.warning(`Notice: Sub-job ${subJobNo} was already fully paid by another user!`);
            } else if (liveDue < initialMaxDue) {
              setPayAmount(liveDue);
              toast.info(`Notice: Live outstanding balance updated to Rs ${liveDue.toLocaleString("en-IN")}`);
            }
          }
        }
      } catch (err) {
        console.warn("Could not check live payment balance:", err);
      } finally {
        if (isMounted) setCheckingLive(false);
      }
    };
    const loadBanks = async () => {
      try {
        const res = await axiosInstance.get("/accounts/bank-master");
        if (res.data?.success) {
          setBanks(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedBankId(res.data.data[0]._id);
          }
        }
      } catch (e) {
        console.warn("Failed to load banks", e);
      }
    };
    const loadTdsAndCustomerData = async () => {
      setLoadingRates(true);
      try {
        let activeTdsList = [];
        try {
          const taxRes = await axiosInstance.get("/taxmaster", {
            params: { limit: "all", status: true },
          });
          if (taxRes.data?.success && Array.isArray(taxRes.data.data)) {
            activeTdsList = taxRes.data.data.filter((t) => t.tax_type === "TDS" && t.is_active);
            if (isMounted) {
              setTdsTaxes(activeTdsList);
            }
          }
        } catch (err) {
          console.warn("Failed to load taxes from tax master:", err);
        }

        let custData = null;
        const cId = target.clientId || target.id;
        const cName = (target.clientName || target.client || "").trim();

        if (cId && typeof cId === "string" && /^[0-9a-fA-F]{24}$/.test(cId)) {
          try {
            const custRes = await axiosInstance.get(`/customer/${cId}`);
            if (custRes.data?.success && custRes.data.data) {
              custData = custRes.data.data;
            }
          } catch {
            /* ignore */
          }
        }

        if (!custData && cName) {
          try {
            const sRes = await axiosInstance.get("/customer", {
              params: { search: cName, limit: 10 },
            });
            if (sRes.data?.success && Array.isArray(sRes.data.data)) {
              custData = sRes.data.data.find(
                (item) => (item.name || "").toLowerCase().trim() === cName.toLowerCase().trim()
              ) || sRes.data.data[0];
            }
          } catch {
            /* ignore */
          }
        }

        if (isMounted && custData) {
          const masterTdsTaxId = typeof custData.tds_tax === "object" && custData.tds_tax?._id
            ? custData.tds_tax._id
            : custData.tds_tax;
          const masterTdsRate = Number(
            custData.tds_tax?.tax_rate !== undefined
              ? custData.tds_tax.tax_rate
              : (custData.tds_rate !== undefined ? custData.tds_rate : 0)
          );

          let matchedTax = null;
          if (masterTdsTaxId) {
            matchedTax = activeTdsList.find((t) => String(t._id) === String(masterTdsTaxId));
          }
          if (!matchedTax && masterTdsRate > 0) {
            matchedTax = activeTdsList.find((t) => Number(t.tax_rate) === masterTdsRate);
          }

          if (matchedTax) {
            setSelectedTdsTaxId(matchedTax._id);
            setTdsRate(Number(matchedTax.tax_rate || 0));
            setCustomerDefaultTax(matchedTax);
          } else if (masterTdsRate > 0) {
            setTdsRate(masterTdsRate);
            setCustomerDefaultTax({ tax_rate: masterTdsRate, tax_name: `TDS ${masterTdsRate}%` });
          }
        }
      } catch (err) {
        console.warn("Error fetching customer or TDS tax data:", err);
      } finally {
        if (isMounted) setLoadingRates(false);
      }
    };
    const fetchUnallocated = async () => {
      const cName = (target.clientName || target.client || "").trim();
      const sjNo = (target.sub_job_no || subJobNo || "").trim();
      if (!cName && !sjNo) return;
      setLoadingUnallocated(true);
      try {
        const res = await axiosInstance.get("/accounts/unallocated-receipts", {
          params: {
            client: cName,
            sub_job_no: sjNo,
            clientId: target.clientId || target.id,
          },
        });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          setUnallocatedList(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedUnallocatedId(res.data.data[0].id || res.data.data[0]._id);
          }
        }
      } catch (err) {
        console.warn("Could not fetch unallocated receipts:", err);
      } finally {
        if (isMounted) setLoadingUnallocated(false);
      }
    };

    verifyLiveBalance();
    loadBanks();
    loadTdsAndCustomerData();
    fetchUnallocated();
    return () => {
      isMounted = false;
    };
  }, [subJobNo, targetAmount, targetAmt, targetGrandTotal, targetQuotationTotal, initialMaxDue, target.clientId, target.id, target.clientName, target.client, target.invoices, target.sub_job_no]);

  // Calculate each invoice's current balance based on direct invoice matches + FIFO allocation
  const invoicesWithBalances = useMemo(() => {
    if (!invoicesList || invoicesList.length === 0) return [];

    // Sort chronologically (FIFO - oldest invoice date or lowest invoiceNo first)
    const sortedInvs = [...invoicesList].sort((a, b) => {
      const da = a.date || a.createdAt ? new Date(a.date || a.createdAt).getTime() : 0;
      const db = b.date || b.createdAt ? new Date(b.date || b.createdAt).getTime() : 0;
      if (da !== db) return da - db;
      return String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || ""));
    });

    // Map each invoice identifier to canonical ID
    const invCanonicalMap = new Map();
    sortedInvs.forEach((inv) => {
      const cId = String(inv._id || inv.id || "").trim().toLowerCase();
      if (cId) invCanonicalMap.set(cId, cId);
      if (inv.invoiceNo) invCanonicalMap.set(String(inv.invoiceNo).trim().toLowerCase(), cId);
    });

    const directPaidMap = new Map();
    let legacyPaymentsPool = 0;

    (paymentHistory || []).forEach((p) => {
      const gross = Number(p.gross_amount || 0);
      const a = Number(p.amount || 0);
      const tds = Number(p.tds_amount || 0);
      const net = Number(p.total_payable || 0);
      const amt = (gross > a)
        ? gross
        : (net > 0 && Math.abs(a - (net + tds)) < 0.05)
          ? a
          : (a + tds);
      if (amt <= 0) return;
      const invNo = String(p.invoice_no || "").trim().toLowerCase();
      const invId = String(p.invoice_id || "").trim().toLowerCase();

      let matched = invCanonicalMap.get(invId) || invCanonicalMap.get(invNo);
      if (!matched && p.notes) {
        const notesMatch = p.notes.match(/(?:invoice|against)\s*[:#]?\s*([A-Za-z0-9\-_]+)/i);
        if (notesMatch && notesMatch[1]) {
          matched = invCanonicalMap.get(notesMatch[1].trim().toLowerCase());
        }
      }

      if (matched) {
        directPaidMap.set(matched, (directPaidMap.get(matched) || 0) + amt);
      } else {
        legacyPaymentsPool += amt;
      }
    });

    let pool = legacyPaymentsPool;
    return sortedInvs.map((inv) => {
      const cId = String(inv._id || inv.id || "").trim().toLowerCase();
      const direct = directPaidMap.get(cId) || 0;
      const invAmt = Number(inv.totalAmt || 0);
      let fromPool = 0;
      if (pool > 0) {
        const needed = Math.max(0, invAmt - direct);
        fromPool = Math.min(needed, pool);
        pool -= fromPool;
      }
      const paidOnInv = direct + fromPool;
      const bal = Math.max(0, Math.round((invAmt - paidOnInv) * 100) / 100);
      return {
        ...inv,
        paid: paidOnInv,
        balance: bal,
      };
    });
  }, [invoicesList, paymentHistory]);

  // Auto-select invoice if there is only 1 open invoice with pending balance
  useEffect(() => {
    if (invoicesWithBalances.length > 0 && !selectedInvoiceId) {
      const openInvs = invoicesWithBalances.filter((i) => i.balance > 0);
      if (openInvs.length === 1) {
        const single = openInvs[0];
        setSelectedInvoiceId(String(single._id || single.id || single.invoiceNo));
        setSelectedInvoice(single);
        setMaxDue(single.balance);
        setPayAmount(single.balance);
      }
    }
  }, [invoicesWithBalances, selectedInvoiceId]);

  const handleInvoiceChange = (invKey) => {
    setSelectedInvoiceId(invKey);
    if (!invKey || invKey === "all") {
      setSelectedInvoice(null);
      const livePaid = (paymentHistory || []).reduce((s, p) => {
        const gross = Number(p.gross_amount || 0);
        const a = Number(p.amount || 0);
        const tds = Number(p.tds_amount || 0);
        const net = Number(p.total_payable || 0);
        const settled = (gross > a)
          ? gross
          : (net > 0 && Math.abs(a - (net + tds)) < 0.05)
            ? a
            : (a + tds);
        return s + settled;
      }, 0);
      const totalAmt = Number(targetAmount || targetAmt || targetGrandTotal || targetQuotationTotal || 0);
      const fullDue = totalAmt > 0 ? Math.max(0, Math.round((totalAmt - livePaid) * 100) / 100) : initialMaxDue;
      setMaxDue(fullDue);
      setPayAmount(fullDue);
    } else {
      const found = invoicesWithBalances.find(
        (i) => String(i._id || i.id || i.invoiceNo) === String(invKey)
      );
      if (found) {
        setSelectedInvoice(found);
        setMaxDue(found.balance);
        setPayAmount(found.balance);
      }
    }
  };

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
            newItems.push({ file, id, name: file.name, size: file.size, preview: "", isImage: false });
          }
        }
      });

      return [...prev, ...newItems];
    });
  };

  const handleRemoveFile = (indexToRemove) => {
    setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAllFiles = () => {
    setAttachmentFiles([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isBusy || isAlreadyPaid || maxDue <= 0) return;
    const val = parseFloat(payAmount);
    if (isNaN(val) || val <= 0) {
      toast.warning("Please enter a valid payment amount greater than 0");
      return;
    }

    // Reconcile flow when applying existing unmatched client receipt
    if (paymentSource === "unmatched") {
      if (!selectedUnallocated) {
        toast.warning("Please select an unmatched payment receipt to reconcile.");
        return;
      }
      if (val > (selectedUnallocated.remaining || 0) + 0.05) {
        toast.error(
          `Entered amount (Rs ${val.toLocaleString("en-IN")}) cannot exceed the available unmatched balance of Rs ${Number(selectedUnallocated.remaining || 0).toLocaleString("en-IN")}.`
        );
        return;
      }
      if (val > maxDue && maxDue > 0) {
        toast.error(
          `Allocation amount (Rs ${val.toLocaleString("en-IN")}) cannot exceed the remaining outstanding balance of Rs ${maxDue.toLocaleString("en-IN")}.`
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const reconcilePayload = {
          unallocatedId: selectedUnallocated._id || selectedUnallocated.id,
          receiptNo: selectedUnallocated.receiptNo,
          invoiceId: selectedInvoice?._id ? String(selectedInvoice._id) : (selectedInvoice?.id ? String(selectedInvoice.id) : target.sub_job_no),
          sub_job_no: target.sub_job_no,
          invoiceNo: selectedInvoice?.invoiceNo ? String(selectedInvoice.invoiceNo).trim() : target.sub_job_no,
          amount: val,
          tds_rate: Number(tdsRate || 0),
          tds_amount: currentTdsAmt,
          tds_tax: selectedTdsTaxId || null,
          total_payable: val,
          gross_amount: Math.round((val + currentTdsAmt) * 100) / 100,
          grossAmount: Math.round((val + currentTdsAmt) * 100) / 100,
          notes: notes || `Reconciled from unmatched receipt ${selectedUnallocated.receiptNo} against ${selectedInvoice?.invoiceNo || target.sub_job_no}`,
        };

        if (typeof onSave === "function") {
          await onSave({
            isReconcile: true,
            reconcileData: reconcilePayload,
            clientId: target.clientId || target.id,
            clientName: target.clientName || target.client,
            subJobNo: target.sub_job_no,
            amount: val,
            tdsAmount: currentTdsAmt,
            tdsRate: Number(tdsRate || 0),
            tds_tax: selectedTdsTaxId || null,
            totalPayable: val,
            grossAmount: Math.round((val + currentTdsAmt) * 100) / 100,
            gross_amount: Math.round((val + currentTdsAmt) * 100) / 100,
          });
        } else {
          const res = await axiosInstance.post("/accounts/collections/reconcile", reconcilePayload);
          if (res.data?.success) {
            toast.success(
              `Payment of Rs ${val.toLocaleString("en-IN")} reconciled successfully from ${selectedUnallocated.receiptNo} for ${target.sub_job_no}!`
            );
            onClose();
          } else {
            toast.error("Failed to reconcile payment: " + (res.data?.message || "Unknown error"));
          }
        }
      } catch (err) {
        console.error("Error reconciling payment:", err);
        toast.error(err.response?.data?.message || err.message || "Failed to reconcile payment");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (val > maxDue && maxDue > 0) {
      toast.error(
        `Entered payment amount (Rs ${val.toLocaleString("en-IN")}) cannot exceed the remaining outstanding balance of Rs ${maxDue.toLocaleString("en-IN")}. Only exact or lower amount is allowed.`
      );
      return;
    }
    if (!attachmentFiles || attachmentFiles.length === 0) {
      toast.warning("Payment Voucher / Receipt Proof is mandatory! Please attach at least 1 file.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (typeof onSave === "function") {
        await onSave({
          clientId: target.clientId || target.id,
          clientName: target.clientName || target.client,
          subJobNo: target.sub_job_no,
          invoice_id: selectedInvoice?._id ? String(selectedInvoice._id) : (selectedInvoice?.id ? String(selectedInvoice.id) : ""),
          invoice_no: selectedInvoice?.invoiceNo ? String(selectedInvoice.invoiceNo).trim() : "",
          amount: val,
          tdsAmount: currentTdsAmt,
          tdsRate: Number(tdsRate || 0),
          tds_rate: Number(tdsRate || 0),
          tds_amount: currentTdsAmt,
          tds_tax: selectedTdsTaxId || null,
          totalPayable: totalPayable,
          total_payable: totalPayable,
          grossAmount: val,
          gross_amount: val,
          mode: payMode,
          bank_account_id: payMode !== "Cash" ? selectedBankId : (banks.find(b => b.account_type === "Cash in Hand")?._id || null),
          bank_account_label: payMode !== "Cash" ? banks.find(b => b._id === selectedBankId)?.bank_name : "Cash in Hand",
          date: payDate,
          ref: refNo,
          cashVoucherNo: cashVoucherNo || refNo,
          cashCollectedBy: cashCollectedBy,
          notes: notes,
          attachments: attachmentFiles.map((f) => f.file),
          attachment: attachmentFiles[0]?.file || null,
        });
      } else {
        // Direct API submit fallback when modal is rendered without onSave (e.g. from top-level Quick Actions)
        const formData = new FormData();
        formData.append("sub_job_no", target.sub_job_no);
        formData.append("job_no", target.clientId ? String(target.clientId).replace(/^job_/, "") : (target.job_no || ""));
        formData.append("client_name", target.clientName || target.client || "");
        if (selectedInvoice?._id || selectedInvoice?.id) {
          formData.append("invoice_id", String(selectedInvoice._id || selectedInvoice.id));
        }
        if (selectedInvoice?.invoiceNo) {
          formData.append("invoice_no", String(selectedInvoice.invoiceNo).trim());
        }
        formData.append("amount", val);
        formData.append("tds_amount", currentTdsAmt);
        formData.append("tds_rate", Number(tdsRate || 0));
        if (selectedTdsTaxId) formData.append("tds_tax", selectedTdsTaxId);
        formData.append("total_payable", totalPayable);
        formData.append("gross_amount", val);
        formData.append("payment_mode", payMode);
        const resolvedBankId = payMode !== "Cash" ? selectedBankId : (banks.find(b => b.account_type === "Cash in Hand")?._id || null);
        const resolvedBankLabel = payMode !== "Cash" ? banks.find(b => b._id === selectedBankId)?.bank_name : "Cash in Hand";
        if (resolvedBankId) formData.append("bank_account_id", resolvedBankId);
        if (resolvedBankLabel) formData.append("bank_account_label", resolvedBankLabel);
        formData.append("payment_date", payDate);
        formData.append("reference_no", refNo || "");
        if (cashVoucherNo) formData.append("cash_voucher_no", cashVoucherNo);
        if (cashCollectedBy) formData.append("cash_collected_by", cashCollectedBy);
        formData.append("notes", notes || "");

        attachmentFiles.forEach((f) => {
          if (f.file) formData.append("attachments", f.file);
        });

        const res = await axiosInstance.post("/accounts/record-payment", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data?.success) {
          toast.success(`Payment of Rs ${val.toLocaleString("en-IN")} recorded successfully for ${target.sub_job_no}!`);
          onClose();
        } else {
          toast.error("Failed to record payment: " + (res.data?.message || "Unknown error"));
        }
      }
    } catch (err) {
      console.error("Error saving client payment:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to record payment");
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
    >
      <div
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
          border: "1.5px solid #059669",
          margin: "12px",
        }}
      >
        <div
          style={{
            background: "#ECFDF5",
            borderBottom: "1.5px solid #A7F3D0",
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>💳</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Record Payment (Manual Entry)
              </div>
              <div style={{ fontSize: 11.5, color: "#047857", fontWeight: 700, marginTop: 2 }}>
                {target.clientName || target.client} · Sub-Job: {target.sub_job_no}
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
                    This sub-job has already been fully paid by another user!
                  </div>
                  <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 2 }}>
                    Outstanding balance is Rs 0. Please close this modal and refresh the console.
                  </div>
                </div>
              </div>
            )}

            {/* Live Alert when client has unmatched payment credit */}
            {unallocatedList.length > 0 && (
              <div
                style={{
                  background: paymentSource === "unmatched" ? "#EFF6FF" : "#FEFCE8",
                  border: paymentSource === "unmatched" ? "1.5px solid #60A5FA" : "1.5px solid #F59E0B",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 14,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>💰</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: paymentSource === "unmatched" ? "#1E40AF" : "#92400E" }}>
                        Unmatched Client Advance Payment Available!
                      </div>
                      <div style={{ fontSize: 11, color: paymentSource === "unmatched" ? "#1D4ED8" : "#B45309", marginTop: 2 }}>
                        This client has <b style={{ fontFamily: "monospace", color: "#1E3A8A" }}>Rs {totalUnallocated.toLocaleString("en-IN")}</b> in unmatched receipts waiting to reconcile.
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      background: paymentSource === "unmatched" ? "#DBEAFE" : "#FEF3C7",
                      color: paymentSource === "unmatched" ? "#1E40AF" : "#92400E",
                      border: paymentSource === "unmatched" ? "1px solid #BFDBFE" : "1px solid #FDE68A",
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {unallocatedList.length} Open {unallocatedList.length === 1 ? "Receipt" : "Receipts"}
                  </span>
                </div>

                {/* Mode Switcher Tabs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentSource("direct");
                      setPayAmount(maxDue);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      border: paymentSource === "direct" ? "2px solid #059669" : "1px solid #CBD5E1",
                      background: paymentSource === "direct" ? "#ECFDF5" : "white",
                      color: paymentSource === "direct" ? "#065F46" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>💳 Direct New Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentSource("unmatched");
                      if (selectedUnallocated) {
                        setPayAmount(Math.min(maxDue, selectedUnallocated.remaining));
                      }
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      border: paymentSource === "unmatched" ? "2px solid #2563EB" : "1.5px solid #FCD34D",
                      background: paymentSource === "unmatched" ? "#DBEAFE" : "#FFFBEB",
                      color: paymentSource === "unmatched" ? "#1E40AF" : "#B45309",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>🔗 Reconcile from Unmatched (Rs {totalUnallocated.toLocaleString("en-IN")})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Source Unmatched Receipt Details when Reconcile Mode is Selected */}
            {paymentSource === "unmatched" && (
              <div
                style={{
                  background: "#F0F9FF",
                  border: "1.5px solid #7DD3FC",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 900, color: "#0369A1", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>📥</span>
                    <span>Source Unmatched Receipt to Reconcile ({unallocatedList.length} Available)</span>
                  </label>
                  {selectedUnallocated && (
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0284C7", background: "#E0F2FE", padding: "1px 6px", borderRadius: 4 }}>
                      Available: Rs {Number(selectedUnallocated.remaining || 0).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                <select
                  value={selectedUnallocatedId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedUnallocatedId(id);
                    const found = unallocatedList.find((u) => String(u.id || u._id) === String(id));
                    if (found) {
                      setPayAmount(Math.min(maxDue, found.remaining));
                    }
                  }}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #38BDF8",
                    background: "white",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#0369A1",
                    outline: "none",
                    boxSizing: "border-box",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {unallocatedList.map((u) => {
                    const rawRef = String(u.referenceNo || "").trim();
                    const cleanRef = rawRef
                      ? ` · Ref: ${rawRef.length > 20 ? rawRef.slice(0, 18) + "…" : rawRef}`
                      : "";
                    return (
                      <option key={u.id || u._id} value={u.id || u._id} title={rawRef ? `Full Ref: ${rawRef}` : ""}>
                        {u.receiptNo} — Avail: Rs {Number(u.remaining || 0).toLocaleString("en-IN")} / Total: Rs {Number(u.amount || 0).toLocaleString("en-IN")} ({u.mode}{cleanRef} · {u.date})
                      </option>
                    );
                  })}
                </select>

                {selectedUnallocated && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "white",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #BAE6FD",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Receipt No</div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 900,
                          color: "#0284C7",
                          fontFamily: "monospace",
                          marginTop: 2,
                        }}
                        title={selectedUnallocated.receiptNo}
                      >
                        {selectedUnallocated.receiptNo}
                      </div>
                    </div>
                    <div style={{ minWidth: 160, flex: 1 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Mode &amp; Reference</div>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#334155",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 2,
                        }}
                      >
                        <span style={{ background: "#F1F5F9", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                          {selectedUnallocated.mode}
                        </span>
                        {selectedUnallocated.referenceNo ? (
                          <span
                            title={`Full Ref: ${selectedUnallocated.referenceNo}`}
                            style={{
                              fontFamily: "monospace",
                              fontSize: 10.5,
                              color: "#0284C7",
                              background: "#F0F9FF",
                              padding: "1px 6px",
                              borderRadius: 4,
                              border: "1px solid #BAE6FD",
                              display: "inline-block",
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              verticalAlign: "middle",
                            }}
                          >
                            Ref: {selectedUnallocated.referenceNo}
                          </span>
                        ) : null}
                        <span style={{ color: "#64748B", fontSize: 11 }}>· {selectedUnallocated.date}</span>
                      </div>
                    </div>
                    <div style={{ minWidth: 120, textAlign: "right" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#047857", textTransform: "uppercase" }}>Available to Reconcile</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#059669", fontFamily: "monospace", marginTop: 2 }}>
                        Rs {Number(selectedUnallocated.remaining || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                )}

                {selectedUnallocated?.attachments && selectedUnallocated.attachments.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "#E0F2FE", padding: "6px 10px", borderRadius: 6, fontSize: 11, color: "#0369A1", fontWeight: 700 }}>
                    <span>📎</span>
                    <span>Original Proof: <b>{selectedUnallocated.attachments.length} file(s)</b> ({selectedUnallocated.attachments[0].name || "Proof"})</span>
                    {selectedUnallocated.attachments[0]?.url && (
                      <button
                        type="button"
                        onClick={() => handleViewProof(selectedUnallocated.attachments[0])}
                        style={{
                          background: "transparent",
                          border: "none",
                          marginLeft: "auto",
                          color: "#0284C7",
                          textDecoration: "underline",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        View Original Proof ↗
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Invoice Selection Section */}
            {invoicesWithBalances.length > 0 ? (
              <div
                style={{
                  background: "#F0FDFA",
                  border: "1.5px solid #99F6E4",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 900, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span>🧾</span>
                    <span>Target Invoice to Settle ({invoicesWithBalances.length} Available)</span>
                  </label>
                  {selectedInvoice && (
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0D9488", background: "#CCFBF1", padding: "1px 6px", borderRadius: 4 }}>
                      Selected: {selectedInvoice.invoiceNo}
                    </span>
                  )}
                </div>

                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "1.5px solid #5EEAD4",
                    background: "white",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#0F766E",
                    outline: "none",
                  }}
                >
                  <option value="all">
                    -- General / Entire Sub-Job Payment (FIFO Across Invoices) --
                  </option>
                  {invoicesWithBalances.map((inv) => (
                    <option key={inv._id || inv.id || inv.invoiceNo} value={inv._id || inv.id || inv.invoiceNo}>
                      {inv.invoiceNo} — Total: Rs {Number(inv.totalAmt || 0).toLocaleString("en-IN")} | Due: Rs {Number(inv.balance || 0).toLocaleString("en-IN")} {inv.balance <= 0 ? "✓ (Cleared)" : ""}
                    </option>
                  ))}
                </select>

                {selectedInvoice ? (
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, background: "white", padding: "8px 10px", borderRadius: 6, border: "1px solid #CCFBF1" }}>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Invoice No</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#0D9488", fontFamily: "monospace" }}>{selectedInvoice.invoiceNo}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Invoice Qty / Date</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>
                        {selectedInvoice.qty ? `${selectedInvoice.qty} pcs` : "—"} {selectedInvoice.date ? `· ${new Date(selectedInvoice.date).toLocaleDateString("en-IN")}` : ""}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Invoice Due</div>
                      <div style={{ fontSize: 12.5, fontWeight: 900, color: selectedInvoice.balance > 0 ? "#DC2626" : "#059669", fontFamily: "monospace" }}>
                        Rs {Number(selectedInvoice.balance || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#0D9488", marginTop: 6, fontWeight: 600 }}>
                    💡 Tip: Select a specific invoice above to record payment directly against that invoice number!
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>ℹ️</span>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                  No Tax Invoices generated yet for this sub-job. This payment will be recorded as an <b>Advance Payment</b>.
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
                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                  {selectedInvoice ? "Invoice Total" : "Total Amount"}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0C1A2E", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {Number(selectedInvoice ? selectedInvoice.totalAmt : (target.amount || target.amt || 0)).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase" }}>
                  {selectedInvoice ? "Invoice Paid" : "Paid So Far"}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#059669", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {Number(selectedInvoice ? selectedInvoice.paid : (target.paid || 0)).toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#EF4444", textTransform: "uppercase" }}>
                  {selectedInvoice ? "Invoice Due" : "Remaining Due"}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: "#EF4444", fontFamily: "monospace", marginTop: 2 }}>
                  Rs {Number(maxDue).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Direct Mode: Standard Payment Amount and TDS Fields */}
            {paymentSource === "direct" ? (
              <>
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
                                background: isFull ? "#15803D" : "#F0FDF4",
                                border: isFull ? "1.5px solid #15803D" : "1px solid #86EFAC",
                                borderRadius: 4,
                                padding: "2px 8px",
                                fontSize: 10.5,
                                fontWeight: 900,
                                color: isFull ? "#FFFFFF" : "#15803D",
                                cursor: "pointer",
                                boxShadow: isFull ? "0 2px 4px rgba(21,128,61,0.25)" : "none",
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
                    style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#059669", padding: "8px 12px" }}
                    autoFocus
                  />
                  {Number(payAmount) > maxDue && maxDue > 0 && (
                    <div style={{ color: "#EF4444", fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                      ⚠️ Payment cannot exceed exact invoice due of Rs {Number(maxDue).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>

                {/* TDS Tax Dropdown from Tax Master */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase" }}>
                      TDS Rate / Tax Master
                    </label>
                    {customerDefaultTax && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: selectedTdsTaxId === customerDefaultTax._id ? "#047857" : "#64748B",
                          background: selectedTdsTaxId === customerDefaultTax._id ? "#ECFDF5" : "#F1F5F9",
                          border: selectedTdsTaxId === customerDefaultTax._id ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                          padding: "1px 7px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                        title="Configured default in Customer Master"
                      >
                        <span>⭐ Customer Master:</span>
                        <b style={{ color: selectedTdsTaxId === customerDefaultTax._id ? "#065F46" : "#334155" }}>
                          {customerDefaultTax.tax_name || `${customerDefaultTax.tax_rate}%`}
                        </b>
                      </span>
                    )}
                  </div>
                  <select
                    className="sel"
                    value={selectedTdsTaxId}
                    onChange={(e) => handleTdsChange(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderColor: (customerDefaultTax && selectedTdsTaxId === customerDefaultTax._id) ? "#10B981" : undefined,
                      fontWeight: 700,
                    }}
                  >
                    <option value="">None (0%)</option>
                    {tdsTaxes.map((tax) => {
                      const isCustDefault = customerDefaultTax && String(customerDefaultTax._id) === String(tax._id);
                      return (
                        <option key={tax._id} value={tax._id}>
                          {tax.tax_name} ({tax.tax_rate}%){isCustDefault ? " ★ [Customer Master Default]" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* TDS Details Preview */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                      TDS Rate
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
                      Rs {currentTdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Total Net Payable (Bank Credit) Banner */}
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1.5px solid #16A34A",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                      Total Net Payable (Bank Credit)
                    </div>
                    <div style={{ fontSize: 10.5, color: "#166534", marginTop: 2 }}>
                      Payment Amount (Rs {numericPayAmt.toLocaleString("en-IN")}) − TDS ({tdsRate}% = Rs {currentTdsAmt.toLocaleString("en-IN")})
                    </div>
                    <div style={{ fontSize: 10.5, color: "#065F46", fontWeight: 700, marginTop: 3 }}>
                      ✓ Gross Settlement: <b>Rs {numericPayAmt.toLocaleString("en-IN")}</b> (Bank + TDS) clears the invoice balance
                    </div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#16A34A", fontFamily: "monospace", textAlign: "right" }}>
                    Rs {totalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                      Credit To Bank Account *
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
                        Cash Receipt / Voucher No *
                      </label>
                      <input
                        type="text"
                        className="inp"
                        value={cashVoucherNo || refNo}
                        onChange={(e) => {
                          setCashVoucherNo(e.target.value);
                          setRefNo(e.target.value);
                        }}
                        placeholder="e.g. CR-2026-0042"
                        style={{ padding: "7px 10px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                        Collected By (Staff Name)
                      </label>
                      <input
                        type="text"
                        className="inp"
                        value={cashCollectedBy}
                        onChange={(e) => setCashCollectedBy(e.target.value)}
                        placeholder="e.g. Ramesh (Accounts)"
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
                      placeholder="e.g. UTR20260904019 / Cheque #884120"
                      style={{ padding: "7px 10px" }}
                    />
                  </div>
                )}
              </>
            ) : (
              /* Unmatched Reconcile Flow: Allocation Amount, TDS & Formula Breakdown */
              <>
                {/* Allocation Amount */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase" }}>
                      Allocation Amount (Rs) *
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(() => {
                        const effectiveMax = Math.min(maxDue, selectedUnallocated?.remaining || 0);
                        const isFull = Number(payAmount) === Number(effectiveMax) && effectiveMax > 0;
                        const isHalf = Number(payAmount) === Math.round(effectiveMax / 2) && effectiveMax > 0 && !isFull;
                        return (
                          <>
                            <button
                              type="button"
                              style={{
                                background: isFull ? "#2563EB" : "#EFF6FF",
                                border: isFull ? "1.5px solid #2563EB" : "1px solid #93C5FD",
                                borderRadius: 4,
                                padding: "2px 8px",
                                fontSize: 10.5,
                                fontWeight: 900,
                                color: isFull ? "#FFFFFF" : "#1E40AF",
                                cursor: "pointer",
                                boxShadow: isFull ? "0 2px 4px rgba(37,99,235,0.25)" : "none",
                                transition: "all 0.15s ease",
                              }}
                              onClick={() => handleAmountChange(effectiveMax)}
                            >
                              {isFull ? "✓ " : ""}Reconcile Max (Rs {Math.round(effectiveMax).toLocaleString("en-IN")})
                            </button>
                            {effectiveMax > 1000 && (
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
                                onClick={() => handleAmountChange(Math.round(effectiveMax / 2))}
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
                    max={(() => {
                      const effectiveMax = Math.min(maxDue, selectedUnallocated?.remaining || 0);
                      return effectiveMax > 0 ? effectiveMax : undefined;
                    })()}
                    step="any"
                    value={payAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        handleAmountChange("");
                        return;
                      }
                      const num = parseFloat(v);
                      const effectiveMax = Math.min(maxDue, selectedUnallocated?.remaining || 0);
                      if (!isNaN(num) && effectiveMax > 0 && num > effectiveMax) {
                        handleAmountChange(effectiveMax);
                      } else {
                        handleAmountChange(v);
                      }
                    }}
                    placeholder={`Exact max: Rs ${Number(Math.min(maxDue, selectedUnallocated?.remaining || 0)).toLocaleString("en-IN")}`}
                    style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#2563EB", padding: "8px 12px" }}
                    autoFocus
                  />
                  {selectedUnallocated && Number(payAmount) > selectedUnallocated.remaining && (
                    <div style={{ color: "#EF4444", fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                      ⚠️ Allocation cannot exceed available unmatched balance of Rs {Number(selectedUnallocated.remaining).toLocaleString("en-IN")}
                    </div>
                  )}
                  {Number(payAmount) > maxDue && maxDue > 0 && (
                    <div style={{ color: "#EF4444", fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                      ⚠️ Payment cannot exceed exact invoice due of Rs {Number(maxDue).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>

                {/* TDS Rate / Tax Master Dropdown for Reconcile */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase" }}>
                      TDS Rate / Tax Master
                    </label>
                    {customerDefaultTax && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: selectedTdsTaxId === customerDefaultTax._id ? "#047857" : "#64748B",
                          background: selectedTdsTaxId === customerDefaultTax._id ? "#ECFDF5" : "#F1F5F9",
                          border: selectedTdsTaxId === customerDefaultTax._id ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                          padding: "1px 7px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                        title="Configured default in Customer Master"
                      >
                        <span>⭐ Customer Master:</span>
                        <b style={{ color: selectedTdsTaxId === customerDefaultTax._id ? "#065F46" : "#334155" }}>
                          {customerDefaultTax.tax_name || `${customerDefaultTax.tax_rate}%`}
                        </b>
                      </span>
                    )}
                  </div>
                  <select
                    className="sel"
                    value={selectedTdsTaxId}
                    onChange={(e) => handleTdsChange(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderColor: (customerDefaultTax && selectedTdsTaxId === customerDefaultTax._id) ? "#10B981" : undefined,
                      fontWeight: 700,
                    }}
                  >
                    <option value="">None (0%)</option>
                    {tdsTaxes.map((tax) => {
                      const isCustDefault = customerDefaultTax && String(customerDefaultTax._id) === String(tax._id);
                      return (
                        <option key={tax._id} value={tax._id}>
                          {tax.tax_name} ({tax.tax_rate}%){isCustDefault ? " ★ [Customer Master Default]" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Advance Reconciliation & Deduction Formula Card */}
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1.5px solid #16A34A",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 14,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 900, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>📐</span>
                      <span>Advance Reconciliation Breakdown</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, background: "#DCFCE7", color: "#15803D", padding: "2px 8px", borderRadius: 4, border: "1px solid #BBF7D0" }}>
                      Logic: Total − Advance So Far − TDS − Allocated
                    </span>
                  </div>

                  <div style={{ background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid #BBF7D0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, paddingBottom: 5 }}>
                      <span style={{ color: "#334155", fontWeight: 700 }}>
                        1. {selectedInvoice ? "Invoice Total Amount" : "Sub-Job Total Amount"}
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 900, color: "#0F172A" }}>
                        Rs {selectedInvoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, paddingBottom: 5 }}>
                      <span style={{ color: "#059669", fontWeight: 700 }}>
                        2. Minus Advance Paid So Far (−)
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 900, color: "#059669" }}>
                        − Rs {selectedInvoicePaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, paddingBottom: 5 }}>
                      <span style={{ color: "#DC2626", fontWeight: 700 }}>
                        3. Minus TDS Deducted ({tdsRate}% on {numericPayAmt > 0 ? `Rs ${numericPayAmt.toLocaleString("en-IN")}` : "Allocation"}) (−)
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 900, color: "#DC2626" }}>
                        − Rs {currentTdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, paddingBottom: 5 }}>
                      <span style={{ color: "#2563EB", fontWeight: 700 }}>
                        4. Minus Advance Allocated ({selectedUnallocated?.receiptNo || "Receipt"}) (−)
                      </span>
                      <span style={{ fontFamily: "monospace", fontWeight: 900, color: "#2563EB" }}>
                        − Rs {numericPayAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ borderTop: "1.5px dashed #CBD5E1", margin: "6px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 900, color: "#1E40AF" }}>
                          = Remaining Invoice Due After Settle:
                        </span>
                        <div style={{ fontSize: 10, color: "#64748B", marginTop: 1 }}>
                          Total ({selectedInvoiceTotal.toLocaleString("en-IN")}) − Paid ({selectedInvoicePaid.toLocaleString("en-IN")}) − TDS ({currentTdsAmt.toLocaleString("en-IN")}) − Allocated ({numericPayAmt.toLocaleString("en-IN")})
                        </div>
                      </div>
                      <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 15, color: "#1E40AF" }}>
                        Rs {Math.max(0, Math.round((selectedInvoiceTotal - selectedInvoicePaid - currentTdsAmt - numericPayAmt) * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Unmatched Reconcile Summary */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1.5px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📋</span>
                    <span>Reconciliation Accounting Summary</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "white", padding: "10px 12px", borderRadius: 8, border: "1px solid #E2E8F0", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Original Payment Mode</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedUnallocated?.mode || "NEFT"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Reference / UTR</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", marginTop: 2 }}>{selectedUnallocated?.referenceNo || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Original Payment Date</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{selectedUnallocated?.date || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Bank Credit Status</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#059669", marginTop: 2 }}>✓ Already Credited</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                    💡 <b>No duplicate bank entry:</b> The client's funds were already deposited and verified in company accounts under <b>{selectedUnallocated?.receiptNo}</b>. This will deduct <b>Rs {Number(numericPayAmt + currentTdsAmt).toLocaleString("en-IN")}</b> (Bank: Rs {numericPayAmt.toLocaleString("en-IN")}{currentTdsAmt > 0 ? ` + TDS: Rs ${currentTdsAmt.toLocaleString("en-IN")}` : ""}) from the outstanding invoice balance.
                  </div>
                </div>
              </>
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
                placeholder="Optional payment notes"
                style={{ padding: "7px 10px" }}
              />
            </div>

            {/* Payment Proofs Upload - Direct Payment only (For reconcile, proof is already linked from unmatched receipt) */}
            {paymentSource === "direct" && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#0C1A2E", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                    <span>Receipt / Payment Proofs</span>
                    <span style={{ fontSize: 12, color: "#dc2626ff", fontWeight: 900 }}>*</span>
                    {attachmentFiles.length > 0 && (
                      <span style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 900 }}>
                        {attachmentFiles.length} {attachmentFiles.length === 1 ? "file" : "files"}
                      </span>
                    )}
                  </label>
                  {attachmentFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllFiles}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#EF4444",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        padding: "0 4px",
                      }}
                    >
                      ✕ Clear All
                    </button>
                  )}
                </div>

                {/* List of uploaded files */}
                {attachmentFiles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>
                    {attachmentFiles.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 10px",
                          border: "1px solid #A7F3D0",
                          borderRadius: 8,
                          background: "#ECFDF5",
                        }}
                      >
                        {item.isImage && item.preview ? (
                          <img
                            src={item.preview}
                            alt="Receipt preview"
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: "cover",
                              borderRadius: 6,
                              border: "1px solid #6EE7B7",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              background: "#CCFBF1",
                              border: "1px solid #99F6E4",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            📄
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#065F46",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#047857", marginTop: 1 }}>
                            {(item.size / 1024).toFixed(1)} KB · Ready to upload
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#94A3B8",
                            fontSize: 14,
                            fontWeight: 900,
                            cursor: "pointer",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropzone / Upload button */}
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: attachmentFiles.length > 0 ? "8px 12px" : "12px 14px",
                    border: attachmentFiles.length > 0 ? "1.5px dashed #A7F3D0" : "1.5px dashed #e0d9d9ff",
                    borderRadius: 8,
                    background: attachmentFiles.length > 0 ? "#F8FAFC" : "#FFF1F2",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: attachmentFiles.length > 0 ? "#0D9488" : "#E11D48", fontWeight: 800, fontSize: 12 }}>
                    <span style={{ fontSize: 16 }}>{attachmentFiles.length > 0 ? "➕" : "📎"}</span>
                    {attachmentFiles.length > 0 ? "Add More Proofs / Receipts" : "Upload Receipts / Screenshots / Slips"}
                  </div>
                  <span style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>
                    Select one or multiple files · PNG, JPG, JPEG, WEBP or PDF (Max 10MB each)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Sticky Footer Actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              alignItems: "center",
              padding: "12px 18px",
              background: "#F8FAFC",
              borderTop: "1px solid #E2E8F0",
              flexShrink: 0,
            }}
          >
            {paymentSource === "direct" && payMode === "Cash" && (
              <button
                type="button"
                className="btn bs"
                style={{ background: "#F0FDFA", borderColor: "#99F6E4", color: "#0D9488", fontWeight: 800 }}
                onClick={() =>
                  generateCashVoucherPDF({
                    subJobNo: target.sub_job_no,
                    clientName: target.clientName || target.client,
                    amount: totalPayable,
                    tdsAmount: currentTdsAmt,
                    grossAmount: numericPayAmt,
                    personName: cashCollectedBy,
                    voucherNo: cashVoucherNo || refNo,
                    date: payDate,
                    notes: notes,
                  })
                }
              >
                📄 Print Cash Receipt PDF
              </button>
            )}
            <button
              type="button"
              className="btn bs"
              style={{ background: "white", borderColor: "#CBD5E1", color: "#64748B" }}
              onClick={onClose}
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={paymentSource === "unmatched" ? "btn bs" : "btn bs bg"}
              disabled={isBusy || isAlreadyPaid || maxDue <= 0 || (paymentSource === "unmatched" && !selectedUnallocated)}
              style={{
                padding: "8px 20px",
                fontSize: 12.5,
                fontWeight: 900,
                opacity: (isBusy || isAlreadyPaid || maxDue <= 0 || (paymentSource === "unmatched" && !selectedUnallocated)) ? 0.6 : 1,
                cursor: (isBusy || isAlreadyPaid || maxDue <= 0 || (paymentSource === "unmatched" && !selectedUnallocated)) ? "not-allowed" : "pointer",
                background: isAlreadyPaid
                  ? "#94A3B8"
                  : paymentSource === "unmatched"
                    ? "#2563EB"
                    : undefined,
                color: isAlreadyPaid
                  ? "white"
                  : paymentSource === "unmatched"
                    ? "#FFFFFF"
                    : undefined,
                borderColor: isAlreadyPaid
                  ? "#94A3B8"
                  : paymentSource === "unmatched"
                    ? "#1D4ED8"
                    : undefined,
              }}
            >
              {isBusy
                ? "⏳ Processing..."
                : isAlreadyPaid
                  ? "✓ Already Fully Paid"
                  : paymentSource === "unmatched"
                    ? `🔗 Reconcile & Settle (Rs ${Number(payAmount || 0).toLocaleString("en-IN")})`
                    : "✅ Record Payment"}
            </button>
          </div>
        </form>
      </div>

      {/* Proof Preview In-App Modal */}
      {previewProof && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setPreviewProof(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              maxWidth: "92vw",
              maxHeight: "90vh",
              width: 720,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1.5px solid rgba(204, 220, 218, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 18 }}>📎</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0F172A",
                    maxWidth: 440,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={previewProof.name}
                >
                  {previewProof.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <a
                  href={
                    previewProof.url.startsWith("data:") || previewProof.url.includes("X-Amz-Signature") || previewProof.url.includes("AWSAccessKeyId")
                      ? previewProof.url
                      : `${backendUrl ? backendUrl.replace(/\/$/, "") : ""}/image/view?url=${encodeURIComponent(previewProof.url)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#0284C7",
                    background: "#E0F2FE",
                    padding: "4px 10px",
                    borderRadius: 5,
                    textDecoration: "none",
                    border: "1px solid #BAE6FD",
                  }}
                >
                  Open in New Tab ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewProof(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                    color: "#64748B",
                    fontWeight: 900,
                    padding: "0 4px",
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
                overflow: "auto",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#0F172A",
                minHeight: 340,
              }}
            >
              {previewProof.url.toLowerCase().includes(".pdf") || previewProof.name.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewProof.url}
                  title={previewProof.name}
                  style={{ width: "100%", height: "68vh", border: "none", borderRadius: 8, background: "white" }}
                />
              ) : (
                <img
                  src={previewProof.url}
                  alt={previewProof.name}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "72vh",
                    objectFit: "contain",
                    borderRadius: 8,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
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

// Payment Receipt & Overview Modal
