import React, { useState, useEffect } from "react";
import {
  isMulti,
  allItems,
  itemName,
  inr,
  gstTag,
  sampleTax,
  addWork,
  fmt,
  isoOf,
  eventDateOf,
  enqDelivDate,
  workDaysTo
} from "../../utils/helpers";
import BillingParty from "./BillingParty";
import PreviewDeliveryChargesSheet from "./PreviewDeliveryChargesSheet";
import CommunicationLogForm from "../common/CommunicationLogForm";

const DetailsStep = ({ s, set, client, job, next, ids }) => {
  const isS = s.mode === "sample";
  const qtyKey = isS ? "sampleQty" : "qty";
  const eventDate = eventDateOf(s.e);
  const sampleCost = s.costing ? s.costing.sampleRate : Math.round((job?.rate || 1000) * 1.5);

  const leadDays = isS ? [1, 2, 3, 5] : [10, 12, 15];

  const costingLines = (s.costing?.lines && s.costing.lines.length > 0)
    ? s.costing.lines
    : allItems(s).map((it, idx) => {
        const key = it.id || it.rateKey || `line_${idx}`;
        const sim = s.simulatedRates?.[key] || s.simulatedRates?.[`${idx}-0`];
        const sRate = sim?.sample !== undefined ? sim.sample : (it.sampleRate || it.rate || 1820);
        return {
          id: key,
          name: it.name || it.title || it.type || `Product ${idx + 1}`,
          spec: it.spec || `${it.type || 'Plaque'} · Composite with a solid base · ${it.size || (8 + idx) + ' in'} · Fusion: ${it.materials?.join(' + ') || it.mat || 'Crystal + Aluminium'} · Metal elements`,
          sampleRate: sRate
        };
      });
  const sampledItems = s.sampledItems || costingLines.map(l => l.id); // Default select all

  const toggleSampledItem = (id) => {
    if (sampledItems.includes(id)) {
      set({ sampledItems: sampledItems.filter(i => i !== id) });
    } else {
      set({ sampledItems: [...sampledItems, id] });
    }
  };

  const sampleChargePerSet = costingLines.reduce((acc, l) => {
    if (sampledItems.includes(l.id)) return acc + (l.sampleRate || 1820);
    return acc;
  }, 0);

  const displaySampleRate = s.sampleRateManual !== undefined ? s.sampleRateManual : sampleChargePerSet;
  const sampleSetsQty = s[qtyKey] || 1;
  const totalSampleCharge = sampleSetsQty * displaySampleRate;

  const absorbedPerPc = sampleChargePerSet > 0 ? sampleChargePerSet : 2180;
  const absorbedTotal = absorbedPerPc * sampleSetsQty;

  const pick = (k, v, how = "picked") =>
    set({ [k]: v, touched: { ...s.touched, [k]: how } });

  // Helper to safely get the previous calendar day (YYYY-MM-DD)
  const getPreviousDayISO = (dateStr) => {
    if (!dateStr) return undefined;
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length !== 3) return undefined;
    const [y, m, d] = parts.map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Needed by date (delivery deadline / event date from enquiry)
  const neededByDateRaw = s.e?.neededByDate || s.e?.eventExactDate || s.e?.eventDate;
  const neededByDate = neededByDateRaw ? new Date(neededByDateRaw) : null;
  const neededByDateISO = neededByDateRaw ? String(neededByDateRaw).slice(0, 10) : "";

  // The maximum allowed job delivery date must be strictly before needed by date
  const maxJobDeliveryDateISO = getPreviousDayISO(neededByDateISO);

  // Job delivery date (when shop floor delivers / completes)
  // Strictly Job Delivery Date: prioritizes manual edit, enquiry job completion date, or day before needed by date
  const enquiryJobDate = s.e?.job_completion_date || s.e?.jobCompletionDate;
  const jobDeliveryDateRaw = s.jobDeliveryDate || enquiryJobDate || maxJobDeliveryDateISO || "";
  const jobDeliveryDate = jobDeliveryDateRaw ? new Date(jobDeliveryDateRaw) : null;

  // Validation: job delivery date must be strictly before needed by date
  const isJobDeliveryAfterNeededBy = Boolean(
    neededByDateISO &&
    jobDeliveryDateRaw &&
    String(jobDeliveryDateRaw).slice(0, 10) >= neededByDateISO
  );

  const targetDate = jobDeliveryDate || (neededByDateRaw ? new Date(neededByDateRaw) : null);

  const handleJobDeliveryDateChange = (val) => {
    if (neededByDateISO && val >= neededByDateISO) {
      set({ 
        jobDeliveryDate: val, 
        jobDeliveryDateError: `Job delivery date must be before needed by date (${fmt(neededByDate)})` 
      });
    } else {
      set({ jobDeliveryDate: val, jobDeliveryDateError: null });
    }
  };

  const earliestSampleDateObj = addWork(2);
  const earliestSampleDateISO = isoOf(earliestSampleDateObj);

  let daysForProduction = null;
  let urgencyLevel = "safe";

  if (s.leadDate && targetDate) {
    const sDate = new Date(s.leadDate);
    const diffMs = targetDate.getTime() - sDate.getTime();
    daysForProduction = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysForProduction < 4) {
      urgencyLevel = "critical";
    } else if (daysForProduction < 8) {
      urgencyLevel = "tight";
    } else {
      urgencyLevel = "safe";
    }
  }

  React.useEffect(() => {
    if (!s.leadDate) {
      const defaultDays = isS ? 2 : 10;
      const d = addWork(defaultDays);
      set({ leadDate: isoOf(d), lead: defaultDays });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fade space-y-4">
      {/* GSTIN Reminder Banner */}
      {client && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
          <div>
            <strong>Client GST Status:</strong>{" "}
            {client.gstin ? `GSTIN Registered (${client.gstin})` : "GST Registration Pending / Not Provided"}
          </div>
          {!client.gstin && (
            <span className="text-[11px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-300">
              Reminder at Production
            </span>
          )}
        </div>
      )}

      {/* Primary Details Panel */}
      <div className="panel p-4 bg-white border rounded-xl shadow-sm space-y-4">
        {/* Quantity Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            {isS
              ? isMulti(s)
                ? "How many sample sets? (one piece of each sampled item per set)"
                : "How many sample sets? (one piece of each sampled item per set)"
              : "Order quantity"}
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center border border-gray-200 rounded-full bg-white px-2 py-1 shadow-xs">
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-medium transition"
                onClick={() => set({ [qtyKey]: Math.max(1, (s[qtyKey] || 1) - 1) })}
              >
                -
              </button>
              <input
                className="w-10 text-center py-0.5 text-sm font-bold bg-transparent outline-none text-gray-800"
                type="number"
                value={s[qtyKey] || 1}
                onChange={(e) =>
                  set({ [qtyKey]: parseInt(e.target.value) || 1 })
                }
              />
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg font-medium transition"
                onClick={() => set({ [qtyKey]: (s[qtyKey] || 1) + 1 })}
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(isS ? [1, 2, 3, 5] : [50, 100, 250, 500]).map((q) => {
                const isSelected = (s[qtyKey] || (isS ? 1 : 100)) === q;
                const isRecommended = isS && q === 2;

                if (isSelected) {
                  return (
                    <button
                      key={q}
                      type="button"
                      className="w-8 h-8 rounded-full bg-[#4F46E5] text-white font-bold text-xs flex items-center justify-center shadow-xs transition"
                      onClick={() => pick(qtyKey, q)}
                    >
                      {q}
                    </button>
                  );
                }

                if (isRecommended) {
                  return (
                    <button
                      key={q}
                      type="button"
                      className="px-2.5 h-8 rounded-full border border-dashed border-amber-400 bg-white text-gray-800 text-xs font-semibold flex items-center gap-1 hover:bg-amber-50/50 transition"
                      onClick={() => pick(qtyKey, q)}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      <span>{q}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={q}
                    type="button"
                    className="w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium flex items-center justify-center transition"
                    onClick={() => pick(qtyKey, q)}
                  >
                    {isS ? q : `${q} pcs`}
                  </button>
                );
              })}
            </div>
          </div>
          {!isS && s.e && s.e.qty && (
            <p className="text-xs text-gray-400 mt-1">Enquiry indicated {s.e.qty} pcs.</p>
          )}
        </div>

        {/* Sample Charges Section (Sample Mode Only) */}
        {isS && (
          <div className="space-y-3 pt-3 border-t">
            <div className="text-xs font-bold text-gray-800">Sample charge</div>
            <div className="flex gap-2 flex-wrap items-center">
              {[
                ["foc", "Free of cost"],
                ["charge", "Chargeable"],
                ["adjust", "Charge, adjust against PO ★"]
              ].map(([k, l]) => {
                const isSel = (s.charge || "foc") === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`py-2 px-4 text-xs rounded-xl border transition ${
                      isSel
                        ? "bg-white border-gray-300 text-gray-900 font-semibold shadow-xs"
                        : "bg-white border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-normal"
                    }`}
                    onClick={() => {
                      pick("charge", k);
                      if (k === "foc") {
                        set({ charge: "foc", sampleRate: 0, sampleRateManual: 0 });
                      } else {
                        set({ charge: k, sampleRate: displaySampleRate || 1820 });
                      }
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 font-normal">This client has paid for samples before.</p>

            {/* If Chargeable or Adjust PO, show Billing Party */}
            {(s.charge === "charge" || s.charge === "adjust") && (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-bold text-gray-900">Sample invoice billed to</div>
                <BillingParty s={s} set={set} client={client} compact />
              </div>
            )}

            {/* Items to sample Card */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-xs">
              <div className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span>Items to sample</span>
              </div>
              <div className="divide-y divide-gray-100">
                {costingLines.length > 0 ? (
                  costingLines.map((l) => {
                    return (
                      <div key={l.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-900 leading-snug">{l.name}</div>
                          <div className="text-[11px] text-gray-400 leading-snug mt-0.5">
                            {l.spec || `${l.category || 'Plaque'} · ${l.base || 'Composite with a solid base'} · ${l.size || '8 in'} · Fusion: ${l.material || 'Crystal + Aluminium · Metal elements'}`}
                          </div>
                        </div>
                        {/* Only show rate editing if NOT Free of Cost */}
                        {(s.charge === "charge" || s.charge === "adjust") && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-gray-400 font-normal">₹</span>
                            <input
                              type="number"
                              className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none text-gray-900 font-semibold"
                              value={l.sampleRate !== undefined ? l.sampleRate : (s.simulatedRates?.[l.id]?.sample || 1820)}
                              onChange={(e) => {
                                const newRate = parseInt(e.target.value) || 0;
                                const updatedLines = costingLines.map(line => line.id === l.id ? { ...line, sampleRate: newRate } : line);
                                set({
                                  costing: { ...(s.costing || {}), lines: updatedLines },
                                  simulatedRates: {
                                    ...(s.simulatedRates || {}),
                                    [l.id]: {
                                      ...(s.simulatedRates?.[l.id] || {}),
                                      sample: newRate
                                    }
                                  }
                                });
                              }}
                            />
                            <span className="text-[11px] text-gray-400 font-normal">/pc</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-400 italic py-2">No trophies selected for sampling.</div>
                )}
              </div>
            </div>

            {/* Sample charge per set Card */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-xs">
              <div className="text-xs font-bold text-gray-800 mb-2.5">
                Sample charge per set (all sampled items)
              </div>

              {(s.charge || "foc") === "foc" ? (
                <div>
                  <div className="border-2 border-[#4F46E5] rounded-2xl p-3.5 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-gray-800">₹ 0</span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">/pc</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-2.5 leading-relaxed">
                    Free of cost. RD absorbs about ₹{inr(absorbedTotal).replace('₹', '')} (₹{inr(absorbedPerPc).replace('₹', '')}/pc at quote + setup). This is logged against the job for MIS.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Big input box with purple border */}
                    <div className="border-2 border-[#4F46E5] rounded-2xl p-3 flex items-center justify-between bg-white w-64 shadow-xs">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-xl font-bold text-gray-700">₹</span>
                        <input
                          type="number"
                          className="text-xl font-bold text-gray-800 bg-transparent outline-none w-full"
                          value={displaySampleRate}
                          onChange={(e) => set({ sampleRateManual: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <span className="text-xs text-gray-400 font-medium">/pc</span>
                    </div>

                    {/* Breakdown next to box: 1 pcs x ₹4,400 = ₹4,400 incl./+ 18% GST */}
                    <div className="text-xs text-gray-700 font-medium flex items-center">
                      <span>{sampleSetsQty} pcs × ₹{displaySampleRate.toLocaleString('en-IN')} = </span>
                      <strong className="text-sm font-bold text-gray-900 ml-1">₹{(displaySampleRate * sampleSetsQty).toLocaleString('en-IN')}</strong>
                      <span className="text-gray-600 ml-1">
                        {(s.sampleGstIncl === true) ? `incl. ${s.sampleGst || 18}% GST` : `+ ${s.sampleGst || 18}% GST`}
                      </span>
                    </div>
                  </div>

                  {/* Toggle pills */}
                  <div className="flex items-center gap-6 pt-1 flex-wrap">
                    <div>
                      <div className="text-[11px] text-gray-500 font-medium mb-1">This amount is</div>
                      <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                        <button
                          type="button"
                          className={`px-3.5 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                            !s.sampleGstIncl ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
                          }`}
                          onClick={() => set({ sampleGstIncl: false })}
                        >
                          Excluding GST
                        </button>
                        <button
                          type="button"
                          className={`px-3.5 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                            s.sampleGstIncl ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
                          }`}
                          onClick={() => set({ sampleGstIncl: true })}
                        >
                          Including GST
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-gray-500 font-medium mb-1">GST rate</div>
                      <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                        {[5, 18].map((r) => {
                          const activeGst = s.sampleGst !== undefined ? s.sampleGst : 18;
                          return (
                            <button
                              key={r}
                              type="button"
                              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                                activeGst === r ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
                              }`}
                              onClick={() => set({ sampleGst: r })}
                            >
                              {r}%
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Calculation Card */}
                  {(() => {
                    const gstRate = s.sampleGst !== undefined ? s.sampleGst : 18;
                    const isGstIncl = s.sampleGstIncl === true;
                    const baseCharge = displaySampleRate * sampleSetsQty;

                    let taxableValue = 0;
                    let gstAmount = 0;
                    let invoiceTotal = 0;
                    let perPcExclGst = 0;

                    if (isGstIncl) {
                      invoiceTotal = baseCharge;
                      taxableValue = Math.round(baseCharge / (1 + gstRate / 100));
                      gstAmount = invoiceTotal - taxableValue;
                      perPcExclGst = Math.round(taxableValue / (sampleSetsQty || 1));
                    } else {
                      taxableValue = baseCharge;
                      gstAmount = Math.round(taxableValue * (gstRate / 100));
                      invoiceTotal = taxableValue + gstAmount;
                      perPcExclGst = Math.round(taxableValue / (sampleSetsQty || 1));
                    }

                    return (
                      <>
                        <div className="border border-gray-200 rounded-2xl p-4 bg-white mt-3 shadow-xs">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-[11px] text-gray-500 font-medium">Taxable value</div>
                              <div className="text-xl font-bold text-gray-900 mt-0.5">₹{taxableValue.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500 font-medium">GST @ {gstRate}%</div>
                              <div className="text-xl font-bold text-gray-900 mt-0.5">₹{gstAmount.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500 font-medium">Sample invoice total</div>
                              <div className="text-xl font-bold text-indigo-700 mt-0.5">₹{invoiceTotal.toLocaleString('en-IN')}</div>
                            </div>
                          </div>

                          {isGstIncl && (
                            <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                              Rate excluding GST works out to ₹{perPcExclGst.toLocaleString('en-IN')}/pc.
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                          Total of the item rates above. Change a rate there to update it.
                        </p>

                        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
                          <span className="bg-emerald-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">✓</span>
                          <span>A separate sample invoice of ₹{invoiceTotal.toLocaleString('en-IN')} incl. GST will be raised on dispatch.</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PO details (Production Mode Only) */}
        {!isS && (
          <div className="space-y-2 pt-3 border-t">
            <div className="text-xs font-bold text-gray-900">Client PO Number</div>
            <div className="flex items-center gap-2">
              <input
                className="border rounded px-3 py-1.5 text-sm bg-white flex-1 max-w-xs"
                placeholder="Enter PO number"
                value={s.po || ""}
                disabled={s.poPending}
                onChange={(ev) => set({ po: ev.target.value, touched: { ...s.touched, po: "typed" } })}
              />
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${
                  s.poPending
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => set({ poPending: !s.poPending, po: "" })}
              >
                PO to follow
              </button>
            </div>
          </div>
        )}

        {/* Delivery / Lead Time */}
        <div className="space-y-3 pt-4 pb-2 border-t mt-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-gray-800">
              {isS ? "Sampling time · sample ready by" : "Delivery Date"}
            </span>

            {/* Target Job Delivery Date */}
            <div className="flex flex-col items-end">
              <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1 border transition ${
                isJobDeliveryAfterNeededBy || s.jobDeliveryDateError
                  ? "bg-red-50 border-red-300"
                  : "bg-indigo-50/70 border-indigo-100"
              }`}>
                <span className="text-[11px] font-semibold text-indigo-900">Job delivery date:</span>
                <input
                  type="date"
                  max={maxJobDeliveryDateISO || undefined}
                  className={`bg-white border rounded px-1.5 py-0.5 text-xs font-bold outline-none cursor-pointer transition ${
                    isJobDeliveryAfterNeededBy || s.jobDeliveryDateError
                      ? "border-red-400 text-red-900 bg-red-50"
                      : "border-indigo-200 text-indigo-950 focus:border-indigo-400"
                  }`}
                  value={jobDeliveryDateRaw ? String(jobDeliveryDateRaw).slice(0, 10) : ""}
                  onChange={(e) => handleJobDeliveryDateChange(e.target.value)}
                />
                {neededByDate && (
                  <span className="text-[10px] text-indigo-600 font-medium whitespace-nowrap">
                    (Needed by: {fmt(neededByDate)})
                  </span>
                )}
              </div>
              {(isJobDeliveryAfterNeededBy || s.jobDeliveryDateError) && (
                <span className="text-[10px] font-bold text-red-600 mt-1">
                  {s.jobDeliveryDateError || `Must be before needed by date (${fmt(neededByDate)})`}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            {isS
              ? "Calculated backwards from the job delivery date so shop floor has adequate time for bulk production."
              : "Pick the delivery date and the working days needed are worked out."}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-700 font-semibold">{isS ? "Sample ready date:" : "Delivery date:"}</span>
            <input
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white text-gray-800 font-semibold outline-none shadow-xs"
              type="date"
              value={s.leadDate || ""}
              onChange={(e) =>
                set({
                  leadDate: e.target.value,
                  lead: workDaysTo(e.target.value),
                  touched: { ...s.touched, leadDate: "picked" }
                })
              }
            />

            {/* Quick 1-click Earliest Target */}
            {isS && (
              <button
                type="button"
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 transition flex items-center gap-1 cursor-pointer"
                onClick={() =>
                  set({
                    leadDate: earliestSampleDateISO,
                    lead: 2,
                    touched: { ...s.touched, leadDate: "picked" }
                  })
                }
              >
                <span>⚡ Earliest: {fmt(earliestSampleDateObj)}</span>
                <span className="text-[10px] text-indigo-500 font-normal">(2 working days)</span>
              </button>
            )}

            {s.lead ? (
              <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 font-medium px-2.5 py-1 rounded-lg">
                {s.lead} working {s.lead === 1 ? "day" : "days"} to make
              </span>
            ) : null}
          </div>

          {/* Dynamic Production Buffer & Turnaround Alert */}
          {isS && targetDate && daysForProduction !== null && (
            <div className="pt-1">
              {urgencyLevel === "safe" && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2 shadow-xs">
                  <span className="text-emerald-600 font-bold text-sm">✓</span>
                  <div>
                    <div className="font-bold">Safe Buffer ({daysForProduction} days left for bulk production)</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      Sample ready by {fmt(new Date(s.leadDate))} leaves ample time for client approval and bulk manufacturing before final delivery on {fmt(targetDate)}.
                    </div>
                  </div>
                </div>
              )}

              {urgencyLevel === "tight" && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2 shadow-xs">
                  <span className="text-amber-600 font-bold text-sm">⚠️</span>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>Tight Turnaround ({daysForProduction} days left for bulk production)</span>
                      <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Rush</span>
                    </div>
                    <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Delivery is on {fmt(targetDate)}. Physical courier may lose 1-2 days. <strong>Recommended:</strong> Approve sample via <strong>Shop Floor HD Photo/Video</strong> on WhatsApp so bulk production starts immediately!
                    </div>
                  </div>
                </div>
              )}

              {urgencyLevel === "critical" && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-start gap-2 shadow-xs">
                  <span className="text-rose-600 font-bold text-sm">🚨</span>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>Critical Deadline ({Math.max(0, daysForProduction)} days left before {fmt(targetDate)})</span>
                      <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">High Risk</span>
                    </div>
                    <div className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                      Physical sample transit will cause the delivery deadline to be missed! <strong>Action required:</strong> Switch to <em>"Straight to Production"</em> or mandate instant digital photo/video approval on dispatch date.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Delivery Details Form (Always rendered for both Sample and Production) */}
        <div className="mt-6 space-y-0">
          {/* Top Destination Summary */}
          {isS ? (
            <div className="flex gap-4 mb-6">
              <div className="flex-1 p-3 border-2 border-amber-400 rounded-xl bg-[#FFFDF0] flex items-start gap-3 shadow-xs">
                <span className="text-2xl mt-1 leading-none">🧪</span>
                <div className="flex flex-col h-full justify-between w-full">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Sample Goes To</div>
                    <div className="font-bold text-base text-gray-900">{client?.shipTos?.[0]?.label || "Andheri East office"}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {s.sampleCarrier ? `${s.sampleCarrier}, ${s.sampleFreight === 'RD pays freight' ? 'we pay' : 'client pays'}` : "Not selected"}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">Set Below</div>
                </div>
              </div>
              <div className="flex-1 p-3 border-2 border-emerald-500 rounded-xl bg-emerald-50/50 flex items-start gap-3 shadow-xs">
                <span className="text-2xl mt-1 leading-none">🏭</span>
                <div className="flex flex-col h-full justify-between w-full">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Final Order Goes To</div>
                    <div className="font-bold text-base text-gray-900">{client?.shipTos?.[0]?.label || "Andheri East office"}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Outstation, Maharashtra · {s.sampleCity || "goa"} · by {targetDate ? fmt(targetDate) : "Sat, 31 Oct"}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">From the enquiry · Confirmed at dispatch</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 border-2 border-emerald-500 rounded-xl bg-emerald-50/50 flex items-start gap-3 shadow-xs mb-6">
              <span className="text-2xl mt-1 leading-none">🏭</span>
              <div className="flex flex-col h-full justify-between w-full">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Final Order Goes To</div>
                  <div className="font-bold text-base text-gray-900">{client?.shipTos?.[0]?.label || "Andheri East office"}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Local delivery · by {s.leadDate ? fmt(new Date(s.leadDate)) : (targetDate ? fmt(targetDate) : "Sat, 31 Oct")}
                  </div>
                </div>
                <div className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">From the enquiry</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 pt-2 border-t border-transparent">
            <span className="text-emerald-500 text-lg leading-none">{isS ? "🧪" : "🚚"}</span>
            <span className="text-xs font-bold text-gray-800">
              {isS ? "Sample delivery details" : "Delivery details"}{" "}
              <span className="text-gray-400 font-normal text-[10px] ml-1">(editable later on the job page)</span>
            </span>
          </div>

          {!isS && (
            <div className="p-3 bg-gray-50/60 border border-gray-200 rounded-xl mb-4 text-xs space-y-1">
              <div className="grid grid-cols-[140px_1fr_auto] gap-2 py-0.5 text-gray-600">
                <span className="text-[11px] text-gray-500">Logged at enquiry</span>
                <span className="font-medium text-gray-800">{client?.shipTos?.[0]?.label || "Andheri East office"}</span>
                <span className="text-gray-500 font-medium">{s.leadDate ? fmt(new Date(s.leadDate)) : "Sat, 31 Oct"}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr_auto] gap-2 py-1 border-t border-gray-200/60 font-bold text-gray-900">
                <span className="text-[11px] text-gray-700">For this delivery</span>
                <span>{client?.shipTos?.[0]?.label || "Andheri East office"}</span>
                <span>{s.leadDate ? fmt(new Date(s.leadDate)) : "Sat, 31 Oct"}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 mt-2">{isS ? "Sample area" : "Destination"}</div>
              <div>
                <div className="flex bg-gray-50/50 p-1 border border-gray-200 rounded-full w-max mb-3 shadow-2xs">
                  {['Local', 'Maharashtra', 'In India', 'Abroad'].map(area => (
                    <button key={area} className={`px-3 py-1 text-[10px] font-semibold rounded-full transition flex items-center gap-1.5 ${s.sampleArea === area ? 'bg-white text-gray-900 border-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 border-2 border-transparent'}`} onClick={() => set({sampleArea: area})}>
                      {area === 'Local' && <span>🏙️</span>}
                      {area === 'Maharashtra' && <span>🛣️</span>}
                      {area === 'In India' && <span className="text-[8px] font-bold tracking-wider text-gray-400">IN</span>}
                      {area === 'Abroad' && <span>🌍</span>}
                      {area}
                    </button>
                  ))}
                </div>
                
                {(s.sampleArea === 'In India' || s.sampleArea === 'Maharashtra') && (
                  <div className="mb-1">
                    <input type="text" className="w-56 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs" placeholder="City, State" value={s.sampleCity || ""} onChange={e => set({sampleCity: e.target.value})} />
                  </div>
                )}
                
                {s.sampleArea === 'Abroad' && (
                  <div className="space-y-2 mb-1">
                    <input type="text" className="w-56 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs" placeholder="City" value={s.sampleCity || ""} onChange={e => set({sampleCity: e.target.value})} />
                    <input type="text" className="w-56 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs block" placeholder="Country" value={s.sampleCountry || ""} onChange={e => set({sampleCountry: e.target.value})} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 mt-2">Carrier</div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { n: 'Our vehicle', i: '🚐' },
                    { n: 'Hand delivery', i: '🤝' },
                    { n: 'Tempo', i: '🛺' },
                    { n: 'Porter', i: '🛵' },
                    { n: 'Courier', i: '📮' },
                    { n: 'Air cargo', i: '✈️' },
                    { n: "Client's courier", i: '📦' },
                    { n: 'Client pickup', i: '🏢' },
                    ...(isS ? [{ n: 'Photos / video only', i: '📷' }] : [])
                  ].map(c => (
                    <button key={c.n} className={`px-3 py-1 text-[10px] font-semibold rounded-full border transition flex items-center gap-1.5 ${(s.delivCarrier || s.sampleCarrier || 'Our vehicle') === c.n ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`} onClick={() => set({sampleCarrier: c.n, delivCarrier: c.n, dmode: c.n})}>
                      <span>{c.i}</span> {c.n}
                    </button>
                  ))}
                </div>
                
                {['Tempo', 'Porter', 'Courier', 'Air cargo'].includes(s.delivCarrier || s.sampleCarrier) && (
                  <div className="flex bg-gray-50/50 p-1 rounded-full border border-gray-200 w-max shadow-2xs mt-1">
                    <button 
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition ${(s.sampleFreight !== 'Client pays freight' && s.delivPayer !== 'client') ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700 border border-transparent'}`} 
                      onClick={() => set({sampleFreight: 'RD pays freight', delivPayer: 'rd'})}>
                      RD pays freight
                    </button>
                    <button 
                      className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition ${(s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-700 border border-transparent'}`} 
                      onClick={() => set({sampleFreight: 'Client pays freight', delivPayer: 'client'})}>
                      Client pays freight
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 mt-2">{isS ? "Sample goes to" : "Final delivery to"}</div>
              
              {s.isAddingNewAddress ? (
                <div className="p-4 border border-gray-200 rounded-xl bg-[#f9f9fb] shadow-xs">
                  <div className="grid grid-cols-[1fr_1fr_100px] gap-3 mb-3">
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">Name for this address</div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="e.g. goa venue" value={s.newAddrName || ''} onChange={e => set({newAddrName: e.target.value})} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">City / town</div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" placeholder="goa" value={s.newAddrCity || ''} onChange={e => set({newAddrCity: e.target.value})} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">PIN code</div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" value={s.newAddrPin || ''} onChange={e => set({newAddrPin: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-[9px] font-bold text-gray-500 mb-1">Full address</div>
                    <textarea className="w-full px-3 py-2 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white min-h-[60px] shadow-2xs" placeholder="Building, street, landmark" value={s.newAddrFull || ''} onChange={e => set({newAddrFull: e.target.value})}></textarea>
                  </div>
                  
                  <div className="grid grid-cols-[1fr_1fr] gap-3 mb-4 max-w-sm">
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">Contact at site <span className="font-normal text-gray-400 italic">(optional)</span></div>
                      <input type="text" className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" value={s.newAddrContact || ''} onChange={e => set({newAddrContact: e.target.value})} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 mb-1">Site mobile <span className="font-normal text-gray-400 italic">(optional)</span></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 font-medium">+91</span>
                        <input type="text" className="flex-1 px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white shadow-2xs" value={s.newAddrPhone || ''} onChange={e => set({newAddrPhone: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button className="px-4 py-1.5 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-2xs" onClick={() => set({isAddingNewAddress: false})}>Cancel</button>
                    <button className={`px-4 py-1.5 text-[11px] font-bold rounded-xl shadow-2xs transition ${s.newAddrName && s.newAddrCity && s.newAddrFull ? 'bg-amber-400 text-amber-900 hover:bg-amber-500' : 'bg-[#FDE6A6] text-[#D4A34F] cursor-not-allowed'}`}>Save and deliver here</button>
                    {(!s.newAddrName || !s.newAddrCity || !s.newAddrFull) && (
                      <span className="text-[10px] text-gray-400 font-medium">Name, full address and city are needed.</span>
                    )}
                  </div>
                </div>
              ) : s.isChangingAddress ? (
                <div className="flex items-center gap-2">
                  <select className="px-3 py-1.5 text-[11px] font-medium text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 bg-white shadow-2xs">
                    <option>{client?.shipTos?.[0]?.label || "Andheri East office"} (from enquiry)</option>
                    <option>mumbai Office</option>
                  </select>
                  <button className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 px-2" onClick={() => set({isAddingNewAddress: true})}>+ Add a new address</button>
                  <button className="text-[11px] font-medium text-gray-400 hover:text-gray-600" onClick={() => set({isChangingAddress: false})}>Cancel</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {!isS && (
                    <div className="flex bg-gray-50/50 p-1 border border-gray-200 rounded-full w-max shadow-2xs">
                      <button
                        type="button"
                        className={`px-3 py-1 text-[10px] font-semibold rounded-full transition ${
                          s.delivSplit !== "split"
                            ? "bg-white text-gray-900 border-2 border-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 border-2 border-transparent"
                        }`}
                        onClick={() => set({ delivSplit: "one" })}
                      >
                        One address
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-[10px] font-semibold rounded-full transition ${
                          s.delivSplit === "split"
                            ? "bg-white text-gray-900 border-2 border-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 border-2 border-transparent"
                        }`}
                        onClick={() => set({ delivSplit: "split" })}
                      >
                        Split across locations
                      </button>
                    </div>
                  )}
                  {isS && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-semibold text-gray-400">Quick pick:</span>
                      <button className="px-3 py-1 text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-sm">Same as final delivery</button>
                      <button className="px-3 py-1 text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-sm">{client?.shipTos?.[0]?.label || "Andheri East office"}</button>
                      <button className="px-3 py-1 text-[10px] font-bold rounded-full bg-white text-indigo-600 border border-dashed border-indigo-600 hover:bg-indigo-50 transition" onClick={() => { set({isChangingAddress: true}); set({isAddingNewAddress: true}); }}>+ Other address</button>
                    </div>
                  )}
                  <div className="p-3 border border-emerald-500 bg-white rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-rose-500 text-sm mt-0.5">📍</span>
                      <div>
                        <div className="text-[9px] text-gray-400 font-medium mb-0.5">
                          {isS ? "Sample goes to the final delivery address" : "Final delivery · address from the enquiry"}
                        </div>
                        <div className="font-bold text-[11px] text-gray-900">{client?.shipTos?.[0]?.label || "Andheri East office"}</div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col justify-between items-end">
                      <div className="text-[10px] text-emerald-700 font-bold mb-1.5">{isS ? "✓ Sample goes here" : "✓ Confirmed"}</div>
                      <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800" onClick={() => set({isChangingAddress: true})}>Change</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 py-4 border-t border-gray-100">
              <div>
                <div className="text-[10px] font-bold text-gray-500 mb-1.5">Receiver</div>
                <select className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-full outline-none focus:border-indigo-500 bg-white transition shadow-2xs" value={s.sampleReceiver || ""} onChange={e => set({sampleReceiver: e.target.value})}>
                  <option value="">{client?.contacts?.[0]?.name || "Sneha Kulkarni"} - {client?.contacts?.[0]?.role || "HR"}</option>
                  {client?.contacts?.slice(1).map(c => (
                    <option key={c.id} value={c.name}>{c.name} - {c.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-500 mb-1.5">When</div>
                <select className="w-full px-3 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-full outline-none focus:border-indigo-500 bg-white transition shadow-2xs" value={s.sampleWhen || ""} onChange={e => set({sampleWhen: e.target.value})}>
                  <option value="Office hours">Office hours</option>
                  <option value="Anytime">Anytime</option>
                  <option value="Morning only">Morning only</option>
                </select>
              </div>
            </div>

            {['Tempo', 'Porter', 'Courier', 'Air cargo'].includes(s.delivCarrier || s.sampleCarrier) && (
              <div className="grid grid-cols-[90px_1fr] gap-3 items-start py-4 border-t border-gray-100 min-h-[60px]">
                <div className="text-[10px] font-bold text-gray-500 mt-2">Charges</div>
                
                {/* INITIAL / UNREQUESTED */}
                {!s.sampleChargesState && (
                  <div className="flex items-center gap-2 mt-1">
                    <button className="px-4 py-1.5 text-[10px] font-semibold text-gray-700 border border-gray-200 rounded-full bg-white hover:bg-gray-50 transition shadow-2xs" onClick={() => set({sampleChargesState: 'requested'})}>Request cost from Dispatch</button>
                    <span className="text-[10px] text-gray-400">Optional · the job can be posted without it</span>
                  </div>
                )}
                
                {/* REQUESTED */}
                {s.sampleChargesState === 'requested' && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-full">Requested 10 Oct 2026 · awaiting</div>
                    <button className="px-4 py-1.5 text-[10px] font-semibold text-gray-700 border border-gray-200 rounded-full bg-white hover:bg-gray-50 transition shadow-2xs" onClick={() => set({sampleChargesState: 'inputting_amount'})}>Simulate: Dispatch sends the cost</button>
                  </div>
                )}
                
                {/* INPUTTING AMOUNT */}
                {s.sampleChargesState === 'inputting_amount' && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]">₹</span>
                      <input type="number" autoFocus className="w-24 pl-6 pr-3 py-1.5 text-[11px] font-bold text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 shadow-2xs" placeholder="Amount" value={s.sampleChargesAmount || ''} onChange={e => set({sampleChargesAmount: e.target.value})} onKeyDown={e => e.key === 'Enter' && s.sampleChargesAmount && set({sampleChargesState: 'simulated'})} />
                    </div>
                    <button className={`px-4 py-1.5 text-[10px] font-bold rounded-full shadow-2xs transition ${s.sampleChargesAmount ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} onClick={() => s.sampleChargesAmount && set({sampleChargesState: 'simulated'})}>Save</button>
                    <button className="text-[10px] font-medium text-gray-400 hover:text-gray-600" onClick={() => set({sampleChargesState: 'requested'})}>Cancel</button>
                  </div>
                )}
                
                {/* SIMULATED OR AWAITING APPROVAL OR SELECTING MODE OR APPROVED */}
                {(s.sampleChargesState === 'simulated' || s.sampleChargesState === 'awaiting_approval' || s.sampleChargesState === 'selecting_approval_mode' || s.sampleChargesState === 'approved') && (
                  <div className="flex flex-col gap-2 mt-0.5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-[11px] font-bold text-gray-900">₹{s.sampleChargesAmount}</div>
                        <button 
                          className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 underline"
                          onClick={() => set({ sampleChargesState: 'inputting_amount' })}
                        >
                          change
                        </button>
                        <span className="text-[11px] font-medium text-gray-500 ml-1">
                          + GST · {s.delivCarrier || s.sampleCarrier || 'Porter'} · DC/{ids?.enq?.replace('RD', '') || "21071"}{isS ? '-S' : '-P'}
                        </span>
                      </div>
                      
                      {(s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') ? (
                        <div className="px-2.5 py-0.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-full">Client pays · added to the invoice</div>
                      ) : (
                        <div className="px-2.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">RD pays · logged to job cost</div>
                      )}
                    </div>
                    
                    {s.sampleChargesState === 'simulated' && (
                      <div>
                        <div className="flex items-center gap-3">
                          <button className="px-4 py-1.5 text-[10px] font-bold bg-amber-400 text-amber-900 hover:bg-amber-500 rounded-lg shadow-2xs transition" onClick={() => set({isPreviewingDeliveryCharges: true})}>Send to client for approval</button>
                          <button className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900" onClick={() => set({sampleChargesState: undefined, sampleChargesAmount: ''})}>Reset</button>
                        </div>
                        {(s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') ? (
                          <div className="text-[10px] text-gray-400 mt-2">Once approved, the charges go on the invoice.</div>
                        ) : (
                          <div className="text-[10px] text-gray-400 mt-2">RD is paying this freight. Should the client pay instead? <button className="font-bold text-indigo-700 hover:text-indigo-900" onClick={() => set({sampleFreight: 'Client pays freight', delivPayer: 'client'})}>Switch to client pays</button></div>
                        )}
                      </div>
                    )}
                    
                    {s.sampleChargesState === 'awaiting_approval' && (
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-lg">Sent via Hand-delivered / other · awaiting OK</div>
                          <button className="px-4 py-1.5 text-[10px] font-bold bg-[#059669] text-white hover:bg-emerald-700 rounded-lg shadow-2xs transition" onClick={() => set({sampleChargesState: 'selecting_approval_mode'})}>Client approved charges</button>
                          <button className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900" onClick={() => set({isPreviewingDeliveryCharges: true})}>Resend</button>
                          <button className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900" onClick={() => set({sampleChargesState: undefined, sampleChargesAmount: ''})}>Reset</button>
                        </div>
                        {(s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') ? (
                          <div className="text-[10px] text-gray-400 mt-2">Once approved, the charges go on the invoice.</div>
                        ) : (
                          <div className="text-[10px] text-gray-400 mt-2">RD is paying this freight. Should the client pay instead? <button className="font-bold text-indigo-700 hover:text-indigo-900" onClick={() => set({sampleFreight: 'Client pays freight', delivPayer: 'client'})}>Switch to client pays</button></div>
                        )}
                      </div>
                    )}
                    
                    {s.sampleChargesState === 'selecting_approval_mode' && (
                      <CommunicationLogForm
                        client={client}
                        mode="delivery-charges"
                        feedbackMode="approve"
                        amount={s.sampleChargesAmount}
                        onBack={() => set({sampleChargesState: 'awaiting_approval'})}
                        onLog={(logData) => {
                          let methodText = 'Hand-delivered / other';
                          if (logData.method === 'whatsapp') methodText = 'WhatsApp';
                          else if (logData.method === 'email') methodText = 'Email';
                          else if (logData.method === 'verbal') methodText = 'Verbal';
                          else if (logData.method === 'written') methodText = 'Written / PO';
                          else if (logData.method === 'screenshot') methodText = 'Screenshot';
                          
                          set({
                            sampleApprovalMethod: methodText,
                            sampleChargesState: 'approved'
                          });
                        }}
                      />
                    )}
                    
                    {s.sampleChargesState === 'approved' && (
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-lg">Approved via {s.sampleApprovalMethod}</div>
                          <button className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900" onClick={() => set({sampleChargesState: undefined, sampleChargesAmount: ''})}>Reset</button>
                        </div>
                        {(s.sampleFreight === 'Client pays freight' || s.delivPayer === 'client') ? (
                          <div className="text-[10px] text-gray-400 mt-2">The charges will be added to the invoice.</div>
                        ) : (
                          <div className="text-[10px] text-gray-400 mt-2">Logged to job cost.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-[90px_1fr] gap-3 items-center py-4 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500">Notes</div>
              <input type="text" className="w-full px-4 py-1.5 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-full outline-none focus:border-indigo-500 transition shadow-2xs" placeholder="e.g. Call 30 minutes before; reception, 8th floor" value={s.sampleNotes || s.delivNotes || ""} onChange={e => set({sampleNotes: e.target.value, delivNotes: e.target.value})} />
            </div>

            <div className="py-4 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-2">
                Anything new for the team? <span className="font-normal text-[9px] text-gray-400">(optional · the enquiry brief is already attached)</span>
              </div>
              <textarea className="w-full px-4 py-2 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition min-h-[60px] shadow-2xs" placeholder="e.g. Winner names will come by Friday" value={s.sampleBrief || s.remarks || ""} onChange={e => set({sampleBrief: e.target.value, remarks: e.target.value})}></textarea>
            </div>
          </div>
        </div>

      {/* Navigation Buttons */}
      <div className="actions flex justify-between items-center pt-3 border-t">
        <button
          className="btn ghost text-xs text-gray-600 hover:bg-gray-100 px-3 py-2 rounded"
          onClick={() => set({ step: s.step - 1 })}
        >
          ← Back
        </button>
        <button
          className="btn gold px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition"
          disabled={!s.leadDate || Boolean(isJobDeliveryAfterNeededBy || s.jobDeliveryDateError)}
          onClick={() => {
            const ch = s.charge || "foc";
            set({
              charge: ch,
              sampleRate: ch === "foc" ? 0 : (displaySampleRate || s.sampleRate || 0),
              dmode: s.delivCarrier || s.sampleCarrier || s.dmode || "Our vehicle"
            });
            next();
          }}
        >
          Review ticket
        </button>
      </div>

      {s.isPreviewingDeliveryCharges && (
        <PreviewDeliveryChargesSheet
          s={s}
          client={client}
          ids={ids}
          onClose={() => set({ isPreviewingDeliveryCharges: false })}
          onSend={() => {
            set({ sampleChargesState: 'awaiting_approval', isPreviewingDeliveryCharges: false });
          }}
        />
      )}
    </div>
  );
};

export default DetailsStep;
