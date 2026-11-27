import React from "react";

const ProductDelinkModal = ({
  lines,
  delinkSel,
  setDelinkSel,
  delinkReason,
  setDelinkReason,
  delinkNote,
  setDelinkNote,
  isDelinkActionLoading,
  handleDelinkHold,
  handleDropProducts,
  onClose,
}) => {
  const reasons = [
    "Design not approved yet",
    "Client put it on hold",
    "Client chose the other product after the sample",
    "Budget not cleared",
    "Waiting for quantity / sizes",
    "Other",
  ];

  return (
    <div className="panel p-4 bg-white border-2 border-indigo-200 rounded-xl shadow-sm ring-4 ring-indigo-50 fade">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-indigo-600 font-bold text-xs">⛓️</span>
        <h4 className="font-bold text-sm text-gray-900">Delink or remove a product</h4>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        The ticked products leave the job's costing, proforma, advance and invoice.{" "}
        <strong className="text-gray-700">Delink</strong> keeps them as a separate sub-job on hold to pick up later.{" "}
        <strong className="text-gray-700">Drop completely</strong> drops them for good.
      </p>

      <div className="space-y-2 mb-4">
        {lines.map((l) => {
          const isSelected = delinkSel.includes(l.id);
          return (
            <label
              key={l.id}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-gray-200 bg-gray-50/50 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    setDelinkSel((prev) =>
                      isSelected ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                    );
                  }}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {l.id} · {l.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {l.size} in · {l.qty} pcs ·{" "}
                    {l.is_dropped
                      ? "dropped"
                      : l.is_on_hold
                      ? "currently on hold"
                      : "active"}
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  l.is_dropped
                    ? "bg-rose-100 text-rose-700"
                    : l.is_on_hold
                    ? "bg-amber-100 text-amber-800"
                    : isSelected
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-400"
                }`}
              >
                {l.is_dropped
                  ? "✕ Dropped"
                  : l.is_on_hold
                  ? "⏳ On hold"
                  : isSelected
                  ? "Selected"
                  : "Active"}
              </span>
            </label>
          );
        })}
      </div>

      <h4 className="font-bold text-xs text-gray-900 mb-2">Why?</h4>
      <div className="flex gap-2 flex-wrap mb-4">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setDelinkReason(r)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition cursor-pointer ${
              delinkReason === r
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <input
        value={delinkNote}
        onChange={(e) => setDelinkNote(e.target.value)}
        placeholder="Note (optional), e.g. Client will confirm after the event committee meets"
        className="w-full text-xs p-2.5 border border-gray-200 rounded-lg mb-4 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
      />

      <div className="flex gap-2 items-center flex-wrap">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!delinkSel.length || isDelinkActionLoading}
          onClick={handleDelinkHold}
          className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition cursor-pointer ${
            !delinkSel.length || isDelinkActionLoading
              ? "bg-gray-300 cursor-not-allowed opacity-60"
              : "bg-amber-600 hover:bg-amber-700 shadow-xs"
          }`}
        >
          {isDelinkActionLoading
            ? "Updating..."
            : `Delink and put on hold (${delinkSel.length})`}
        </button>
        <button
          type="button"
          disabled={!delinkSel.length || isDelinkActionLoading}
          onClick={handleDropProducts}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ml-auto cursor-pointer ${
            !delinkSel.length || isDelinkActionLoading
              ? "text-gray-300 cursor-not-allowed opacity-60"
              : "text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200"
          }`}
        >
          Drop completely
        </button>
      </div>
    </div>
  );
};

export default ProductDelinkModal;

