import React from "react";
import { PRODUCT_ROUTES } from "./productTypeDefaults";

/**
 * ProductRouteAndPresets
 * Renders the route capabilities strip (In-house / Outsourced, MOQ, Sample Time, Die charge notes)
 * and Quick Presets pills for non-trophy products.
 * Prioritizes dynamic configuration from MongoDB activeProdConfig.
 */
const ProductRouteAndPresets = ({
  currentPType,
  group,
  activeProdConfig,
  onApplyPreset,
}) => {
  if (!currentPType || currentPType === "trophy" || currentPType === "memento") {
    return null;
  }

  const rInfo = activeProdConfig?.route_config?.route
    ? {
        route: activeProdConfig.route_config.route,
        moq: activeProdConfig.route_config.moq || "MOQ 1 pcs",
        sampleTime:
          activeProdConfig.route_config.sample_time ||
          "Sample in 2 working days",
        note: activeProdConfig.route_config.note || "",
      }
    : PRODUCT_ROUTES[currentPType] || PRODUCT_ROUTES.trophy;

  const isOutsourced = (rInfo.route || "").toLowerCase().includes("outsourced");
  const presets = activeProdConfig?.presets || [];

  return (
    <div className="space-y-3">
      {/* ── Route Capabilities Strip ── */}
      <div className="p-3.5 bg-[#FAF9FF] border border-[#EBE7FF] rounded-2xl space-y-2">
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span
            className={`px-3 py-1 bg-white border rounded-full flex items-center gap-1.5 shadow-2xs ${
              isOutsourced
                ? "border-amber-200 text-amber-900"
                : "border-[#E0DCFE] text-[#372BA6]"
            }`}
          >
            <span>
              {currentPType === "cufflinks" ? "🏭" : isOutsourced ? "🤝" : "🏭"}
            </span>{" "}
            {rInfo.route}
          </span>
          <span className="px-3 py-1 bg-white border border-[#E0DCFE] text-[#372BA6] rounded-full shadow-2xs">
            {rInfo.moq}
          </span>
          <span className="px-3 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-full flex items-center gap-1.5 shadow-2xs">
            <span>🧪</span> {rInfo.sampleTime}
          </span>
        </div>

        {currentPType === "medal" && (
          <div>
            <span className="px-3 py-1 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
              Die-charge: running applies exp/1st yr
            </span>
          </div>
        )}

        {currentPType === "cufflinks" && (
          <div>
            <span className="px-3 py-1 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
              Die charge · Costing quotes · kept 1 year
            </span>
          </div>
        )}

        {rInfo.note && (
          <div className="text-[11px] text-gray-500 font-normal leading-relaxed">
            {rInfo.note}
          </div>
        )}
      </div>

      {/* ── Quick Presets for non-trophy products ── */}
      {currentPType !== "plaque" &&
        currentPType !== "medal" &&
        presets.length > 0 &&
        ((currentPType === "badge" &&
          (group.designSpec?.badgeType || "name") === "name") ||
        currentPType === "frame" ||
        currentPType === "lapel_pin" ||
        currentPType === "cufflinks" ||
        currentPType === "tie_pin" ||
        currentPType === "fridge_magnet" ||
        currentPType === "flagstand" ||
        currentPType === "coaster" ||
        currentPType === "scroll" ? (
          <div className="p-3.5 bg-white border-2 border-dashed border-[#5A48EF] rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
              <span className="text-amber-500 text-sm">⚡</span>
              <span>
                {currentPType === "badge"
                  ? "3 favourite presets for a fast start:"
                  : "Quick presets · one tap fills the card"}
              </span>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {presets.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className="px-5 py-2 bg-white hover:bg-[#F4F1FF] border-2 border-[#4B3BF5] text-[#4B3BF5] rounded-full text-xs font-bold transition cursor-pointer shadow-2xs"
                  onClick={() => onApplyPreset(preset)}
                >
                  {preset.label || preset.name || `Preset ${pIdx + 1}`}
                </button>
              ))}
            </div>
          </div>
        ) : currentPType !== "badge" ? (
          <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <span>⚡</span>
                <span>
                  Quick Presets for {activeProdConfig?.name || activeProdConfig?.label || "this product"}:
                </span>
              </span>
              <span className="text-amber-700/80 text-[10px]">
                Click to apply standard configuration
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {presets.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className="px-3 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                  onClick={() => onApplyPreset(preset)}
                >
                  + {preset.label || preset.name || `Preset ${pIdx + 1}`}
                </button>
              ))}
            </div>
          </div>
        ) : null)}
    </div>
  );
};

export default ProductRouteAndPresets;

