import React, { useState } from "react";
import {
  BOX_OPTS,
  PROTECT_OPTS,
  LABEL_OPTS,
  ADDON_OPTS,
  MODE_OPTS,
  BOX_COLOURS,
  dfmt
} from "../../utils/helpers";
import PreviewDeliveryChargesSheet from "./PreviewDeliveryChargesSheet";
import CommunicationLogForm from "../common/CommunicationLogForm";

const PackDelivery = ({ s, set, client, items = [] }) => {
  const products =
    items?.length > 0
      ? items
      : s.orderItems?.length > 0
      ? s.orderItems
      : [
          { id: "item_1", theme: "Million Dollar Club Trophy", qty: 40, size: 11 },
          { id: "item_2", theme: "fbvdfbdgfb", qty: 100, size: 18 }
        ];

  // ----------------------------------------------------
  // PACKING STATE
  // ----------------------------------------------------
  const defaultPackConfig = {
    outer: ["Velvet box"],
    protect: ["Thermocol cavity box"],
    labels: ["Address & name label"],
    addons: ["Certificate"],
    mode: "Individual",
    alphabetical: true,
    colour: "Black",
    notes: ""
  };

  const [packingScope, setPackingScope] = useState(s.packingScope || "all"); // 'all' | 'per_product'
  const [activeProductIdx, setActiveProductIdx] = useState(0);

  const [allPack, setAllPack] = useState(() => ({
    ...defaultPackConfig,
    ...(s.pack || {})
  }));

  const [productPacks, setProductPacks] = useState(() => {
    const map = {};
    products.forEach((p, idx) => {
      map[idx] = {
        ...defaultPackConfig,
        ...(s.productPacks?.[idx] || (idx === 0 && s.pack ? s.pack : {}))
      };
    });
    return map;
  });

  const [openP, setOpenP] = useState(!s.packOk);

  const currentPack =
    packingScope === "all"
      ? allPack
      : productPacks[activeProductIdx] || defaultPackConfig;

  const updateCurrentPack = (changes) => {
    if (packingScope === "all") {
      setAllPack((prev) => ({ ...prev, ...changes }));
    } else {
      setProductPacks((prev) => ({
        ...prev,
        [activeProductIdx]: {
          ...(prev[activeProductIdx] || defaultPackConfig),
          ...changes
        }
      }));
    }
    set({ packOk: false });
  };

  const toggleMultiPack = (key, val) => {
    const list = currentPack[key] || [];
    const next = list.includes(val)
      ? list.filter((x) => x !== val)
      : [...list, val];
    updateCurrentPack({ [key]: next });
  };

  const setPackMode = (val) => {
    updateCurrentPack({ mode: val });
  };

  const toggleAlphabetical = () => {
    updateCurrentPack({ alphabetical: !currentPack.alphabetical });
  };

  const handleConfirmPacking = () => {
    if (packingScope === "all") {
      set({
        pack: allPack,
        packingScope: "all",
        packOk: true
      });
      setOpenP(false);
    } else {
      if (activeProductIdx < products.length - 1) {
        setActiveProductIdx(activeProductIdx + 1);
      } else {
        set({
          pack: productPacks[0] || defaultPackConfig,
          productPacks,
          packingScope: "per_product",
          packOk: true
        });
        setOpenP(false);
      }
    }
  };

  // ----------------------------------------------------
  // DELIVERY STATE
  // ----------------------------------------------------
  const defaultDelivConfig = {
    destination: "Local",
    carrier: "Tempo",
    payer: "rd", // 'rd' or 'client'
    splitLocations: false,
    shipTo: "Lonavala offsite venue",
    receiver: "Vikas Rao · Sales ops",
    when: "Office hours",
    chargesState: null, // null | 'simulated'
    chargesAmount: 2500,
    notes: ""
  };

  const [dispatchScope, setDispatchScope] = useState(s.dispatchScope || "all"); // 'all' | 'per_product'
  const [activeDispatchIdx, setActiveDispatchIdx] = useState(0);

  const [allDeliv, setAllDeliv] = useState(() => ({
    ...defaultDelivConfig,
    ...(s.deliv || {})
  }));

  const [productDelivs, setProductDelivs] = useState(() => {
    const map = {};
    products.forEach((p, idx) => {
      map[idx] = {
        ...defaultDelivConfig,
        ...(s.productDelivs?.[idx] || (idx === 0 && s.deliv ? s.deliv : {}))
      };
    });
    return map;
  });

  const [openD, setOpenD] = useState(!s.delivOk);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const [isChangingAddress, setIsChangingAddress] = useState(false);

  const currentDeliv =
    dispatchScope === "all"
      ? allDeliv
      : productDelivs[activeDispatchIdx] || defaultDelivConfig;

  const updateCurrentDeliv = (changes) => {
    if (dispatchScope === "all") {
      setAllDeliv((prev) => ({ ...prev, ...changes }));
    } else {
      setProductDelivs((prev) => ({
        ...prev,
        [activeDispatchIdx]: {
          ...(prev[activeDispatchIdx] || defaultDelivConfig),
          ...changes
        }
      }));
    }
    set({ delivOk: false });
  };

  const handleConfirmDelivery = () => {
    if (dispatchScope === "all") {
      set({
        deliv: currentDeliv,
        dispatchScope: "all",
        delivOk: true
      });
      setOpenD(false);
    } else {
      if (activeDispatchIdx < products.length - 1) {
        setActiveDispatchIdx(activeDispatchIdx + 1);
      } else {
        set({
          deliv: productDelivs[0] || defaultDelivConfig,
          productDelivs,
          dispatchScope: "per_product",
          delivOk: true
        });
        setOpenD(false);
      }
    }
  };

  const DELIV_CARRIERS = [
    { id: "Our vehicle", icon: "🚐", label: "Our vehicle", hasCharges: false },
    { id: "Hand delivery", icon: "🤝", label: "Hand delivery", hasCharges: false },
    { id: "Tempo", icon: "🚚", label: "Tempo", hasCharges: true },
    { id: "Porter", icon: "🛵", label: "Porter", hasCharges: true },
    { id: "Courier", icon: "📮", label: "Courier", hasCharges: true },
    { id: "Air cargo", icon: "✈️", label: "Air cargo", hasCharges: true },
    { id: "Client's courier", icon: "📦", label: "Client's courier", hasCharges: false },
    { id: "Client pickup", icon: "🏢", label: "Client pickup", hasCharges: false }
  ];

  const DEST_OPTS = [
    { id: "Local", icon: "🏙️", label: "Local" },
    { id: "Maharashtra", icon: "🗺️", label: "Maharashtra" },
    { id: "India", icon: "🇮🇳", label: "in India" },
    { id: "Abroad", icon: "🌐", label: "Abroad" }
  ];

  const currentCarrierObj = DELIV_CARRIERS.find(
    (c) => c.id === currentDeliv.carrier
  ) || DELIV_CARRIERS[2];

  const currentProduct = products[activeProductIdx] || products[0];
  const currentDispatchProduct = products[activeDispatchIdx] || products[0];

  return (
    <div className="space-y-4 text-xs">
      {/* ==================================================== */}
      {/* 1. PACKING CARD                                      */}
      {/* ==================================================== */}
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

      {/* ==================================================== */}
      {/* 2. DELIVERY CARD                                     */}
      {/* ==================================================== */}
      <div
        className={`p-5 rounded-2xl border bg-white shadow-2xs transition ${
          s.delivOk ? "border-emerald-300" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚚</span>
            <div>
              <h4 className="font-bold text-sm text-gray-900">Delivery</h4>
              <p className="text-[11px] text-gray-500">
                {s.delivOk && !openD
                  ? `${currentDeliv.carrier} · ${currentDeliv.shipTo} · ${currentDeliv.when}`
                  : `By ${dfmt(s.relDate || s.leadDate || "2026-10-24")} · date set on Order & rate`}
              </p>
            </div>
          </div>
          {!openD && (
            <button
              type="button"
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              onClick={() => setOpenD(true)}
            >
              Edit
            </button>
          )}
        </div>

        {openD && (
          <div className="pt-4 space-y-5 text-xs">
            {/* Top Switcher: Same dispatch for all vs Dispatch each product separately */}
            <div className="p-2.5 bg-gray-50/70 border border-gray-200 rounded-2xl flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-gray-500 pl-2">
                {products.length} products:
              </span>
              <div className="inline-flex rounded-xl p-1 bg-gray-100/90 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setDispatchScope("all")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    dispatchScope === "all"
                      ? "bg-white text-gray-900 shadow-2xs border border-gray-200"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Same dispatch for all
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchScope("per_product")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    dispatchScope === "per_product"
                      ? "bg-white text-indigo-700 shadow-2xs border border-indigo-200"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Dispatch each product separately
                </button>
              </div>
            </div>

            {/* Per-Product Tabs & Product Header */}
            {dispatchScope === "per_product" && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {products.map((prod, idx) => (
                    <button
                      key={prod.id || idx}
                      type="button"
                      onClick={() => setActiveDispatchIdx(idx)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        activeDispatchIdx === idx
                          ? "bg-[#2815f5] text-white shadow-2xs"
                          : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                          activeDispatchIdx === idx
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
                    {currentDispatchProduct.theme || currentDispatchProduct.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {currentDispatchProduct.qty || 40} pcs to dispatch
                  </p>
                </div>
              </div>
            )}

            {/* Comparison Box (Logged at enquiry vs For this delivery) */}
            <div className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-[11px]">Logged at enquiry</span>
                <span className="font-medium text-gray-800">
                  Lonavala offsite venue
                </span>
                <span className="text-gray-400 font-mono text-[11px]">
                  Fri, 23 Oct
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700">
                  For this delivery
                </span>
                <span className="font-extrabold text-gray-900">
                  {currentDeliv.shipTo || "Lonavala offsite venue"}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-900 font-bold text-[11px]">
                    Sat, 24 Oct
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-purple-100 text-purple-700">
                    UPDATED
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-gray-400 pt-1.5 border-t border-gray-200/60 flex items-center gap-1.5">
                <span>✏️</span> The sample went to Lonavala offsite venue. This is the final order's delivery.
              </div>
            </div>

            {/* Structured Rows */}
            <div className="divide-y divide-gray-100">
              {/* Row 1: Destination */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4 first:pt-0">
                <div className="w-full sm:w-44 shrink-0">
                  <b className="block text-xs font-bold text-gray-900">
                    Destination
                  </b>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-flex rounded-xl p-1 bg-gray-50 border border-gray-200 flex-wrap gap-1">
                    {DEST_OPTS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => updateCurrentDeliv({ destination: d.id })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          currentDeliv.destination === d.id
                            ? "bg-white text-indigo-700 shadow-2xs border border-gray-200 font-bold"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <span>{d.icon}</span>
                        <span>{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Carrier & Freight Payer */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
                <div className="w-full sm:w-44 shrink-0">
                  <b className="block text-xs font-bold text-gray-900">
                    Carrier
                  </b>
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {DELIV_CARRIERS.map((c) => {
                      const isSel = currentDeliv.carrier === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => updateCurrentDeliv({ carrier: c.id })}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            isSel
                              ? "bg-[#2815f5] text-white shadow-2xs"
                              : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <span>{c.icon}</span>
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Freight Payer Pills (RD pays vs Client pays) */}
                  {currentCarrierObj.hasCharges && (
                    <div className="inline-flex rounded-xl p-1 bg-gray-50 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => updateCurrentDeliv({ payer: "rd" })}
                        className={`px-3.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          currentDeliv.payer === "rd"
                            ? "bg-white text-gray-900 shadow-2xs border border-gray-200"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        RD pays freight
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCurrentDeliv({ payer: "client" })}
                        className={`px-3.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          currentDeliv.payer === "client"
                            ? "bg-white text-indigo-700 shadow-2xs border border-indigo-200"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        Client pays freight
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Final delivery to */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
                <div className="w-full sm:w-44 shrink-0">
                  <b className="block text-xs font-bold text-gray-900">
                    Final delivery to
                  </b>
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="inline-flex rounded-xl p-1 bg-gray-50 border border-gray-200">
                    <button
                      type="button"
                      onClick={() => updateCurrentDeliv({ splitLocations: false })}
                      className={`px-3.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        !currentDeliv.splitLocations
                          ? "bg-white text-gray-900 shadow-2xs border border-gray-200"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      One address
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentDeliv({ splitLocations: true })}
                      className={`px-3.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        currentDeliv.splitLocations
                          ? "bg-white text-indigo-700 shadow-2xs border border-indigo-200"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Split across locations
                    </button>
                  </div>

                  {/* Confirmed Address Card (Green Box) */}
                  <div className="border-2 border-emerald-500 bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <span className="text-rose-500 text-sm mt-0.5">📍</span>
                      <div>
                        <div className="text-[10px] text-gray-400 font-medium">
                          Final delivery address from the enquiry
                        </div>
                        <div className="font-extrabold text-xs text-gray-900 mt-0.5">
                          {currentDeliv.shipTo || "Lonavala offsite venue"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-emerald-700 font-bold mb-1">
                        ✓ Confirmed
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsChangingAddress(!isChangingAddress)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {isChangingAddress && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2">
                      <select
                        className="p-2 text-xs border border-gray-200 rounded-lg bg-white flex-1 outline-none"
                        value={currentDeliv.shipTo}
                        onChange={(e) => {
                          updateCurrentDeliv({ shipTo: e.target.value });
                          setIsChangingAddress(false);
                        }}
                      >
                        <option value="Lonavala offsite venue">
                          Lonavala offsite venue
                        </option>
                        <option value="Head office, Lower Parel">
                          Head office, Lower Parel
                        </option>
                        <option value="Andheri East office">
                          Andheri East office
                        </option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsChangingAddress(false)}
                        className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4: Receiver & When */}
              <div className="py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Receiver
                    </label>
                    <select
                      className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none cursor-pointer"
                      value={currentDeliv.receiver}
                      onChange={(e) =>
                        updateCurrentDeliv({ receiver: e.target.value })
                      }
                    >
                      <option value="Vikas Rao · Sales ops">
                        Vikas Rao · Sales ops
                      </option>
                      <option value="Sneha Kulkarni · HR">
                        Sneha Kulkarni · HR
                      </option>
                      {client?.contacts?.map((c) => (
                        <option key={c.id || c.name} value={`${c.name} · ${c.role || "Contact"}`}>
                          {c.name} · {c.role || "Contact"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      When
                    </label>
                    <select
                      className="w-full p-2 text-xs border border-gray-200 rounded-xl bg-white outline-none cursor-pointer"
                      value={currentDeliv.when}
                      onChange={(e) =>
                        updateCurrentDeliv({ when: e.target.value })
                      }
                    >
                      <option value="Office hours">Office hours</option>
                      <option value="Anytime">Anytime</option>
                      <option value="Morning only">Morning only</option>
                      <option value="Before the event date">
                        Before the event date
                      </option>
                      <option value="At the venue, event day">
                        At the venue, event day
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 5: Charges */}
              {currentCarrierObj.hasCharges && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4">
                  <div className="w-full sm:w-44 shrink-0">
                    <b className="block text-xs font-bold text-gray-900 mt-1">
                      Charges
                    </b>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* 1. INITIAL / UNREQUESTED */}
                    {!currentDeliv.chargesState && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateCurrentDeliv({
                              chargesState: "requested"
                            })
                          }
                          className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                        >
                          Request cost from Dispatch
                        </button>
                        <span className="text-[11px] text-gray-400 font-medium">
                          Optional · the job can be posted without it
                        </span>
                      </div>
                    )}

                    {/* 2. REQUESTED */}
                    {currentDeliv.chargesState === "requested" && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-full">
                          Requested {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · awaiting
                        </div>
                        <button
                          type="button"
                          className="px-4 py-1.5 text-[10px] font-semibold text-gray-700 border border-gray-200 rounded-full bg-white hover:bg-gray-50 transition shadow-2xs cursor-pointer"
                          onClick={() =>
                            updateCurrentDeliv({ chargesState: "inputting_amount" })
                          }
                        >
                          Simulate: Dispatch sends the cost
                        </button>
                      </div>
                    )}

                    {/* 3. INPUTTING AMOUNT */}
                    {currentDeliv.chargesState === "inputting_amount" && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[11px] font-bold">
                            ₹
                          </span>
                          <input
                            type="number"
                            autoFocus
                            className="w-28 pl-7 pr-3 py-1.5 text-[11px] font-bold text-gray-800 border border-gray-200 rounded-full outline-none focus:border-indigo-500 shadow-2xs"
                            placeholder="Amount"
                            value={currentDeliv.chargesAmount ?? ""}
                            onChange={(e) =>
                              updateCurrentDeliv({ chargesAmount: e.target.value })
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              currentDeliv.chargesAmount &&
                              updateCurrentDeliv({ chargesState: "simulated" })
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className={`px-4 py-1.5 text-[10px] font-bold rounded-full shadow-2xs transition cursor-pointer ${
                            currentDeliv.chargesAmount
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                          onClick={() =>
                            currentDeliv.chargesAmount &&
                            updateCurrentDeliv({ chargesState: "simulated" })
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer"
                          onClick={() =>
                            updateCurrentDeliv({
                              chargesState: currentDeliv.chargesAmount
                                ? "simulated"
                                : "requested"
                            })
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* 4. SIMULATED / AWAITING_APPROVAL / SELECTING_APPROVAL_MODE / APPROVED */}
                    {[
                      "simulated",
                      "awaiting_approval",
                      "selecting_approval_mode",
                      "approved"
                    ].includes(currentDeliv.chargesState) && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-extrabold text-xs text-gray-900">
                              ₹{Number(currentDeliv.chargesAmount || 2500).toLocaleString("en-IN")}
                            </span>
                            <button
                              type="button"
                              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 underline cursor-pointer"
                              onClick={() =>
                                updateCurrentDeliv({ chargesState: "inputting_amount" })
                              }
                            >
                              change
                            </button>
                            <span className="text-gray-500 text-[11px] font-medium ml-1">
                              + GST · {currentDeliv.carrier} · {s?.dcNumber || "DC/26/0415-972"}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              currentDeliv.payer === "client"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {currentDeliv.payer === "client"
                              ? "Client pays · added to invoice"
                              : "RD pays · logged to job cost"}
                          </span>
                        </div>

                        {currentDeliv.chargesState === "simulated" && (
                          <div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setShowChargesModal(true)}
                                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer"
                              >
                                Send to client for approval
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCurrentDeliv({
                                    chargesState: null,
                                    chargesAmount: ""
                                  })
                                }
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                              >
                                Reset
                              </button>
                            </div>

                            <div className="text-[11px] text-gray-400 mt-2">
                              {currentDeliv.payer === "rd" ? (
                                <>
                                  RD is paying this freight. Should the client pay instead?{" "}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCurrentDeliv({ payer: "client" })
                                    }
                                    className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                  >
                                    Switch to client pays
                                  </button>
                                </>
                              ) : (
                                <>
                                  Once approved, the charges go on the invoice.{" "}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCurrentDeliv({ payer: "rd" })
                                    }
                                    className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                  >
                                    Switch to RD pays
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {currentDeliv.chargesState === "awaiting_approval" && (
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="px-3 py-1.5 text-[10px] font-bold bg-[#FFF8D6] text-[#A67C00] rounded-lg">
                                Sent via {currentDeliv.chargesSendMethod || "Hand-delivered / other"} · awaiting OK
                              </div>
                              <button
                                type="button"
                                className="px-4 py-1.5 text-[10px] font-bold bg-[#059669] text-white hover:bg-emerald-700 rounded-lg shadow-2xs transition cursor-pointer"
                                onClick={() =>
                                  updateCurrentDeliv({ chargesState: "selecting_approval_mode" })
                                }
                              >
                                Client approved charges
                              </button>
                              <button
                                type="button"
                                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                                onClick={() => setShowChargesModal(true)}
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                                onClick={() =>
                                  updateCurrentDeliv({ chargesState: null, chargesAmount: "" })
                                }
                              >
                                Reset
                              </button>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-2">
                              {currentDeliv.payer === "client"
                                ? "Once approved, the charges go on the invoice."
                                : "RD is paying this freight."}
                            </div>
                          </div>
                        )}

                        {currentDeliv.chargesState === "selecting_approval_mode" && (
                          <CommunicationLogForm
                            client={client}
                            mode="delivery-charges"
                            feedbackMode="approve"
                            amount={currentDeliv.chargesAmount}
                            onBack={() =>
                              updateCurrentDeliv({ chargesState: "awaiting_approval" })
                            }
                            onLog={(logData) => {
                              let methodText = "Hand-delivered / other";
                              if (logData.method === "whatsapp") methodText = "WhatsApp";
                              else if (logData.method === "email") methodText = "Email";
                              else if (logData.method === "verbal") methodText = "Verbal";
                              else if (logData.method === "written") methodText = "Written / PO";
                              else if (logData.method === "screenshot") methodText = "Screenshot";

                              updateCurrentDeliv({
                                approvalMethod: methodText,
                                chargesState: "approved"
                              });
                            }}
                          />
                        )}

                        {currentDeliv.chargesState === "approved" && (
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="px-3 py-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-lg">
                                Approved via {currentDeliv.approvalMethod || "WhatsApp"}
                              </div>
                              <button
                                type="button"
                                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                                onClick={() =>
                                  updateCurrentDeliv({ chargesState: null, chargesAmount: "" })
                                }
                              >
                                Reset
                              </button>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-2">
                              {currentDeliv.payer === "client"
                                ? "The charges will be added to the invoice."
                                : "Logged to job cost."}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 6: Notes */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 py-4 last:border-b-0">
                <div className="w-full sm:w-44 shrink-0">
                  <b className="block text-xs font-bold text-gray-900">
                    Notes
                  </b>
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="e.g. Call 30 minutes before; reception, 8th floor"
                    className="w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white outline-none focus:border-indigo-400 transition"
                    value={currentDeliv.notes || ""}
                    onChange={(e) =>
                      updateCurrentDeliv({ notes: e.target.value })
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
                onClick={handleConfirmDelivery}
              >
                {dispatchScope === "all"
                  ? "Confirm delivery"
                  : activeDispatchIdx < products.length - 1
                  ? `Confirm and next: ${
                      products[activeDispatchIdx + 1]?.theme ||
                      products[activeDispatchIdx + 1]?.name ||
                      "Next product"
                    }`
                  : "Confirm delivery"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 3. DELIVERY CHARGES APPROVAL MODAL                    */}
      {/* ==================================================== */}
      {showChargesModal && (
        <PreviewDeliveryChargesSheet
          s={{
            ...s,
            chargesAmount: currentDeliv.chargesAmount || 2500,
            carrier: currentDeliv.carrier || "Tempo",
            payer: currentDeliv.payer || "rd",
            shipTo: currentDeliv.shipTo || "Lonavala offsite venue",
            sampleReceiver: currentDeliv.receiver
          }}
          client={client}
          onClose={() => setShowChargesModal(false)}
          onSend={(mode) => {
            updateCurrentDeliv({
              chargesState: "awaiting_approval",
              chargesSendMethod: typeof mode === "string" ? mode : "WhatsApp"
            });
            setShowChargesModal(false);
          }}
        />
      )}
    </div>
  );
};

export default PackDelivery;
