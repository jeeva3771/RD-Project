import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { TYPE_CATEGORIES } from "../../../utils/constants";
import ProductSpecificSizeCard from "./ProductSpecificSizeCard"; // v32 synced
import ProductDesignSpecs from "./ProductDesignSpecs";
import ProductTypeSelector from "./ProductTypeSelector";

import { generateSpecLine } from "../../../utils/specLineGenerator";
import { calculateDynamicEstimate } from "../../../utils/trophyMasterService";
import { fetchAllActiveEnquiryMasters } from "../../../../../reducer/enquiryFlowMastersReducer";
import { fetchActiveProductConfigs } from "../../../../../reducer/masters/enquiryFlow/productConfigMasterReducer";
import { fetchActivePlatingFinishes } from "../../../../../reducer/masters/enquiryFlow/platingFinishMasterReducer";

import {
  CustomTrophyDesignSection,
  ProductRouteAndPresets,
  PastOrdersCarousel,
  GroupValidationFooter,
  mapTypeNameToProductType,
  applyProductTypeDefaults,
  computeGroupValidation,
} from "./custom-trophy";

/**
 * CustomTrophyForm Component
 * Refactored modular coordinator for configuring a product in AskStep.
 *  - Section 1: "Which product?" (ProductTypeSelector)
 *  - Section 2: "What's the design?" (CustomTrophyDesignSection / ProductDesignSpecs + Route & Presets)
 *  - Section 3: "Sizes, quantities and approximate rates" (ProductSpecificSizeCard)
 *  - Bottom action footer: dynamic validation & product submission
 */
