import React from "react";
import RefImageUploader from "./RefImageUploader";
import ProductAssetsSection from "./ProductAssetsSection";

/**
 * Form for "One brief for all products" mode.
 * Displays which products the brief applies to, reference image uploader,
 * brief textarea, and client assets (Logo, Signatures, Additional Files).
 */
const OneBriefForm = ({
  products = [],
  globalRefs = [],
  setGlobalRefs = () => {},
  globalBrief = "",
  setGlobalBrief = () => {},
  globalLogos = [],
  setGlobalLogos = () => {},
  globalSignatures = [],
  setGlobalSignatures = () => {},
  globalAdditionalFiles = [],
  setGlobalAdditionalFiles = () => {},
  isLogoMandatory = false,
  setIsLogoMandatory = () => {},
  isSignatureMandatory = false,
  setIsSignatureMandatory = () => {},
  isAdditionalFilesMandatory = false,
  setIsAdditionalFilesMandatory = () => {},
  clientId = "",
  clientName = "",
  enquiryNo = "",
  onImmediateSave = null,
}) => {
  return (
    <div className="space-y-4">
      <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
        {/* Applies to chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-400 font-semibold">
            Applies to:
          </span>
          {products.map((p, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
            >
              <span>{p.name}</span>
              <span className="text-[10px] opacity-60">
                ({p.items.length} size{p.items.length !== 1 ? "s" : ""})
              </span>
            </span>
          ))}
        </div>

        {/* References */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700">
            Reference images / sketches (optional)
          </label>
          <RefImageUploader
            images={globalRefs}
            onChange={(newImgs, immediate) => setGlobalRefs(newImgs, immediate)}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            subJobNo="all_products"
            folderType="reference_images"
            onImmediateSave={(newImgs) => onImmediateSave?.({ globalRefs: newImgs })}
          />
        </div>

        {/* Brief textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-800">
            The Brief <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border border-gray-200 rounded-xl p-3.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-2xs resize-none"
            rows={4}
            placeholder="What did the client say? What are they looking for? Style, elements, text, colors, anything specific..."
            value={globalBrief}
            onChange={(e) => setGlobalBrief(e.target.value)}
            onBlur={() => onImmediateSave?.({ globalBrief })}
          />
        </div>
      </div>

      {/* Client Assets & Attachments (Logo, Signatures, Additional Files) */}
      <ProductAssetsSection
        isPerProduct={false}
        logos={globalLogos}
        signatures={globalSignatures}
        additionalFiles={globalAdditionalFiles}
        isLogoMandatory={isLogoMandatory}
        isSignatureMandatory={isSignatureMandatory}
        isAdditionalFilesMandatory={isAdditionalFilesMandatory}
        onRequirementsChange={({ isLogoMandatory: lm, isSignatureMandatory: sm, isAdditionalFilesMandatory: am }) => {
          setIsLogoMandatory(lm);
          setIsSignatureMandatory(sm);
          setIsAdditionalFilesMandatory(am);
          onImmediateSave?.({
            is_logo_mandatory: lm,
            is_signature_mandatory: sm,
            is_additional_files_mandatory: am,
            isLogoMandatory: lm,
            isSignatureMandatory: sm,
            isAdditionalFilesMandatory: am,
          });
        }}
        onLogosChange={(newLogos, immediate) => {
          setGlobalLogos(newLogos);
          if (immediate) onImmediateSave?.({ globalLogos: newLogos, clientLogo: newLogos, clientLogos: newLogos });
        }}
        onSignaturesChange={(newSigs, immediate) => {
          setGlobalSignatures(newSigs);
          if (immediate) onImmediateSave?.({ globalSignatures: newSigs, signatures: newSigs });
        }}
        onAdditionalFilesChange={(newFiles, immediate) => {
          setGlobalAdditionalFiles(newFiles);
          if (immediate) onImmediateSave?.({ globalAdditionalFiles: newFiles, additionalFiles: newFiles });
        }}
        clientId={clientId}
        clientName={clientName}
        enquiryNo={enquiryNo}
        subJobNo="all_products"
        products={products}
        onImmediateSave={onImmediateSave}
      />
    </div>
  );
};

export default OneBriefForm;
