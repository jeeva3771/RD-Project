import React from "react";
import { TYPE_CATEGORIES } from "../../../utils/constants";

const CustomTrophyForm = ({
  gIdx,
  group,
  groupChar,
  trophyGroups,
  setTrophyGroups,
  syncState,
  handleSaveAll,
  setActiveGroupIndex,
  addSizeToGroup,
  removeSizeFromGroup,
  clientPastOrders,
  typeCatKey,
  setTypeCatKey,
  typeQuery,
  setTypeQuery,
  toggleMaterialInGroup,
  toggleElementInGroup,
  formatMatString,
  handleDiscardGroup
}) => {
  const updateGroupTheme = (newTheme) => {
    const updated = [...trophyGroups];
    updated[gIdx].theme = newTheme;
    setTrophyGroups(updated);
    syncState(updated);
  };

  const selectPastReorder = (reorder) => {
    const updated = [...trophyGroups];
    updated[gIdx].theme = reorder.name;
    if (updated[gIdx].items?.[0]) {
      updated[gIdx].items[0].size = reorder.size;
      updated[gIdx].items[0].budget = reorder.rate;
    }
    setTrophyGroups(updated);
    syncState(updated);
  };

  const handleUpdateItem = (iIdx, field, val) => {
    const updated = [...trophyGroups];
    updated[gIdx].items[iIdx] = {
      ...updated[gIdx].items[iIdx],
      [field]: val
    };
    setTrophyGroups(updated);
    syncState(updated);
  };

  const handleDuplicateSize = (iIdx) => {
    const currentItem = group.items[iIdx];
    const duplicatedItem = {
      ...currentItem,
      size: (parseFloat(currentItem.size) || 8) + 2,
      qty: currentItem.qty || 50,
      budget: currentItem.budget || 850,
      designOptionsCount: currentItem.designOptionsCount || 2
    };
    const updated = [...trophyGroups];
    updated[gIdx].items.splice(iIdx + 1, 0, duplicatedItem);
    setTrophyGroups(updated);
    syncState(updated);
  };

  const pastOrdersScrollRef = React.useRef(null);

  const scrollPastOrders = (direction) => {
    if (pastOrdersScrollRef.current) {
      const scrollAmount = 260;
      pastOrdersScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="panel p-5 bg-white border-2 border-indigo-600 rounded-3xl shadow-md space-y-5">
      {/* Product Header Title */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-md bg-indigo-100 text-indigo-800 font-extrabold text-xs uppercase tracking-wider">
            CUSTOM DESIGNED
          </span>
          <span className="font-extrabold text-lg text-gray-900">
            {group.theme
              ? `Product ${gIdx + 1}: ${group.theme}`
              : `Product ${gIdx + 1}`}
          </span>
        </div>
        <span className="text-xs font-semibold text-gray-400">
          Type {groupChar}
        </span>
      </div>

      {/* 1. What's the design? */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
            1
          </span>
          <span className="font-bold text-sm text-gray-900">
            What’s the design?
          </span>
        </div>

        {/* Past Reorders Scrollable Carousel */}
        {clientPastOrders && clientPastOrders.length > 0 && (
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => scrollPastOrders("left")}
              title="Previous"
              aria-label="Previous past orders"
              className="w-7 h-7 rounded-full bg-white border border-gray-300 hover:bg-gray-100 active:scale-90 flex items-center justify-center text-xs font-bold shrink-0 text-gray-600 mr-2 shadow-xs cursor-pointer transition"
            >
              ◀
            </button>
            <div
              ref={pastOrdersScrollRef}
              className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none flex-1 scroll-smooth"
            >
              {clientPastOrders.map((po, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className={`p-3 rounded-2xl border text-left transition shrink-0 flex items-center gap-3 cursor-pointer ${
                    group.theme === po.name
                      ? "bg-indigo-50 border-indigo-600 shadow-sm"
                      : "bg-white border-gray-200 hover:border-indigo-300"
                  }`}
                  onClick={() => selectPastReorder(po)}
                >
                  <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                    🏆
                  </span>
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      {po.name}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                      Reorder · {po.month} · {po.size} in · ₹{po.rate}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollPastOrders("right")}
              title="Next"
              aria-label="Next past orders"
              className="w-7 h-7 rounded-full bg-white border border-gray-300 hover:bg-gray-100 active:scale-90 flex items-center justify-center text-xs font-bold shrink-0 text-gray-600 ml-2 shadow-xs cursor-pointer transition"
            >
              ▶
            </button>
          </div>
        )}

        {/* Design Name Text Input */}
        <div>
          <input
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm font-semibold text-gray-900 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition placeholder-gray-400"
            value={group.theme || ""}
            placeholder="Design name or theme, e.g. Champions Cup 2026"
            onChange={(ev) => updateGroupTheme(ev.target.value)}
          />
        </div>

        {/* Type Box */}
        <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-800">Type</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]">
              {group.type || "Memento"}{" "}
              <span className="opacity-60 font-normal">
                · {TYPE_CATEGORIES[typeCatKey]?.label || "Classic"}
              </span>
            </span>
          </div>

          <div className="relative">
            <input
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium"
              placeholder="Search options…"
              value={typeQuery}
              onChange={(ev) => setTypeQuery(ev.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-xs text-gray-400">
              🔍
            </span>
          </div>

          {/* Category Chips */}
          <div className="flex gap-2 overflow-x-auto text-xs pb-1">
            {Object.entries(TYPE_CATEGORIES).map(([key, cat]) => {
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
                        ? "bg-indigo-700 text-white"
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
              const currentOpts =
                TYPE_CATEGORIES[typeCatKey]?.options ||
                TYPE_CATEGORIES[typeCatKey]?.items ||
                TYPE_CATEGORIES?.classic?.options ||
                TYPE_CATEGORIES?.classic?.items ||
                [];
              const rawFiltered = typeQuery.trim()
                ? Object.values(TYPE_CATEGORIES || {})
                    .flatMap((c) => c?.options || c?.items || [])
                    .filter((o) => {
                      const str = typeof o === "string" ? o : o?.label || "";
                      return str.toLowerCase().includes(typeQuery.toLowerCase());
                    })
                : currentOpts;
              const filtered = Array.isArray(rawFiltered) ? rawFiltered : [];

              return [...filtered, "+ Other..."].map((tp) => {
                const isOtherBtn = tp === "+ Other...";
                const isSelected = isOtherBtn
                  ? group.isCustomType || group.type === "+ Other..."
                  : group.type === tp && !group.isCustomType;

                return (
                  <button
                    key={tp}
                    type="button"
                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white border-gray-200 text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/50"
                    }`}
                    onClick={() => {
                      const updated = [...trophyGroups];
                      if (isOtherBtn) {
                        updated[gIdx].isCustomType = true;
                        updated[gIdx].showCustomTypeInput = true;
                        if (!updated[gIdx].customTypeName) {
                          updated[gIdx].customTypeName = "";
                        }
                        updated[gIdx].type =
                          updated[gIdx].customTypeName || "Other Product";
                      } else {
                        updated[gIdx].type = tp;
                        updated[gIdx].isCustomType = false;
                        updated[gIdx].showCustomTypeInput = false;
                      }
                      setTrophyGroups(updated);
                      syncState(updated);
                    }}
                  >
                    {isOtherBtn && group.customTypeName
                      ? `+ Other (${group.customTypeName})`
                      : tp}
                  </button>
                );
              });
            })()}
          </div>

          {/* Inline Custom Type Name Input Field when + Other... is active */}
          {(group.isCustomType || group.showCustomTypeInput) && (
            <div className="flex items-center gap-3 pt-2 fade">
              <input
                autoFocus
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-2xl text-xs outline-none text-gray-900 placeholder-gray-400 font-medium focus:border-indigo-500 shadow-2xs"
                placeholder={`Add to ${TYPE_CATEGORIES[typeCatKey]?.label || "Classic"}...`}
                value={group.customTypeName || ""}
                onChange={(ev) => {
                  const val = ev.target.value;
                  const updated = [...trophyGroups];
                  updated[gIdx].customTypeName = val;
                  if (val.trim()) {
                    updated[gIdx].type = val;
                  }
                  setTrophyGroups(updated);
                  syncState(updated);
                }}
              />
              <button
                type="button"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition shadow-2xs shrink-0 cursor-pointer"
                onClick={() => {
                  const updated = [...trophyGroups];
                  updated[gIdx].showCustomTypeInput = false;
                  const finalType =
                    updated[gIdx].customTypeName?.trim() || "Custom Product";
                  updated[gIdx].type = finalType;
                  setTrophyGroups(updated);
                  syncState(updated);
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Construction Type Grid */}
        <div className="space-y-2.5 pt-1">
          <div className="text-xs font-bold text-gray-800">
            Construction type
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {[
              "13x11 CNC",
              "CNC with a solid base",
              "Plaque with a stud",
              "Composite, solid base",
              "Composite, single step",
              "Composite, double step",
              "Self-standing block",
              "Fibre frame",
              "Medal",
              "Clear acrylic, hollow LED base",
              "3D figurine, solid base"
            ].map((ct) => {
              const isSel =
                (group.construction || "Plaque with a stud") === ct;
              return (
                <button
                  key={ct}
                  type="button"
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    isSel
                      ? "bg-indigo-50/80 border-indigo-600 text-indigo-900 shadow-xs"
                      : "bg-white border-gray-200 text-gray-800 hover:border-indigo-300"
                  }`}
                  onClick={() => {
                    const updated = [...trophyGroups];
                    updated[gIdx].construction = ct;
                    setTrophyGroups(updated);
                    syncState(updated);
                  }}
                >
                  <span>{ct}</span>
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

        {/* Elements Selection */}
        <div className="space-y-2.5 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-800">Elements</span>
            <span className="text-gray-400 text-[11px]">
              (pick any that apply)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {[
              { id: "metal", label: "Metal elements", icon: "⚙️" },
              {
                id: "laser_cut",
                label: "Metal laser-cut elements",
                icon: "✂️"
              },
              { id: "casting", label: "Metal casting elements", icon: "🔥" },
              { id: "plated", label: "Gold / silver plated", icon: "✨" },
              { id: "lanyard", label: "Lanyard", icon: "🎗️" }
            ].map((el) => {
              const curElements = Array.isArray(group.elements)
                ? group.elements
                : [];
              const isSel = curElements.includes(el.id);
              return (
                <button
                  key={el.id}
                  type="button"
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    isSel
                      ? "bg-indigo-50/80 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-500/20"
                      : "bg-white border-gray-200 text-gray-800 hover:border-indigo-300"
                  }`}
                  onClick={() => toggleElementInGroup(gIdx, el.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{el.icon}</span>
                    <span>{el.label}</span>
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

        {/* Material Selection */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-800">Material</span>
            <span className="text-gray-400 text-[11px]">
              one, or up to 3 for a fusion
            </span>
          </div>
          <div className="flex gap-2 flex-wrap text-xs">
            {[
              "Acrylic",
              "Crystal",
              "Resin",
              "3D printing",
              "Brass",
              "MS",
              "Metal",
              "Aluminium",
              "Glass",
              "MDF",
              "Wood"
            ].map((mat) => {
              const curMats =
                Array.isArray(group.mats) && group.mats.length > 0
                  ? group.mats
                  : group.mat && group.mat.startsWith("Fusion: ")
                  ? group.mat.replace("Fusion: ", "").split(" + ")
                  : [group.mat || "MDF"];

              const isSel = curMats.includes(mat);
              return (
                <button
                  key={mat}
                  type="button"
                  className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${
                    isSel
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleMaterialInGroup(gIdx, mat)}
                >
                  {mat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Sizes, quantities and approximate rates */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            2
          </span>
          <div>
            <h3 className="font-bold text-base text-gray-900 leading-snug">
              Sizes, quantities and approximate rates
            </h3>
            <p className="text-xs text-gray-500 font-normal mt-0.5">
              Fill one card per size. For each size, add the quantities to
              price, the rate the client expects and how many design options to
              show.
            </p>
          </div>
        </div>

        {/* Size Cards List */}
        <div className="space-y-4">
          {group.items.map((item, iIdx) => (
            <div
              key={iIdx}
              className="bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl overflow-hidden transition shadow-xs"
            >
              {/* Size Card Header */}
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    ✓
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">
                      Size Line {iIdx + 1}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                      {item.size || 8} in
                    </span>
                    {item.qty ? (
                      <span className="text-xs text-gray-500 font-normal">
                        · {item.qty} pcs
                      </span>
                    ) : null}
                    {item.budget ? (
                      <span className="text-xs text-gray-500 font-normal">
                        · ≈ ₹{item.budget}/pc
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer"
                    onClick={() => handleDuplicateSize(iIdx)}
                  >
                    + Duplicate with new size
                  </button>
                  {group.items.length > 1 && (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600 font-medium text-xs transition cursor-pointer px-1"
                      onClick={() => removeSizeFromGroup(gIdx, iIdx)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Size Card Body */}
              <div className="p-5 space-y-4">
                {/* Trophy Height Dropdown */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      Trophy Height
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Main vertical dimension
                    </div>
                  </div>
                  <div className="w-full sm:w-64">
                    <select
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-800 bg-white outline-none focus:border-indigo-500 transition cursor-pointer shadow-2xs"
                      value={parseFloat(item.size) || 8}
                      onChange={(ev) => {
                        const val = parseFloat(ev.target.value) || 8;
                        handleUpdateItem(iIdx, "size", val);
                      }}
                    >
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24].map((n) => (
                        <option key={n} value={n}>
                          {n} inches ({Math.round(n * 25.4)} mm)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantities to price */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      Quantities to price
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Add one or more quantity targets
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
                        handleUpdateItem(iIdx, "qty", val);
                      }}
                    />
                    {[25, 50, 100, 150, 200].map((presetQty) => (
                      <button
                        key={presetQty}
                        type="button"
                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition cursor-pointer ${
                          item.qty === presetQty
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-white border-dashed border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600"
                        }`}
                        onClick={() => handleUpdateItem(iIdx, "qty", presetQty)}
                      >
                        {presetQty}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Approx. rate per piece */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      Approx. rate per piece
                    </div>
                    <div className="text-[11px] text-gray-400">
                      What the client expects
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Rate"
                        className="w-28 pl-7 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 bg-white outline-none focus:border-indigo-500 shadow-2xs"
                        value={item.budget || ""}
                        onChange={(ev) => {
                          const val = parseFloat(ev.target.value) || 0;
                          handleUpdateItem(iIdx, "budget", val);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      onClick={() => handleUpdateItem(iIdx, "budget", 850)}
                    >
                      Fits our estimate
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-xl text-xs font-medium transition cursor-pointer"
                      onClick={() => handleUpdateItem(iIdx, "budget", 0)}
                    >
                      Client hasn't said
                    </button>
                  </div>
                </div>

                {/* Design options to show */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      Design options to show
                    </div>
                    <div className="text-[11px] text-gray-400">
                      How many unique design directions to present
                    </div>
                  </div>
                  <div className="flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold transition cursor-pointer"
                      onClick={() => {
                        const cur = item.designOptionsCount || 2;
                        handleUpdateItem(
                          iIdx,
                          "designOptionsCount",
                          Math.max(1, cur - 1)
                        );
                      }}
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-bold text-xs text-gray-800">
                      {item.designOptionsCount || 2}
                    </span>
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold transition cursor-pointer"
                      onClick={() => {
                        const cur = item.designOptionsCount || 2;
                        handleUpdateItem(
                          iIdx,
                          "designOptionsCount",
                          Math.min(5, cur + 1)
                        );
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Another Size Button */}
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

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-3">
        <button
          type="button"
          className="px-6 py-2.5 bg-[#FCE6A9] hover:bg-[#f6dc98] text-gray-800 font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
          onClick={() => {
            handleSaveAll();
            setActiveGroupIndex(
              gIdx + 1 < trophyGroups.length ? gIdx + 1 : null
            );
          }}
        >
          Done with this product
        </button>
        <span className="text-xs text-gray-400">
          Add the design name, type, construction and material.
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

export default CustomTrophyForm;
