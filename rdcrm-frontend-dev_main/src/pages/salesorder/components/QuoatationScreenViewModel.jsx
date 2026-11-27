import React, { useState, useMemo } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import IconButton from "@mui/material/IconButton";
import { capitalizeFirst } from "../../../utils/helper/capitalize";
import { getStatusBadge } from "../../../utils/enquiry/statusHelpers";
import { useDispatch } from "react-redux";
import { downloadFile } from "../../../reducer/standalone_bomReducer";

const QuotationViewModel = ({ order, onClose }) => {
  const dispatch = useDispatch();

  const getFileName = (fileInput) => {
    if (!fileInput) return "";
    let str = "";
    if (typeof fileInput === "object") {
      if (fileInput.file_name) return fileInput.file_name;
      if (fileInput.name) return fileInput.name;
      str = fileInput.file_url || fileInput.url || "";
    } else if (typeof fileInput === "string") {
      str = fileInput;
    }
    if (!str) return "";
    const withoutParams = str.split("?")[0];
    let name = withoutParams.split("---").pop();
    if (name.includes("/")) {
      name = name.split("/").pop();
    }
    return decodeURIComponent(name);
  };

  const handleDownload = async (fileInput, customName) => {
    if (!fileInput) return;
    const url = typeof fileInput === "string" ? fileInput : fileInput.file_url || fileInput.url;
    if (!url) return;
    const fileName = customName || getFileName(fileInput) || "download";

    try {
      // 1. Direct fetch & blob trigger (works directly for signed Cloudflare R2 URLs)
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
        return;
      }
    } catch (err) {
      console.warn("Direct blob download failed, falling back to Redux/backend download:", err);
    }

    // 2. Fallback to Redux /image/download
    try {
      if (dispatch) {
        dispatch(downloadFile(url));
        return;
      }
    } catch (e) {
      console.warn("Redux downloadFile failed, using anchor fallback:", e);
    }

    // 3. Fallback: Browser anchor with target=_blank
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleView = (fileInput) => {
    if (!fileInput) return;
    const url = typeof fileInput === "string" ? fileInput : fileInput.file_url || fileInput.url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Consolidate all uploaded production artwork files (.cdr, .pdf, high-res files)
  const productionFiles = useMemo(() => {
    const list = [];
    const seen = new Set();

    const add = (item) => {
      if (!item) return;
      const url = typeof item === "string" ? item : item.file_url || item.url || item.signed_url;
      if (!url || typeof url !== "string" || seen.has(url)) return;
      seen.add(url);

      const urlClean = url.split("?")[0];
      const ext = urlClean.split(".").pop().toLowerCase();
      let displayName = "";
      if (typeof item === "object" && item.file_name) {
        displayName = item.file_name;
      } else {
        displayName = getFileName(url);
      }

      list.push({
        url,
        name: displayName || `artwork-file.${ext}`,
        type: (typeof item === "object" && item.file_type) ? item.file_type : ext,
      });
    };

    if (Array.isArray(order?.dtp_files)) order.dtp_files.forEach(add);
    if (Array.isArray(order?.dtpFiles)) order.dtpFiles.forEach(add);
    if (Array.isArray(order?.designer_files)) order.designer_files.forEach(add);
    if (Array.isArray(order?.designerFiles)) order.designerFiles.forEach(add);

    if (order?.raw_sub_job) {
      if (Array.isArray(order.raw_sub_job.dtp_files)) order.raw_sub_job.dtp_files.forEach(add);
      if (Array.isArray(order.raw_sub_job.designer_files)) order.raw_sub_job.designer_files.forEach(add);
      if (Array.isArray(order.raw_sub_job.design_files)) order.raw_sub_job.design_files.forEach(add);
    }

    return list;
  }, [order]);


  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold uppercase flex items-center space-x-2">
            <span>{capitalizeFirst(order.product_name || "Sample Order")}</span>
            {/* Show red "Rework PI" if PI files exist */}
            {order.quatation_files?.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                Rework Quotation
              </span>
            )}

          </h2>
          <button
            className="text-2xl text-gray-600 hover:text-black"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-180px)] p-4 space-y-6">

          {/* PRODUCT INFORMATION */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-600 mb-4 flex items-center justify-between">
              <span>Product Information</span>

              {order?.is_client_design && (
                <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  Client Design
                </span>
              )}
            </h3>

            <div className="space-y-3">
              <InfoRow label="Job Number" value={capitalizeFirst(order.job_no)} />
              <InfoRow label="Sub Job Number" value={capitalizeFirst(order.sub_job_no)} />
              <InfoRow label="Reference Number" value={order.enquiry_id?.reference_no || " "} />
              <InfoRow label="Product Name" value={capitalizeFirst(order.product_name)} />
              <InfoRow label="Type" value={capitalizeFirst(order.type || "N/A")} />
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-block px-2 sm:px-3 py-1 rounded text-xs font-semibold uppercase ${getStatusBadge(
                      order.status
                    )}`}
                    style={{ color: "rgb(51, 51, 51)" }}
                  >
                    {capitalizeFirst(order.status)}
                  </span>
                </div>
              </div>

              <InfoRow label="Quantity" value={order.job_quantity ?? order.quantity} />
              <InfoRow label="Delivery Date" value={order.delivery_date} />
              {order.size && <InfoRow label="Size" value={order.size} />}
              {(order.specs || order.material) && (
                <InfoRow label="Specifications / Material" value={order.specs || order.material} />
              )}
            </div>
          </div>

          {/* DESIGN PREVIEW */}
          {(order.approved_design_url || order.image || (Array.isArray(order.images) && order.images.length > 0)) && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-600 mb-3">
                Approved Design Preview
              </h3>
              <div className="flex items-center gap-4">
                <img
                  src={order.approved_design_url || order.image || order.images?.[0]}
                  alt="Approved Design"
                  className="w-32 h-32 rounded-lg object-contain border border-gray-200 bg-gray-50"
                  onError={(e) => {
                    if (order.reference_image_url && e.currentTarget.src !== order.reference_image_url) {
                      e.currentTarget.src = order.reference_image_url;
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* APPROVED PRODUCTION ARTWORK FILES (.CDR, .PDF, ETC.) */}
          {productionFiles.length > 0 && (
            <div className="bg-emerald-50/40 border-2 border-emerald-300 rounded-xl p-4 space-y-3 shadow-2xs">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-emerald-950">
                    Approved Production Artwork Files
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[11px] font-extrabold border border-emerald-300">
                    {productionFiles.length} File{productionFiles.length > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-xs text-emerald-800 font-medium hidden sm:inline">
                  Uploaded by Designer (.cdr / .pdf)
                </span>
              </div>

              <div className="space-y-2">
                {productionFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-gray-200 hover:border-emerald-400 p-3 rounded-lg shadow-2xs transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          file.type === "cdr"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : file.type === "pdf"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {file.type}
                      </span>
                      <span
                        className="font-medium text-xs text-gray-800 truncate"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleView(file.url)}
                        className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50 flex items-center gap-1.5 transition cursor-pointer"
                        title="View file in new tab"
                      >
                        <VisibilityIcon style={{ fontSize: 16 }} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(file.url, file.name)}
                        className="px-3 py-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="Download file directly"
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CLIENT INFORMATION */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">
              Client Information
            </h3>
            <div className="space-y-3">
              <InfoRow label="Client Name" value={order.client_name} />
              <InfoRow label="Email" value={order.email?.join(", ")} />
              <InfoRow label="Phone" value={order.mobile_no || "N/A"} />
              <InfoRow label="WhatsApp" value={order.wp_number?.join(", ")} />
            </div>
          </div>





          {/* Quotation FILES */}
          {order.quatation_files?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-blue-600">
                  Quotation Files
                </h3>
              </div>

              <div className="space-y-3">
                {order.quatation_files.map((file, idx) => (
                  <div key={idx} className="flex justify-between border border-gray-200 p-2 rounded">
                    <span className="text-gray-700">{getFileName(file)}</span>
                    <div className="flex space-x-2 items-center">
                      <IconButton
                        onClick={() => window.open(file, "_blank")}
                        size="small"
                      >
                        <VisibilityIcon className="text-blue-600" />
                      </IconButton>
                      <button
                        onClick={() => handleDownload(file)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors font-primary border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-2"
                      >
                        <i className="fa-solid fa-download"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {order.is_bom_verified_remarks && (
                <p className="mt-2 text-gray-700 italic">
                  Quotation Remarks: {order.is_bom_verified_remarks}
                </p>
              )}
            </div>
          )}


        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-200 p-4 flex justify-end">
          <button
            className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>


    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-gray-600">{label}</span>
    <span className="font-medium text-gray-800 max-w-[60%] text-right break-words">
      {Array.isArray(value) ? value.join(", ") : value || "N/A"}
    </span>
  </div>
);

export default QuotationViewModel;
