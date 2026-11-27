import React from "react";
import { fmt, workDaysTo } from "../../../utils/helpers";

const OrderAndRateTab = ({
  s,
  set,
  items,
  totalPcs,
  totalAmountBeforeGst,
  totalInvoiceVal,
  advPercent,
  effectiveAdv,
  advOption,
  setAdvOption,
  customAdvAmount,
  setCustomAdvAmount,
  deliveryDate,
  completionDate,
  handleDeliveryDateChange,
  handleCompletionDateChange,
  getMaxCompletionDate,
  rateNegotiateBanner,
  setRateNegotiateBanner,
  editingRateId,
  setEditingRateId,
  editingRateVal,
  setEditingRateVal,
  editingReasonVal,
  setEditingReasonVal,
  handleQtyChange,
  handleQtyInput,
  handleDropItem,
  handleSaveRate,
  handleAddProduct,
  rounds,
  billingEdit,
  setBillingEdit,
  billingPartyType,
  setBillingPartyType,
  diffPartyName,
  setDiffPartyName,
  diffGstin,
  setDiffGstin,
  diffAddress,
  setDiffAddress,
  client,
  onNext,
}) => {
  return (
    <div className="space-y-6 text-xs">
      {rateNegotiateBanner && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs text-amber-950 font-medium shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-base">💬</span>
            <span>
              <b>Client requested a better rate:</b> Modify the rate per item below, click <b>Save</b>, and then proceed to <b>Next: financials</b>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRateNegotiateBanner(false)}
            className="text-amber-800 hover:text-amber-950 font-bold cursor-pointer text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Final quantity and rate for each item */}
      <div>
        <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-3">
          Final quantity and rate for each item
        </h3>

        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 text-center">Final Qty</th>
                <th className="py-3 px-4">Rate</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((it, idx) => (
                <tr key={it.id} className="hover:bg-gray-50/50 transition">
                  {/* Item description */}
                  <td className="py-4 px-4 align-top">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            {it.theme}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            Custom
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                          {it.desc}
                        </p>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDropItem(it.id)}
                            className="text-[10px] font-semibold text-gray-400 hover:text-rose-600 mt-1 cursor-pointer transition"
                          >
                            Drop / delink this line
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Final Qty Stepper */}
                  <td className="py-4 px-4 align-top text-center whitespace-nowrap">
                    <div className="inline-flex items-center border border-gray-200 rounded-xl bg-white shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(it.id, -5)}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 font-black transition cursor-pointer text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => handleQtyInput(it.id, e.target.value)}
                        className="w-14 text-center font-bold text-gray-900 outline-none text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange(it.id, 5)}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 font-black transition cursor-pointer text-sm"
                      >
                        +
                      </button>
                    </div>
                  </td>

                  {/* Rate */}
                  <td className="py-4 px-4 align-top whitespace-nowrap">
                    {editingRateId === it.id ? (
                      <div className="space-y-1.5">
                        <input
                          type="number"
                          value={editingRateVal}
                          onChange={(e) => setEditingRateVal(e.target.value)}
                          className="w-24 p-1.5 text-xs border border-indigo-400 rounded-lg outline-none font-bold"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveRate(it.id)}
                            className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRateId(null)}
                            className="px-2 py-0.5 text-gray-500 text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-extrabold text-gray-900">
                          ₹{Number(it.rate).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <span>✓ {it.rateStatus || "confirmed"}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRateId(it.id);
                              setEditingRateVal(it.rate);
                            }}
                            className="text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                    <div className="text-sm font-black text-gray-900">
                      ₹{(Number(it.qty) * Number(it.rate)).toLocaleString("en-IN")}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                <td colSpan={2} className="py-3 px-4 font-bold text-gray-700 text-xs">
                  {items.length} item{items.length > 1 ? "s" : ""} · {totalPcs} pcs
                </td>
                <td colSpan={2} className="py-3 px-4 text-right font-black text-gray-900 text-sm">
                  ₹{totalAmountBeforeGst.toLocaleString("en-IN")}{" "}
                  <span className="text-[11px] font-normal text-gray-500">before GST</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 2. Client PO */}
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-2">Client PO</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="PO number"
            disabled={s.poFollow}
            className="w-64 p-2.5 text-xs border border-gray-300 rounded-xl outline-none bg-white disabled:bg-gray-100 font-medium transition"
            value={s.relPo || ""}
            onChange={(e) => set({ relPo: e.target.value })}
          />
          <button
            type="button"
            className={`px-4 py-2.5 rounded-full border text-xs font-bold transition cursor-pointer ${
              s.poFollow
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
            onClick={() =>
              set({ poFollow: !s.poFollow, relPo: s.poFollow ? "" : "PO to follow" })
            }
          >
            PO to follow
          </button>
        </div>
      </div>

      {/* 3. Delivery by & Job completion date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">
            Delivery date
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => handleDeliveryDateChange(e.target.value)}
            className="w-full sm:w-64 p-2.5 text-xs border border-gray-300 rounded-xl outline-none bg-white font-medium cursor-pointer shadow-2xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
          {deliveryDate && (
            <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
              {fmt(deliveryDate)} · {workDaysTo(deliveryDate)} working days from today
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">
            Job completion date (Shop floor)
          </label>
          <input
            type="date"
            value={completionDate}
            max={getMaxCompletionDate(deliveryDate)}
            onChange={(e) => handleCompletionDateChange(e.target.value)}
            className={`w-full sm:w-64 p-2.5 text-xs border rounded-xl outline-none bg-white font-medium cursor-pointer shadow-2xs transition ${
              completionDate && deliveryDate && completionDate >= deliveryDate
                ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                : "border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            }`}
          />
          {completionDate && deliveryDate && completionDate >= deliveryDate ? (
            <p className="text-[11px] text-rose-600 mt-1.5 font-bold">
              ⚠️ Completion date must be before delivery date ({fmt(deliveryDate)})
            </p>
          ) : completionDate ? (
            <p className="text-[11px] text-emerald-700 mt-1.5 font-medium">
              Target: {fmt(completionDate)}{" "}
              {deliveryDate &&
                `(${Math.max(
                  1,
                  Math.round(
                    (new Date(deliveryDate) - new Date(completionDate)) /
                      (1000 * 60 * 60 * 24)
                  )
                )} days before delivery)`}
            </p>
          ) : null}
        </div>
      </div>

      {/* 4. Revision Note Badge */}
      {rounds.length > 0 && (
        <div className="bg-[#FFF9E6] border border-[#FDE68A] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950 font-medium">
          <span className="text-amber-500 text-base leading-none">⭐</span>
          <div className="leading-relaxed">
            <b className="font-bold">
              Approved after {rounds.length} round{rounds.length > 1 ? "s" : ""} of changes:
            </b>{" "}
            {rounds
              .map(
                (r, i) =>
                  `v${r.v || i + 1} (${
                    (r.changes || []).join(", ") ||
                    "Size, Text / names, Logo / artwork, Finish, Material, Base / stand, Packaging, Colour"
                  })`
              )
              .join("; ")}.
          </div>
        </div>
      )}

      {/* 5. Billing Party Section */}
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-2">Billing</label>
        {!billingEdit ? (
          <div className="border border-gray-200 rounded-2xl p-4 bg-white flex items-center justify-between shadow-2xs">
            <div>
              <b className="text-sm font-bold text-gray-900 block">
                Bill to{" "}
                {billingPartyType === "different" && diffPartyName
                  ? diffPartyName
                  : client?.name || "Meridian Pharma Pvt Ltd"}
              </b>
              <span className="text-xs text-gray-500 block mt-0.5">
                {billingPartyType === "different"
                  ? `GSTIN ${diffGstin} · Maharashtra`
                  : `Same as the client · ${client?.state || "Maharashtra"} · CGST + SGST`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setBillingEdit(true)}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBillingPartyType("client")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billingPartyType === "client"
                    ? "bg-indigo-50 border-2 border-indigo-600 text-indigo-700"
                    : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Bill {client?.name || "Meridian Pharma"}
              </button>
              <button
                type="button"
                onClick={() => setBillingPartyType("different")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billingPartyType === "different"
                    ? "bg-indigo-50 border-2 border-indigo-600 text-indigo-700"
                    : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Bill a different party
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Invoices go to{" "}
              {billingPartyType === "different"
                ? diffPartyName || "Different Party"
                : client?.name || "Meridian Pharma Pvt Ltd"}{" "}
              · {client?.state || "Maharashtra"} GST.
            </p>

            {billingPartyType === "different" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Company / Party Name
                  </label>
                  <input
                    type="text"
                    value={diffPartyName}
                    onChange={(e) => setDiffPartyName(e.target.value)}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-medium"
                    placeholder="e.g. Meridian Healthcare Pvt Ltd"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={diffGstin}
                    onChange={(e) => setDiffGstin(e.target.value)}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-medium"
                    placeholder="e.g. 27AADCM5561H1Z6"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    value={diffAddress}
                    onChange={(e) => setDiffAddress(e.target.value)}
                    className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-medium"
                    placeholder="Plot 14, MIDC, Andheri East, Mumbai 400093"
                  />
                </div>
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setBillingEdit(false);
                  set({
                    billingPartyType,
                    diffPartyName,
                    diffGstin,
                    diffAddress,
                    billingParty:
                      billingPartyType === "different" ? diffPartyName : client?.name,
                  });
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Advance for this order (optional) */}
      <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-3.5 shadow-2xs">
        <div>
          <span className="text-xs font-bold text-gray-900">
            Advance for this order
          </span>{" "}
          <span className="text-[11px] text-gray-400 font-medium">(optional)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAdvOption("terms");
              set({
                advPlan: { mode: "terms", amount: Math.round(totalInvoiceVal * 0.25) },
              });
            }}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
              advOption === "terms"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            As per terms{" "}
            <span
              className={advOption === "terms" ? "text-indigo-100" : "text-gray-400"}
            >
              Net 30
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdvOption("custom");
              const safeAmt =
                customAdvAmount && customAdvAmount <= totalInvoiceVal && customAdvAmount !== 84300
                  ? customAdvAmount
                  : (Math.round(totalInvoiceVal * 0.5) || Math.round(totalInvoiceVal * 0.25));
              setCustomAdvAmount(safeAmt);
              set({ advPlan: { mode: "custom", amount: safeAmt } });
            }}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
              advOption === "custom"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            Different amount
          </button>

          <button
            type="button"
            onClick={() => {
              setAdvOption("none");
              set({ advPlan: { mode: "none", amount: 0 } });
            }}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
              advOption === "none"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            No advance
          </button>
        </div>

        {advOption === "custom" && (
          <div className="pt-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center border-2 border-indigo-600 rounded-xl px-3.5 py-2 bg-white text-lg font-black text-gray-900 shadow-2xs">
                <span className="text-gray-400 mr-2 text-base font-bold">₹</span>
                <input
                  type="number"
                  value={customAdvAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCustomAdvAmount(val);
                    set({ advPlan: { mode: "custom", amount: val } });
                  }}
                  className="w-36 outline-none font-black text-gray-900 text-lg"
                />
              </div>
              <span className="text-xs font-bold text-gray-600">
                of ₹{totalInvoiceVal.toLocaleString("en-IN")} ({advPercent}%)
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              It goes on the proforma. Production isn't held for it; record it when it arrives.
            </p>
          </div>
        )}

        {advOption === "none" && (
          <p className="text-[11px] text-gray-400 pt-1">
            The proforma will show no advance; the full amount is billed on the tax invoice.
          </p>
        )}

        {advOption === "terms" && (
          <p className="text-[11px] text-gray-400 pt-1">
            It goes on the proforma. Production isn't held for it; record it when it arrives.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          type="button"
          className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition cursor-pointer text-xs"
          onClick={() => set({ step: s.step || 5 })}
        >
          ← Back
        </button>
        <button
          type="button"
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs"
          onClick={onNext}
        >
          Next: financials
        </button>
      </div>

      {/* Cancel Order Link */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Are you sure the client wants to cancel this order?")) {
              set({ abandoned: true });
            }
          }}
          className="text-xs text-gray-400 hover:text-rose-600 transition cursor-pointer font-medium"
        >
          Client wants to cancel the whole order...
        </button>
      </div>
    </div>
  );
};

export default OrderAndRateTab;

