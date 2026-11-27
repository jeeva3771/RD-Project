import React, { useState, useRef } from "react";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";

const ACCEPTED_DOCS =
  ".pdf,.xlsx,.xls,.csv,.doc,.docx,.zip,.rar,.ai,.eps,.cdr,.png,.jpg,.jpeg";

const getFileExt = (fileName = "") => {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "file";
};

const getBadgeConfig = (ext) => {
  switch (ext) {
    case "xlsx":
    case "xls":
    case "csv":
      return { icon: "📊", label: "Excel", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case "pdf":
      return { icon: "📕", label: "PDF", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
    case "doc":
    case "docx":
      return { icon: "📘", label: "Word", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    case "zip":
    case "rar":
      return { icon: "📦", label: "Archive", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };
    case "ai":
    case "eps":
    case "cdr":
      return { icon: "🎨", label: "Vector", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    default:
      return { icon: "📎", label: ext.toUpperCase(), bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
  }
};

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

/**
 * AdditionalFilesUploader Component
 * Allows uploading spreadsheets (e.g. awardees list), PDFs, documents, or vector assets.
 * Uploads directly to Cloudflare R2 under folderType: "additional_files" with subJobNo scoping.
 */
const AdditionalFilesUploader = ({
  files = [],
  onChange = () => {},
  clientId = "",
  clientName = "",
  enquiryNo = "",
  subJobNo = "",
  onImmediateSave = null,
}) => {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const arrayFiles = Array.from(fileList);

    setIsUploading(true);
    const newlyUploaded = [];
    let successCount = 0;
    let failCount = 0;

    for (const file of arrayFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", clientId || "");
        formData.append("clientName", clientName || "");
        formData.append("enquiryNo", enquiryNo || "RD_ENQUIRY");
        formData.append("folderType", "additional_files");
        if (subJobNo) formData.append("subJobNo", subJobNo);

        const res = await axiosInstance.post(
          "/enquiry-flow-integration/upload",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (res.data?.success && res.data?.data) {
          const r2Data = res.data.data;
          const ext = getFileExt(file.name);
          newlyUploaded.push({
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            url: r2Data.signed_url || r2Data.file_url,
            file_url: r2Data.file_url,
            signed_url: r2Data.signed_url,
            name: file.name,
            file_name: r2Data.file_name || file.name,
            file_type: ext,
            size: file.size,
            folder_path: r2Data.folder_path,
            uploaded_at: new Date().toISOString(),
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error("Additional file upload error:", err);
        failCount++;
      }
    }

    setIsUploading(false);

    if (newlyUploaded.length > 0) {
      const nextFiles = [...files, ...newlyUploaded];
      onChange(nextFiles, true);
      if (typeof onImmediateSave === "function") {
        try { onImmediateSave(nextFiles); } catch (_e) { /* ignore */ }
      }
      toast.success(
        successCount === 1
          ? "Additional document uploaded successfully!"
          : `${successCount} documents uploaded!`
      );
    }

    if (failCount > 0) {
      toast.error(`${failCount} file(s) failed to upload. Please try again.`);
    }
  };

  const removeFile = (idx) => {
    const nextFiles = files.filter((_, i) => i !== idx);
    onChange(nextFiles, true);
    if (typeof onImmediateSave === "function") {
      try { onImmediateSave(nextFiles); } catch (_e) { /* ignore */ }
    }
    toast.info("Document removed");
  };

  return (
    <div className="space-y-3">
      {/* Files List / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {files.map((file, idx) => {
          const ext = file.file_type || getFileExt(file.name || file.file_name);
          const badge = getBadgeConfig(ext);
          const downloadUrl = file.signed_url || file.file_url || file.url;

          return (
            <div
              key={file.id || idx}
              className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs flex items-center justify-between gap-2.5 transition hover:border-indigo-200"
            >
              <div
                className={`w-10 h-10 rounded-lg ${badge.bg} ${badge.border} border flex items-center justify-center text-lg flex-shrink-0`}
              >
                <span>{badge.icon}</span>
              </div>

              <div className="flex-1 min-w-0">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-xs text-gray-800 hover:text-indigo-600 truncate block transition"
                  title="Click to view or download file"
                >
                  {file.name || file.file_name || `File ${idx + 1}`}
                </a>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                  <span className={`px-1.5 py-0.2 rounded font-semibold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  <span>·</span>
                  <span>{formatSize(file.size)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition"
                    title="Open / Download"
                  >
                    <span>↗</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                  title="Remove file"
                >
                  <span className="text-xs font-bold">✕</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Upload Button */}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_DOCS}
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
            className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 transition flex items-center justify-center gap-2 cursor-pointer text-gray-600 hover:text-indigo-600 disabled:opacity-50 min-h-[58px]"
          >
            {isUploading ? (
              <span className="text-xs font-bold text-indigo-600 animate-pulse">
                Uploading file(s)...
              </span>
            ) : (
              <>
                <span className="text-base">📎</span>
                <span className="text-xs font-bold">+ Upload Additional Files (Excel, PDF, Docs)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <p className="text-[11px] text-gray-400">
          {files.length} document{files.length > 1 ? "s" : ""} attached · Click on file name or ↗ to open
        </p>
      )}
    </div>
  );
};

export default AdditionalFilesUploader;
