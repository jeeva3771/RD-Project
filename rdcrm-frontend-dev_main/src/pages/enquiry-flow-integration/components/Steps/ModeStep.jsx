import React from "react";
import { allReady, isMulti, allItems } from "../../utils/helpers";

const ModeStep = ({ s, set, next }) => {
  const e = s.e || {};
  const rec = allReady(s) || e.fromPast ? "production" : "sample";

  const nudgeMessage = allReady(s)
    ? "Every item is ready stock, so production can start directly."
    : isMulti(s) && allItems(s).some((x) => x.kind === "ready")
    ? "Mixed order: the sample covers the custom items only; ready trophies go with the production run."
    : e.fromPast
    ? "Reorder of an approved design with a frozen BOM, so production can start directly."
    : "New design from this enquiry, so a sample protects the order.";

  return (
    <div className="fade space-y-4">
      <div className="modes grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          className={`mode p-5 rounded-xl border text-left relative transition ${
            s.mode === "sample"
              ? "bg-amber-50/70 border-amber-500 ring-2 ring-amber-400/30"
              : "bg-white border-gray-200 hover:border-amber-300"
          }`}
          disabled={s.sent}
          onClick={() => set({ mode: "sample" })}
        >
          {rec === "sample" && (
            <span className="rec absolute top-3 right-3 text-[10px] uppercase font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-sm">
              Recommended
            </span>
          )}
          <div className="big text-4xl mb-2" aria-hidden="true">
            🧪
          </div>
          <h3 className="font-bold text-lg text-gray-900">Sample first</h3>
          <p className="text-xs text-gray-500 mt-1">
            Make a few pieces, get the client’s nod, then release production with one click.
          </p>
        </button>

        <button
          className={`mode p-5 rounded-xl border text-left relative transition ${
            s.mode === "production"
              ? "bg-amber-50/70 border-amber-500 ring-2 ring-amber-400/30"
              : "bg-white border-gray-200 hover:border-amber-300"
          }`}
          disabled={s.sent}
          onClick={() => set({ mode: "production" })}
        >
          {rec === "production" && (
            <span className="rec absolute top-3 right-3 text-[10px] uppercase font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-sm">
              Recommended
            </span>
          )}
          <div className="big text-4xl mb-2" aria-hidden="true">
            🏭
          </div>
          <h3 className="font-bold text-lg text-gray-900">Straight to production</h3>
          <p className="text-xs text-gray-500 mt-1">
            Design already approved. Final quantity and PO, and it’s on the shop floor.
          </p>
        </button>
      </div>

      <div className="nudge p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 flex items-start gap-2">
        <span className="font-bold text-indigo-600">★</span>
        <div>{nudgeMessage}</div>
      </div>

      {s.mode === "production" && (
        <div className="p-3 bg-gray-50 border rounded-lg flex items-center justify-between">
          <div>
            <div className="font-semibold text-xs text-gray-900">Pre-production sample</div>
            <div className="text-[11px] text-gray-500">
              Production holds until client approves 1 piece. Same ticket, no second form.
            </div>
          </div>
          <button
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              s.pp ? "bg-amber-500" : "bg-gray-300"
            }`}
            onClick={() => set({ pp: !s.pp })}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                s.pp ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      )}

      <div className="actions flex justify-between items-center pt-3 border-t">
        <button
          className="btn ghost text-xs text-gray-600 hover:bg-gray-100 px-3 py-2 rounded"
          onClick={() => set({ step: s.step - 1 })}
        >
          ← Back to enquiry
        </button>
        <button
          className="btn gold px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition"
          disabled={!s.mode}
          onClick={next}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ModeStep;
