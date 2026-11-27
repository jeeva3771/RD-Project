import React, { useState, useRef } from "react";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";

const ACCEPTED = "image/png,image/jpeg,image/webp";
const MAX_REFS = 5;

export const getImgSrc = (img) => {
  if (!img) return "";
  if (typeof img === "string") return img;
  return (
    img.signed_url ||
    img.file_url ||
    img.url ||
    img.dataUrl ||
    img.preview ||
    ""
  );
};

export const getImgName = (img, idx) => {
  if (!img) return `Image ${idx + 1}`;
  if (typeof img === "string") {
    try {
      const urlObj = new URL(img);
      const parts = urlObj.pathname.split("/");
      const last = decodeURIComponent(parts[parts.length - 1] || "");
      if (last.includes("---")) return last.split("---")[1];
      return last || `Ref ${idx + 1}`;
    } catch (_) {
      return `Ref ${idx + 1}`;
    }
  }
  return img.name || img.file_name || `Ref ${idx + 1}`;
};

/**
 * Reusable reference image uploader.
 * Features:
 *  1. Interactive thumbnail grid & full-screen lightbox preview.
 *  2. Pre-upload confirmation modal showing thumbnail, file info, and destination.
 *  3. Direct upload to Cloudflare R2 storage via /enquiry-flow-integration/upload.
 *  4. Instant callback to trigger DB persistence immediately upon upload.
 */
