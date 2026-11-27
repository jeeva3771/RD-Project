import React, { useState } from "react";
import { inr, outstanding, dfmt, todayISO } from "../../utils/helpers";

const CollectionsPanel = ({ s, set, client, f }) => {
  const due = outstanding(s, f);
  const [log, setLog] = useState(null);
  const [pay, setPay] = useState(null);

  if (!s.deliveredAt && due <= 0) return null;

  const fu = s.followups || [];
  const receipts = [s.balRcpt, ...(s.collRcpts || [])].filter(Boolean);

  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">💰</span>
        <div>
          <h4 className="font-bold text-sm text-gray-900">Collections & Balance Payment</h4>
          <p className="text-[11px] text-gray-500">
            Track outstanding balance payments, log collection follow-ups, and record settlements.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={`p-3 rounded-xl border ${due > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <span className="text-[10px] font-bold text-gray-500 block">Balance Outstanding</span>
          <b className={`text-lg font-black block mt-0.5 ${due > 0 ? "text-amber-900" : "text-emerald-800"}`}>
            {due > 0 ? inr(due) : "Fully Settled ✓"}
          </b>
        </div>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <span className="text-[10px] font-bold text-gray-500 block">Payment Terms</span>
          <b className="text-sm font-bold text-gray-900 block mt-1">
            {client?.terms || "50% advance against order"}
          </b>
        </div>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-gray-500 block">Billed To</span>
          <b className="text-sm font-bold text-gray-900 block mt-1 truncate">
            {s.billTo?.name || client?.name || "Client"}
          </b>
        </div>
      </div>

      {/* Payment Receipts History */}
      {receipts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <label className="font-bold text-gray-700 block">Payments Recorded:</label>
          {receipts.map((r, i) => (
            <div key={i} className="flex justify-between items-center p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 font-medium">
              <span>
                {dfmt(r.date)} · {inr(r.amount)} received via {r.mode}
                {r.ref ? ` (${r.ref})` : ""}
              </span>
              <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                Receipt saved ✓
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Form */}
      {due > 0 && (
        <div className="pt-2">
          {!pay ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg shadow-2xs transition cursor-pointer"
                onClick={() => setPay({ amount: due, date: todayISO(), mode: "NEFT", ref: "" })}
              >
                Record payment received
              </button>
              {!log && (
                <button
                  type="button"
                  className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                  onClick={() => setLog({ via: "Call", note: "", promise: "" })}
                >
                  + Log follow-up call/msg
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
              <h5 className="font-bold text-gray-900">Record balance payment</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg bg-white outline-none"
                    value={pay.amount}
                    onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">Payment Mode</label>
                  <select
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg bg-white outline-none"
                    value={pay.mode}
                    onChange={(e) => setPay({ ...pay, mode: e.target.value })}
                  >
                    <option>NEFT</option>
                    <option>RTGS</option>
                    <option>IMPS</option>
                    <option>UPI</option>
                    <option>Cheque</option>
                    <option>Cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">UTR / Ref No.</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR9012384"
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg bg-white outline-none"
                    value={pay.ref}
                    onChange={(e) => setPay({ ...pay, ref: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg shadow-2xs cursor-pointer"
                  onClick={() => {
                    const newRec = { ...pay, at: new Date().toISOString() };
                    set(
                      s.balRcpt
                        ? { collRcpts: [...(s.collRcpts || []), newRec] }
                        : { balRcpt: newRec }
                    );
                    setPay(null);
                  }}
                >
                  Save payment
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
                  onClick={() => setPay(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow-up Note Form */}
      {log && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
          <h5 className="font-bold text-gray-900">Log collection follow-up</h5>
          <div className="flex items-center gap-3">
            <select
              className="p-2 text-xs border border-gray-300 rounded-lg bg-white outline-none"
              value={log.via}
              onChange={(e) => setLog({ ...log, via: e.target.value })}
            >
              <option>Call</option>
              <option>WhatsApp</option>
              <option>Email</option>
              <option>Visit</option>
            </select>
            <input
              type="text"
              placeholder="What did they say? e.g. Cheque processed, ready by Friday"
              className="flex-1 p-2 text-xs border border-gray-300 rounded-lg bg-white outline-none"
              value={log.note}
              onChange={(e) => setLog({ ...log, note: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-2xs cursor-pointer"
              disabled={log.note.trim().length < 3}
              onClick={() => {
                set({ followups: [...fu, { ...log, at: new Date().toISOString() }] });
                setLog(null);
              }}
            >
              Save follow-up
            </button>
            <button
              type="button"
              className="px-3 py-2 text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
              onClick={() => setLog(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionsPanel;
