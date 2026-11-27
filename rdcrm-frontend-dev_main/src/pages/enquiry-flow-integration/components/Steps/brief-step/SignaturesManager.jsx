import React, { useState, useRef } from "react";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";
import { getImgSrc } from "./RefImageUploader";

const ACCEPTED_SIGS = "image/png,image/jpeg,image/webp";

/**
 * SignaturesManager Component
 * Allows adding multiple signatories with Name and Designation before uploading their signature file.
 * Uploads directly to Cloudflare R2 under folderType: "signatures" with subJobNo scoping.
 */
const SignaturesManager = ({
  signatures = [],
  onChange = () => {},
  clientId = "",
  clientName = "",
  enquiryNo = "",
  subJobNo = "",
  onImmediateSave = null,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [designation, setDesignation] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activePreviewSig, setActivePreviewSig] = useState(null);
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setSignatoryName("");
    setDesignation("");
    if (filePreviewUrl) {
      try {
        URL.revokeObjectURL(filePreviewUrl);
      } catch (_e) {
        /* ignore */
      }
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setIsModalOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or WebP signature image.");
      return;
    }

    if (filePreviewUrl) {
      try {
        URL.revokeObjectURL(filePreviewUrl);
      } catch (_e) {
        /* ignore */
      }
    }

    setSelectedFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveSignature = async (e) => {
    e?.preventDefault();

    const trimmedName = signatoryName.trim();
    const trimmedDesig = designation.trim();

    if (!trimmedName) {
      toast.warn("Please enter the Signatory's Name.");
      return;
    }

    if (!selectedFile) {
      toast.warn("Please select the signature image file to upload.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("clientId", clientId || "");
      formData.append("clientName", clientName || "");
      formData.append("enquiryNo", enquiryNo || "RD_ENQUIRY");
      formData.append("folderType", "signatures");
      if (subJobNo) formData.append("subJobNo", subJobNo);

      const res = await axiosInstance.post(
        "/enquiry-flow-integration/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data?.success && res.data?.data) {
        const r2Data = res.data.data;
        const newSigItem = {
          id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: trimmedName,
          designation: trimmedDesig,
          file_url: r2Data.file_url,
          signed_url: r2Data.signed_url || r2Data.file_url,
          url: r2Data.signed_url || r2Data.file_url,
          file_name: r2Data.file_name || selectedFile.name,
          size: selectedFile.size,
          folder_path: r2Data.folder_path,
          uploaded_at: new Date().toISOString(),
        };

        const updated = [...signatures, newSigItem];
        onChange(updated, true);
        if (typeof onImmediateSave === "function") {
          try { onImmediateSave(updated); } catch (_e) { /* ignore */ }
        }

        toast.success(`Signature for "${trimmedName}" uploaded successfully!`);
        resetForm();
      } else {
        toast.error("Failed to upload signature file. Please try again.");
      }
    } catch (err) {
      console.error("Signature upload error:", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to upload signature. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const removeSignature = (sigId) => {
    const updated = signatures.filter((s) => s.id !== sigId);
    onChange(updated, true);
    if (typeof onImmediateSave === "function") {
      try { onImmediateSave(updated); } catch (_e) { /* ignore */ }
    }
    toast.info("Signature removed");
  };

  return (
    <div className="space-y-3">
      {/* Signatures Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {signatures.map((sig, idx) => (
          <div
            key={sig.id || idx}
            className="panel p-3 bg-white border border-gray-200 rounded-xl shadow-xs flex items-center justify-between gap-3 transition hover:border-indigo-200"
          >
            {/* Signature Preview */}
            <div
              className="w-16 h-12 bg-gray-50 border border-gray-100 rounded-lg p-1 flex items-center justify-center flex-shrink-0 cursor-zoom-in"
              onClick={() => setActivePreviewSig(sig)}
              title="Click to preview signature"
            >
              <img
                src={getImgSrc(sig)}
                alt={sig.name || "Signature"}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Signatory Details */}
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-xs text-gray-900 truncate">
                {sig.name}
              </div>
              {sig.designation ? (
                <div className="text-[11px] text-gray-500 truncate mt-0.5">
                  {sig.designation}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 italic mt-0.5">
                  No designation
                </div>
              )}
            </div>

            {/* Remove Button */}
            <button
              type="button"
              onClick={() => removeSignature(sig.id)}
              className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer flex-shrink-0"
              title="Remove signature"
            >
              <span className="text-xs font-bold">✕</span>
            </button>
          </div>
        ))}

        {/* Add Signature Button Card */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 transition flex items-center justify-center gap-2 cursor-pointer text-gray-600 hover:text-indigo-600 min-h-[58px]"
        >
          <span className="text-base">✍️</span>
          <span className="text-xs font-bold">+ Add Signatory & Signature</span>
        </button>
      </div>

      {signatures.length > 0 && (
        <p className="text-[11px] text-gray-400">
          {signatures.length} signature{signatures.length > 1 ? "s" : ""} added
        </p>
      )}

      {/* Modal: Add Signatory & Upload Signature */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl space-y-4 fade"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">✍️</span>
                <h3 className="font-extrabold text-sm text-gray-900">
                  Add Signatory & Signature
                </h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSignature} className="space-y-3.5">
              {/* Field 1: Signatory Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-800">
                  Signatory Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. R. Sundar"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Field 2: Designation (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>Designation</span>
                  <span className="text-gray-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Director & Vice Chancellor (optional)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>

              {/* Field 3: Signature File */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-800">
                  Signature Image <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_SIGS}
                  className="hidden"
                  onChange={handleFileChange}
                />

                {filePreviewUrl ? (
                  <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 flex items-center justify-between gap-3">
                    <div className="w-20 h-12 bg-white rounded-lg border border-indigo-100 p-1 flex items-center justify-center flex-shrink-0">
                      <img
                        src={filePreviewUrl}
                        alt="Signature Preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-gray-800 truncate">
                        {selectedFile?.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {((selectedFile?.size || 0) / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition text-gray-500 hover:text-indigo-600 bg-gray-50/50 hover:bg-indigo-50/30"
                  >
                    <span className="text-xl">🖋️</span>
                    <span className="text-xs font-bold">
                      Click to choose signature image (PNG, JPG, WebP)
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Prefer transparent PNG background
                    </span>
                  </button>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isUploading ||
                    !signatoryName.trim() ||
                    !selectedFile
                  }
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#635BFF" }}
                >
                  {isUploading ? "Uploading..." : "Save & Add Signature"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Signature Preview */}
      {activePreviewSig && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActivePreviewSig(null)}
        >
          <div
            className="relative max-w-md bg-white rounded-2xl p-5 shadow-2xl flex flex-col items-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActivePreviewSig(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center cursor-pointer transition"
            >
              ✕
            </button>
            <div className="text-center">
              <div className="font-extrabold text-sm text-gray-900">
                {activePreviewSig.name}
              </div>
              {activePreviewSig.designation && (
                <div className="text-xs text-gray-500">
                  {activePreviewSig.designation}
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl w-full flex items-center justify-center">
              <img
                src={getImgSrc(activePreviewSig)}
                alt={activePreviewSig.name}
                className="max-w-full max-h-48 object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturesManager;