const RefImageUploader = ({
  images = [],
  onChange = () => {},
  clientId = "",
  clientName = "",
  enquiryNo = "",
  subJobNo = "",
  folderType = "reference_images",
  onImmediateSave = null,
}) => {
  const inputRef = useRef(null);
  const [previewIdx, setPreviewIdx] = useState(null);
  const [pendingUploads, setPendingUploads] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // File selection → opens confirmation modal with preview
  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp"].includes(f.type)
    );

    if (valid.length === 0) {
      toast.error("Please upload only PNG, JPG, or WebP images.");
      return;
    }

    const remaining = MAX_REFS - images.length;
    if (remaining <= 0) {
      toast.warning(`Maximum ${MAX_REFS} reference images allowed.`);
      return;
    }

    const toAdd = valid.slice(0, remaining);
    if (toAdd.length < valid.length) {
      toast.info(
        `Only ${remaining} more image${
          remaining > 1 ? "s" : ""
        } can be added (max ${MAX_REFS}).`
      );
    }

    const pending = toAdd.map((file) => ({
      file,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      rawSize: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingUploads(pending);
  };

  const handleCancelUpload = () => {
    if (pendingUploads) {
      pendingUploads.forEach((p) => {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch (_err) {
          /* ignore */
        }
      });
    }
    setPendingUploads(null);
  };

  // Upload confirmed files to Cloudflare R2 and save to DB
  const handleConfirmUpload = async () => {
    if (!pendingUploads || pendingUploads.length === 0) return;
    setIsUploading(true);

    const newlyUploaded = [];
    let successCount = 0;
    let failCount = 0;
    let lastErrorMsg = "";

    for (const item of pendingUploads) {
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("clientId", clientId || "");
        formData.append("clientName", clientName || "");
        formData.append("enquiryNo", enquiryNo || "RD_ENQUIRY");
        formData.append("folderType", folderType || "reference_images");
        if (subJobNo) formData.append("subJobNo", subJobNo);

        const res = await axiosInstance.post(
          "/enquiry-flow-integration/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (res.data?.success && res.data?.data) {
          const r2Data = res.data.data;
          newlyUploaded.push({
            url: r2Data.signed_url || r2Data.file_url,
            file_url: r2Data.file_url,
            signed_url: r2Data.signed_url,
            name: item.name,
            file_name: r2Data.file_name || item.name,
            size: item.rawSize,
            folder_path: r2Data.folder_path,
            uploaded_at: new Date().toISOString(),
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error("R2 upload error:", err);
        lastErrorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "";
        failCount++;
      }
    }

    // Cleanup local preview blob URLs
    pendingUploads.forEach((p) => {
      try {
        URL.revokeObjectURL(p.previewUrl);
      } catch (_err) {
        /* ignore */
      }
    });

    setIsUploading(false);
    setPendingUploads(null);

    if (newlyUploaded.length > 0) {
      const nextImages = [...images, ...newlyUploaded];
      onChange(nextImages, true);
      if (onImmediateSave) onImmediateSave(nextImages);
      toast.success(
        successCount === 1
          ? "Reference image uploaded to Cloud Storage and saved!"
          : `${successCount} reference images uploaded and saved!`
      );
    }

    if (failCount > 0) {
      toast.error(
        `${failCount} image${
          failCount > 1 ? "s" : ""
        } failed to upload to R2.${lastErrorMsg ? ` (${lastErrorMsg})` : " Please try again."}`
      );
    }
  };

  const removeImage = (idx) => {
    if (previewIdx === idx) setPreviewIdx(null);
    const nextImages = images.filter((_, i) => i !== idx);
    onChange(nextImages, true);
    if (onImmediateSave) onImmediateSave(nextImages);
    toast.info("Reference image removed");
  };

  const previewImg = previewIdx !== null ? images[previewIdx] : null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Thumbnails */}
        {images.map((img, idx) => (
          <div
            key={idx}
            className="relative group w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-xs flex-shrink-0 bg-gray-50"
          >
            {/* Clickable image → preview */}
            <img
              src={getImgSrc(img)}
              alt={getImgName(img, idx)}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setPreviewIdx(idx)}
            />
            {/* Persistent ✕ remove badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(idx);
              }}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-red-600 text-white text-[9px] font-black flex items-center justify-center cursor-pointer transition shadow-sm leading-none"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add button */}
        {images.length < MAX_REFS && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-400 bg-gray-50 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:text-indigo-500 transition gap-0.5 flex-shrink-0"
              title="Add Reference Image"
            >
              <span className="text-xl leading-none">+</span>
              <span className="text-[9px] font-semibold">image</span>
            </button>
          </>
        )}

        {images.length > 0 && (
          <span className="text-[10px] text-gray-400 self-end mb-1">
            {images.length}/{MAX_REFS}
          </span>
        )}
      </div>

      {/* ── Pre-upload Confirmation Modal ── */}
      {pendingUploads && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs"
          onClick={() => {
            if (!isUploading) handleCancelUpload();
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-2xs">
                  ☁️
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900 leading-tight">
                    Confirm Reference Image Upload
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    {pendingUploads.length} image
                    {pendingUploads.length > 1 ? "s" : ""} selected for Cloudflare R2
                  </p>
                </div>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm cursor-pointer transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Body / Previews */}
            <div className="p-5 space-y-4">
              {pendingUploads.length === 1 ? (
                <div className="flex flex-col items-center">
                  <div className="w-48 h-48 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center p-2 shadow-xs mb-3">
                    <img
                      src={pendingUploads[0].previewUrl}
                      alt={pendingUploads[0].name}
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-800 truncate max-w-xs">
                      {pendingUploads[0].name}
                    </p>
                    <span className="text-[11px] font-semibold text-gray-400">
                      {pendingUploads[0].size}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {pendingUploads.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      className="relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden p-1.5 flex flex-col items-center shadow-2xs"
                    >
                      <div className="w-full h-20 rounded-lg overflow-hidden flex items-center justify-center bg-white mb-1">
                        <img
                          src={p.previewUrl}
                          alt={p.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 truncate w-full text-center">
                        {p.name}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        {p.size}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Destination & Action notice */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-indigo-700">Storage Target:</span>
                  <span className="font-bold text-indigo-900">Cloudflare R2 Bucket</span>
                </div>
                {enquiryNo && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-indigo-700">Enquiry No:</span>
                    <span className="font-mono font-bold text-indigo-900">{enquiryNo}</span>
                  </div>
                )}
                {subJobNo && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-indigo-700">Sub-Job / Product:</span>
                    <span className="font-semibold text-indigo-900">{subJobNo}</span>
                  </div>
                )}
                <p className="text-[11px] text-indigo-700/80 pt-1.5 border-t border-indigo-100/70 leading-relaxed">
                  Upon confirmation, the image will upload to R2 and automatically save to this enquiry in the database.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleCancelUpload}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleConfirmUpload}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-70"
                style={{ backgroundColor: "#635BFF" }}
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Uploading to R2...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Upload</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen Preview Modal ── */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
          onClick={() => setPreviewIdx(null)}
        >
          <div
            className="relative max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <img
              src={getImgSrc(previewImg)}
              alt={getImgName(previewImg, previewIdx)}
              className="w-full max-h-[80vh] object-contain bg-black rounded-2xl"
            />

            {/* Top bar */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
              }}
            >
              <span className="text-white text-xs font-semibold truncate max-w-xs opacity-80">
                {getImgName(previewImg, previewIdx)}
              </span>
              <div className="flex items-center gap-2">
                {/* Prev / Next */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIdx(
                          (previewIdx - 1 + images.length) % images.length
                        )
                      }
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-xs flex items-center justify-center cursor-pointer transition"
                    >
                      ‹
                    </button>
                    <span className="text-white text-[11px] font-semibold opacity-70">
                      {previewIdx + 1}/{images.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIdx((previewIdx + 1) % images.length)
                      }
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-xs flex items-center justify-center cursor-pointer transition"
                    >
                      ›
                    </button>
                  </>
                )}
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeImage(previewIdx)}
                  className="px-3 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-bold cursor-pointer transition"
                >
                  Remove
                </button>
                {/* Close */}
                <button
                  type="button"
                  onClick={() => setPreviewIdx(null)}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white font-bold text-sm flex items-center justify-center cursor-pointer transition"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RefImageUploader;
