import React, { useState } from "react";
import {
  inr,
  finOf,
  advSettled,
  dfmt,
  fmt,
  addWork,
  todayISO,
  roundOf,
  subJobsOf,
  workDaysTo,
  allReady
} from "../../utils/helpers";
import PackDelivery from "./PackDelivery";
import CommunicationLogForm from "../common/CommunicationLogForm";
import PreviewProformaSheet from "./PreviewProformaSheet";
import PreviewPaymentReminderSheet from "./PreviewPaymentReminderSheet";

const OrderPipeline = ({ s, set, client, job, ids = {} }) => {
  const [sub, setSub] = useState(s.sub || 0); // 0: Order & rate, 1: Financials, 2: Pack & post

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21071";

  const roundInfo = roundOf(s);
  const currentV = roundInfo.v || (s?.rounds?.length ? s.rounds.length + 1 : 1);
  const rounds = s?.rounds || [];

  // Initial products list from orderItems, subJobsOf, or fallback matching screenshot
  const initialItems = s.orderItems || (() => {
    const sj = subJobsOf(s, parentJobNo);
    if (sj.length > 0) {
      return sj.map((item, idx) => ({
        id: item.id || `item_${idx + 1}`,
        subJobNo: item.subJobNo,
        theme: item.theme || s.e?.theme || "Custom Trophy",
        type: item.type || "Plaque",
        size: item.size || (idx === 0 ? 11 : 18),
        mat: item.mat || item.material || (idx === 0 ? "Fusion: Crystal + MDF" : "Fusion: Resin + MDF"),
        desc: `${item.type || "Plaque"} · Composite with a solid base · ${item.size || (idx === 0 ? 11 : 18)} in · ${item.mat || (idx === 0 ? "Fusion: Crystal + MDF" : "Fusion: Resin + MDF")} · Metal elements`,
        qty: idx === 0 ? (s.finalQty || 40) : 100,
        rate: idx === 0 ? (s.fc?.rate || 3390) : 1500,
        rateStatus: idx === 0 ? "confirmed" : "changed · Client negotiated"
      }));
    }
    return [
      {
        id: "item_1",
        subJobNo: `${parentJobNo}-A1`,
        theme: s.e?.theme || "Million Dollar Club Trophy",
        type: "Plaque",
        size: 11,
        mat: "Fusion: Crystal + MDF",
        desc: "Plaque · Composite with a solid base · 11 in · Fusion: Crystal + MDF · Metal elements",
        qty: s.finalQty || 40,
        rate: s.fc?.rate || 3390,
        rateStatus: "confirmed"
      },
      {
        id: "item_2",
        subJobNo: `${parentJobNo}-A2`,
        theme: "fbvdfbdgfb",
        type: "Plaque",
        size: 18,
        mat: "Fusion: Resin + MDF",
        desc: "Plaque · CNC with a solid base · 18 in · Fusion: Resin + MDF · Metal elements",
        qty: 100,
        rate: 1500,
        rateStatus: "changed · Client negotiated"
      }
    ];
  })();

  const [items, setItems] = useState(initialItems);
  const [editingRateId, setEditingRateId] = useState(null);
  const [editingRateVal, setEditingRateVal] = useState(0);
  const [editingReasonVal, setEditingReasonVal] = useState("Client negotiated");

  // Quantity and Rate handlers
  const handleQtyChange = (id, delta) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        const newQty = Math.max(1, (Number(it.qty) || 0) + delta);
        return { ...it, qty: newQty };
      }
      return it;
    });
    setItems(updated);
    const newTotal = updated.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    set({ orderItems: updated, finalQty: newTotal });
  };

  const handleQtyInput = (id, val) => {
    const newQty = Math.max(1, parseInt(val) || 1);
    const updated = items.map((it) => (it.id === id ? { ...it, qty: newQty } : it));
    setItems(updated);
    const newTotal = updated.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    set({ orderItems: updated, finalQty: newTotal });
  };

  const handleDropItem = (id) => {
    if (items.length <= 1) return;
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    const newTotal = updated.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    set({ orderItems: updated, finalQty: newTotal });
  };

  const handleSaveRate = (id) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          rate: Number(editingRateVal),
          rateStatus: `changed · ${editingReasonVal}`
        };
      }
      return it;
    });
    setItems(updated);
    setEditingRateId(null);
    set({ orderItems: updated, fc: { rate: updated[0]?.rate || 1000 } });
  };

  const handleAddProduct = () => {
    const nextIdx = items.length + 1;
    const newItem = {
      id: `item_${Date.now()}`,
      subJobNo: `${parentJobNo}-A${nextIdx}`,
      theme: `Custom Award ${nextIdx}`,
      type: "Plaque",
      size: 10,
      mat: "Acrylic + Wood",
      desc: "Plaque · Laser cut award · 10 in · Acrylic + Wood · Metal base",
      qty: 50,
      rate: 1800,
      rateStatus: "Quoted rate"
    };
    const updated = [...items, newItem];
    setItems(updated);
    const newTotal = updated.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    set({ orderItems: updated, finalQty: newTotal });
  };

  // Live Totals
  const totalPcs = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalAmountBeforeGst = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0),
    0
  );
  const gstAmount = Math.round(totalAmountBeforeGst * 0.18);
  const totalInvoiceVal = totalAmountBeforeGst + gstAmount;

  // Proforma preview modal state
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [autoReminderMode, setAutoReminderMode] = useState(true);
  const [prodGst, setProdGst] = useState(s.prodGst || 18);
  const [adjustSampleCharges, setAdjustSampleCharges] = useState(s.relAdjust === true || false);

  // Post to Production Hub check states (Screenshot 1)
  const [contentStatus, setContentStatus] = useState(s.contentStatus || "received");
  const [contentFileName, setContentFileName] = useState(s.contentFileName || "bhagath singh.webp");
  const [packingListStatus, setPackingListStatus] = useState(s.packingListStatus || "not_received");
  const [packingListFileName, setPackingListFileName] = useState(s.packingListFileName || "packing_list.xlsx");
  const [clientChanges, setClientChanges] = useState(s.clientChanges || "Size, Text / names, Logo / artwork, Finish, Material, Base / stand, Packaging, Colour: xsaxdxd");
  const [priority, setPriority] = useState(s.priority || "Normal");
  const [autoRemindClient, setAutoRemindClient] = useState(s.autoRemindClient !== undefined ? s.autoRemindClient : true);
  const [postNotes, setPostNotes] = useState(s.postNotes || "");

  // Advance modal and recording state
  const [advFormMode, setAdvFormMode] = useState(null); // null | 'record' | 'on_the_way'
  const [rcptAmount, setRcptAmount] = useState(s.advPlan?.amount || 100000);
  const [rcptDate, setRcptDate] = useState(todayISO());
  const [rcptMode, setRcptMode] = useState("NEFT");
  const [rcptRef, setRcptRef] = useState("");
  const [rcptFrom, setRcptFrom] = useState(client?.name || client?.company || "Meridian Pharma Pvt Ltd");
  const [rcptInto, setRcptInto] = useState(s.bankAc || "HDFC Kalina · current a/c");

  const [otwAmount, setOtwAmount] = useState(s.advPlan?.amount || 100000);
  const [otwFrom, setOtwFrom] = useState(client?.name || client?.company || "Meridian Pharma Pvt Ltd");
  const [otwMode, setOtwMode] = useState("NEFT");
  const [otwExpectedBy, setOtwExpectedBy] = useState("Tomorrow");
  const [otwExpectedDate, setOtwExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [otwRef, setOtwRef] = useState("");
  const [otwNote, setOtwNote] = useState("");
  const [otwHoldProduction, setOtwHoldProduction] = useState(false);

  const [capCost, setCapCost] = useState(false);
  const [rateNegotiateBanner, setRateNegotiateBanner] = useState(false);

  // Delivery and Job Completion Dates - strictly completionDate < deliveryDate
  const getMaxCompletionDate = (delivDate) => {
    if (!delivDate) return "";
    const d = new Date(delivDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const getRecommendedCompletionDate = (delivDate) => {
    if (!delivDate) return "";
    const d = new Date(delivDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  };

  const [deliveryDate, setDeliveryDate] = useState(s.relDate || s.leadDate || "2026-10-23");
  const [completionDate, setCompletionDate] = useState(() => {
    const initialComp = s.jobCompletionDate || s.completionDate;
    const del = s.relDate || s.leadDate || "2026-10-23";
    if (!initialComp || initialComp >= del) {
      return getRecommendedCompletionDate(del) || "2026-10-21";
    }
    return initialComp;
  });

  const handleDeliveryDateChange = (val) => {
    setDeliveryDate(val);
    const maxComp = getMaxCompletionDate(val);
    let newComp = completionDate;
    if (!completionDate || completionDate >= val) {
      newComp = getRecommendedCompletionDate(val) || maxComp;
      setCompletionDate(newComp);
    }
    set({ relDate: val, jobCompletionDate: newComp });
  };

  const handleCompletionDateChange = (val) => {
    const maxComp = getMaxCompletionDate(deliveryDate);
    if (deliveryDate && val >= deliveryDate) {
      setCompletionDate(maxComp);
      set({ jobCompletionDate: maxComp });
    } else {
      setCompletionDate(val);
      set({ jobCompletionDate: val });
    }
  };

  const [showCustomDate, setShowCustomDate] = useState(false);
  const eventDate = s.e?.eventExactDate || "2026-10-24";

  // Billing address state
  const [billingEdit, setBillingEdit] = useState(false);
  const [billingPartyType, setBillingPartyType] = useState(s.billingPartyType || "client");
  const [diffPartyName, setDiffPartyName] = useState(s.diffPartyName || "Meridian Healthcare Pvt Ltd");
  const [diffGstin, setDiffGstin] = useState(s.diffGstin || "27AADCM5561H1Z6");
  const [diffAddress, setDiffAddress] = useState(s.diffAddress || "Plot 14, MIDC, Andheri East, Mumbai 400093");

  // Advance state matching screenshot
  const [advOption, setAdvOption] = useState(s.advPlan?.mode || "custom"); // "terms" | "custom" | "none"
  const [customAdvAmount, setCustomAdvAmount] = useState(s.advPlan?.amount || 84300);

  const effectiveAdv = advOption === "none" ? 0 : advOption === "custom" ? customAdvAmount : Math.round(totalInvoiceVal * 0.25);
  const advPercent = totalInvoiceVal > 0 ? Math.round((effectiveAdv / totalInvoiceVal) * 100) : 0;

  // Financials object for later steps
  const f = finOf(s, job, client, totalPcs);

  // Pipeline subnav completion flags
  const isOrderRateDone = totalPcs > 0 && totalAmountBeforeGst > 0;
  const isFinDone = !!(s.pi?.sent && s.costOk && advSettled(s, f));
  const isPackPostDone = !!s.released;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-7 text-left">
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-1">
          {s.mode === "sample"
            ? `Sample v${currentV} approved. Process the order`
            : "Process the production order"}
        </h2>
        <p className="text-xs text-gray-500 font-medium">
          Confirm the final order details, close financials, and post to the Production Hub.
        </p>
      </div>

      {/* 3 Sub-tabs Pills Bar matching Screenshot */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
        {[
          { idx: 0, num: 1, label: "Order & rate", done: isOrderRateDone },
          { idx: 1, num: 2, label: "Financials", done: isFinDone },
          { idx: 2, num: 3, label: "Pack, deliver & post", done: isPackPostDone }
        ].map((tab) => (
          <button
            key={tab.idx}
            type="button"
            className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              sub === tab.idx
                ? "bg-indigo-600 text-white shadow-xs"
                : tab.done
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => setSub(tab.idx)}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                sub === tab.idx
                  ? "bg-white text-indigo-700"
                  : tab.done
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-300 text-gray-700"
              }`}
            >
              {tab.done && sub !== tab.idx ? "✓" : tab.num}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBNAV 0: Order & Rate */}
      {sub === 0 && (
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

            <div className="mt-2.5">
              <button
                type="button"
                onClick={handleAddProduct}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span> Add a product to this order
              </button>
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
                onClick={() => set({ poFollow: !s.poFollow, relPo: s.poFollow ? "" : "PO to follow" })}
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

          {/* 4. Revision Note Badge matching Screenshot */}
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

          {/* 5. Billing Party Section matching Screenshot */}
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
                          billingPartyType === "different" ? diffPartyName : client?.name
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

          {/* 6. Advance for this order (optional) matching Screenshot */}
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
                  set({ advPlan: { mode: "terms", amount: Math.round(totalInvoiceVal * 0.25) } });
                }}
                className={`px-4 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
                  advOption === "terms"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                As per terms <span className={advOption === "terms" ? "text-indigo-100" : "text-gray-400"}>Net 30</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAdvOption("custom");
                  set({ advPlan: { mode: "custom", amount: customAdvAmount } });
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

            {/* When Different amount is selected */}
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

            {/* When No advance is selected */}
            {advOption === "none" && (
              <p className="text-[11px] text-gray-400 pt-1">
                The proforma will show no advance; the full amount is billed on the tax invoice.
              </p>
            )}

            {/* When As per terms is selected */}
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
              onClick={() => {
                set({
                  finalQty: totalPcs,
                  fc: {
                    rate: items[0]?.rate || 1000,
                    qty: totalPcs,
                    ref: "Order rate confirmed",
                    at: new Date().toISOString()
                  },
                  relDate: deliveryDate,
                  jobCompletionDate: completionDate,
                  advPlan: {
                    mode: advOption,
                    amount: effectiveAdv
                  }
                });
                setSub(1);
              }}
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
      )}

      {/* SUBNAV 1: Financials matching Screenshot */}
      {sub === 1 && (() => {
        const sampleV1Adjusted = 13960;
        const sampleV2Adjusted = 6648;
        const totalSampleAdjusted = adjustSampleCharges ? sampleV1Adjusted + sampleV2Adjusted : 0;

        const finTaxableValue = Math.max(0, totalAmountBeforeGst - totalSampleAdjusted);
        const finGstRate = prodGst || 18;
        const finHalfRate = finGstRate / 2;
        const finCgst = Math.round(finTaxableValue * (finHalfRate / 100));
        const finSgst = Math.round(finTaxableValue * (finHalfRate / 100));
        const totalGst = Math.round(finTaxableValue * (finGstRate / 100));
        const finInvoiceTotal = finTaxableValue + totalGst;

        const finAdvanceDue = effectiveAdv;
        const finBalanceDue = Math.max(0, finInvoiceTotal - finAdvanceDue);

        const sampleV1Invoice = 16473;
        const sampleV2Invoice = 6980;
        const finTotalJobValue = finInvoiceTotal + sampleV1Invoice + sampleV2Invoice;

        return (
          <div className="space-y-6 text-xs">
            {/* Top Controls Bar: GST on production & Adjust sample charges */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-gray-200 rounded-2xl bg-white shadow-2xs">
              {/* GST on production */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  GST on production
                </label>
                <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setProdGst(5);
                      set({ prodGst: 5 });
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      prodGst === 5
                        ? "bg-white text-indigo-700 shadow-2xs border border-gray-200"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    5%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProdGst(18);
                      set({ prodGst: 18 });
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      prodGst === 18
                        ? "bg-white text-indigo-700 shadow-2xs border border-gray-200"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    18%
                  </button>
                </div>
              </div>

              {/* Adjust sample charges toggle switch */}
              <div className="flex-1 max-w-md border border-gray-200 rounded-xl p-3 bg-white flex items-center gap-3.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    const next = !adjustSampleCharges;
                    setAdjustSampleCharges(next);
                    set({ relAdjust: next });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    adjustSampleCharges ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      adjustSampleCharges ? "transform translate-x-5" : ""
                    }`}
                  />
                </button>
                <div>
                  <div className="font-bold text-xs text-gray-900">
                    Adjust sample charges against this order
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {adjustSampleCharges
                      ? "Sample taxable value is deducted from the production invoice"
                      : "Sample invoices stand on their own"}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Statement Detailed Table matching Screenshot */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-semibold">DESCRIPTION</th>
                    <th className="py-2.5 px-4 text-right font-semibold">AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-gray-900 text-xs">
                          {idx + 1}. {it.theme}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {it.desc} · {it.qty} pcs × {inr(it.rate)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">
                        {inr(Number(it.qty) * Number(it.rate))}
                      </td>
                    </tr>
                  ))}

                  {adjustSampleCharges && (
                    <>
                      <tr className="text-emerald-700 bg-emerald-50/30">
                        <td className="py-2.5 px-4">
                          <span className="font-bold">Less: sample v1 charge adjusted</span>
                          <div className="text-[10px] text-emerald-600">
                            2 pc × ₹6,980 · taxable value
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                          − {inr(sampleV1Adjusted)}
                        </td>
                      </tr>
                      <tr className="text-emerald-700 bg-emerald-50/30">
                        <td className="py-2.5 px-4">
                          <span className="font-bold">Less: sample v2 charge adjusted</span>
                          <div className="text-[10px] text-emerald-600">
                            1 pc × ₹6,980 incl. GST · taxable value
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
                          − {inr(sampleV2Adjusted)}
                        </td>
                      </tr>
                    </>
                  )}

                  <tr className="border-t border-gray-200">
                    <td className="py-2.5 px-4 text-gray-800 font-bold">Taxable value</td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      {inr(finTaxableValue)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1.5 px-4 text-gray-600 font-medium">CGST @ {finHalfRate}%</td>
                    <td className="py-1.5 px-4 text-right text-gray-900 whitespace-nowrap font-medium">
                      {inr(finCgst)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1.5 px-4 text-gray-600">
                      <div className="font-medium">SGST @ {finHalfRate}%</div>
                      <div className="text-[10px] text-gray-400">
                        Place of supply: {client?.state || "Maharashtra"} (27)
                      </div>
                    </td>
                    <td className="py-1.5 px-4 text-right text-gray-900 whitespace-nowrap font-medium align-top">
                      {inr(finSgst)}
                    </td>
                  </tr>

                  <tr className="border-t-2 border-indigo-100 bg-indigo-50/30">
                    <td className="py-3 px-4 font-black text-sm text-indigo-900">
                      Invoice total
                    </td>
                    <td className="py-3 px-4 text-right font-black text-sm text-indigo-900 whitespace-nowrap">
                      {inr(finInvoiceTotal)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-4">
                      <span className="font-bold text-gray-800">Advance due now</span>
                      <div className="text-[10px] text-gray-400">Amount agreed with the client</div>
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      {inr(finAdvanceDue)}
                    </td>
                  </tr>

                  <tr className="border-t border-gray-100">
                    <td className="py-2.5 px-4 font-bold text-gray-800">
                      Balance due before dispatch
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      {inr(finBalanceDue)}
                    </td>
                  </tr>

                  {/* BILLED SEPARATELY */}
                  <tr className="bg-gray-50/80 border-t border-gray-200">
                    <td colSpan={2} className="py-2 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      BILLED SEPARATELY
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-gray-800">Sample v1 invoice</span>
                      <div className="text-[10px] text-gray-400">
                        2 pc × ₹6,980 + 18% GST {adjustSampleCharges && "· taxable value adjusted above"}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                      {inr(sampleV1Invoice)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-gray-800">Sample v2 invoice</span>
                      <div className="text-[10px] text-gray-400">
                        1 pc × ₹6,980 incl. 5% GST {adjustSampleCharges && "· taxable value adjusted above"}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                      {inr(sampleV2Invoice)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Purple Box: Total job value incl. GST */}
            <div className="bg-[#EEF2FF] border border-indigo-100 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-2xs">
              <div>
                <div className="font-bold text-xs text-indigo-950">
                  Total job value incl. GST
                </div>
                <div className="text-[10px] text-indigo-700/70">
                  Invoice total + sample invoices
                </div>
              </div>
              <div className="text-base sm:text-xl font-black text-indigo-900">
                {inr(finTotalJobValue)}
              </div>
            </div>

            {/* Close the financials in three ticks */}
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-gray-800">
                Close the financials in three ticks:
              </h4>

              {/* Tick 1: Quotation & proforma */}
              <div className={`p-4 rounded-2xl border transition shadow-2xs ${
                s.pi?.sent ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-gray-200"
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      s.pi?.sent ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 border border-gray-300"
                    }`}>
                      {s.pi?.sent ? "✓" : "1"}
                    </span>
                    <div>
                      <b className="block text-xs font-bold text-gray-900">
                        Send quotation & proforma
                      </b>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {s.pi?.sent
                          ? `${s.pi.no || ids.pi || "PI/26/0415"} · ₹${Number(items[0]?.rate || 3390).toLocaleString("en-IN")}/pc · sent via ${s.pi.sent || "Hand-delivered / other"}`
                          : "One document: final rate, sample adjustment, GST, advance due and bank details."}
                      </p>
                      {s.pi?.sent && (
                        <button
                          type="button"
                          onClick={() => setShowProformaModal(true)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 mt-1 inline-block cursor-pointer"
                        >
                          Open or resend
                        </button>
                      )}
                    </div>
                  </div>

                  {!s.pi?.sent && (
                    <button
                      type="button"
                      onClick={() => setShowProformaModal(true)}
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs shrink-0"
                    >
                      Preview and send
                    </button>
                  )}
                </div>
              </div>

              {/* Tick 2: Client approves */}
              <div className={`p-4 rounded-2xl border transition shadow-2xs ${
                s.costOk ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-gray-200"
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    s.costOk ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 border border-gray-300"
                  }`}>
                    {s.costOk ? "✓" : "2"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <b className="block text-xs font-bold text-gray-900">
                        Client approves
                      </b>
                      {s.costOk && (
                        <span className="text-xs font-bold text-emerald-700 shrink-0">
                          Approved ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {s.costOk
                        ? `Approved · ${s.costOk.method === "whatsapp" ? "WhatsApp" : s.costOk.method ? s.costOk.method.charAt(0).toUpperCase() + s.costOk.method.slice(1) : "WhatsApp"} · ${dfmt(s.costOk.date || todayISO())} ${s.costOk.time || "05:44"} · ${s.costOk.whoConfirmed?.split("·")[0]?.trim() || "Vikas Rao"}`
                        : "Log how they said yes: WhatsApp, email, verbal or PO."}
                    </p>

                    {!s.costOk && !capCost && (
                      <div className="flex flex-wrap items-center gap-2.5 mt-3">
                        <button
                          type="button"
                          className="px-5 py-2.5 bg-[#009b66] hover:bg-[#008256] text-white font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                          onClick={() => setCapCost(true)}
                        >
                          Client approved
                        </button>
                        <button
                          type="button"
                          className="px-5 py-2.5 bg-[#f4f3fb] hover:bg-[#eae8f7] text-[#4b4376] border border-[#e2dff0] font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                          onClick={() => {
                            setSub(0);
                            if (items[0]) {
                              setEditingRateId(items[0].id);
                              setEditingRateVal(items[0].rate);
                              setEditingReasonVal("Client negotiated a better rate");
                            }
                            setRateNegotiateBanner(true);
                          }}
                        >
                          Wants a better rate · back to Costing
                        </button>
                      </div>
                    )}

                    {capCost && (
                      <div className="mt-3">
                        <CommunicationLogForm
                          client={client}
                          mode="order"
                          feedbackMode="approve"
                          hideCard={false}
                          title={`Approved at ₹${Number(items[0]?.rate || 3390).toLocaleString("en-IN")}/pc? How did the client confirm?`}
                          subTitle="Record how the client said yes, so there's proof on the job if anything is questioned later."
                          buttonText="Log approval"
                          buttonHint="Paste their message or add a screenshot."
                          amount={items[0]?.rate || 3390}
                          onBack={() => setCapCost(false)}
                          onLog={(logData) => {
                            set({ costOk: logData });
                            setCapCost(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tick 3: Advance */}
              <div className={`p-4 rounded-2xl border transition shadow-2xs ${
                s.rcpt ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-gray-200"
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    s.rcpt
                      ? "bg-emerald-500 text-white"
                      : (s.advFollow || s.advLater)
                      ? "bg-amber-500 text-white tracking-widest text-[9px]"
                      : "bg-gray-100 text-gray-600 border border-gray-300"
                  }`}>
                    {s.rcpt ? "✓" : (s.advFollow || s.advLater) ? "···" : "3"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <b className="block text-xs font-bold text-gray-900">
                        Advance {inr(finAdvanceDue)} <span className="text-gray-400 font-normal text-[11px] bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">optional</span>
                      </b>
                      {s.rcpt && (
                        <span className="text-xs font-bold text-emerald-700 shrink-0">
                          Settled ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {s.rcpt
                        ? `${inr(s.rcpt.amount)} received (${s.rcpt.mode || "NEFT"} · ${dfmt(s.rcpt.date || todayISO())}${s.rcpt.into ? " · " + s.rcpt.into : ""})`
                        : (s.advFollow || s.advLater)
                        ? `${inr(finAdvanceDue)} to follow. Production isn't held for it; record it when it arrives.`
                        : "Amount agreed with the client. Record it now, or go ahead and record it when it arrives."}
                    </p>

                    {/* Buttons when no form is open */}
                    {!s.rcpt && advFormMode === null && (
                      <div className="flex flex-wrap items-center gap-2.5 mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setRcptAmount(finAdvanceDue);
                            setAdvFormMode("record");
                          }}
                          className={`px-5 py-2.5 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs ${
                            !s.advFollow && !s.advLater
                              ? "bg-amber-400 hover:bg-amber-500 text-amber-950"
                              : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                          }`}
                        >
                          Record advance received
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtwAmount(finAdvanceDue);
                            setAdvFormMode("on_the_way");
                          }}
                          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                        >
                          Advance on the way
                        </button>
                        {!s.advFollow && !s.advLater && (
                          <button
                            type="button"
                            onClick={() => {
                              set({ advFollow: true, advLater: true });
                              setAdvFormMode(null);
                            }}
                            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl shadow-2xs transition cursor-pointer text-xs"
                          >
                            Proceed, advance to follow
                          </button>
                        )}
                      </div>
                    )}

                    {/* FORM 1: Record Advance Received (Screenshot 2) */}
                    {advFormMode === "record" && (
                      <div className="space-y-4 pt-3 mt-3 border-t border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Amount received</label>
                            <div className="flex">
                              <span className="px-3 py-2 text-xs border border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-gray-500 font-bold">₹</span>
                              <input
                                type="number"
                                className="w-full p-2 text-xs border border-gray-200 rounded-r-xl bg-white font-bold outline-none"
                                value={rcptAmount}
                                onChange={(e) => setRcptAmount(Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Date received</label>
                            <input
                              type="date"
                              className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                              value={rcptDate}
                              onChange={(e) => setRcptDate(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Mode</label>
                          <div className="flex flex-wrap gap-2">
                            {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setRcptMode(m)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                                  rcptMode === m
                                    ? "bg-[#2815f5] text-white shadow-2xs"
                                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">UTR / transaction ref</label>
                            <input
                              type="text"
                              className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                              value={rcptRef}
                              onChange={(e) => setRcptRef(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Received from</label>
                            <input
                              type="text"
                              className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                              value={rcptFrom}
                              onChange={(e) => setRcptFrom(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Received into</label>
                          <input
                            type="text"
                            className="w-full max-w-md p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                            value={rcptInto}
                            onChange={(e) => setRcptInto(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setAdvFormMode(null)}
                            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              set({
                                rcpt: {
                                  amount: rcptAmount,
                                  date: rcptDate,
                                  mode: rcptMode,
                                  ref: rcptRef,
                                  from: rcptFrom,
                                  into: rcptInto
                                },
                                advLater: false,
                                advFollow: false
                              });
                              setAdvFormMode(null);
                            }}
                            className="px-5 py-2 bg-amber-300 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                          >
                            Save receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdvFormMode("on_the_way")}
                            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 ml-2 cursor-pointer"
                          >
                            Not credited yet? Mark as on the way
                          </button>
                        </div>
                      </div>
                    )}

                    {/* FORM 2: Advance On The Way (Screenshot 3) */}
                    {advFormMode === "on_the_way" && (
                      <div className="p-4 bg-[#fffdf0] border border-amber-200 rounded-2xl space-y-4 mt-3">
                        <p className="text-xs font-bold text-amber-950">
                          The client says the payment is on its way. Log it now and mark it received when it's credited.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Amount coming</label>
                            <div className="flex">
                              <span className="px-3 py-2 text-xs border border-r-0 border-gray-200 rounded-l-xl bg-gray-50 text-gray-500 font-bold">₹</span>
                              <input
                                type="number"
                                className="w-full p-2 text-xs border border-gray-200 rounded-r-xl bg-white font-bold outline-none"
                                value={otwAmount}
                                onChange={(e) => setOtwAmount(Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">From</label>
                            <input
                              type="text"
                              className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                              value={otwFrom}
                              onChange={(e) => setOtwFrom(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">How it's coming</label>
                          <div className="flex flex-wrap gap-2">
                            {["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash"].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setOtwMode(m)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                                  otwMode === m
                                    ? "bg-[#2815f5] text-white shadow-2xs"
                                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Expected by</label>
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { label: "Today", days: 0 },
                              { label: "Tomorrow", days: 1 },
                              { label: "In 3 days", days: 3 },
                              { label: "In a week", days: 7 }
                            ].map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => {
                                  setOtwExpectedBy(opt.label);
                                  const d = new Date();
                                  d.setDate(d.getDate() + opt.days);
                                  setOtwExpectedDate(d.toISOString().slice(0, 10));
                                }}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                                  otwExpectedBy === opt.label
                                    ? "bg-[#2815f5] text-white shadow-2xs"
                                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                            <input
                              type="date"
                              className="p-1.5 text-xs border border-gray-200 rounded-xl bg-white outline-none ml-1"
                              value={otwExpectedDate}
                              onChange={(e) => {
                                setOtwExpectedDate(e.target.value);
                                setOtwExpectedBy("Custom");
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">UTR / ref (if shared)</label>
                            <input
                              type="text"
                              className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                              value={otwRef}
                              onChange={(e) => setOtwRef(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 mb-1.5 block">Note</label>
                            <input
                              type="text"
                              placeholder="e.g. Accounts said released today"
                              className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none"
                              value={otwNote}
                              onChange={(e) => setOtwNote(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="border border-dashed border-gray-300 rounded-xl p-3 flex items-center gap-3 bg-white/70">
                          <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">📎</span>
                          <div>
                            <span className="text-xs font-bold text-gray-800 block">Payment screenshot (optional)</span>
                            <span className="text-[11px] text-gray-400">Paste with Ctrl+V or choose the transfer or cheque photo</span>
                          </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl p-3 bg-white flex items-center gap-3 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setOtwHoldProduction(!otwHoldProduction)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                              otwHoldProduction ? "bg-indigo-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                otwHoldProduction ? "transform translate-x-5" : ""
                              }`}
                            />
                          </button>
                          <div>
                            <div className="font-bold text-xs text-gray-900">
                              Hold production until it's credited
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {otwHoldProduction
                                ? "On: production will be held until advance is credited"
                                : "Off: production goes ahead; the advance is tracked as on the way"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setAdvFormMode(null)}
                            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              set({
                                advLater: true,
                                advFollow: true,
                                advOnTheWay: {
                                  amount: otwAmount,
                                  from: otwFrom,
                                  mode: otwMode,
                                  expectedBy: otwExpectedBy,
                                  expectedDate: otwExpectedDate,
                                  ref: otwRef,
                                  note: otwNote,
                                  holdProduction: otwHoldProduction
                                }
                              });
                              setAdvFormMode(null);
                            }}
                            className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                          >
                            Save as on the way
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning: Advance not received (Screenshots 1, 2, 3, 4, 5) */}
              {!s.rcpt && (
                <div className="border border-rose-300 bg-rose-50/50 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                  <div>
                    <div className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                      <span>⚠</span> Advance not received
                    </div>
                    <p className="text-[11px] text-rose-900/80 mt-1 leading-relaxed">
                      Until it's received, the tax invoice won't be generated and dispatch will be delayed. {s.advReminderSent ? `Reminder sent on ${s.advReminderSent}.` : "No reminder sent yet."} Auto reminders are on: one goes when the job is posted, and again 2 working days before dispatch.
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowReminderModal(true)}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                    >
                      Send reminder now
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-rose-100 p-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAutoReminderMode(!autoReminderMode)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                        autoReminderMode ? "bg-[#2815f5]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          autoReminderMode ? "transform translate-x-5" : ""
                        }`}
                      />
                    </button>
                    <div>
                      <div className="font-bold text-xs text-gray-900">Auto mode</div>
                      <div className="text-[11px] text-gray-500">Sends by itself</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Green Success Banner (Screenshots 4 & 5) */}
              {(s.advFollow || s.advLater) && !s.rcpt && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900 font-medium shadow-2xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    ✓
                  </span>
                  <span>
                    Invoicing is complete; the <b>{inr(finAdvanceDue)}</b> advance is to follow. The tax invoice is raised from this proforma at dispatch.
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button
                type="button"
                className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition cursor-pointer text-xs"
                onClick={() => setSub(0)}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!s.rcpt && !s.advFollow && !s.advLater}
                className={`px-8 py-3 rounded-xl font-bold transition text-xs shadow-xs ${
                  s.rcpt || s.advFollow || s.advLater
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                    : "bg-[#c8c1fa] text-[#8e85d4] opacity-70 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (s.rcpt || s.advFollow || s.advLater) {
                    setSub(2);
                  }
                }}
              >
                Next: pack, deliver & post
              </button>
            </div>

            {/* Cancel Order Link */}
            <div className="pt-1">
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
      })()}

      {/* SUBNAV 2: Pack, deliver & post */}
      {sub === 2 && (
        <div className="space-y-6 text-xs">
          {/* Packing & Delivery Module */}
          <PackDelivery s={s} set={set} client={client} items={items} />

          {/* Post to Production Hub Card (Screenshot 1) */}
          {(() => {
            const receivedCount =
              (contentStatus === "received" ? 1 : 0) +
              (packingListStatus === "received" ? 1 : 0) +
              (s.rcpt ? 1 : 0);

            return (
              <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6 text-left">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">🏭</span>
                  <div>
                    <h3 className="text-base font-black text-gray-900 tracking-tight">
                      Post to Production Hub
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      {items.length} items · {totalPcs} pcs · follow sample v{currentV}
                    </p>
                  </div>
                </div>

                {/* Ready Stock Notice */}
                {allReady(s) && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-900 font-medium">
                    <span className="text-xl">⚡</span>
                    <div>
                      <b className="font-bold block">Ready stock order</b>
                      <span>Every item is ready stock, so production and packing can start directly without 3D custom design prototyping.</span>
                    </div>
                  </div>
                )}

                {/* Pre-production (PP) Sample Notice */}
                {s.ppAfter && (
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    s.ppApproved
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🔬</span>
                      <div>
                        <b className="font-bold block">Pre-production (PP) Sample Flow</b>
                        <span>
                          {s.ppApproved
                            ? `Approved · Bulk production cleared on ${dfmt(s.ppApprovedAt || todayISO())}`
                            : "1 test sample piece to be made & approved first. Bulk run holds until client sign-off."}
                        </span>
                      </div>
                    </div>
                    {!s.ppApproved && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider shrink-0">
                        PP Hold Active
                      </span>
                    )}
                  </div>
                )}

                {/* Box: Before it goes to the shop floor */}
                <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/40 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <b className="text-xs font-black text-gray-900">
                      Before it goes to the shop floor
                    </b>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#fff1eb] text-[#d9531e] border border-[#fed7c7]">
                      {receivedCount} of 3 received
                    </span>
                  </div>

                  {/* 1. Content from client */}
                  {contentStatus === "received" ? (
                    <div className="p-3 bg-[#eefbf4] border border-[#a2e8c1] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          ✓
                        </span>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Content from client
                          </div>
                          <div className="text-[11px] text-[#059669] font-medium">
                            Received · {contentFileName}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#fef2f2] border border-[#fca5a5] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          !
                        </span>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Content from client
                          </div>
                          <div className="text-[11px] text-rose-600 font-medium">
                            Not received · Names, logos, text
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Packing list */}
                  {packingListStatus === "received" ? (
                    <div className="p-3 bg-[#eefbf4] border border-[#a2e8c1] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          ✓
                        </span>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Packing list
                          </div>
                          <div className="text-[11px] text-[#059669] font-medium">
                            Received · {packingListFileName}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPackingListStatus("not_received");
                          set({ packingListStatus: "not_received" });
                        }}
                        className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#fef2f2] border border-[#fca5a5] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          !
                        </span>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Packing list
                          </div>
                          <div className="text-[11px] text-rose-600 font-medium">
                            Not received · Needed for individual + alphabetical
                          </div>
                        </div>
                      </div>
                      <label className="px-4 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer">
                        Attach
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPackingListStatus("received");
                              setPackingListFileName(file.name);
                              set({
                                packingListStatus: "received",
                                packingListFileName: file.name
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {/* 3. Advance */}
                  {s.rcpt ? (
                    <div className="p-3 bg-[#eefbf4] border border-[#a2e8c1] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          ✓
                        </span>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Advance
                          </div>
                          <div className="text-[11px] text-[#059669] font-medium">
                            Received · {inr(s.rcpt.amount || effectiveAdv)} ({s.rcpt.mode || "NEFT"})
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#fef2f2] border border-[#fca5a5] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          !
                        </span>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Advance
                          </div>
                          <div className="text-[11px] text-rose-600 font-medium">
                            Not received · {inr(effectiveAdv)} due
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSub(1)}
                        className="text-xs font-bold text-gray-600 hover:text-indigo-600 underline cursor-pointer"
                      >
                        Record it in Financials
                      </button>
                    </div>
                  )}

                  {/* Footnotes */}
                  <div className="text-[11px] text-gray-500 font-medium pt-1">
                    You can still post now. Anything red stays on the job page as pending until it's received.
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 flex-wrap">
                    <span>After posting:</span>
                    <span className="text-gray-700 font-semibold">🖊 Production artwork (DTP)</span>
                    <span>→</span>
                    <span className="text-gray-700 font-semibold">📦 Goods out · dispatch details</span>
                    <span>→</span>
                    <span className="text-gray-700 font-semibold">💰 Job financials.</span>
                  </div>
                </div>

                {/* Client changes */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
                  <div className="w-full sm:w-44 shrink-0 font-bold text-gray-900 text-xs">
                    Client changes
                  </div>
                  <div className="flex-1 text-xs text-gray-700 font-medium leading-relaxed">
                    {clientChanges}
                  </div>
                </div>

                {/* Content from client */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
                  <div className="w-full sm:w-44 shrink-0">
                    <div className="font-bold text-gray-900 text-xs">
                      Content from client
                    </div>
                    <div className="text-[10px] text-gray-400 font-normal">
                      Names, logos, text
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setContentStatus("awaiting");
                          set({ contentStatus: "awaiting" });
                        }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          contentStatus === "awaiting"
                            ? "bg-white text-gray-900 shadow-2xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Awaiting from client
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContentStatus("received");
                          set({ contentStatus: "received" });
                        }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          contentStatus === "received"
                            ? "bg-white text-gray-900 shadow-2xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Received
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Posted now; processing starts when it arrives.
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
                  <div className="w-full sm:w-44 shrink-0 font-bold text-gray-900 text-xs">
                    Priority
                  </div>
                  <div className="flex-1">
                    <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
                      {["Normal", "Urgent"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPriority(p);
                            set({ priority: p });
                          }}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            priority === p
                              ? "bg-white text-gray-900 shadow-2xs"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Payment reminder (Advance not received) */}
                {!s.rcpt && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3 border-b border-gray-100">
                    <div className="w-full sm:w-44 shrink-0">
                      <div className="font-bold text-gray-900 text-xs">
                        Payment reminder
                      </div>
                      <div className="text-[10px] text-gray-400 font-normal">
                        Advance not received
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="p-4 bg-white border border-gray-200 rounded-2xl flex items-center gap-3.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setAutoRemindClient(!autoRemindClient)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            autoRemindClient ? "bg-indigo-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                              autoRemindClient ? "transform translate-x-5" : ""
                            }`}
                          />
                        </button>
                        <div>
                          <div className="font-bold text-xs text-gray-900">
                            Auto-remind the client
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Sends on posting, then on Thu, 22 Oct
                          </div>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setShowReminderModal(true)}
                          className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                        >
                          Preview reminder
                        </button>
                      </div>

                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        {inr(effectiveAdv)} advance pending. The reminder says the invoice won't be generated and dispatch will be delayed until it's received.
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-3">
                  <div className="w-full sm:w-44 shrink-0">
                    <div className="font-bold text-gray-900 text-xs">Notes</div>
                    <div className="text-[10px] text-gray-400 font-normal">Optional</div>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="e.g. Winner list expected Friday"
                      value={postNotes}
                      onChange={(e) => {
                        setPostNotes(e.target.value);
                        set({ postNotes: e.target.value });
                      }}
                      className="w-full px-4 py-2.5 text-xs text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={!s.packOk || !s.delivOk}
                    className={`px-8 py-3 rounded-xl font-bold transition text-xs shadow-xs ${
                      s.packOk && s.delivOk
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        : "bg-[#a3e2c6] text-[#4f7866] opacity-80 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (s.packOk && s.delivOk) {
                        set({
                          released: true,
                          releasedAt: new Date().toISOString(),
                          hub: {
                            no: ids.ph || "PH/26/21072",
                            at: new Date().toISOString()
                          }
                        });
                      }
                    }}
                  >
                    Post to Production Hub
                  </button>
                  {(!s.packOk || !s.delivOk) && (
                    <span className="text-xs text-gray-400 font-medium">
                      Confirm packing first.
                    </span>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition cursor-pointer text-xs"
                    onClick={() => setSub(1)}
                  >
                    ← Back
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Proforma Invoice Overlay Modal */}
      {showProformaModal && (
        <PreviewProformaSheet
          s={s}
          set={set}
          client={client}
          job={job}
          ids={ids}
          items={items}
          prodGst={prodGst}
          adjustSampleCharges={adjustSampleCharges}
          advanceDue={effectiveAdv}
          deliveryDate={deliveryDate}
          onClose={() => setShowProformaModal(false)}
          onSend={(channel) => {
            set({
              pi: {
                no: ids.pi || `PI/26/${s.seq || "0415"}`,
                sent: channel,
                sentAt: new Date().toISOString()
              }
            });
            setShowProformaModal(false);
          }}
        />
      )}

      {/* Payment Reminder Overlay Modal (Screenshot 2) */}
      {showReminderModal && (
        <PreviewPaymentReminderSheet
          s={s}
          client={client}
          job={job}
          ids={ids}
          items={items}
          totalInvoiceVal={totalInvoiceVal}
          advanceDue={effectiveAdv}
          deliveryDate={deliveryDate}
          currentDeliv={s.deliv || {}}
          onClose={() => setShowReminderModal(false)}
          onSend={() => {
            set({
              advReminderSent: dfmt(todayISO())
            });
            setShowReminderModal(false);
          }}
        />
      )}
    </div>
  );
};

export default OrderPipeline;
