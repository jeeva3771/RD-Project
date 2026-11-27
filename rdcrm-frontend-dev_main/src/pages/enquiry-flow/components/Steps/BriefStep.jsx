import React, { useState, useRef } from "react";

const ACCEPTED = "image/png,image/jpeg,image/webp";
const MAX_REFS = 5;

const COPYRIGHT_OPTIONS = [
  {
    id: 1,
    value:
      "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd",
  },
  {
    id: 2,
    value:
      "Please note Design Copyrights Apply & is credited with the designer of this design",
  },
];

/** Reusable reference image uploader — accepts png/jpg/jpeg/webp, up to 5 images */
const RefImageUploader = ({ images = [], onChange }) => {
  const inputRef = useRef(null);
  const [previewIdx, setPreviewIdx] = useState(null);

  const handleFiles = (files) => {
    const valid = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp"].includes(f.type)
    );
    const remaining = MAX_REFS - images.length;
    const toAdd = valid.slice(0, remaining);
    const readers = toAdd.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ dataUrl: e.target.result, name: file.name });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((newImgs) => onChange([...images, ...newImgs]));
  };

  const removeImage = (idx) => {
    if (previewIdx === idx) setPreviewIdx(null);
    onChange(images.filter((_, i) => i !== idx));
  };

  const previewImg = previewIdx !== null ? images[previewIdx] : null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Thumbnails */}
        {images.map((img, idx) => (
          <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-xs flex-shrink-0">
            {/* Clickable image → preview */}
            <img
              src={img.dataUrl}
              alt={img.name}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setPreviewIdx(idx)}
            />
            {/* Persistent ✕ remove badge */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-red-600 text-white text-[9px] font-black flex items-center justify-center cursor-pointer transition shadow-sm leading-none"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add button */}
        {images.length < MAX_REFS && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-400 bg-gray-50 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:text-indigo-500 transition gap-0.5 flex-shrink-0"
            >
              <span className="text-xl leading-none">+</span>
              <span className="text-[9px] font-semibold">image</span>
            </button>
          </>
        )}

        {images.length > 0 && (
          <span className="text-[10px] text-gray-400 self-end mb-1">
            {images.length}/{MAX_REFS}
          </span>
        )}
      </div>

      {/* ── Full-screen Preview Modal ── */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
          onClick={() => setPreviewIdx(null)}
        >
          <div
            className="relative max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <img
              src={previewImg.dataUrl}
              alt={previewImg.name}
              className="w-full max-h-[80vh] object-contain bg-black rounded-2xl"
            />

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
              <span className="text-white text-xs font-semibold truncate max-w-xs opacity-80">
                {previewImg.name}
              </span>
              <div className="flex items-center gap-2">
                {/* Prev / Next */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewIdx((previewIdx - 1 + images.length) % images.length)}
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-xs flex items-center justify-center cursor-pointer transition"
                    >
                      ‹
                    </button>
                    <span className="text-white text-[11px] font-semibold opacity-70">
                      {previewIdx + 1}/{images.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewIdx((previewIdx + 1) % images.length)}
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-xs flex items-center justify-center cursor-pointer transition"
                    >
                      ›
                    </button>
                  </>
                )}
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeImage(previewIdx)}
                  className="px-3 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-bold cursor-pointer transition"
                >
                  Remove
                </button>
                {/* Close */}
                <button
                  type="button"
                  onClick={() => setPreviewIdx(null)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-sm flex items-center justify-center cursor-pointer transition"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const BriefStep = ({ s, set, next }) => {
  const e = s?.e || {};

  // Derive all products from trophyGroups
  const trophyGroups = e.trophyGroups || [];
  const products = trophyGroups.length > 0
    ? trophyGroups.map((g, i) => ({
        name: g.theme || `Product ${i + 1}`,
        kind: g.kind || "custom",
        items: g.items || [],
      }))
    : [{ name: e.theme || "Custom Trophy", kind: e.askMode || "custom", items: [{ size: e.size || 8, qty: e.qty || 50 }] }];

  const isSingle = products.length === 1 && products[0].items.length === 1;

  // Local state
  const [briefMode, setBriefMode] = useState(e.briefMode || null); // "one" | "each"
  const [globalBrief, setGlobalBrief] = useState(e.globalBrief || "");
  const [globalRefs, setGlobalRefs] = useState(e.globalRefs || []);
  const [productBriefs, setProductBriefs] = useState(e.productBriefs || {});
  const [activeProductIdx, setActiveProductIdx] = useState(0);
  const [designer, setDesigner] = useState(e.designer !== false);
  const [quoteOnly, setQuoteOnly] = useState(e.quoteOnly || false);
  const [showRDLogo, setShowRDLogo] = useState(e.showRDLogo || false);
  const [showRDContent, setShowRDContent] = useState(e.showRDContent || false);
  const [copyrightContent, setCopyrightContent] = useState(e.copyrightContent || e.copyright_content || "");
  const [designOptions, setDesignOptions] = useState(e.designOptions || 3);
  const [optionsDueIn, setOptionsDueIn] = useState(e.optionsDueIn || 24);

  const updateE = (patch) => set({ e: { ...e, ...patch } });

  const saveAll = () => {
    updateE({
      briefMode,
      globalBrief,
      globalRefs,
      productBriefs,
      designer,
      quoteOnly,
      showRDLogo,
      showRDContent,
      copyrightContent,
      copyright_content: copyrightContent,
      designOptions,
      optionsDueIn,
    });
  };

  const isValid =
    (briefMode === "one"
      ? globalBrief.trim() !== "" && (!showRDContent || Boolean(copyrightContent))
      : briefMode === "each"
      ? products.every((p) => {
          const pb = productBriefs[p.name];
          if (!pb?.brief?.trim()) return false;
          const pHasContent = pb.showRDContent !== undefined ? pb.showRDContent : showRDContent;
          if (pHasContent && !(pb.copyrightContent || copyrightContent)) return false;
          return true;
        })
      : false);

  const activeProduct = products[activeProductIdx] || products[0];
  const activeBrief = productBriefs[activeProduct?.name] || { brief: "", refs: [] };

  const updateProductBrief = (productName, patch) => {
    const updated = {
      ...productBriefs,
      [productName]: { ...(productBriefs[productName] || {}), ...patch },
    };
    setProductBriefs(updated);
  };

  const ToggleSwitch = ({ value, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${value ? "bg-[#635BFF]" : "bg-gray-200"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );

  return (
    <div className="fade space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">Give design the brief</h2>
        <p className="text-sm text-gray-500 mt-1">
          One brief for everything, or a brief for each product. Add references, the brief and how many design options.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <div className="text-xs font-bold text-gray-700">
          Is the design brief the same for all {products.length} product{products.length > 1 ? "s" : ""}?
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* One brief */}
          <button
            type="button"
            className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer ${
              briefMode === "one"
                ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20"
                : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50"
            }`}
            onClick={() => setBriefMode("one")}
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-extrabold text-sm text-gray-900">One brief for all products</div>
            <div className="text-xs text-gray-500 mt-0.5">Same theme, colours and branding across everything</div>
          </button>

          {/* Brief for each */}
          <button
            type="button"
            disabled={isSingle}
            className={`p-4 rounded-2xl border-2 text-left transition ${
              isSingle
                ? "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
                : briefMode === "each"
                ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 cursor-pointer"
                : "bg-white border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50 cursor-pointer"
            }`}
            onClick={() => { if (!isSingle) setBriefMode("each"); }}
          >
            <div className="text-2xl mb-2">🗂️</div>
            <div className="font-extrabold text-sm text-gray-900">A brief for each product</div>
            <div className="text-xs text-gray-500 mt-0.5">Each design has its own look, text or references</div>
          </button>
        </div>
      </div>

      {/* ── ONE BRIEF ── */}
      {briefMode === "one" && (
        <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          {/* Applies to chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Applies to:</span>
            {products.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200"
              >
                {p.name}
              </span>
            ))}
          </div>

          {/* References */}
          <div>
            <div className="text-xs font-bold text-gray-800 mb-1.5">
              References{" "}
              <span className="font-normal text-gray-400">(up to 5 — screenshots from WhatsApp work)</span>
            </div>
            <RefImageUploader images={globalRefs} onChange={setGlobalRefs} />
          </div>

          {/* Brief textarea */}
          <div>
            <div className="text-xs font-bold text-gray-800 mb-1.5">
              Brief <span className="text-red-500">*</span>{" "}
              <span className="font-normal text-gray-400">(one box for everything the designer and costing need)</span>
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-none text-gray-700 placeholder-gray-400"
              rows={4}
              placeholder="e.g. Football theme, company colours navy and gold, winner name plate, logo on the base"
              value={globalBrief}
              onChange={(ev) => setGlobalBrief(ev.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── EACH PRODUCT BRIEF ── */}
      {briefMode === "each" && (
        <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          {/* Product Tabs */}
          <div className="flex gap-2 flex-wrap">
            {products.map((p, idx) => {
              const hasBrief = !!(productBriefs[p.name]?.brief?.trim());
              const isActive = idx === activeProductIdx;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setActiveProductIdx(idx)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition cursor-pointer ${
                    isActive
                      ? "border-transparent"
                      : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
                  }`}
                  style={isActive ? { backgroundColor: "#635BFF", color: "#ffffff", borderColor: "#635BFF" } : {}}
                >
                  {hasBrief && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  )}
                  {p.name}
                </button>
              );
            })}
          </div>

          {/* Per-product form */}
          {activeProduct && (() => {
            const pb = productBriefs[activeProduct.name] || {};
            const upd = (patch) => updateProductBrief(activeProduct.name, patch);
            const pDesigner = pb.designer !== false;
            const pQuoteOnly = pb.quoteOnly || false;
            const pRDLogo = pb.showRDLogo || false;
            const pRDContent = pb.showRDContent || false;
            const pDesignOptions = pb.designOptions || 3;
            const pOptionsDueIn = pb.optionsDueIn || 24;

            return (
              <div className="space-y-4">
                {/* Product header */}
                <div className="space-y-1 pb-3 border-b border-gray-100">
                  <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                    Product {activeProductIdx + 1} of {products.length}
                  </div>
                  <div className="font-extrabold text-lg text-gray-900">{activeProduct.name}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase">
                      {activeProduct.kind}
                    </span>
                    {activeProduct.items.map((it, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold">
                        {it.size} in · {it.qty} pcs
                      </span>
                    ))}
                  </div>
                </div>

                {/* References */}
                <div>
                  <div className="text-xs font-bold text-gray-800 mb-1.5">
                    References for this product{" "}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </div>
                  <RefImageUploader
                    images={pb.refs || []}
                    onChange={(imgs) => upd({ refs: imgs })}
                  />
                </div>

                {/* Brief textarea */}
                <div>
                  <div className="text-xs font-bold text-gray-800 mb-1.5">
                    Brief for this product <span className="text-red-500">*</span>{" "}
                    <span className="font-normal text-gray-400">(what the designer needs for this design)</span>
                  </div>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-none text-gray-700 placeholder-gray-400"
                    rows={4}
                    placeholder="e.g. Wave shape, navy and gold, winner name plate, logo on the base"
                    value={pb.brief || ""}
                    onChange={(ev) => upd({ brief: ev.target.value })}
                  />
                </div>

                {/* ── Per-product design settings ── */}
                <div className="pt-3 border-t border-gray-100 space-y-4">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">Design settings for this product</div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${pDesigner ? "bg-indigo-50/60 border-indigo-400" : "bg-white border-gray-200"}`}>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Designer needed</div>
                        <div className="text-[11px] text-gray-500">Design team creates options before the quote</div>
                      </div>
                      <ToggleSwitch value={pDesigner} onChange={(v) => upd({ designer: v })} />
                    </div>
                    <div className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${pQuoteOnly ? "bg-amber-50/60 border-amber-400" : "bg-white border-gray-200"}`}>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Quote only</div>
                        <div className="text-[11px] text-gray-500">Client just wants a price for now</div>
                      </div>
                      <ToggleSwitch value={pQuoteOnly} onChange={(v) => upd({ quoteOnly: v })} />
                    </div>
                    <div className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${pRDLogo ? "bg-indigo-50/60 border-indigo-400" : "bg-white border-gray-200"}`}>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Show RD logo</div>
                        <div className="text-[11px] text-gray-500">On the design options we share</div>
                      </div>
                      <ToggleSwitch value={pRDLogo} onChange={(v) => upd({ showRDLogo: v })} />
                    </div>
                    <div className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${pRDContent ? "bg-indigo-50/60 border-indigo-400" : "bg-white border-gray-200"}`}>
                      <div>
                        <div className="font-bold text-xs text-gray-900">Show RD content</div>
                        <div className="text-[11px] text-gray-500">Company profile with the options</div>
                      </div>
                      <ToggleSwitch value={pRDContent} onChange={(v) => upd({ showRDContent: v })} />
                    </div>
                  </div>

                  {/* Copyright content dropdown when Show RD content is ON */}
                  {pRDContent && (
                    <div className="space-y-1.5 fade">
                      <label className="block text-xs font-bold text-gray-800">
                        Copyright Content <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                        value={pb.copyrightContent || copyrightContent || ""}
                        onChange={(ev) => upd({ copyrightContent: ev.target.value })}
                      >
                        <option value="">Select copyright content</option>
                        {COPYRIGHT_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.value}
                          </option>
                        ))}
                      </select>
                      {!(pb.copyrightContent || copyrightContent) && (
                        <div className="text-red-500 text-[10px] font-semibold">
                          Please select copyright content
                        </div>
                      )}
                    </div>
                  )}

                  {/* How many design options */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-800">How many design options?</div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => upd({ designOptions: n })}
                          className="w-9 h-9 rounded-full border-2 text-xs font-extrabold transition cursor-pointer"
                          style={pDesignOptions === n
                            ? { borderColor: "#635BFF", color: "#635BFF", backgroundColor: "#EEF2FF" }
                            : { borderColor: "#E5E7EB", color: "#6B7280", backgroundColor: "#fff" }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options due in */}
                  {pDesigner && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-gray-800">Options due in</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[
                          { v: 4, label: "4 hours", sub: "rush" },
                          { v: 24, label: "24 hours", sub: null },
                          { v: 48, label: "48 hours", sub: null },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => upd({ optionsDueIn: opt.v })}
                            className="px-4 py-2 rounded-full border-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            style={pOptionsDueIn === opt.v
                              ? { borderColor: "#635BFF", color: "#635BFF", backgroundColor: "#EEF2FF" }
                              : { borderColor: "#E5E7EB", color: "#374151", backgroundColor: "#fff" }}
                          >
                            <span>{opt.label}</span>
                            {opt.sub && <span className="text-[10px] opacity-60 font-normal">{opt.sub}</span>}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Design team load today: 6 briefs in queue. 24 hours is realistic.
                      </p>
                    </div>
                  )}
                </div>

                {/* Product Navigation Buttons */}
                <div className="flex items-center justify-between pt-2">
                  {/* Previous Product Button */}
                  {activeProductIdx > 0 ? (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 border border-gray-300 bg-white hover:bg-gray-50 transition cursor-pointer flex items-center gap-1.5"
                      onClick={() => setActiveProductIdx(activeProductIdx - 1)}
                    >
                      <span>←</span>
                      <span>Previous Product: {products[activeProductIdx - 1].name}</span>
                    </button>
                  ) : (
                    <div /> /* Empty div to push the Next button to the right if there's no Previous button */
                  )}

                  {/* Next Product Button */}
                  {activeProductIdx < products.length - 1 && (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1.5"
                      onClick={() => setActiveProductIdx(activeProductIdx + 1)}
                    >
                      <span>Next Product: {products[activeProductIdx + 1].name}</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Global Design Settings (only for "one brief" mode) ── */}
      {briefMode === "one" && (
        <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 transition ${designer ? "bg-indigo-50/60 border-indigo-400" : "bg-white border-gray-200"}`}>
              <div>
                <div className="font-bold text-xs text-gray-900">Designer needed</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Design team creates options before the quote</div>
              </div>
              <ToggleSwitch value={designer} onChange={setDesigner} />
            </div>
            <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 transition ${quoteOnly ? "bg-amber-50/60 border-amber-400" : "bg-white border-gray-200"}`}>
              <div>
                <div className="font-bold text-xs text-gray-900">Quote only</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Client just wants a price for now</div>
              </div>
              <ToggleSwitch value={quoteOnly} onChange={setQuoteOnly} />
            </div>
            <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 transition ${showRDLogo ? "bg-indigo-50/60 border-indigo-400" : "bg-white border-gray-200"}`}>
              <div>
                <div className="font-bold text-xs text-gray-900">Show RD logo</div>
                <div className="text-[11px] text-gray-500 mt-0.5">On the design options we share</div>
              </div>
              <ToggleSwitch value={showRDLogo} onChange={setShowRDLogo} />
            </div>
            <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 transition ${showRDContent ? "bg-indigo-50/60 border-indigo-400" : "bg-white border-gray-200"}`}>
              <div>
                <div className="font-bold text-xs text-gray-900">Show RD content</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Company profile with the options</div>
              </div>
              <ToggleSwitch value={showRDContent} onChange={setShowRDContent} />
            </div>
          </div>

          {/* Copyright content dropdown when Show RD content is ON */}
          {showRDContent && (
            <div className="pt-2 border-t border-gray-100 space-y-1.5 fade">
              <label className="block text-xs font-bold text-gray-800">
                Copyright Content <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                value={copyrightContent}
                onChange={(ev) => setCopyrightContent(ev.target.value)}
              >
                <option value="">Select copyright content</option>
                {COPYRIGHT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.value}
                  </option>
                ))}
              </select>
              {!copyrightContent && (
                <div className="text-red-500 text-[10px] font-semibold">
                  Please select copyright content
                </div>
              )}
            </div>
          )}

          {/* How many design options */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="text-xs font-bold text-gray-800">How many design options?</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDesignOptions(n)}
                  className="w-9 h-9 rounded-full border-2 text-xs font-extrabold transition cursor-pointer"
                  style={designOptions === n
                    ? { borderColor: "#635BFF", color: "#635BFF", backgroundColor: "#EEF2FF" }
                    : { borderColor: "#E5E7EB", color: "#6B7280", backgroundColor: "#fff" }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-indigo-600 font-medium">
              Per-size option counts entered on the products are kept; this is the default for anything not set.
            </p>
          </div>

          {/* Options due in */}
          {designer && (
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="text-xs font-bold text-gray-800">Options due in</div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { v: 4, label: "4 hours", sub: "rush" },
                  { v: 24, label: "24 hours", sub: null },
                  { v: 48, label: "48 hours", sub: null },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setOptionsDueIn(opt.v)}
                    className="px-4 py-2 rounded-full border-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    style={optionsDueIn === opt.v
                      ? { borderColor: "#635BFF", color: "#635BFF", backgroundColor: "#EEF2FF" }
                      : { borderColor: "#E5E7EB", color: "#374151", backgroundColor: "#fff" }}
                  >
                    <span>{opt.label}</span>
                    {opt.sub && <span className="text-[10px] opacity-60 font-normal">{opt.sub}</span>}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                Design team load today: 6 briefs in queue. 24 hours is realistic.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          onClick={() => set({ step: 1 })}
        >
          <span>←</span>
          <span>Back</span>
        </button>

        <button
          type="button"
          disabled={!isValid}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2 ${
            isValid
              ? "hover:opacity-95"
              : "opacity-40 cursor-not-allowed"
          }`}
          style={isValid ? { backgroundColor: "#635BFF", color: "#ffffff" } : { backgroundColor: "#635BFF", color: "#ffffff" }}
          onClick={() => {
            if (!isValid) return;
            saveAll();
            next();
          }}
        >
          <span>Next: log it</span>
        </button>

        {!briefMode && (
          <span className="text-[11px] text-gray-400">
            Choose one brief for all, or a brief for each product.
          </span>
        )}
      </div>
    </div>
  );
};

export default BriefStep;
