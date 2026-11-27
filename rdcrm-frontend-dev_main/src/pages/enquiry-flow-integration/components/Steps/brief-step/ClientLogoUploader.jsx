import React, { useState, useRef } from "react";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";
import { getImgSrc, getImgName } from "./RefImageUploader";

const ACCEPTED_LOGOS = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_LOGOS = 5;

/**
 * ClientLogoUploader Component
 * Dedicated uploader for client logos associated with an enquiry or specific product.
 * Uploads directly to Cloudflare R2 under folderType: "client_logo".
 */
const ClientLogoUploader = ({
  logos = [],
  onChange = () => {},
  clientId = "",
  clientName = "",
  enquiryNo = "",
  subJobNo = "",
  onImmediateSave = null,
}) => {
  const inputRef = useRef(null);
  const [previewIdx, setPreviewIdx] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(f.type)
    );

    if (valid.length === 0) {
      toast.error("Please upload valid logo images (PNG, JPG, SVG, WebP).");
      return;
    }

    const remaining = MAX_LOGOS - logos.length;
    if (remaining <= 0) {
      toast.warning(`Maximum ${MAX_LOGOS} client logos allowed.`);
      return;
    }

    const toUpload = valid.slice(0, remaining);
    setIsUploading(true);
    const newlyUploaded = [];
    let successCount = 0;
    let failCount = 0;

    for (const file of toUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", clientId || "");
        formData.append("clientName", clientName || "");
        formData.append("enquiryNo", enquiryNo || "RD_ENQUIRY");
        formData.append("folderType", "client_logo");
        if (subJobNo) formData.append("subJobNo", subJobNo);

        const res = await axiosInstance.post(
          "/enquiry-flow-integration/upload",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (res.data?.success && res.data?.data) {
          const r2Data = res.data.data;
          newlyUploaded.push({
            url: r2Data.signed_url || r2Data.file_url,
            file_url: r2Data.file_url,
            signed_url: r2Data.signed_url,
            name: file.name,
            file_name: r2Data.file_name || file.name,
            size: file.size,
            folder_path: r2Data.folder_path,
            uploaded_at: new Date().toISOString(),
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error("Logo upload error:", err);
        failCount++;
      }
    }

    setIsUploading(false);

    if (newlyUploaded.length > 0) {
      const nextLogos = [...logos, ...newlyUploaded];
      onChange(nextLogos, true);
      if (typeof onImmediateSave === "function") {
        try { onImmediateSave(nextLogos); } catch (_e) { /* ignore */ }
      }
      toast.success(
        successCount === 1
          ? "Client logo uploaded successfully!"
          : `${successCount} client logos uploaded!`
      );
    }

    if (failCount > 0) {
      toast.error(`${failCount} logo(s) failed to upload. Please try again.`);
    }
  };

  const removeLogo = (idx) => {
    if (previewIdx === idx) setPreviewIdx(null);
    const nextLogos = logos.filter((_, i) => i !== idx);
    onChange(nextLogos, true);
    if (typeof onImmediateSave === "function") {
      try { onImmediateSave(nextLogos); } catch (_e) { /* ignore */ }
    }
    toast.info("Client logo removed");
  };

  const previewLogo = previewIdx !== null ? logos[previewIdx] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Uploaded Logos Thumbnails */}
        {logos.map((img, idx) => (
          <div
            key={idx}
            className="relative group w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-xs flex-shrink-0 bg-white p-1 flex items-center justify-center"
          >
            <img
              src={getImgSrc(img)}
              alt={getImgName(img, idx)}
              className="max-w-full max-h-full object-contain cursor-zoom-in"
              onClick={() => setPreviewIdx(idx)}
            />
            {/* Remove Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeLogo(idx);
              }}
              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 hover:bg-red-600 text-white text-[9px] font-black flex items-center justify-center cursor-pointer transition shadow-sm leading-none"
              title="Remove logo"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add Logo Button */}
        {logos.length < MAX_LOGOS && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_LOGOS}
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 transition flex flex-col items-center justify-center gap-1 cursor-pointer text-gray-500 hover:text-indigo-600 disabled:opacity-50 flex-shrink-0 bg-white"
            >
              {isUploading ? (
                <span className="text-[10px] text-indigo-600 font-semibold animate-pulse">
                  Uploading...
                </span>
              ) : (
                <>
                  <span className="text-xl">🏢</span>
                  <span className="text-[10px] font-bold text-center leading-tight">
                    + Add Logo
                  </span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {logos.length > 0 && (
        <p className="text-[11px] text-gray-400">
          {logos.length} logo{logos.length > 1 ? "s" : ""} uploaded · Click to preview full size
        </p>
      )}

      {/* Lightbox Modal */}
      {previewLogo && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewIdx(null)}
        >
          <div
            className="relative max-w-lg max-h-[85vh] bg-white rounded-2xl p-4 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewIdx(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center cursor-pointer transition"
            >
              ✕
            </button>
            <div className="font-bold text-xs text-gray-700 mb-3 truncate max-w-xs">
              {getImgName(previewLogo, previewIdx)}
            </div>
            <div className="p-4 bg-gray-50 rounded-xl max-w-full max-h-[60vh] flex items-center justify-center">
              <img
                src={getImgSrc(previewLogo)}
                alt="Full logo preview"
                className="max-w-full max-h-[50vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientLogoUploader;
