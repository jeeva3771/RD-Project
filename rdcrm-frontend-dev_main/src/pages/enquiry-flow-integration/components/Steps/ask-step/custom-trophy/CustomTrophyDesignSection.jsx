import React from "react";

/**
 * CustomTrophyDesignSection
 * Renders Section 2 for Custom Trophy:
 *  - Type Card: Search, Category Chips (Classic, Themed, Sports), Option pills + "+ Other..."
 *  - Construction type 12-Grid (Shadow box, Sandwich, Pillar, Tiered, etc.)
 *  - Elements picker (pick any that apply)
 *  - Main material fusion selector (one, or up to 3 for a fusion)
 */
const CustomTrophyDesignSection = ({
  group,
  gIdx,
  typeCatKey,
  setTypeCatKey,
  typeQuery,
  setTypeQuery,
  activeCategoryData = {},
  constructions = [],
  elements = [],
  materials = [],
  updateTrophyDesign,
  toggleElementInGroup,
  toggleMaterialInGroup,
  onSelectType,
}) => {
  return (
    <div className="space-y-4">
      {/* ── Type Card ── */}
      <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-800">Type</span>
          <span className="text-gray-400 font-normal text-xs">
            Classic, themed or sports
          </span>
        </div>

        <div className="relative">
          <input
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium placeholder-gray-400"
            placeholder="Search 29 options..."
            value={typeQuery}
            onChange={(ev) => setTypeQuery(ev.target.value)}
          />
          <span className="absolute left-3 top-2.5 text-xs text-gray-400">
            🔍
          </span>
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto text-xs pb-1">
          {Object.entries(activeCategoryData).map(([key, cat]) => {
            const isSel = typeCatKey === key;
            return (
              <button
                key={key}
                type="button"
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
                  isSel
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setTypeCatKey(key)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSel
                      ? "bg-indigo-800 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Options Buttons */}
        <div className="flex gap-2 flex-wrap text-xs pt-1">
          {(() => {
            const currentCategory =
              activeCategoryData[typeCatKey] ||
              activeCategoryData.classic ||
              Object.values(activeCategoryData)[0];
            const allOptions = Object.values(activeCategoryData).flatMap(
              (c) => c.options || []
            );
            const filtered = typeQuery.trim()
              ? allOptions.filter((o) =>
                  o.toLowerCase().includes(typeQuery.toLowerCase())
                )
              : currentCategory?.options || [];

            return [...filtered, "+ Other..."].map((tp) => {
              const isOtherBtn = tp === "+ Other...";
              const isSelected = isOtherBtn
                ? group.isCustomType
                : (group.type || "Trophy") === tp;

              return (
                <button
                  key={tp}
                  type="button"
                  className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                      : isOtherBtn
                      ? "bg-white border-dashed border-gray-300 text-gray-700 hover:border-indigo-400"
                      : "bg-white border-gray-300 text-gray-800 hover:border-indigo-300 hover:bg-gray-50"
                  }`}
                  onClick={() => onSelectType(tp, isOtherBtn)}
                >
                  {tp}
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* ── Construction type 12-Grid ── */}
      <div className="space-y-2.5 pt-1">
        <div className="text-xs font-bold text-gray-800">Construction type</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {(constructions || []).map((ct) => {
            const ctId = ct.id || ct.name;
            const ctLabel = ct.label || ct.name;
            const ctIcon = ct.icon || "🔲";
            const currentConstruction =
              group.construction || "Shadow box (3D object)";
            const isSel =
              currentConstruction === ctId || currentConstruction === ctLabel;
            return (
              <button
                key={ctId}
                type="button"
                className={`p-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  isSel
                    ? "bg-indigo-50/80 border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-500/20"
                    : "bg-white border-gray-200 text-gray-800 hover:border-indigo-300"
                }`}
                onClick={() => updateTrophyDesign("construction", ctId)}
              >
                <div className="flex items-center gap-2">
                  <span>{ctIcon}</span>
                  <span>{ctLabel}</span>
                </div>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                    isSel
                      ? "bg-indigo-600 border-indigo-600 text-white font-bold"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSel ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Elements (pick any that apply) ── */}
      <div className="space-y-2.5 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-800">Elements</span>
          <span className="text-gray-400 text-[11px]">(pick any that apply)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {(elements || []).map((el) => {
            const elId = el.id || el.name;
            const elLabel = el.label || el.name;
            const elIcon = el.icon || "⚙️";
            const curElements = Array.isArray(group.elements)
              ? group.elements
              : [];
            const isSel =
              curElements.includes(elId) || curElements.includes(elLabel);
            return (
              <button
                key={elId}
                type="button"
                className={`p-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                  isSel
                    ? "bg-indigo-50/80 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-500/20"
                    : "bg-white border-gray-200 text-gray-800 hover:border-indigo-300"
                }`}
                onClick={() => toggleElementInGroup(gIdx, elId)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{elIcon}</span>
                  <span>{elLabel}</span>
                </div>
                <span
                  className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] transition ${
                    isSel
                      ? "bg-indigo-600 border-indigo-600 text-white font-bold"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSel ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main material (one, or up to 3 for a fusion) ── */}
      <div className="space-y-2 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-800">
            Main material{" "}
            <span className="text-gray-400 font-normal">
              (one, or up to 3 for a fusion)
            </span>
          </span>
        </div>
        {(() => {
          const currentMats =
            Array.isArray(group.mats) && group.mats.length > 0
              ? group.mats
              : group.mat && group.mat.startsWith("Fusion: ")
              ? group.mat.replace("Fusion: ", "").split(" + ")
              : [group.mat || "MDF"];
          return (
            <div className="flex gap-2 flex-wrap text-xs">
              {(materials || []).map((mObj) => {
                const mat = typeof mObj === "string" ? mObj : mObj.name;
                const curMats = currentMats.map((m) =>
                  m === "Resin cast" ? "Resin" : m
                );
                const isSel =
                  curMats.includes(mat) ||
                  (mat === "Resin" && currentMats.includes("Resin cast"));
                return (
                  <button
                    key={mat}
                    type="button"
                    className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${
                      isSel
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => toggleMaterialInGroup(gIdx, mat)}
                  >
                    {mat}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default CustomTrophyDesignSection;