const CustomTrophyForm = ({
  gIdx,
  group,
  groupChar,
  trophyGroups,
  setTrophyGroups,
  syncState,
  handleSaveAll,
  isSavingProduct = false,
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
  handleDiscardGroup,
}) => {
  const dispatch = useDispatch();

  // Dynamic masters from Redux / MongoDB
  const {
    materials = [],
    elements = [],
    constructions = [],
    typeCategoryData,
  } = useSelector((state) => state.enquiryFlowMasters || {});

  const { activeItems: activeProductConfigs = [] } = useSelector(
    (state) => state.productConfigMaster || {}
  );

  useEffect(() => {
    dispatch(fetchAllActiveEnquiryMasters());
    dispatch(fetchActiveProductConfigs());
    dispatch(fetchActivePlatingFinishes());
  }, [dispatch]);

  const activeCategoryData =
    typeCategoryData && Object.keys(typeCategoryData).length > 0
      ? typeCategoryData
      : TYPE_CATEGORIES;

  const currentPType =
    group.productType !== undefined
      ? group.productType
      : mapTypeNameToProductType(group.type);

  const isTrophyProduct =
    currentPType === "trophy" || currentPType === "memento";

  const activeProdConfig = activeProductConfigs.find(
    (p) => p.product_id === currentPType
  );

  // Dynamic validation based on ProductConfigMaster design_fields and size_config
  const groupValidation = computeGroupValidation(
    group,
    activeProductConfigs,
    currentPType,
    isTrophyProduct
  );

  const handleSelectProductType = (newType, labelText, specPatch) => {
    const updated = [...trophyGroups];
    const grp = updated[gIdx];
    const targetProdConfig = activeProductConfigs.find(
      (p) => p.product_id === newType
    );
    const ptObj = targetProdConfig;

    applyProductTypeDefaults(
      grp,
      newType,
      labelText,
      specPatch,
      targetProdConfig,
      ptObj,
      materials,
      elements
    );

    setTrophyGroups(updated);
    syncState(updated);
  };

  const handleApplyPreset = (preset) => {
    const updated = [...trophyGroups];
    const grp = updated[gIdx];
    if (preset.size && grp.items?.[0]) {
      grp.items[0].size = preset.size;
    }
    if (preset.budget && grp.items?.[0]) {
      grp.items[0].budget = preset.budget;
    }
    if (preset.mat) {
      grp.mat = preset.mat;
      grp.mats = [preset.mat];
    }
    if (!grp.designSpec) grp.designSpec = {};
    const mergedSpec = {
      ...grp.designSpec,
      ...preset,
      ...(preset.spec || {}),
    };
    grp.designSpec = mergedSpec;

    if (Array.isArray(grp.items)) {
      grp.items = grp.items.map((it) => {
        const nextSpec = {
          ...(it.spec || {}),
          ...mergedSpec,
        };
        return {
          ...it,
          spec: nextSpec,
          specLine: generateSpecLine(currentPType, nextSpec, grp),
        };
      });
    }
    setTrophyGroups(updated);
    syncState(updated);
  };

  const handleUpdateItem = (iIdx, updatedItem) => {
    const updated = [...trophyGroups];
    const curGroup = updated[gIdx] || {};
    const newItems = [...(curGroup.items || [])];
    newItems[iIdx] = updatedItem;
    const itemDesignOptions =
      updatedItem.designOptions ||
      updatedItem.designOptionsCount ||
      updatedItem.spec?.designOptions;
    updated[gIdx] = {
      ...curGroup,
      ...(itemDesignOptions ? { designOptions: Math.min(5, Math.max(1, Number(itemDesignOptions) || 2)) } : {}),
      items: newItems
    };
    setTrophyGroups(updated);
    if (typeof syncState === "function") {
      syncState(updated);
    }
  };

  const handleDuplicateSize = (iIdx) => {
    const currentItem = group.items[iIdx];
    const newSize = (parseFloat(currentItem.size) || 8) + 2;
    const duplicatedItem = {
      ...currentItem,
      size: newSize,
      designOptions: currentItem.designOptions || currentItem.spec?.designOptions || activeProdConfig?.size_config?.default_design_options || 2,
      designOptionsCount: currentItem.designOptionsCount || currentItem.designOptions || activeProdConfig?.size_config?.default_design_options || 2,
      budget: currentItem.budget || Number(activeProdConfig?.size_config?.default_budget || 0),
      spec: {
        ...(currentItem.spec || {}),
        designOptions: currentItem.spec?.designOptions || currentItem.designOptions || activeProdConfig?.size_config?.default_design_options || 2,
      },
    };
    const updated = [...trophyGroups];
    updated[gIdx].items.splice(iIdx + 1, 0, duplicatedItem);
    setTrophyGroups(updated);
    syncState(updated);
  };

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

  const updateTrophyDesign = (field, value) => {
    const updated = [...trophyGroups];
    const grp = updated[gIdx];
    if (!grp.designSpec) grp.designSpec = {};
    grp.designSpec[field] = value;
    grp[field] = value;

    if (Array.isArray(grp.items)) {
      grp.items.forEach((it) => {
        if (!it.spec) it.spec = {};
        it.spec[field] = value;
      });
    }

    setTrophyGroups(updated);
    syncState(updated);
  };

  const handleSelectCustomType = (tp, isOtherBtn) => {
    const updated = [...trophyGroups];
    if (isOtherBtn) {
      updated[gIdx].isCustomType = true;
      updated[gIdx].showCustomTypeInput = true;
    } else {
      updated[gIdx].type = tp;
      updated[gIdx].isCustomType = false;
    }
    setTrophyGroups(updated);
    syncState(updated);
  };

  const displayPastOrders = Array.isArray(clientPastOrders)
    ? clientPastOrders
    : [];

  return (
    <div className="panel p-5 bg-white border border-gray-200 rounded-3xl shadow-sm space-y-6">
      {/* ── 1. Which product? ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-[#4B3BF5] text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
            1
          </span>
          <h2 className="font-extrabold text-base md:text-lg text-gray-900 tracking-tight">
            Which product?
          </h2>
        </div>
        <ProductTypeSelector
          selectedType={currentPType}
          currentDesignSpec={group.designSpec || {}}
          currentProductLabel={
            currentPType === "trophy"
              ? "custom trophy"
              : currentPType === "medal"
              ? group.designSpec?.medalType === "zinc_cast" ||
                group.designSpec?.subType === "zinc_cast"
                ? "zinc cast medal"
                : "MS punched medal"
              : currentPType === "badge"
              ? group.designSpec?.badgeType === "name" ||
                group.designSpec?.subType === "name"
                ? "name badge"
                : group.designSpec?.badgeType === "emblem" ||
                  group.designSpec?.subType === "emblem"
                ? "emblem badge"
                : "button badge"
              : activeProdConfig?.name ||
                activeProdConfig?.label ||
                "product"
          }
          onSelectType={handleSelectProductType}
          onApplyPreset={handleApplyPreset}
        />
      </div>

      {/* ── 2. What's the design? and 3. Sizes & Quantities ── */}
      {currentPType ? (
        <>
          {/* Section 2 Header */}
          <div className="space-y-4 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-[#4B3BF5] text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                2
              </span>
              <h2 className="font-extrabold text-lg text-gray-900 tracking-tight">
                What’s the design?
              </h2>
            </div>

            {/* Dynamic Route Capabilities Strip & Quick Presets */}
            <ProductRouteAndPresets
              currentPType={currentPType}
              group={group}
              activeProdConfig={activeProdConfig}
              onApplyPreset={handleApplyPreset}
            />

            {/* Past Reorders Scrollable Carousel */}
            <PastOrdersCarousel
              pastOrders={displayPastOrders}
              selectedTheme={group.theme}
              onSelectReorder={selectPastReorder}
            />

            {/* Design Name Text Input */}
            <div>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-sm font-semibold text-gray-900 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition placeholder-gray-400"
                value={group.theme || ""}
                placeholder={
                  currentPType === "lapel_pin"
                    ? "Design name, e.g. Company Logo Pin"
                    : currentPType === "frame"
                    ? "Design name, e.g. Long Service Certificate"
                    : currentPType === "plaque"
                    ? "Design name, e.g. Star Performer Plaque 2026"
                    : currentPType === "medal"
                    ? group.designSpec?.medalType === "zinc_cast"
                      ? "Design name, e.g. Marathon Finisher Medal"
                      : "Design name, e.g. Sports Day Medal"
                    : currentPType === "badge"
                    ? group.designSpec?.badgeType === "emblem"
                      ? "Design name, e.g. Security Emblem"
                      : group.designSpec?.badgeType === "button"
                      ? "Design name, e.g. Campaign Button"
                      : "Design name, e.g. Julicious Name Badge"
                    : currentPType === "cufflinks"
                    ? "Design name, e.g. Logo Cufflinks"
                    : currentPType === "tie_pin"
                    ? "Design name, e.g. Board Tie Bar"
                    : currentPType === "fridge_magnet"
                    ? "Design name, e.g. Annual Day Magnet"
                    : currentPType === "flagstand"
                    ? "Design name, e.g. Board Room Flag Stand"
                    : currentPType === "coaster"
                    ? "Design name, e.g. Logo Coaster Set"
                    : currentPType === "scroll"
                    ? "Design name, e.g. Felicitation Scroll 2026"
                    : "Design name or theme, e.g. Champions Cup 2026"
                }
                onChange={(ev) => updateGroupTheme(ev.target.value)}
              />
            </div>

            {/* Product-Specific Design Specs - For non-trophy products */}
            {!isTrophyProduct && (
              <ProductDesignSpecs
                group={group}
                gIdx={gIdx}
                productType={currentPType}
                trophyGroups={trophyGroups}
                setTrophyGroups={setTrophyGroups}
                syncState={syncState}
                toggleElementInGroup={toggleElementInGroup}
                toggleMaterialInGroup={toggleMaterialInGroup}
              />
            )}

            {/* Custom Trophy Structured Section */}
            {isTrophyProduct && (
              <CustomTrophyDesignSection
                group={group}
                gIdx={gIdx}
                typeCatKey={typeCatKey}
                setTypeCatKey={setTypeCatKey}
                typeQuery={typeQuery}
                setTypeQuery={setTypeQuery}
                activeCategoryData={activeCategoryData}
                constructions={constructions}
                elements={elements}
                materials={materials}
                updateTrophyDesign={updateTrophyDesign}
                toggleElementInGroup={toggleElementInGroup}
                toggleMaterialInGroup={toggleMaterialInGroup}
                onSelectType={handleSelectCustomType}
              />
            )}
          </div>

          {/* ── 3. Sizes, quantities and approximate rates ── */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#4B3BF5] text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  3
                </span>
                <h2 className="font-extrabold text-base md:text-lg text-gray-900 tracking-tight">
                  Sizes, quantities and approximate rates
                </h2>
              </div>
              <p className="text-xs text-gray-500 font-normal pl-9.5">
                One card per size. For each size, add the quantities to price, the rate the client expects and how many design options to show.
              </p>
            </div>

            <div className="space-y-4">
              {group.items.map((item, iIdx) => (
                <ProductSpecificSizeCard
                  key={iIdx}
                  gIdx={gIdx}
                  iIdx={iIdx}
                  item={item}
                  group={group}
                  productType={currentPType}
                  materials={materials}
                  elements={elements}
                  onUpdateItem={(updatedItem) =>
                    handleUpdateItem(iIdx, updatedItem)
                  }
                  onRemoveSize={() => removeSizeFromGroup(gIdx, iIdx)}
                  onDuplicateSize={() => handleDuplicateSize(iIdx)}
                  canRemove={group.items.length > 1}
                />
              ))}
            </div>

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

          {/* ── Bottom Action Footer ── */}
          <GroupValidationFooter
            validation={groupValidation}
            isSaving={isSavingProduct}
            onDone={() => {
              if (!groupValidation.isValid || isSavingProduct) return;
              handleSaveAll();
              setActiveGroupIndex(
                gIdx + 1 < trophyGroups.length ? gIdx + 1 : null
              );
            }}
            onDiscard={() => handleDiscardGroup(gIdx)}
          />
        </>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-3">
          <span className="text-xs text-gray-400">
            Please choose a product above to configure its design and size
            requirements.
          </span>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-red-600 font-medium transition cursor-pointer"
            onClick={() => handleDiscardGroup(gIdx)}
          >
            Discard this product
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomTrophyForm;
