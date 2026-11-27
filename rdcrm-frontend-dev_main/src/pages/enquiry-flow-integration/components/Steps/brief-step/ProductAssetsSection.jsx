import React, { useState } from "react";
import ClientLogoUploader from "./ClientLogoUploader";
import SignaturesManager from "./SignaturesManager";
import AdditionalFilesUploader from "./AdditionalFilesUploader";

/**
 * ProductAssetsSection Component
 * Organizes Client Logo, Signatures (with Name & Designation), and Additional Files
 * for a specific product or the overall enquiry.
 *
 * Supports mandatory asset toggles (Logo, Signatures, Additional Files) with deferred upload support.
 */
const ProductAssetsSection = ({
  isPerProduct = false,
  productName = "",
  logos = [],
  signatures = [],
  additionalFiles = [],
  isLogoMandatory = false,
  isSignatureMandatory = false,
  isAdditionalFilesMandatory = false,
  onRequirementsChange = () => {},
  onApplyRequirementsToAll = null,
  onLogosChange = () => {},
  onSignaturesChange = () => {},
  onAdditionalFilesChange = () => {},
  onApplyLogosToAll = null,
  onApplySignaturesToAll = null,
  onApplyFilesToAll = null,
  clientId = "",
  clientName = "",
  enquiryNo = "",
  subJobNo = "",
  products = [],
  onImmediateSave = null,
  hideMandatoryCheckboxes = false,
}) => {
  const [activeTab, setActiveTab] = useState("signatures"); // "signatures" | "logos" | "files"

  const handleToggleRequirement = (key) => {
    const current = {
      isLogoMandatory,
      isSignatureMandatory,
      isAdditionalFilesMandatory,
      [key]: !({
        isLogoMandatory,
        isSignatureMandatory,
        isAdditionalFilesMandatory,
      }[key]),
    };
    onRequirementsChange(current);
  };

  return (
    <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4 fade">
      {/* Section Header */}
      <div className="pb-3 border-b border-gray-100">
        <div className="font-extrabold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <span>🗂️</span>
          <span>
            {isPerProduct
              ? `Assets & Attachments for ${productName || "Product"}`
              : "Client Assets & Attachments"}
          </span>
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">
          Client logo, signatories & signatures, and additional event files (Excel, PDF, Docs)
        </div>
      </div>

      {/* 1. Asset Mandatory Checkboxes Bar (Placed on Top) */}
      {!hideMandatoryCheckboxes && (
        <div className="p-3 bg-gradient-to-r from-gray-50 to-indigo-50/30 border border-gray-200/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>📋</span>
              <span>Asset Requirement Flags for {isPerProduct ? productName : "This Enquiry"}:</span>
            </span>

            {isPerProduct && onApplyRequirementsToAll && products.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onApplyRequirementsToAll({
                    isLogoMandatory,
                    isSignatureMandatory,
                    isAdditionalFilesMandatory,
                  })
                }
                className="text-[10px] text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                title="Apply these mandatory requirement settings to all products"
              >
                ⚡ Apply requirements to all products
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* Checkbox 1: Signature Mandatory */}
            <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 transition cursor-pointer shadow-2xs">
              <input
                type="checkbox"
                checked={isSignatureMandatory}
                onChange={() => handleToggleRequirement("isSignatureMandatory")}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <span>✍️</span>
                  <span>Signature Mandatory</span>
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {isSignatureMandatory ? "Enforced before DTP" : "Optional"}
                </div>
              </div>
            </label>

            {/* Checkbox 2: Logo Mandatory */}
            <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 transition cursor-pointer shadow-2xs">
              <input
                type="checkbox"
                checked={isLogoMandatory}
                onChange={() => handleToggleRequirement("isLogoMandatory")}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <span>🏢</span>
                  <span>Logo Mandatory</span>
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {isLogoMandatory ? "Enforced before DTP" : "Optional"}
                </div>
              </div>
            </label>

            {/* Checkbox 3: Additional Files Mandatory */}
            <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 transition cursor-pointer shadow-2xs">
              <input
                type="checkbox"
                checked={isAdditionalFilesMandatory}
                onChange={() => handleToggleRequirement("isAdditionalFilesMandatory")}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                  <span>📎</span>
                  <span>Addl. Files Mandatory</span>
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {isAdditionalFilesMandatory ? "Names/citation list" : "Optional"}
                </div>
              </div>
            </label>
          </div>

          <div className="text-[10px] text-gray-500 flex items-center gap-1 pt-0.5">
            <span>ℹ️</span>
            <span>
              Files do <b>NOT</b> need to be uploaded right now. You can upload them now or later before Design Request / Production DTP.
            </span>
          </div>
        </div>
      )}

      {/* 2. Category Tabs Bar (Placed Below Checkboxes) */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
        <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <span>📁</span>
          <span>Upload &amp; Manage Assets:</span>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl flex-wrap">
          {/* Tab 1: Signatures */}
          <button
            type="button"
            onClick={() => setActiveTab("signatures")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "signatures"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>✍️</span>
            <span>Signatures</span>
            {signatures.length > 0 ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                ✓ {signatures.length}
              </span>
            ) : isSignatureMandatory ? (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                ⏳ Required
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-normal">0</span>
            )}
          </button>

          {/* Tab 2: Client Logo */}
          <button
            type="button"
            onClick={() => setActiveTab("logos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "logos"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>🏢</span>
            <span>Client Logo</span>
            {logos.length > 0 ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                ✓ {logos.length}
              </span>
            ) : isLogoMandatory ? (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                ⏳ Required
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-normal">0</span>
            )}
          </button>

          {/* Tab 3: Additional Files */}
          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "files"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>📎</span>
            <span>Additional Files</span>
            {additionalFiles.length > 0 ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                ✓ {additionalFiles.length}
              </span>
            ) : isAdditionalFilesMandatory ? (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                ⏳ Required
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-normal">0</span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content 1: Signatures */}
      {activeTab === "signatures" && (
        <div className="space-y-2 fade">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>✍️</span>
              <span>Signatories & Signatures for {isPerProduct ? productName : "Trophy"}</span>
              {isSignatureMandatory && (
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Mandatory Asset
                </span>
              )}
            </div>
            {isPerProduct && onApplySignaturesToAll && products.length > 1 && signatures.length > 0 && (
              <button
                type="button"
                onClick={() => onApplySignaturesToAll(signatures)}
                className="text-[10px] text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                title="Apply these signatures to all products in this enquiry"
              >
                ⚡ Apply signatures to all products
              </button>
            )}
          </div>
          <SignaturesManager
            signatures={signatures}
            onChange={onSignaturesChange}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            subJobNo={subJobNo}
            onImmediateSave={
              !isPerProduct && onImmediateSave
                ? (newSigs) => onImmediateSave?.({ globalSignatures: newSigs, signatures: newSigs })
                : null
            }
          />
        </div>
      )}

      {/* Tab Content 2: Client Logo */}
      {activeTab === "logos" && (
        <div className="space-y-2 fade">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>🏢</span>
              <span>Client Logo for {isPerProduct ? productName : "Trophy"}</span>
              {isLogoMandatory && (
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Mandatory Asset
                </span>
              )}
            </div>
            {isPerProduct && onApplyLogosToAll && products.length > 1 && logos.length > 0 && (
              <button
                type="button"
                onClick={() => onApplyLogosToAll(logos)}
                className="text-[10px] text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                title="Apply this logo to all products in this enquiry"
              >
                ⚡ Apply logo to all products
              </button>
            )}
          </div>
          <ClientLogoUploader
            logos={logos}
            onChange={onLogosChange}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            subJobNo={subJobNo}
            onImmediateSave={
              !isPerProduct && onImmediateSave
                ? (newLogos) => onImmediateSave?.({ globalLogos: newLogos, clientLogo: newLogos, clientLogos: newLogos })
                : null
            }
          />
        </div>
      )}

      {/* Tab Content 3: Additional Files */}
      {activeTab === "files" && (
        <div className="space-y-2 fade">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>📎</span>
              <span>Additional Event Documents (Excel names list, PDF citation, Word)</span>
              {isAdditionalFilesMandatory && (
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Mandatory Asset
                </span>
              )}
            </div>
            {isPerProduct && onApplyFilesToAll && products.length > 1 && additionalFiles.length > 0 && (
              <button
                type="button"
                onClick={() => onApplyFilesToAll(additionalFiles)}
                className="text-[10px] text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                title="Apply these documents to all products in this enquiry"
              >
                ⚡ Apply files to all products
              </button>
            )}
          </div>
          <AdditionalFilesUploader
            files={additionalFiles}
            onChange={onAdditionalFilesChange}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            subJobNo={subJobNo}
            onImmediateSave={
              !isPerProduct && onImmediateSave
                ? (newFiles) => onImmediateSave?.({ globalAdditionalFiles: newFiles, additionalFiles: newFiles, additional_files: newFiles })
                : null
            }
          />
        </div>
      )}
    </div>
  );
};

export default ProductAssetsSection;
