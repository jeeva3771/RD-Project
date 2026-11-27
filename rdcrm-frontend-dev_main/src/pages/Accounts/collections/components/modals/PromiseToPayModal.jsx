import React, { useState } from "react";
import { toast } from "react-toastify";
import { TODAY } from "../../constants/collectionsConstants";
import { inr } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function PromiseToPayModal({ caseObj, onClose, onConfirm }) {
  const todayIso =
    TODAY.getFullYear() +
    "-" +
    String(TODAY.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(TODAY.getDate()).padStart(2, "0");

  const [promisedDate, setPromisedDate] = useState(
    caseObj.promisedDateIso
      ? caseObj.promisedDateIso.slice(0, 10)
      : todayIso
  );
  const [promisedAmount, setPromisedAmount] = useState(
    caseObj.promisedAmount != null ? caseObj.promisedAmount : (caseObj.total || 0)
  );
  const [note, setNote] = useState(caseObj.promisedNote || "");

  const submit = () => {
    if (!promisedDate) {
      toast.warning("Please select a promised payment date");
      return;
    }
    const amt = promisedAmount ? Number(promisedAmount) : 0;
    onConfirm({
      promisedDate,
      promisedAmount: amt > 0 ? amt : null,
      note: note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-5 py-3.5 border-b border-teal-100 flex items-center justify-between bg-teal-50/80">
          <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
            <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
              <CollectionIcon name="calendar" size={13} />
            </div>
            Record Promise to Pay
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-teal-100 flex items-center justify-center text-teal-700 hover:text-teal-900 transition"
          >
            <CollectionIcon name="x" size={15} />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400 font-medium">Client</div>
              <div className="font-bold text-slate-800 text-sm">{caseObj.client}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 font-medium">Total Balance Due</div>
              <div className="font-extrabold text-teal-700 text-sm">{inr(caseObj.total)}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Promised Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={promisedDate}
              min={todayIso}
              onChange={(e) => setPromisedDate(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 font-semibold text-slate-800 bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Select the date client committed to make payment.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Promised Amount (₹)
            </label>
            <input
              type="number"
              value={promisedAmount}
              onChange={(e) => setPromisedAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 font-semibold text-slate-800 bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Defaulted to full balance. Change if partial payment or installment was promised.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Commitment Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Spoke with client accounts; committed to deposit cheque/RTGS by 3 PM."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 text-slate-800 bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <CollectionIcon name="check" size={13} />
              Save Commitment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

