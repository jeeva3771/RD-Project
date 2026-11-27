import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchActiveProductConfigs } from "../../../../../reducer/masters/enquiryFlow/productConfigMasterReducer";

const ProductTypeSelector = ({
  selectedType = null,
  currentDesignSpec = {},
  currentProductLabel = "product",
  onSelectType,
  onApplyPreset
}) => {
  const dispatch = useDispatch();
  const { activeItems = [], loading: configsLoading, error: configsError } = useSelector(
    (state) => state.productConfigMaster || {}
  );
  const [hasDispatched, setHasDispatched] = useState(false);

  useEffect(() => {
    if (!activeItems || activeItems.length === 0) {
      dispatch(fetchActiveProductConfigs());
      setHasDispatched(true);
    }
  }, [dispatch, activeItems]);

  // Derive dynamic product tiles strictly from active items in Product Engine table
  const tiles = useMemo(() => {
    if (activeItems && activeItems.length > 0) {
      return [...activeItems]
        .filter((item) => item.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
        .map((p) => ({
          id: p.product_id,
          icon: p.icon || "📦",
          label: p.name || p.label || p.product_id,
          sub: p.sub_label || p.sub || "",
          hasSubs: Boolean(p.has_sub_types && p.sub_types && p.sub_types.length > 0),
          isNew: Boolean(p.is_new),
          presets: p.presets || [],
          raw: p
        }));
    }
    return [];
  }, [activeItems]);

  // Derive dynamic sub-tiles strictly from active items in Product Engine table
  const subTiles = useMemo(() => {
    if (activeItems && activeItems.length > 0) {
      const map = {};
      activeItems.forEach((p) => {
        if (p.has_sub_types && Array.isArray(p.sub_types) && p.sub_types.length > 0) {
          const activeSubs = p.sub_types
            .filter((st) => st.is_active !== false)
            .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
            .map((st) => ({
              subId: st.sub_id,
              icon: st.icon || p.icon || "📦",
              label: st.label,
              sub: st.sub_text || st.sub_desc || st.sub || "",
              specPatch: st.spec_patch || st.specPatch || {}
            }));
          if (activeSubs.length > 0) {
            map[p.product_id] = activeSubs;
          }
        }
      });
      return map;
    }
    return {};
  }, [activeItems]);

  const [openFamily, setOpenFamily] = useState(() => {
    if (selectedType && subTiles[selectedType]) return selectedType;
    return null;
  });

  const [pendingSwitch, setPendingSwitch] = useState(null);

  useEffect(() => {
    if (selectedType && subTiles[selectedType]?.length > 0) {
      setOpenFamily(selectedType);
    }
  }, [selectedType, subTiles]);

  const handleTileClick = (tile) => {
    if (tile.hasSubs) {
      setOpenFamily(tile.id);
      if (selectedType && selectedType !== tile.id) {
        const familySubs = subTiles[tile.id] || [];
        const defaultSub = familySubs[0];
        if (defaultSub) {
          setPendingSwitch({
            id: tile.id,
            subId: defaultSub.subId,
            label: defaultSub.label,
            specPatch: defaultSub.specPatch
          });
        }
      }
      return;
    }

    setOpenFamily(null);

    if (selectedType === tile.id && !pendingSwitch) {
      return;
    }

    if (!selectedType) {
      if (onSelectType) {
        onSelectType(tile.id, tile.label, {});
      }
      return;
    }

    setPendingSwitch({
      id: tile.id,
      label: tile.label,
      specPatch: {}
    });
  };

  const getActiveSubId = (familyId) => {
    return (
      currentDesignSpec.subType ||
      currentDesignSpec[`${familyId}Type`] ||
      (familyId === "medal" ? currentDesignSpec.medalType : undefined) ||
      (familyId === "badge" ? currentDesignSpec.badgeType : undefined) ||
      subTiles[familyId]?.[0]?.subId
    );
  };

  const handleSubTileClick = (familyId, sub) => {
    const activeSubId = getActiveSubId(familyId);
    const isCurrentActiveSub = selectedType === familyId && activeSubId === sub.subId;

    if (isCurrentActiveSub && !pendingSwitch) {
      return;
    }

    const patch = {
      subType: sub.subId,
      [`${familyId}Type`]: sub.subId,
      ...(sub.specPatch || {})
    };

    if (!selectedType) {
      if (onSelectType) {
        onSelectType(familyId, sub.label, patch);
      }
      return;
    }

    // Always show confirmation banner when switching product OR switching sub-type within the same product
    setPendingSwitch({
      id: familyId,
      subId: sub.subId,
      label: sub.label,
      specPatch: patch
    });
  };

  const handleConfirmSwitch = () => {
    if (!pendingSwitch) return;
    if (onSelectType) {
      onSelectType(pendingSwitch.id, pendingSwitch.label, pendingSwitch.specPatch);
    }
    setPendingSwitch(null);
  };

  const handleCancelSwitch = () => {
    setPendingSwitch(null);
    if (openFamily && openFamily !== selectedType) {
      setOpenFamily(selectedType && subTiles[selectedType] ? selectedType : null);
    }
  };

  const isLoading = (configsLoading || !hasDispatched) && activeItems.length === 0;
  const isError = !configsLoading && hasDispatched && tiles.length === 0;

  return (
    <div className="space-y-3.5">
      {/* 1. Loading Skeleton State */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl border border-gray-200 bg-white animate-pulse flex flex-col justify-between min-h-[92px]"
            >
              <div className="w-8 h-8 rounded-xl bg-gray-100 mb-2"></div>
              <div className="space-y-1.5">
                <div className="h-3.5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-2.5 bg-gray-100 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Error / No Data State */}
      {isError && (
        <div className="p-6 bg-red-50/70 border border-red-200 rounded-2xl text-center space-y-3 animate-fadeIn">
          <div className="w-10 h-10 mx-auto rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">
            ⚠️
          </div>
          <div>
            <h4 className="text-xs font-bold text-red-900">Could not get product data</h4>
            <p className="text-[11px] text-red-600 mt-0.5">
              {configsError || "API la irunthu product configs load aagala. Please check backend or retry."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch(fetchActiveProductConfigs())}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>🔄</span> Retry
          </button>
        </div>
      )}

      {/* 3. Product Tiles in 4-column Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {tiles.map((t) => {
            const isCurrent = selectedType === t.id;
            const isPending = pendingSwitch?.id === t.id && !pendingSwitch?.subId;
            const isOpenWithSubs = openFamily === t.id && t.hasSubs;

            let borderStyle = "border-gray-200 bg-white hover:border-[#818CF8] hover:-translate-y-0.5";
            if (isCurrent) {
              borderStyle = "border-[#4B3BF5] bg-[#FAF9FF] shadow-xs";
            } else if (isPending) {
              borderStyle = "border-2 border-[#4B3BF5] bg-white ring-2 ring-[#4B3BF5]/15";
            } else if (isOpenWithSubs) {
              borderStyle = "border-2 border-dashed border-[#4B3BF5] bg-white";
            }

            return (
              <button
                key={t.id}
                type="button"
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer relative min-h-[92px] ${borderStyle}`}
                onClick={() => handleTileClick(t)}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-2xl leading-none">{t.icon}</span>
                  {isCurrent && (
                    <span className="w-5 h-5 rounded-full bg-[#4B3BF5] text-white flex items-center justify-center text-xs font-bold">
                      ✓
                    </span>
                  )}
                  {t.isNew && !isCurrent && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFF5D1] text-[#6E5100]">
                      NEW
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-gray-900 truncate">{t.label}</div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                    {t.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-tiles Drawer for Medal, Badge, or any product with sub-types */}
      {!isLoading && !isError && openFamily && subTiles[openFamily] && subTiles[openFamily].length > 0 && (
        <div className="p-3.5 bg-white border border-gray-200 rounded-2xl space-y-2.5 animate-fadeIn">
          <span className="text-xs font-semibold text-gray-700 block">
            Which {tiles.find((t) => t.id === openFamily)?.label?.toLowerCase() || openFamily}?
          </span>
          <div
            className={`grid gap-3 text-xs ${
              subTiles[openFamily].length <= 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-3"
            }`}
          >
            {subTiles[openFamily].map((sub) => {
              const activeSubId = getActiveSubId(openFamily);
              const isCurrentSub = selectedType === openFamily && activeSubId === sub.subId;

              const isPendingSub =
                pendingSwitch?.id === openFamily && pendingSwitch?.subId === sub.subId;

              const isSelected = isPendingSub || (isCurrentSub && !pendingSwitch);

              return (
                <button
                  key={sub.subId}
                  type="button"
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    isSelected
                      ? "border-2 border-[#4B3BF5] bg-[#FAF9FF] shadow-2xs"
                      : "border-gray-200 bg-white hover:border-[#818CF8]"
                  }`}
                  onClick={() => handleSubTileClick(openFamily, sub)}
                >
                  <span className="text-2xl shrink-0">{sub.icon}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-xs truncate">{sub.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                      {sub.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Product Switch Confirmation Warning Banner (Matching v37 Nudge warn) */}
      {pendingSwitch && (
        <div className="p-4 bg-[#FEECEB] border border-[#FCA5A5]/60 rounded-2xl flex items-start justify-between gap-3 text-xs text-[#7F1D1D] animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#991B1B] text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
              !
            </span>
            <div>
              <div className="leading-snug font-medium">
                Switching to <b className="font-bold">{pendingSwitch.label}</b> clears the {currentProductLabel.toLowerCase()} details on this product.
              </div>
              <button
                type="button"
                onClick={handleCancelSwitch}
                className="mt-2.5 px-3.5 py-1.5 bg-white text-gray-800 border border-gray-200 rounded-full font-semibold hover:bg-gray-50 shadow-2xs cursor-pointer text-xs"
              >
                Keep {currentProductLabel.toLowerCase()}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConfirmSwitch}
            className="px-3.5 py-1.5 bg-white border border-gray-300 rounded-full font-bold text-gray-800 hover:bg-gray-50 shadow-2xs cursor-pointer shrink-0 text-xs"
          >
            Clear and switch
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductTypeSelector;
