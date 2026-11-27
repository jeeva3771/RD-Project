import React from "react";
import { computeGroupLetter } from "../../../utils/helpers";

const SavedProductsSummary = ({
  trophyGroups,
  setTrophyGroups,
  syncState,
  setProductSaved,
  addTrophyGroup,
  whatNextSelected,
  setWhatNextSelected,
  parentJobNo,
  setActiveGroupIndex
}) => {
  const totalSizeLines = trophyGroups.reduce(
    (acc, g) => acc + g.items.length,
    0
  );

  return (
    <div className="space-y-5 fade">
      {/* Panel 1: Products in this enquiry */}
      <div className="panel p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="font-bold text-sm text-gray-900">
            Products in this enquiry
          </div>
          <div className="text-xs text-gray-400 font-medium">
            {trophyGroups.length} product{trophyGroups.length > 1 ? "s" : ""} ·{" "}
            {totalSizeLines} size line{totalSizeLines > 1 ? "s" : ""}
          </div>
        </div>

        <div className="space-y-3">
          {trophyGroups.map((group, gIdx) => (
            <div
              key={gIdx}
              className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {gIdx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-sm text-gray-900">
                      {group.theme || group.type || "Custom Trophy"}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-extrabold text-[10px] tracking-wider uppercase">
                        {group.kind || "CUSTOM"}
                      </span>
                      <span>
                        {group.type || "Trophy"} ·{" "}
                        {group.mats && group.mats.length > 1
                          ? `Fusion: ${group.mats.join(" + ")}`
                          : (group.mat || group.mats?.[0] || "MDF")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer transition"
                    onClick={() => {
                      setActiveGroupIndex(gIdx);
                      setProductSaved(false);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600 font-medium text-xs cursor-pointer transition"
                    onClick={() => {
                      if (trophyGroups.length > 1) {
                        const updated = trophyGroups.filter(
                          (_, idx) => idx !== gIdx
                        );
                        setTrophyGroups(updated);
                        syncState(updated);
                      } else {
                        setProductSaved(false);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Size Pills Row */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {group.items.map((item, iIdx) => {
                  const groupChar = computeGroupLetter(gIdx);
                  const subJobNo = `${parentJobNo}-${groupChar}${iIdx + 1}`;

                  return (
                    <span
                      key={iIdx}
                      className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50/70 text-gray-700 text-xs font-medium flex items-center gap-2 shadow-2xs"
                    >
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-extrabold text-[10px]">
                        {subJobNo}
                      </span>
                      <span>
                        {String(item.size || 8).includes("in") || String(item.size || "").startsWith("A") ? item.size : `${item.size} in`}
                        {item.colour ? ` · ${item.colour}` : ""} · {item.qty || 100} pcs · ≈ ₹
                        {(item.budget || 1660).toLocaleString()} ·{" "}
                        {item.designOptionsCount || 1} design option
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel 2: Product added. What next? */}
      <div className="panel p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
        <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
          <span className="text-emerald-600 font-bold">✓</span>
          Product added. What next?
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Add a custom design */}
          <button
            type="button"
            className={`p-5 rounded-2xl text-left space-y-3 transition cursor-pointer hover:shadow-xs border ${
              whatNextSelected === "custom"
                ? "bg-indigo-50/40 border-2 border-indigo-500 shadow-xs"
                : "bg-white border-gray-200 hover:border-indigo-400"
            }`}
            onClick={() => {
              setWhatNextSelected("custom");
              addTrophyGroup("custom");
              setProductSaved(false);
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl">
              ✏️
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 mb-1">
                Add a custom design
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Another design, or the same design in a different spec
              </div>
            </div>
          </button>

          {/* Card 2: Add a ready trophy */}
          <button
            type="button"
            className={`p-5 rounded-2xl text-left space-y-3 transition cursor-pointer hover:shadow-xs border ${
              whatNextSelected === "ready"
                ? "bg-indigo-50/40 border-2 border-indigo-500 shadow-xs"
                : "bg-white border-gray-200 hover:border-indigo-400"
            }`}
            onClick={() => {
              setWhatNextSelected("ready");
              addTrophyGroup("ready");
              setProductSaved(false);
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
              🏆
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 mb-1">
                Add a ready trophy
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                From ready stock, priced from the list
              </div>
            </div>
          </button>

          {/* Card 3: Continue with the rest of the enquiry */}
          <button
            type="button"
            className={`p-5 rounded-2xl text-left space-y-3 transition cursor-pointer shadow-xs border ${
              whatNextSelected === "continue"
                ? "bg-indigo-50/40 border-2 border-indigo-600 shadow-sm"
                : "bg-white border-gray-200 hover:border-indigo-400"
            }`}
            onClick={() => setWhatNextSelected("continue")}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">
              ➔
            </div>
            <div>
              <div className="font-bold text-sm text-indigo-950 mb-1">
                Continue with the rest of the enquiry
              </div>
              <div className="text-xs text-indigo-600/90 leading-relaxed">
                Occasion and event date
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavedProductsSummary;
