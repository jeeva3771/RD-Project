import React, { useState } from "react";
import { roundOf } from "../../utils/helpers";
import { toast } from "react-toastify";

const CHANGE_TYPES = [
  "Colour",
  "Size",
  "Text / names",
  "Logo / artwork",
  "Material",
  "Finish",
  "Base / stand",
  "Packaging"
];

const RevisionPanel = ({ s, set, job, onCancel }) => {
  const prev = roundOf(s);
  const v = prev.v || 1;
  const nextV = v + 1;

  const [changes, setChanges] = useState([]);
  const [note, setNote] = useState("");
  const [path, setPath] = useState("sample"); // defaults to 'sample' (v2) matching screenshot

  // Sample v2: pieces and charge state
  const v1Rate = s?.sampleRate || s?.sampleRateManual || 6980;
  const quotedRate = job?.rate || s?.quoteRate || s?.rate || 3200;

  const [sampleQty, setSampleQty] = useState(s?.sampleQty || 1);
  const [chargeType, setChargeType] = useState(s?.charge || "foc"); // 'foc', 'charge', 'adj'
  const [sampleRate, setSampleRate] = useState(v1Rate);
  const [isGstIncl, setIsGstIncl] = useState(s?.sampleGstIncl || false);
  const [gstRate, setGstRate] = useState(s?.sampleGst !== undefined ? s.sampleGst : 18);

  const absorbedVal = (s?.absorbedCost || 4800) * sampleQty;

  // Calculation for Chargeable / Adjust against PO
  const totalBase = sampleRate * sampleQty;
  let taxableValue = totalBase;
  let gstAmount = Math.round(taxableValue * (gstRate / 100));
  let invoiceTotal = taxableValue + gstAmount;

  if (isGstIncl) {
    invoiceTotal = totalBase;
    taxableValue = Math.round(totalBase / (1 + gstRate / 100));
    gstAmount = invoiceTotal - taxableValue;
  }

  const toggleChange = (c) => {
    setChanges((prevList) =>
      prevList.includes(c) ? prevList.filter((x) => x !== c) : [...prevList, c]
    );
  };

  const toggleSelectAll = () => {
    if (changes.length === CHANGE_TYPES.length) {
      setChanges([]);
    } else {
      setChanges([...CHANGE_TYPES]);
    }
  };

  // Valid if at least one change option is selected OR a description note is given
  const isOk = changes.length > 0 || note.trim().length > 0;

  const handleSubmit = () => {
    if (!isOk) return;
    const finalPath = path || "sample";
    const prevRoundData = {
      ...prev,
      changes,
      note: note.trim(),
      path: finalPath,
      date: new Date().toISOString()
    };

    if (finalPath === "pp") {
      set({
        rounds: [...(s.rounds || []), prevRoundData],
        ppAfter: true,
        approved: true,
        revOpen: false,
        sub: 0
      });
      toast.success("Order released to production with pre-production sample hold.");
    } else {
      // Create new sample round (e.g. v2)
      set({
        rounds: [...(s.rounds || []), prevRoundData],
        revOpen: false,
        sub: 0,
        sampleQty,
        charge: chargeType,
        sampleRate: chargeType === "foc" ? 0 : sampleRate,
        sampleGstIncl: isGstIncl,
        sampleGst: gstRate,
        sflow: {
          ...(s.sflow || {}),
          [nextV]: {
            readyAt: null,
            disp: null,
            deliveredAt: null,
            photosAt: null,
            qty: sampleQty,
            chargeType,
            rate: chargeType === "foc" ? 0 : sampleRate,
            gstIncl: isGstIncl,
            gst: gstRate,
            invoiceTotal: chargeType === "foc" ? 0 : invoiceTotal
          }
        }
      });
      toast.success(`Sample v${nextV} revision created and sent to shop floor.`);
    }

    if (onCancel) onCancel();
  };

  return (
    <div className="w-full bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* Title & Subtitle from Screenshot */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1">
          Client wants changes to sample v{v}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 font-medium leading-relaxed">
          Record exactly what they asked for. It goes on the job card and on the confirmation they receive.
        </p>
      </div>

      {/* What needs to change? - Multi-select options */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-bold text-gray-800">
            What needs to change?
            {changes.length > 0 && (
              <span className="ml-2 text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                {changes.length} of {CHANGE_TYPES.length} selected
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
          >
            {changes.length === CHANGE_TYPES.length ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {CHANGE_TYPES.map((c) => {
            const isSel = changes.includes(c);
            return (
              <button
                key={c}
                type="button"
                className={`px-4 py-2 rounded-full text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  isSel
                    ? "bg-indigo-600 text-white border border-indigo-600 shadow-2xs font-semibold"
                    : "bg-white text-gray-700 border border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-50/30 font-medium"
                }`}
                onClick={() => toggleChange(c)}
              >
                {isSel && <span className="text-[11px] font-bold">✓</span>}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Describe the changes */}
      <div>
        <label className="text-xs font-bold text-gray-800 block mb-2">
          Describe the changes
        </label>
        <textarea
          rows={3}
          className="w-full p-3.5 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-800 placeholder-gray-400 font-medium transition resize-y"
          placeholder="e.g. Base colour to matte black, winner name font one size larger, logo moved to centre"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* What happens next? */}
      <div>
        <label className="text-xs font-bold text-gray-800 block mb-2.5">
          What happens next?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            className={`p-5 rounded-2xl border text-left transition cursor-pointer ${
              path === "sample"
                ? "bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-100 shadow-2xs"
                : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
            }`}
            onClick={() => setPath("sample")}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white text-lg mb-3 shadow-2xs">
              🔄
            </div>
            <h4 className="text-base font-black text-gray-900 mb-1 tracking-tight">
              Another sample (v{nextV})
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed font-normal">
              Big changes. Make a revised sample and get approval again before production.
            </p>
          </button>

          <button
            type="button"
            className={`p-5 rounded-2xl border text-left transition cursor-pointer ${
              path === "pp"
                ? "bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-100 shadow-2xs"
                : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
            }`}
            onClick={() => setPath("pp")}
          >
            <div className="w-10 h-10 flex items-center justify-center text-3xl mb-3">
              🏭
            </div>
            <h4 className="text-base font-black text-gray-900 mb-1 tracking-tight">
              Production + PP sample
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed font-normal">
              Small changes. Release the order now; production holds until the client approves one pre-production piece.
            </p>
          </button>
        </div>
      </div>

      {/* Sample v2: pieces and charge (when Another sample v2 is selected) */}
      {path === "sample" && (
        <div className="border border-indigo-100/90 rounded-2xl p-5 bg-[#fafbff] shadow-2xs space-y-4">
          <div className="text-xs font-bold text-gray-800">
            Sample v{nextV}: pieces and charge
          </div>

          {/* Stepper + Charge Type Pills Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center border border-gray-200 rounded-xl bg-white px-2 py-1 shadow-2xs">
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-base cursor-pointer"
                onClick={() => setSampleQty(Math.max(1, sampleQty - 1))}
              >
                −
              </button>
              <span className="w-8 text-center text-xs font-bold text-gray-900">
                {sampleQty}
              </span>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-base cursor-pointer"
                onClick={() => setSampleQty(sampleQty + 1)}
              >
                +
              </button>
            </div>

            {/* Charge Type Segmented Buttons */}
            <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/70">
              {[
                { id: "foc", label: "Free of cost" },
                { id: "charge", label: "Chargeable" },
                { id: "adj", label: "Charge, adjust against PO" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`px-4 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    chargeType === opt.id
                      ? "bg-white text-gray-900 shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  onClick={() => setChargeType(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Free of cost caption */}
          {chargeType === "foc" && (
            <div className="text-xs text-gray-400 font-medium leading-relaxed">
              Free of cost. RD absorbs about ₹{absorbedVal.toLocaleString('en-IN')}, logged to MIS.
            </div>
          )}

          {/* Chargeable / Adjust against PO Options */}
          {chargeType !== "foc" && (
            <div className="space-y-4 pt-1">
              {/* Rate input + Quick pills */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="border-2 border-indigo-600 rounded-2xl p-2.5 px-4 flex items-center justify-between w-60 sm:w-64 bg-white shadow-2xs">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xl font-bold text-gray-700">₹</span>
                    <input
                      type="number"
                      className="text-xl font-bold text-gray-900 bg-transparent outline-none w-full"
                      value={sampleRate}
                      onChange={(e) => setSampleRate(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">/pc</span>
                </div>

                {/* Quick pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer ${
                      sampleRate === v1Rate
                        ? "bg-indigo-600 text-white font-bold shadow-2xs"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 font-semibold"
                    }`}
                    onClick={() => setSampleRate(v1Rate)}
                  >
                    ₹{v1Rate.toLocaleString('en-IN')} <span className="font-normal">same as v1</span>
                  </button>

                  <button
                    type="button"
                    className={`px-3.5 py-1.5 rounded-full text-xs transition cursor-pointer ${
                      sampleRate === quotedRate && sampleRate !== v1Rate
                        ? "bg-indigo-600 text-white font-bold shadow-2xs"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 font-semibold"
                    }`}
                    onClick={() => setSampleRate(quotedRate)}
                  >
                    ₹{quotedRate.toLocaleString('en-IN')} <span className="font-normal">quoted rate</span>
                  </button>
                </div>
              </div>

              {/* GST toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <div>
                  <div className="text-[11px] text-gray-500 font-medium mb-1.5">
                    This amount is
                  </div>
                  <div className="flex bg-gray-100/90 p-0.5 rounded-xl border border-gray-200/70">
                    <button
                      type="button"
                      className={`px-3.5 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                        !isGstIncl
                          ? "bg-white text-gray-900 shadow-2xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                      onClick={() => setIsGstIncl(false)}
                    >
                      Excluding GST
                    </button>
                    <button
                      type="button"
                      className={`px-3.5 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                        isGstIncl
                          ? "bg-white text-gray-900 shadow-2xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                      onClick={() => setIsGstIncl(true)}
                    >
                      Including GST
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 font-medium mb-1.5">
                    GST rate
                  </div>
                  <div className="flex bg-gray-100/90 p-0.5 rounded-xl border border-gray-200/70">
                    {[5, 18].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className={`px-3.5 py-1.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                          gstRate === rate
                            ? "bg-white text-gray-900 shadow-2xs"
                            : "text-gray-500 hover:text-gray-800"
                        }`}
                        onClick={() => setGstRate(rate)}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3-Column Summary Card */}
              <div className="border border-gray-200/80 rounded-2xl p-4 bg-white grid grid-cols-3 gap-3 shadow-2xs">
                <div>
                  <span className="text-xs text-gray-500 block mb-1 font-medium">
                    Taxable value
                  </span>
                  <strong className="text-base font-black text-gray-900 block">
                    ₹{taxableValue.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1 font-medium">
                    GST @ {gstRate}%
                  </span>
                  <strong className="text-base font-black text-gray-900 block">
                    ₹{gstAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1 font-medium">
                    Invoice total
                  </span>
                  <strong className="text-base font-black text-indigo-700 block">
                    ₹{invoiceTotal.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer from Screenshot */}
      <div className="flex items-center justify-start gap-3 pt-2">
        <button
          type="button"
          className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
          onClick={onCancel}
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!isOk}
          className={`px-6 py-2.5 text-xs font-bold rounded-xl transition ${
            isOk
              ? "bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-2xs cursor-pointer"
              : "bg-amber-200/50 text-amber-950/40 cursor-not-allowed"
          }`}
          onClick={handleSubmit}
        >
          {path === "pp"
            ? "Release production with PP sample"
            : `Send sample v${nextV} to shop floor`}
        </button>
      </div>
    </div>
  );
};

export default RevisionPanel;
