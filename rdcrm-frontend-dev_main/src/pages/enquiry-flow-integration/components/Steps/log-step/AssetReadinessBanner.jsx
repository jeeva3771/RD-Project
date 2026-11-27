import React, { useState } from "react";
import { checkMandatoryAssetsReadiness } from "../../../utils/assetValidationHelpers";
import AssetUploadModal from "../../common/AssetUploadModal";

/**
 * AssetReadinessBanner.jsx
 *
 * Shows an informative warning banner in Step 3 (Design Options) if any product has
 * mandatory assets that were deferred during Brief Step.
 * Provides a 1-click [Upload Assets Now] button opening the Quick Asset Upload Modal.
 */
const AssetReadinessBanner = ({
  products = [],
  theBrief = {},
  briefMode = "one",
  clientId = "",
  clientName = "",
  enquiryNo = "",
  onUpdateSubJobAssets = () => {},
  onImmediateSave = null,
}) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const readiness = checkMandatoryAssetsReadiness(products, theBrief, briefMode);

  if (!readiness.hasMissing) return null;

  return (
    <>
      <div className="panel p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-300 rounded-xl shadow-2xs space-y-2 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="text-lg shrink-0">⏳</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs text-amber-950">
                  Mandatory Client Assets Pending Upload
                </span>
                <span className="px-2 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  Deferred Upload
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                The designer can proceed with draft layouts and placeholder concepts. However, high-res mandatory assets must be uploaded before releasing to <b>Production DTP</b>.
              </p>
            </div>
          </div>
        </div>

        {/* List of pending items */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-amber-200/80">
          {readiness.missingList.map((item, idx) => (
            <div
              key={idx}
              className="px-2.5 py-1 bg-white/90 border border-amber-300 rounded-lg text-xs flex items-center gap-2 shadow-2xs"
            >
              <span className="font-extrabold text-gray-900">
                {item.productName}
              </span>
              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Missing: {item.missingAssets.join(", ")}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(item.product);
                  setShowUploadModal(true);
                }}
                className="text-[10px] font-extrabold text-indigo-700 hover:text-indigo-900 underline cursor-pointer ml-1"
              >
                Upload Now →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Inline Quick Upload Modal */}
      {showUploadModal && (
        <AssetUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          product={selectedProduct}
          clientId={clientId}
          clientName={clientName}
          enquiryNo={enquiryNo}
          onSaveAssets={({ subJobNo, client_logo, signatures, additional_files }) => {
            onUpdateSubJobAssets({
              subJobNo,
              client_logo,
              signatures,
              additional_files,
            });
            setShowUploadModal(false);
          }}
          onImmediateSave={onImmediateSave}
        />
      )}
    </>
  );
};

export default AssetReadinessBanner;
