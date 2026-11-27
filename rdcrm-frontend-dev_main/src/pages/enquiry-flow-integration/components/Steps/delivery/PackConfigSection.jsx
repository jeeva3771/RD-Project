import React from "react";
import {
  BOX_OPTS,
  PROTECT_OPTS,
  LABEL_OPTS,
  ADDON_OPTS,
  MODE_OPTS,
  BOX_COLOURS
} from "../../../utils/helpers";

/**
 * PackConfigSection
 * Handles box, protective cavity, labels, add-ons, packing mode, and notes.
 * Extracted from PackDelivery to keep file line count strictly below 1,500 lines.
 */
export default function PackConfigSection({
  s,
  products,
  openP,
  setOpenP,
  packingScope,
  setPackingScope,
  activeProductIdx,
  setActiveProductIdx,
  currentProduct,
  currentPack,
  toggleMultiPack,
  updateCurrentPack,
  setPackMode,
  toggleAlphabetical,
  handleConfirmPacking
}) {
  return (
    <div
      className={`p-5 rounded-2xl border bg-white shadow-2xs transition ${
        s.packOk ? "border-emerald-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📦</span>
          <div>
            <h4 className="font-bold text-sm text-gray-900">Packing</h4>
            <p className="text-[11px] text-gray-500">
              {s.packOk && !openP
                ? packingScope === "all"
                  ? `${currentPack.outer.join(" + ")} · ${
                      currentPack.protect.join(", ") || "No buffer"
                    } · ${currentPack.mode}${
                      currentPack.alphabetical ? " + Alphabetical" : ""
                    }`
                  : `Configured differently for ${products.length} products`
                : packingScope === "all"
                ? "Pre-filled from the last order: Velvet box"
                : "How each piece is boxed, protected and labelled"}
            </p>
          </div>
        </div>
        {!openP && (
          <button
            type="button"
            className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            onClick={() => setOpenP(true)}
          >
            Edit
          </button>
        )}
      </div>

      {openP && (
        <div className="pt-4 space-y-5 text-xs">
          {/* Top Switcher: Same packing for all vs Pack each product differently */}
          <div className="p-2.5 bg-gray-50/70 border border-gray-200 rounded-2xl flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 pl-2">
              {products.length} products:
            </span>
            <div className="inline-flex rounded-xl p-1 bg-gray-100/90 border border-gray-200">
              <button
                type="button"
                onClick={() => setPackingScope("all")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  packingScope === "all"
                    ? "bg-white text-gray-900 shadow-2xs border border-gray-200"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Same packing for all
              </button>
              <button
                type="button"
                onClick={() => setPackingScope("per_product")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  packingScope === "per_product"
                    ? "bg-white text-indigo-700 shadow-2xs border border-indigo-200"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Pack each product differently
              </button>
            </div>
          </div>

          {/* Per-Product Tabs & Product Header */}
          {packingScope === "per_product" && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {products.map((prod, idx) => (
                  <button
                    key={prod.id || idx}
                    type="button"
                    onClick={() => setActiveProductIdx(idx)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                      activeProductIdx === idx
                        ? "bg-[#2815f5] text-white shadow-2xs"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        activeProductIdx === idx
                          ? "bg-white text-[#2815f5] font-black"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span>
                      {prod.theme || prod.name || `Product ${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <h3 className="font-extrabold text-sm text-gray-900">
                  {currentProduct.theme || currentProduct.name}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  {currentProduct.qty || 40} × {currentProduct.size || 11} in
                </p>
              </div>
            </div>
          )}

          {/* Structured Rows */}
          <div className="divide-y divide-gray-100">
            {/* Row 1: Box */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4 first:pt-0">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">Box</b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Pick one or more
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BOX_OPTS.map((b) => {
                    const isSel = currentPack.outer.includes(b.v);
                    return (
                      <div
                        key={b.v}
                        onClick={() => toggleMultiPack("outer", b.v)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSel
                            ? "border-[#2815f5] bg-[#f5f4fe] shadow-2xs"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{b.icon}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-gray-900 truncate">
                              {b.t}
                            </div>
                            {b.sub && (
                              <div className="text-[10px] text-gray-400 truncate">
                                {b.sub}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isSel
                              ? "bg-[#2815f5] text-white"
                              : "border border-gray-300 bg-white"
                          }`}
                        >
                          {isSel ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {currentPack.outer.includes("Top-bottom box") && (
                  <div className="mt-3 flex items-center gap-2.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <span className="font-bold text-gray-600 text-[11px]">
                      Lid colour:
                    </span>
                    {BOX_COLOURS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                          currentPack.colour === c
                            ? "bg-[#2815f5] text-white border-[#2815f5]"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                        onClick={() => updateCurrentPack({ colour: c })}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Protection inside */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">
                  Protection inside
                </b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Pick any
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROTECT_OPTS.map((p) => {
                    const isSel = currentPack.protect.includes(p.v);
                    return (
                      <div
                        key={p.v}
                        onClick={() => toggleMultiPack("protect", p.v)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSel
                            ? "border-[#2815f5] bg-[#f5f4fe] shadow-2xs"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{p.icon}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-gray-900 truncate">
                              {p.t}
                            </div>
                            {p.sub && (
                              <div className="text-[10px] text-gray-400 truncate">
                                {p.sub}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isSel
                              ? "bg-[#2815f5] text-white"
                              : "border border-gray-300 bg-white"
                          }`}
                        >
                          {isSel ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 3: Top label */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">
                  Top label
                </b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Pick any, or none
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LABEL_OPTS.map((l) => {
                    const isSel = currentPack.labels.includes(l.v);
                    return (
                      <div
                        key={l.v}
                        onClick={() => toggleMultiPack("labels", l.v)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSel
                            ? "border-[#2815f5] bg-[#f5f4fe] shadow-2xs"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{l.icon}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-gray-900 truncate">
                              {l.t}
                            </div>
                            {l.sub && (
                              <div className="text-[10px] text-gray-400 truncate">
                                {l.sub}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isSel
                              ? "bg-[#2815f5] text-white"
                              : "border border-gray-300 bg-white"
                          }`}
                        >
                          {isSel ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 4: Add-ons */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">
                  Add-ons
                </b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Pick any
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ADDON_OPTS.map((a) => {
                    const isSel = currentPack.addons.includes(a.v);
                    return (
                      <div
                        key={a.v}
                        onClick={() => toggleMultiPack("addons", a.v)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSel
                            ? "border-[#2815f5] bg-[#f5f4fe] shadow-2xs"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{a.icon}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-gray-900 truncate">
                              {a.t}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isSel
                              ? "bg-[#2815f5] text-white"
                              : "border border-gray-300 bg-white"
                          }`}
                        >
                          {isSel ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 5: How it's packed */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">
                  How it's packed
                </b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Pick one, then add alphabetical if needed
                </span>
              </div>
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MODE_OPTS.map((m) => {
                    const isSel = currentPack.mode === m.v;
                    return (
                      <div
                        key={m.v}
                        onClick={() => setPackMode(m.v)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                          isSel
                            ? "border-[#2815f5] bg-[#f5f4fe] shadow-2xs"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{m.icon}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-gray-900 truncate">
                              {m.t}
                            </div>
                            {m.sub && (
                              <div className="text-[10px] text-gray-400 truncate">
                                {m.sub}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isSel
                              ? "bg-[#2815f5] text-white"
                              : "border border-gray-300 bg-white"
                          }`}
                        >
                          {isSel ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Alphabetical Option below grid */}
                <div
                  onClick={toggleAlphabetical}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                    currentPack.alphabetical
                      ? "border-[#2815f5] bg-[#f5f4fe] shadow-2xs"
                      : "border-dashed border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        currentPack.alphabetical
                          ? "bg-[#2815f5] text-white"
                          : "border border-gray-300 bg-white"
                      }`}
                    >
                      {currentPack.alphabetical ? "✓" : ""}
                    </div>
                    <span className="text-base shrink-0">🔤</span>
                    <div>
                      <div className="font-bold text-xs text-gray-900">
                        + Alphabetical
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Arrange by winner name, on top of "{currentPack.mode || "Individual"}"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 6: Packing list */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">
                  Packing list
                </b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Needed for this packing
                </span>
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                >
                  Attach list
                </button>
                <span className="text-[11px] text-gray-400 font-medium">
                  Or post now; it's shown as awaited.
                </span>
              </div>
            </div>

            {/* Row 7: Notes */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4 last:border-b-0">
              <div className="w-full sm:w-44 shrink-0">
                <b className="block text-xs font-bold text-gray-900">
                  Notes
                </b>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Optional
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="e.g. Label each box with the winner's name"
                  className="w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white outline-none focus:border-indigo-400 transition"
                  value={currentPack.notes || ""}
                  onChange={(e) =>
                    updateCurrentPack({ notes: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Bottom Button */}
          <div className="pt-2">
            <button
              type="button"
              className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
              onClick={handleConfirmPacking}
            >
              {packingScope === "all"
                ? "Confirm packing"
                : activeProductIdx < products.length - 1
                ? `Confirm and next: ${
                    products[activeProductIdx + 1]?.theme ||
                    products[activeProductIdx + 1]?.name ||
                    "Next product"
                  }`
                : "Confirm packing"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
