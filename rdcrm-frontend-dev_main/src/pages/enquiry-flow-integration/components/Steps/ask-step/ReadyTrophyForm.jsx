import React from "react";
import { READY_TROPHIES, PERSONALISATION_OPTIONS } from "../../../utils/constants";

const ReadyTrophyForm = ({
  gIdx,
  group,
  trophyGroups,
  setTrophyGroups,
  syncState,
  handleSaveAll,
  isSavingProduct = false,
  setActiveGroupIndex,
  addSizeToGroup,
  removeSizeFromGroup,
  handleDiscardGroup
}) => {
  const isReadyFormValid = Boolean(
    (group.theme || group.readyCode) &&
      group.items.length > 0 &&
      group.items.every((it) => it.size && it.qty > 0)
  );

  return (
    <div className="panel p-5 bg-white border-2 border-indigo-600 rounded-3xl shadow-md space-y-5">
      {/* Product Header Title */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-xs uppercase tracking-wider">
            READY TROPHY
          </span>
          <span className="font-extrabold text-lg text-gray-900">
            Product {gIdx + 1}
            {group.theme ? `: ${group.theme}` : ""}
          </span>
        </div>
      </div>

      {/* 1. Which ready trophy? */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
            1
          </span>
          <span className="font-bold text-sm text-gray-900">
            Which ready trophy?
          </span>
        </div>

        {/* Ready Trophies Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {READY_TROPHIES.map((rt) => {
            const isSelected =
              group.readyCode === rt.code || group.theme === rt.name;
            return (
              <button
                key={rt.code}
                type="button"
                className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50/70 border-indigo-600 shadow-sm ring-2 ring-indigo-500/20"
                    : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50"
                }`}
                onClick={() => {
                  const updated = [...trophyGroups];
                  updated[gIdx].theme = rt.name;
                  updated[gIdx].readyCode = rt.code;
                  updated[gIdx].kind = "ready";
                  updated[gIdx].type = "Ready Trophy";
                  updated[gIdx].mat = "Ready Stock";
                  const defaultSz = rt.sizes?.[0];
                  if (updated[gIdx].items?.[0] && defaultSz) {
                    updated[gIdx].items[0].size = defaultSz.size;
                    updated[gIdx].items[0].budget = defaultSz.rate;
                  }
                  setTrophyGroups(updated);
                  syncState(updated);
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shrink-0">
                  {rt.icon}
                </div>
                <div>
                  <div className="font-extrabold text-xs text-gray-900 leading-tight">
                    {rt.name}
                  </div>
                  <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                    {rt.code} · from ₹{rt.rate.toLocaleString()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Sizes, quantities and personalisation */}
      {(group.theme || group.readyCode) && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <div>
              <span className="font-bold text-sm text-gray-900">
                Sizes, quantities and personalisation
              </span>
              <div className="text-xs text-gray-400">
                Rates come from the price list, so there’s nothing to estimate.
              </div>
            </div>
          </div>

          {/* Size Cards List */}
          <div className="space-y-4">
            {group.items.map((item, iIdx) => {
              const selectedRt =
                READY_TROPHIES.find(
                  (r) =>
                    r.code === group.readyCode || r.name === group.theme
                ) || READY_TROPHIES[1];
              const availableSizes = selectedRt.sizes || [
                { size: 8, rate: 1100, stock: 80 },
                { size: 10, rate: 1450, stock: 45 }
              ];

              const currentSizeObj =
                availableSizes.find((s) => s.size === item.size) ||
                availableSizes[0];
              const currentSize = item.size || currentSizeObj.size;
              const baseRate = item.budget || currentSizeObj.rate;
              const extraCost = item.personalisationExtra || 0;
              const totalRate = baseRate + extraCost;

              return (
                <div
                  key={iIdx}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs space-y-0"
                >
                  {/* Header */}
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                        {iIdx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">
                          Size {iIdx + 1}
                        </span>
                        <span className="text-xs text-gray-500 font-normal">
                          {currentSize} in · ₹{totalRate.toLocaleString()}/pc
                        </span>
                      </div>
                    </div>
                    {group.items.length > 1 && (
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-600 font-normal text-xs transition cursor-pointer"
                        onClick={() => removeSizeFromGroup(gIdx, iIdx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-gray-100">
                    {/* Row 1: Size options */}
                    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-gray-900">
                          Size
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {availableSizes.map((szObj) => {
                          const isSel =
                            (item.size || currentSizeObj.size) === szObj.size;
                          return (
                            <button
                              key={szObj.size}
                              type="button"
                              className={`px-4 py-2 rounded-full border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                isSel
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white border-gray-200 text-gray-800 hover:border-indigo-400 hover:bg-indigo-50/40"
                              }`}
                              onClick={() => {
                                const updated = [...trophyGroups];
                                updated[gIdx].items[iIdx].size = szObj.size;
                                updated[gIdx].items[iIdx].budget = szObj.rate;
                                setTrophyGroups(updated);
                                syncState(updated);
                              }}
                            >
                              <span>{szObj.size} in</span>
                              <span className={isSel ? "text-indigo-200" : "text-gray-400"}>
                                ·
                              </span>
                              <span>₹{szObj.rate.toLocaleString()}</span>
                              <span className={isSel ? "text-indigo-200" : "text-gray-400"}>
                                ·
                              </span>
                              <span
                                className={
                                  isSel
                                    ? "text-indigo-100 font-semibold"
                                    : "text-gray-500 font-normal"
                                }
                              >
                                {szObj.stock} in stock
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 2: Quantities to price */}
                    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-gray-900">
                          Quantities to price
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Add one or more
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="number"
                          placeholder="Qty"
                          className="w-24 border border-gray-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-900 bg-white outline-none focus:border-indigo-500 shadow-2xs"
                          value={item.qty || ""}
                          onChange={(ev) => {
                            const val = parseInt(ev.target.value) || 0;
                            const updated = [...trophyGroups];
                            updated[gIdx].items[iIdx].qty = val;
                            setTrophyGroups(updated);
                            syncState(updated);
                          }}
                        />
                        {[50, 100, 200].map((presetQty) => {
                          const isSelected = item.qty === presetQty;
                          return (
                            <button
                              key={presetQty}
                              type="button"
                              className={`px-3.5 py-1 text-xs font-semibold rounded-full border transition cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white border-dashed border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600"
                              }`}
                              onClick={() => {
                                const updated = [...trophyGroups];
                                updated[gIdx].items[iIdx].qty = presetQty;
                                setTrophyGroups(updated);
                                syncState(updated);
                              }}
                            >
                              {presetQty}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 3: Personalisation */}
                    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-gray-900">
                          Personalisation
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {PERSONALISATION_OPTIONS.map((pOpt) => {
                          const isSel = (item.personalisation || "none") === pOpt.id;
                          return (
                            <button
                              key={pOpt.id}
                              type="button"
                              className={`px-4 py-2 rounded-full border text-xs font-bold transition cursor-pointer ${
                                isSel
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white border-gray-200 text-gray-800 hover:border-indigo-400 hover:bg-indigo-50/40"
                              }`}
                              onClick={() => {
                                const updated = [...trophyGroups];
                                updated[gIdx].items[iIdx].personalisation = pOpt.id;
                                updated[gIdx].items[iIdx].personalisationExtra = pOpt.extra;
                                setTrophyGroups(updated);
                                syncState(updated);
                              }}
                            >
                              <span>{pOpt.label}</span>
                              {pOpt.extra > 0 && (
                                <span
                                  className={
                                    isSel
                                      ? "text-indigo-100 font-normal ml-1"
                                      : "text-gray-500 font-normal ml-1"
                                  }
                                >
                                  +₹{pOpt.extra}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 4: Rate per piece */}
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-gray-900">
                          Rate per piece
                        </div>
                        <div className="text-[11px] text-gray-400">
                          From the price list
                        </div>
                      </div>
                      <div className="font-extrabold text-base text-gray-900">
                        ₹{totalRate.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add another size button */}
          <div className="pt-1">
            <button
              type="button"
              className="w-full py-3.5 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl text-indigo-600 text-xs font-bold transition hover:bg-indigo-50/50 bg-indigo-50/20 cursor-pointer"
              onClick={() => addSizeToGroup(gIdx)}
            >
              + Add another size of this design
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-3">
        <button
          type="button"
          disabled={!isReadyFormValid || isSavingProduct}
          className={`px-6 py-2.5 font-bold rounded-xl text-xs shadow-xs transition select-none flex items-center gap-2 ${
            isReadyFormValid && !isSavingProduct
              ? "bg-[#FCE6A9] hover:bg-[#f6dc98] text-gray-800 cursor-pointer active:scale-98"
              : "bg-amber-100/70 text-gray-400 cursor-not-allowed opacity-60"
          }`}
          onClick={() => {
            if (isReadyFormValid && !isSavingProduct) {
              handleSaveAll();
              setActiveGroupIndex(
                gIdx + 1 < trophyGroups.length ? gIdx + 1 : null
              );
            }
          }}
        >
          {isSavingProduct && (
            <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <span>{isSavingProduct ? "Saving to database..." : "Done with this product"}</span>
        </button>
        <span className="text-xs text-gray-400">
          {!group.theme && !group.readyCode
            ? "Pick a ready trophy."
            : !isReadyFormValid
            ? "Each row needs a size and a quantity."
            : "Each row has a size and a quantity."}
        </span>
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-red-600 font-medium transition cursor-pointer"
          onClick={() => handleDiscardGroup(gIdx)}
        >
          Discard this product
        </button>
      </div>
    </div>
  );
};

export default ReadyTrophyForm;
