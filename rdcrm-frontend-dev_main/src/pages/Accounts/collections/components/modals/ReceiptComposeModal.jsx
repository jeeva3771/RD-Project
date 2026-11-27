import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../../utils/url/config";
import { TODAY } from "../../constants/collectionsConstants";
import { inr, formatDate } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function ReceiptComposeModal({ caseObj, onClose, onConfirm, onConfirmUnallocated, bankAccounts = [] }) {
  const unpaidInvoices = caseObj.invoices.filter((i) => i.balance > 0);
  const [matched, setMatched] = useState(true);
  const [invoiceId, setInvoiceId] = useState(unpaidInvoices[0] ? unpaidInvoices[0].id : "");
  const [amount, setAmount] = useState(unpaidInvoices[0] ? Number(unpaidInvoices[0].balance).toFixed(2) : "0.00");
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?._id || "");
  const todayIso =
    TODAY.getFullYear() +
    "-" +
    String(TODAY.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(TODAY.getDate()).padStart(2, "0");
  const [date, setDate] = useState(todayIso);
  const [mode, setMode] = useState("NEFT");
  const [refNo, setRefNo] = useState("");
  const [confirmedBy, setConfirmedBy] = useState("Accounts Team");
  const [proofFiles, setProofFiles] = useState([]);
  const [proofError, setProofError] = useState(false);

  // TDS configuration for matched invoice receipt (Direct New Payment logic)
  const [tdsTaxes, setTdsTaxes] = useState([]);
  const [selectedTdsTaxId, setSelectedTdsTaxId] = useState("");
  const [tdsRate, setTdsRate] = useState(0);
  const [customerDefaultTax, setCustomerDefaultTax] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadTdsAndCustomer = async () => {
      try {
        let activeTds = [];
        try {
          const taxRes = await axiosInstance.get("/taxmaster", {
            params: { limit: "all", status: true },
          });
          if (taxRes.data?.success && Array.isArray(taxRes.data.data)) {
            activeTds = taxRes.data.data.filter((t) => t.tax_type === "TDS" && t.is_active);
            if (isMounted) setTdsTaxes(activeTds);
          }
        } catch (e) {
          console.warn("Could not load tax master:", e);
        }

        let custData = null;
        const cName = (caseObj?.client || "").trim();
        const cId = caseObj?.client_id;
        if (cId && typeof cId === "string" && /^[0-9a-fA-F]{24}$/.test(cId)) {
          try {
            const custRes = await axiosInstance.get(`/customer/${cId}`);
            if (custRes.data?.success && custRes.data.data) custData = custRes.data.data;
          } catch {
            /* ignore */
          }
        }
        if (!custData && cName) {
          try {
            const sRes = await axiosInstance.get("/customer", { params: { search: cName, limit: 10 } });
            if (sRes.data?.success && Array.isArray(sRes.data.data)) {
              custData = sRes.data.data.find(
                (it) => (it.name || "").toLowerCase().trim() === cName.toLowerCase().trim()
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
            matchedTax = activeTds.find((t) => String(t._id) === String(masterTdsTaxId));
          }
          if (!matchedTax && masterTdsRate > 0) {
            matchedTax = activeTds.find((t) => Number(t.tax_rate) === masterTdsRate);
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
        console.warn("Error loading TDS:", err);
      }
    };
    loadTdsAndCustomer();
    return () => {
      isMounted = false;
    };
  }, [caseObj?.client, caseObj?.client_id]);

  const handleInvoiceChange = (id) => {
    setInvoiceId(id);
    const inv = caseObj.invoices.find((i) => i.id === id);
    setAmount(inv ? Number(inv.balance).toFixed(2) : "0.00");
  };

  const handleAmountChange = (rawVal) => {
    if (rawVal === "" || rawVal === null || rawVal === undefined) {
      setAmount("");
      return;
    }
    // Only allow numbers and decimal dot
    let val = String(rawVal).replace(/[^0-9.]/g, "");
    const parts = val.split(".");
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("");
    }
    if (val.includes(".")) {
      const [intPart, decPart] = val.split(".");
      val = `${intPart}.${decPart.slice(0, 2)}`;
    }
    setAmount(val);
  };

  const handleTdsChange = (taxId) => {
    setSelectedTdsTaxId(taxId);
    if (!taxId) {
      setTdsRate(0);
      return;
    }
    const found = tdsTaxes.find((t) => String(t._id) === String(taxId));
    if (found) {
      setTdsRate(Number(found.tax_rate || 0));
    } else {
      setTdsRate(0);
    }
  };

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const newItems = selected.map((file) => {
      let preview = null;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }
      return {
        id: file.name + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
      };
    });

    setProofFiles((prev) => [...prev, ...newItems]);
    setProofError(false);
    e.target.value = "";
  };

  const removeProof = (id) => {
    setProofFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Selected invoice metrics
  const selectedInv = caseObj.invoices.find((i) => String(i.id) === String(invoiceId)) || unpaidInvoices[0];
  const invTotal = Number(selectedInv?.amount || 0);
  const invPaid = Number(selectedInv?.received || (invTotal - Number(selectedInv?.balance || 0)) || 0);
  const invDue = Number(selectedInv?.balance || 0);

  // Direct New Payment calculation:
  // Entered amount is the Gross Settlement amount (clearing invoice balance)
  const numericGross = Number(amount || 0);
  const currentTdsAmt = matched
    ? Math.round((numericGross * (Number(tdsRate || 0) / 100)) * 100) / 100
    : 0;
  // Net bank credit to be received
  const netBankCredit = matched
    ? Math.max(0, Math.round((numericGross - currentTdsAmt) * 100) / 100)
    : numericGross;

  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.warning("Please enter a valid receipt amount");
      return;
    }
    if (matched && amt > invDue && invDue > 0) {
      toast.error(`Gross settlement amount (${inr(amt)}) cannot exceed remaining invoice due of ${inr(invDue)}`);
      return;
    }
    if (!proofFiles.length) {
      setProofError(true);
      toast.error("Payment proof is mandatory! Please upload at least one transaction receipt or screenshot.");
      return;
    }
    const rawFiles = proofFiles.map((p) => p.file);
    if (matched) {
      if (!invoiceId) {
        toast.warning("Please select an invoice to allocate payment");
        return;
      }
      onConfirm({
        invoiceId,
        sub_job_no: selectedInv?.sub_job_no || "",
        invoiceNo: selectedInv?.invoiceNo || invoiceId,
        amount: netBankCredit,
        tds_amount: currentTdsAmt,
        tds_rate: Number(tdsRate || 0),
        tds_tax: selectedTdsTaxId || null,
        total_payable: netBankCredit,
        gross_amount: numericGross,
        dateLabel: formatDate(new Date(date)),
        dateObj: new Date(date),
        mode,
        refNo,
        bankAccountId: mode === "Cash" ? null : bankAccountId,
        confirmedBy: confirmedBy.trim() || "Accounts Team",
        proofFiles: rawFiles,
      });
      toast.success(
        "Receipt of " + inr(netBankCredit) + (currentTdsAmt > 0 ? " (TDS: " + inr(currentTdsAmt) + ")" : "") + " recorded successfully with proof"
      );
    } else {
      onConfirmUnallocated({
        amount: amt,
        dateLabel: formatDate(new Date(date)),
        dateObj: new Date(date),
        mode,
        refNo,
        bankAccountId: mode === "Cash" ? null : bankAccountId,
        confirmedBy: confirmedBy.trim() || "Accounts Team",
        proofFiles: rawFiles,
      });
      toast.info(
        "Unmatched payment of " + inr(amt) + " logged with proof (" + rawFiles.length + " file" + (rawFiles.length === 1 ? "" : "s") + ")"
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70 shrink-0">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <CollectionIcon name="check" size={16} className="text-emerald-600" /> Record Client Receipt
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <CollectionIcon name="x" size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300">
          {/* Tabs: Matched vs Unmatched */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMatched(true)}
              className={
                "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition " +
                (matched
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "text-slate-600 border-slate-200 hover:bg-slate-50")
              }
            >
              Matched to Invoice
            </button>
            <button
              type="button"
              onClick={() => setMatched(false)}
              className={
                "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition " +
                (!matched
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                  : "text-slate-600 border-slate-200 hover:bg-slate-50")
              }
            >
              Unmatched Payment
            </button>
          </div>

          {!matched && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <CollectionIcon name="alert" size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                This will be logged as an unallocated receipt on {caseObj.client}'s account.
                Officers will see an alert not to chase the client until reconciled.
              </span>
            </div>
          )}

          {matched && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Target Invoice to Settle ({unpaidInvoices.length} open)
              </label>
              <select
                value={invoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-white font-medium"
              >
                {unpaidInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNo} — Total: {inr(i.amount)} | Due: {inr(i.balance)}
                  </option>
                ))}
              </select>

              {selectedInv && (
                <div className="grid grid-cols-3 gap-2 mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <div>
                    <div className="text-[9.5px] font-bold uppercase text-slate-400">Invoice Total</div>
                    <div className="text-xs font-black text-slate-800 font-mono mt-0.5">{inr(invTotal)}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-bold uppercase text-emerald-600">Already Paid</div>
                    <div className="text-xs font-black text-emerald-700 font-mono mt-0.5">{inr(invPaid)}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-bold uppercase text-rose-600">Remaining Due</div>
                    <div className="text-xs font-black text-rose-700 font-mono mt-0.5">{inr(invDue)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Input with Quick Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Amount Received (₹)
              </label>
              {matched && invDue > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(Number(invDue).toFixed(2))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    Reconcile Max ({inr(invDue)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(Number(invDue * 0.5).toFixed(2))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition"
                  >
                    50%
                  </button>
                </div>
              )}
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onBlur={() => {
                if (amount !== "" && !isNaN(Number(amount)) && Number(amount) > 0) {
                  setAmount(Number(amount).toFixed(2));
                }
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 font-bold font-mono text-slate-800"
              placeholder="0.00"
            />
          </div>

          {/* TDS Rate / Tax Master Selector (when Matched) */}
          {matched && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  TDS Rate / Tax Master
                </label>
                {customerDefaultTax && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span>★ Customer Default:</span>
                    <b>{customerDefaultTax.tax_name || `${customerDefaultTax.tax_rate}%`}</b>
                  </span>
                )}
              </div>
              <select
                value={selectedTdsTaxId}
                onChange={(e) => handleTdsChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-white font-semibold text-slate-700"
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
          )}

          {/* Direct New Payment TDS & Net Payable Banner */}
          {matched && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                    Total Net Payable (Bank Credit)
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    Gross Settlement ({inr(numericGross)}) − TDS ({tdsRate}% = {inr(currentTdsAmt)})
                  </div>
                  <div className="text-[10px] text-emerald-900 font-bold mt-1">
                    ✓ Gross Settlement: <b>{inr(numericGross)}</b> (Bank + TDS) clears the invoice balance
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                    {inr(netBankCredit)}
                  </div>
                  {currentTdsAmt > 0 && (
                    <div className="text-[10.5px] font-bold text-rose-600 font-mono">
                      TDS: −{inr(currentTdsAmt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Payment Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-white"
              >
                {["NEFT", "RTGS", "UPI", "Cheque", "Cash"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Payment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Reference / UTR No.
              </label>
              <input
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="UTR / Cheque Number"
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
            {mode !== "Cash" && bankAccounts.length > 0 ? (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Deposit Bank Account
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-white"
                >
                  <option value="">-- Select Bank Account --</option>
                  {bankAccounts.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.label || `${b.bank_name} (${b.account_number_masked})`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Confirmed By (Accounts)
                </label>
                <input
                  value={confirmedBy}
                  onChange={(e) => setConfirmedBy(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                />
              </div>
            )}
          </div>

          {mode !== "Cash" && bankAccounts.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Confirmed By (Accounts)
              </label>
              <input
                value={confirmedBy}
                onChange={(e) => setConfirmedBy(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          )}

          {/* Payment Proof Attachment (Mandatory Multi-Upload) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <span>Payment Proof / Receipt Vouchers</span>
                <span className="text-rose-500 font-extrabold text-xs">*</span>
                {proofFiles.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                    {proofFiles.length} attached
                  </span>
                )}
              </label>
              {proofFiles.length > 0 && (
                <label className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-1">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFilesChange}
                    className="hidden"
                  />
                  <span>+ Add More Files</span>
                </label>
              )}
            </div>

            {proofFiles.length === 0 ? (
              <label
                className={
                  "border-2 border-dashed rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer transition text-center group " +
                  (proofError
                    ? "border-rose-400 bg-rose-50/70"
                    : "border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 bg-slate-50/50")
                }
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFilesChange}
                  className="hidden"
                />
                <div
                  className={
                    "w-8 h-8 rounded-full flex items-center justify-center transition mb-1 " +
                    (proofError
                      ? "bg-rose-100 text-rose-600"
                      : "bg-emerald-100 text-emerald-700 group-hover:scale-105")
                  }
                >
                  <CollectionIcon name="link" size={15} />
                </div>
                <div className="text-xs font-bold text-slate-700">
                  Click to Upload Payment Proof(s)
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Screenshots, Bank UTR Slips, or PDF Vouchers • Multiple files allowed
                </div>
                {proofError && (
                  <div className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                    <CollectionIcon name="alert" size={11} /> Proof is required to record this receipt
                  </div>
                )}
              </label>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin p-1 rounded-xl border border-slate-200 bg-slate-50/60">
                {proofFiles.map((item) => (
                  <div
                    key={item.id}
                    className="border border-emerald-200 bg-white rounded-lg p-2 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt="Proof"
                          className="w-8 h-8 object-cover rounded-md border border-emerald-300 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-[9px]">
                          PDF
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {(item.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProof(item.id)}
                      className="w-6 h-6 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition shrink-0"
                      title="Remove file"
                    >
                      <CollectionIcon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className={
              "text-xs font-bold text-white px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition " +
              (matched ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700")
            }
          >
            <CollectionIcon name="check" size={13} />
            {matched ? `Confirm Receipt (${inr(numericGross)})` : "Record Unmatched Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
