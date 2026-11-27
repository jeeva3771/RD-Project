import React from "react";
import BillingParty from "../BillingParty";
import { inr } from "../../../utils/helpers";
import { generateSpecLine } from "../../../utils/specLineGenerator";

/**
 * SamplePricingSection
 * Handles Free of Cost (FOC), Chargeable, and Adjust against PO modes,
 * items to sample toggles, individual sample rates, GST options, and invoice totals.
 */
const SamplePricingSection = ({
  s,
  set,
  client,
  pick,
  displaySampleRate,
  costingLines = [],
  sampledItems = [],
  toggleSampledItem,
  sampleSetsQty = 1,
  absorbedTotal = 0,
  absorbedPerPc = 0,
}) => {
  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="text-xs font-bold text-gray-800">Sample charge</div>
      <div className="flex gap-2 flex-wrap items-center">
        {[
          ["foc", "Free of cost"],
          ["charge", "Chargeable"],
          ["adjust", "Charge, adjust against PO ★"],
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
                  set({ charge: "foc", sampleRate: 0, sampleRateManual: 0, syncNow: true });
                } else {
                  const restoredLines = costingLines.map((line) => {
                    const r = Number(
                      (line.sampleRate !== undefined && Number(line.sampleRate) > 0)
                        ? line.sampleRate
                        : (line.quotationSampleRate || (line.rate ? line.rate + 200 : 0))
                    );
                    return { ...line, sampleRate: r };
                  });
                  const restoredTotal = restoredLines.reduce((acc, line) => acc + (Number(line.sampleRate) || 0), 0);
                  const effectiveTargetRate = restoredTotal > 0 ? restoredTotal : (displaySampleRate || 0);

                  set({
                    charge: k,
                    sampleRate: effectiveTargetRate,
                    sampleRateManual: effectiveTargetRate,
                    costing: { ...(s.costing || {}), lines: restoredLines },
                    syncNow: true,
                  });
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
                      {(typeof l.spec === "string" && l.spec) ||
                        l.specLine ||
                        l.spec_line ||
                        (typeof l.spec === "object" && l.spec !== null ? generateSpecLine(l.type || l.category || "trophy", l.spec, l) : "") ||
                        `${l.category || l.type || "Plaque"} · ${l.base || "Composite with a solid base"} · ${
                          typeof l.size === "object" ? (l.size?.trophyH || l.size?.size || 8) : (l.size || "8 in")
                        } · Fusion: ${l.material || "Crystal + Aluminium · Metal elements"}`}
                    </div>
                  </div>
                  {/* Only show rate editing if NOT Free of Cost */}
                  {(s.charge === "charge" || s.charge === "adjust") && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-400 font-normal">₹</span>
                      <input
                        type="number"
                        className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none text-gray-900 font-semibold"
                        value={
                          (s.charge === "foc")
                            ? 0
                            : (l.sampleRate !== undefined && Number(l.sampleRate) > 0
                                ? l.sampleRate
                                : (l.quotationSampleRate || s.simulatedRates?.[l.id]?.sample || (l.rate ? l.rate + 200 : 0)))
                        }
                        onChange={(e) => {
                          const newRate = parseInt(e.target.value) || 0;
                          const updatedLines = costingLines.map((line) =>
                            line.id === l.id ? { ...line, sampleRate: newRate } : line
                          );
                          const newSum = updatedLines.reduce((acc, line) => {
                            return acc + (Number(line.sampleRate) || 0);
                          }, 0);
                          set({
                            sampleRateManual: newSum,
                            sampleRate: newSum,
                            costing: { ...(s.costing || {}), lines: updatedLines },
                            simulatedRates: {
                              ...(s.simulatedRates || {}),
                              [l.id]: {
                                ...(s.simulatedRates?.[l.id] || {}),
                                sample: newRate,
                              },
                            },
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
              Free of cost. RD absorbs about ₹{inr(absorbedTotal).replace("₹", "")} (₹
              {inr(absorbedPerPc).replace("₹", "")}/pc at quote + setup). This is logged against the job
              for MIS.
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
                    value={
                      (s.charge === "foc")
                        ? 0
                        : (displaySampleRate > 0
                            ? displaySampleRate
                            : costingLines.reduce((acc, line) => acc + (Number(line.sampleRate || line.quotationSampleRate || 0)), 0))
                    }
                    onChange={(e) => {
                      const newTotal = parseInt(e.target.value) || 0;
                      let updatedLines = costingLines;
                      if (costingLines.length > 0) {
                        const oldSum = costingLines.reduce((acc, line) => acc + (Number(line.sampleRate) || 0), 0);
                        updatedLines = costingLines.map((line) => {
                          let newLineRate = 0;
                          if (costingLines.length === 1) {
                            newLineRate = newTotal;
                          } else if (oldSum > 0) {
                            newLineRate = Number((((Number(line.sampleRate) || 0) / oldSum) * newTotal).toFixed(2));
                          } else {
                            newLineRate = Number((newTotal / costingLines.length).toFixed(2));
                          }
                          return { ...line, sampleRate: newLineRate };
                        });
                      }
                      set({
                        sampleRateManual: newTotal,
                        sampleRate: newTotal,
                        costing: { ...(s.costing || {}), lines: updatedLines },
                      });
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-medium">/pc</span>
              </div>

              {/* Breakdown next to box */}
              {(() => {
                const effectivePerSet = (s.charge === "foc")
                  ? 0
                  : (displaySampleRate > 0
                      ? displaySampleRate
                      : costingLines.reduce((acc, line) => acc + (Number(line.sampleRate || line.quotationSampleRate || 0)), 0));
                return (
                  <div className="text-xs text-gray-700 font-medium flex items-center">
                    <span>
                      {sampleSetsQty} pcs × ₹{effectivePerSet.toLocaleString("en-IN")} ={" "}
                    </span>
                    <strong className="text-sm font-bold text-gray-900 ml-1">
                      ₹{(effectivePerSet * sampleSetsQty).toLocaleString("en-IN")}
                    </strong>
                    <span className="text-gray-600 ml-1">
                      {s.sampleGstIncl === true
                        ? `incl. ${s.sampleGst || 18}% GST`
                        : `+ ${s.sampleGst || 18}% GST`}
                    </span>
                  </div>
                );
              })()}
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
                          activeGst === r
                            ? "bg-white text-gray-900 shadow-xs"
                            : "text-gray-500 hover:text-gray-800"
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
              const effectivePerSet = (s.charge === "foc")
                ? 0
                : (displaySampleRate > 0
                    ? displaySampleRate
                    : costingLines.reduce((acc, line) => acc + (Number(line.sampleRate || line.quotationSampleRate || 0)), 0));
              const baseCharge = effectivePerSet * sampleSetsQty;

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
                        <div className="text-xl font-bold text-gray-900 mt-0.5">
                          ₹{taxableValue.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500 font-medium">GST @ {gstRate}%</div>
                        <div className="text-xl font-bold text-gray-900 mt-0.5">
                          ₹{gstAmount.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500 font-medium">Sample invoice total</div>
                        <div className="text-xl font-bold text-indigo-700 mt-0.5">
                          ₹{invoiceTotal.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {isGstIncl && (
                      <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                        Rate excluding GST works out to ₹{perPcExclGst.toLocaleString("en-IN")}/pc.
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Total of the item rates above. Change a rate there to update it.
                  </p>

                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
                    <span className="bg-emerald-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                      ✓
                    </span>
                    <span>
                      A separate sample invoice of ₹{invoiceTotal.toLocaleString("en-IN")} incl. GST will
                      be raised on dispatch.
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default SamplePricingSection;
