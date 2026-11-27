import React from "react";
import RefImageUploader from "./RefImageUploader";
import DesignSettingsCard from "./DesignSettingsCard";
import ProductAssetsSection from "./ProductAssetsSection";

/**
 * Form for "Brief for each product" mode.
 * Includes product tabs, active product brief editor, reference images,
 * per-product assets (Logo, Signatures with Name & Designation, Additional Files),
 * per-product design settings, and previous/next navigation buttons.
 */
const PerProductBriefForm = ({
  products = [],
  activeProductIdx = 0,
  setActiveProductIdx = () => { },
  productBriefs = {},
  updateProductBrief = () => { },
  applyDesignerToAllProducts = () => { },
  applyLogosToAllProducts = null,
  applySignaturesToAllProducts = null,
  applyFilesToAllProducts = null,
  applyRequirementsToAllProducts = null,
  designersList = [],
  globalDesignSettings = {},
  onGlobalUpdate = () => { },
  clientId = "",
  clientName = "",
  enquiryNo = "",
  onImmediateSave = null,
  linksDuration = 24,
  onLinksDurationChange = () => { },
}) => {
  const getProductBrief = (p) => {
    if (!p) return {};
    if (productBriefs[p.name]) return productBriefs[p.name];
    if (p.theme && productBriefs[p.theme]) return productBriefs[p.theme];
    const foundKey = Object.keys(productBriefs).find(
      (k) => k.toLowerCase() === (p.name || p.theme || "").toLowerCase()
    );
    if (foundKey && productBriefs[foundKey]) return productBriefs[foundKey];
    return {};
  };

  const activeProduct = products[activeProductIdx] || products[0];
  const pb = getProductBrief(activeProduct);
  const activeBrief = {
    brief: pb?.brief || "",
    refs: pb?.refs || [],
  };
  const upd = (patch, immediate = false) => {
    updateProductBrief(activeProduct?.name, patch, immediate);
  };

  // Per-product setting fallbacks from global settings
  const pDesigner =
    pb.designer !== undefined
      ? pb.designer
      : globalDesignSettings.designer !== false;
  const pQuoteOnly =
    pb.quoteOnly !== undefined
      ? pb.quoteOnly
      : globalDesignSettings.quoteOnly || false;
  // Common settings across all products: RD logo, RD content, Copyright text
  const pRDLogo =
    globalDesignSettings.showRDLogo !== undefined
      ? globalDesignSettings.showRDLogo
      : (pb.showRDLogo !== undefined ? pb.showRDLogo : true);
  const pRDContent =
    globalDesignSettings.showRDContent !== undefined
      ? globalDesignSettings.showRDContent
      : (pb.showRDContent || false);
  const pCopyrightContent =
    globalDesignSettings.copyrightContent || pb.copyrightContent || "";
  const pAssignedDesigner =
    pb.assignedDesigner || globalDesignSettings.assignedDesigner || "";
  const pAssignedDesignerName =
    pb.designerName || globalDesignSettings.assignedDesignerName || "";
  const pDesignOptions = Math.min(
    5,
    Math.max(
      1,
      Number(
        pb.designOptions !== undefined
          ? pb.designOptions
          : activeProduct?.designOptions ||
          activeProduct?.items?.[0]?.spec?.designOptions ||
          activeProduct?.items?.[0]?.designOptions ||
          activeProduct?.items?.[0]?.designOptionsCount ||
          globalDesignSettings.designOptions ||
          2
      )
    )
  );
  const pOptionsDueIn =
    pb.optionsDueIn !== undefined
      ? pb.optionsDueIn
      : globalDesignSettings.optionsDueIn || 24;

  const pLogoMandatory = Boolean(
    pb.is_logo_mandatory !== undefined
      ? pb.is_logo_mandatory
      : pb.isLogoMandatory !== undefined
      ? pb.isLogoMandatory
      : globalDesignSettings.is_logo_mandatory ?? globalDesignSettings.isLogoMandatory ?? false
  );
  const pSignatureMandatory = Boolean(
    pb.is_signature_mandatory !== undefined
      ? pb.is_signature_mandatory
      : pb.isSignatureMandatory !== undefined
      ? pb.isSignatureMandatory
      : globalDesignSettings.is_signature_mandatory ?? globalDesignSettings.isSignatureMandatory ?? false
  );
  const pAdditionalFilesMandatory = Boolean(
    pb.is_additional_files_mandatory !== undefined
      ? pb.is_additional_files_mandatory
      : pb.isAdditionalFilesMandatory !== undefined
      ? pb.isAdditionalFilesMandatory
      : globalDesignSettings.is_additional_files_mandatory ?? globalDesignSettings.isAdditionalFilesMandatory ?? false
  );

  return (
    <div className="space-y-3">
      {/* Product Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {products.map((p, idx) => {
          const itemPb = getProductBrief(p);
          const isFilled = itemPb?.brief?.trim()?.length > 0;
          const pNeedsDesigner =
            p.kind !== "ready" &&
            (itemPb.designer !== undefined
              ? Boolean(itemPb.designer)
              : Boolean(globalDesignSettings.designer !== false));
          const hasDesigner = Boolean(
            (itemPb.assignedDesigner || globalDesignSettings.assignedDesigner || "").trim()
          );
          const isDesignerMissing = pNeedsDesigner && !hasDesigner;
          const isCur = activeProductIdx === idx;
          const isComplete = isFilled && !isDesignerMissing;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveProductIdx(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border flex-shrink-0 ${isCur
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : isComplete
                    ? "bg-white text-gray-800 border-emerald-300 hover:border-emerald-400"
                    : "bg-white text-gray-600 border-amber-300 hover:border-amber-400"
                }`}
            >
              <span>{p.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${isCur
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                  }`}
              >
                {p.items.length} size{p.items.length !== 1 ? "s" : ""}
              </span>
              {isComplete ? (
                <span className={isCur ? "text-white font-bold" : "text-emerald-500 font-bold"}>
                  ✓
                </span>
              ) : !isFilled ? (
                <span className={isCur ? "text-white/80 font-bold text-[10px]" : "text-amber-500 font-bold text-[10px]"}>
                  (Brief needed)
                </span>
              ) : (
                <span className={isCur ? "text-white/80 font-bold text-[10px]" : "text-amber-500 font-bold text-[10px]"}>
                  (Designer needed)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Per-Product Editor Form */}
      {activeProduct && (
        <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4 fade">
          {/* Product Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <div className="font-extrabold text-sm text-gray-900">
                {activeProduct.name}
              </div>
              <div className="text-[11px] text-gray-400">
                {activeProduct.items.length} size
                {activeProduct.items.length !== 1 ? "s" : ""}:{" "}
                {activeProduct.items
                  .map((it) => `${it.size || "Default"}`)
                  .join(", ")}
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeProduct.kind === "ready"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-indigo-100 text-indigo-700"
                }`}
            >
              {activeProduct.kind === "ready" ? "Ready Trophy" : "Custom"}
            </span>
          </div>

          {/* References */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">
              Reference images / sketches for {activeProduct.name} (optional)
            </label>
            <RefImageUploader
              images={activeBrief.refs || []}
              onChange={(newImgs, immediate) => upd({ refs: newImgs }, immediate)}
              clientId={clientId}
              clientName={clientName}
              enquiryNo={enquiryNo}
              subJobNo={activeProduct.name}
              folderType="reference_images"
              onImmediateSave={(newImgs) =>
                onImmediateSave?.({
                  productBriefs: {
                    ...productBriefs,
                    [activeProduct.name]: {
                      ...(productBriefs[activeProduct.name] || {}),
                      refs: newImgs,
                    },
                  },
                })
              }
            />
          </div>

          {/* Brief textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              The Brief for {activeProduct.name}{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-2xs resize-none"
              rows={4}
              placeholder={`What did the client say about ${activeProduct.name}? Style, elements, text, colors...`}
              value={activeBrief.brief || ""}
              onChange={(e) => upd({ brief: e.target.value })}
              onBlur={() =>
                onImmediateSave?.({
                  productBriefs: {
                    ...productBriefs,
                    [activeProduct.name]: {
                      ...(productBriefs[activeProduct.name] || {}),
                      brief: activeBrief.brief || "",
                    },
                  },
                })
              }
            />
          </div>

          {/* Per-Product Assets (Client Logo, Signatures with Name & Designation, Additional Files) */}
          <ProductAssetsSection
            isPerProduct={true}
            productName={activeProduct.name}
            logos={pb.clientLogo || pb.client_logo || []}
            signatures={pb.signatures || []}
            additionalFiles={pb.additionalFiles || pb.additional_files || []}
            isLogoMandatory={pLogoMandatory}
            isSignatureMandatory={pSignatureMandatory}
            isAdditionalFilesMandatory={pAdditionalFilesMandatory}
            onRequirementsChange={(reqs) =>
              upd({
                is_logo_mandatory: reqs.isLogoMandatory,
                is_signature_mandatory: reqs.isSignatureMandatory,
                is_additional_files_mandatory: reqs.isAdditionalFilesMandatory,
                isLogoMandatory: reqs.isLogoMandatory,
                isSignatureMandatory: reqs.isSignatureMandatory,
                isAdditionalFilesMandatory: reqs.isAdditionalFilesMandatory,
              }, true)
            }
            onApplyRequirementsToAll={applyRequirementsToAllProducts}
            onLogosChange={(newLogos, immediate) =>
              upd({ clientLogo: newLogos, client_logo: newLogos }, immediate)
            }
            onSignaturesChange={(newSigs, immediate) =>
              upd({ signatures: newSigs }, immediate)
            }
            onAdditionalFilesChange={(newFiles, immediate) =>
              upd({ additionalFiles: newFiles, additional_files: newFiles }, immediate)
            }
            onApplyLogosToAll={applyLogosToAllProducts}
            onApplySignaturesToAll={applySignaturesToAllProducts}
            onApplyFilesToAll={applyFilesToAllProducts}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            subJobNo={activeProduct.name}
            products={products}
            onImmediateSave={onImmediateSave}
          />

          {/* Per-Product Design Settings Card */}
          <DesignSettingsCard
            isPerProduct={true}
            productName={activeProduct.name}
            designer={pDesigner}
            quoteOnly={pQuoteOnly}
            showRDLogo={pRDLogo}
            showRDContent={pRDContent}
            assignedDesigner={pAssignedDesigner}
            assignedDesignerName={pAssignedDesignerName}
            copyrightContent={pCopyrightContent}
            designOptions={pDesignOptions}
            optionsDueIn={pOptionsDueIn}
            linksDuration={linksDuration || globalDesignSettings.linksDuration || 24}
            designersList={designersList}
            products={products}
            onUpdate={(patch) => {
              if (
                "showRDLogo" in patch ||
                "showRDContent" in patch ||
                "copyrightContent" in patch ||
                "optionsDueIn" in patch
              ) {
                onGlobalUpdate(patch);
              } else {
                upd(patch);
              }
            }}
            onApplyToAllProducts={applyDesignerToAllProducts}
            onLinksDurationChange={onLinksDurationChange}
          />

          {/* Product Navigation Buttons */}
          <div className="flex items-center justify-between pt-2">
            {/* Previous Product Button */}
            {activeProductIdx > 0 ? (
              <button
                type="button"
                onClick={() => setActiveProductIdx(activeProductIdx - 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>← Previous</span>
                <span className="text-[10px] text-gray-400">
                  ({products[activeProductIdx - 1]?.name})
                </span>
              </button>
            ) : (
              <div />
            )}

            {/* Next Product Button */}
            {activeProductIdx < products.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveProductIdx(activeProductIdx + 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto"
                style={{ backgroundColor: "#635BFF" }}
              >
                <span>Next Product</span>
                <span className="text-[10px] opacity-80">
                  ({products[activeProductIdx + 1]?.name})
                </span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerProductBriefForm;
