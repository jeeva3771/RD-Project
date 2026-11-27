import React, { useState, useEffect } from "react";
import ProductAssetsSection from "../Steps/brief-step/ProductAssetsSection";

/**
 * AssetUploadModal.jsx
 *
 * Popup dialog that lets users upload Client Logo, Signatures, and Additional Files
 * directly from Step 3 (Design Options) or Step 4 (Production DTP) without navigating back to Brief Step.
 */
const AssetUploadModal = ({
  isOpen = false,
  onClose = () => {},
  product = {},
  clientId = "",
  clientName = "",
  enquiryNo = "",
  onSaveAssets = () => {},
  onImmediateSave = null,
}) => {
  const [logos, setLogos] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [additionalFiles, setAdditionalFiles] = useState([]);

  useEffect(() => {
    if (product) {
      setLogos(product.client_logo || product.clientLogo || []);
      setSignatures(product.signatures || []);
      setAdditionalFiles(product.additional_files || product.additionalFiles || []);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const productName = product.theme || product.product_name || product.name || "Product";
  const subJobNo = product.sub_job_no || product.subJobNo || "";

  const handleSaveAndClose = () => {
    onSaveAssets({
      product,
      subJobNo,
      client_logo: logos,
      signatures,
      additional_files: additionalFiles,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-all transform animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              📁
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <span>Upload Assets for {productName}</span>
                {subJobNo && (
                  <span className="font-mono text-xs text-gray-500 font-normal">
                    ({subJobNo})
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-400">
                Upload required client logos, authorized signatures, or artwork reference files.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <ProductAssetsSection
            isPerProduct={true}
            productName={productName}
            logos={logos}
            signatures={signatures}
            additionalFiles={additionalFiles}
            isLogoMandatory={Boolean(product.is_logo_mandatory)}
            isSignatureMandatory={Boolean(product.is_signature_mandatory)}
            isAdditionalFilesMandatory={Boolean(product.is_additional_files_mandatory)}
            onLogosChange={(newLogos, immediate) => {
              setLogos(newLogos);
              if (immediate && onImmediateSave) {
                onImmediateSave({ client_logo: newLogos, subJobNo });
              }
            }}
            onSignaturesChange={(newSigs, immediate) => {
              setSignatures(newSigs);
              if (immediate && onImmediateSave) {
                onImmediateSave({ signatures: newSigs, subJobNo });
              }
            }}
            onAdditionalFilesChange={(newFiles, immediate) => {
              setAdditionalFiles(newFiles);
              if (immediate && onImmediateSave) {
                onImmediateSave({ additional_files: newFiles, subJobNo });
              }
            }}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            subJobNo={subJobNo}
            products={[]}
            onImmediateSave={onImmediateSave}
            hideMandatoryCheckboxes={true}
          />
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            Files upload directly to secure Cloudflare R2 storage.
          </span>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 rounded-xl text-xs font-extrabold text-white transition cursor-pointer shadow-sm hover:opacity-95"
            style={{ backgroundColor: "#635BFF" }}
          >
            Save &amp; Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetUploadModal;
