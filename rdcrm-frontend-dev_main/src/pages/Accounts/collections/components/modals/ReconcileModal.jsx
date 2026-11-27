import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../../utils/url/config";
import { inr } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function ReconcileModal({ unallocated, invoices, onClose, onAllocate, clientName, clientId }) {
  const remaining =
    unallocated.amount -
    unallocated.allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
  const [invoiceId, setInvoiceId] = useState(invoices[0] ? invoices[0].id : "");
  const [amount, setAmount] = useState(
    invoices[0] ? Number(Math.min(remaining, invoices[0].balance)).toFixed(2) : "0.00"
  );
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
        const cName = (clientName || unallocated.client || "").trim();
        const cId = clientId;
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
  }, [clientName, unallocated.client, clientId]);

  const handleInvoiceChange = (id) => {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    setAmount(inv ? Number(Math.min(remaining, inv.balance)).toFixed(2) : "0.00");
  };

  const handleAmountChange = (rawVal) => {
    if (rawVal === "" || rawVal === null || rawVal === undefined) {
      setAmount("");
      return;
    }
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

  const selectedInv = invoices.find((i) => String(i.id) === String(invoiceId)) || invoices[0];
  const invTotal = Number(selectedInv?.amount || 0);
  const invPaid = Number(selectedInv?.received || (invTotal - Number(selectedInv?.balance || 0)) || 0);
  const invDue = Number(selectedInv?.balance || 0);

  const numericAlloc = Number(amount || 0);
  // Calculate TDS on partial allocation amount
  const currentTdsAmt = Math.round((numericAlloc * (Number(tdsRate || 0) / 100)) * 100) / 100;
  const grossSettlement = Math.round((numericAlloc + currentTdsAmt) * 100) / 100;
  const remainingInvoiceDueAfter = Math.max(
    0,
    Math.round((invTotal - invPaid - currentTdsAmt - numericAlloc) * 100) / 100
  );

  const submit = () => {
    const amt = Number(amount);
    if (!invoiceId || !amt || amt <= 0 || amt > remaining) {
      toast.warning("Please enter a valid allocation amount within remaining balance");
      return;
    }
    if (amt > invDue && invDue > 0) {
      toast.error(`Allocation amount (${inr(amt)}) cannot exceed remaining invoice due of ${inr(invDue)}`);
      return;
    }
    onAllocate(unallocated.id, invoiceId, amt, {
      tds_amount: currentTdsAmt,
      tds_rate: Number(tdsRate || 0),
      tds_tax: selectedTdsTaxId || null,
      total_payable: amt,
      gross_amount: grossSettlement,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/70 shrink-0">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <CollectionIcon name="link" size={16} className="text-indigo-600" /> Reconcile Unmatched Payment
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <CollectionIcon name="x" size={15} />
          </button>
        </div>
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300">
          {/* Source Unmatched Receipt Details */}
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-700 font-mono text-[13px]">
                {unallocated.receiptNo || "UNMATCHED"}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {unallocated.date} • {unallocated.mode}
                {unallocated.refNo ? " (Ref: " + unallocated.refNo + ")" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11.5px]">
              <span className="text-slate-500">
                Original Receipt Total: <b className="text-slate-800 font-mono">{inr(unallocated.amount)}</b>
              </span>
              <span className="text-indigo-700 font-bold">
                Available to Reconcile: <b className="font-mono text-indigo-900">{inr(remaining)}</b>
              </span>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-6 text-center">
              No open invoices remaining for this client.
            </div>
          ) : (
            <React.Fragment>
              {/* Target Invoice */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Target Invoice to Settle ({invoices.length} available)
                </label>
                <select
                  value={invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white font-medium"
                >
                  {invoices.map((i) => (
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
                      <div className="text-[9.5px] font-bold uppercase text-emerald-600">Invoice Paid</div>
                      <div className="text-xs font-black text-emerald-700 font-mono mt-0.5">{inr(invPaid)}</div>
                    </div>
                    <div>
                      <div className="text-[9.5px] font-bold uppercase text-rose-600">Invoice Due</div>
                      <div className="text-xs font-black text-rose-700 font-mono mt-0.5">{inr(invDue)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* TDS Rate / Tax Master Selector */}
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white font-semibold text-slate-700"
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

              {/* Advance Reconciliation Breakdown Box */}
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <span>📐</span>
                    <span>Advance Reconciliation Breakdown</span>
                  </div>
                  <span className="text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Logic: Total − Advance So Far − TDS − Allocated
                  </span>
                </div>

                <div className="bg-white rounded-lg p-3 border border-emerald-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold">1. Invoice Total Amount</span>
                    <span className="font-mono font-bold text-slate-900">{inr(invTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700">
                    <span className="font-semibold">2. Minus Advance Paid So Far (−)</span>
                    <span className="font-mono font-bold">− {inr(invPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-600">
                    <span className="font-semibold">
                      3. Minus TDS Deducted ({tdsRate}% on {inr(numericAlloc)}) (−)
                    </span>
                    <span className="font-mono font-bold">− {inr(currentTdsAmt)}</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-700">
                    <span className="font-semibold">
                      4. Minus Advance Allocated ({unallocated.receiptNo || "Receipt"}) (−)
                    </span>
                    <span className="font-mono font-bold">− {inr(numericAlloc)}</span>
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-1.5" />

                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-black text-indigo-900 text-[12.5px]">
                        = Remaining Invoice Due After Settle:
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Total ({inr(invTotal)}) − Paid ({inr(invPaid)}) − TDS ({inr(currentTdsAmt)}) − Allocated ({inr(numericAlloc)})
                      </div>
                    </div>
                    <span className="font-mono font-black text-indigo-900 text-sm">
                      {inr(remainingInvoiceDueAfter)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount to Allocate with Quick Actions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Amount to Allocate (Max: {inr(remaining)})
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAmount(Number(Math.min(remaining, invDue)).toFixed(2))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                    >
                      Reconcile Max ({inr(Math.min(remaining, invDue))})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(Number(Math.min(remaining, invDue) * 0.5).toFixed(2))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition"
                    >
                      50%
                    </button>
                  </div>
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 font-bold font-mono text-slate-800"
                  placeholder="0.00"
                />
              </div>
            </React.Fragment>
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          {invoices.length > 0 && (
            <button
              onClick={submit}
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <CollectionIcon name="link" size={13} /> Reconcile & Settle ({inr(numericAlloc)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
