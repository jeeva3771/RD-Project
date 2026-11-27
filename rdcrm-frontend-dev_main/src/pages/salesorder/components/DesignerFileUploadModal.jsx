import React, { useState, useEffect } from "react";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { axiosInstance } from "../../../utils/url/config";

const DesignerFileUploadModal = ({
  open,
  files,
  onClose,
  onFileChange,
  onRemoveFile,
  onSubmit,
  loading,
  order,
}) => {
  const [enquiryJob, setEnquiryJob] = useState(null);
  const [loadingEnq, setLoadingEnq] = useState(false);

  useEffect(() => {
    if (!open || !order) {
      setEnquiryJob(null);
      return;
    }

    const targetId =
      order.enquiry_flow_id ||
      order.enquiry_id?._id ||
      (typeof order.enquiry_id === "string" ? order.enquiry_id : "") ||
      order.sub_job_no ||
      order.job_no ||
      order.enquiry_id?.reference_no ||
      "";

    if (!targetId) return;

    let isMounted = true;
    setLoadingEnq(true);

    // Call GET /enquiry-flow-integration/:id to fetch full enquiry job document with complete financials and rates
    axiosInstance
      .get(`/enquiry-flow-integration/${encodeURIComponent(targetId)}`)
      .then((res) => {
        if (isMounted && res.data?.success && res.data.data) {
          setEnquiryJob(res.data.data);
        }
      })
      .catch((err) => {
        // Fallback search query if direct ID fetch failed
        axiosInstance
          .get("/enquiry-flow-integration", {
            params: { search: targetId, limit: 1 },
          })
          .then((fallbackRes) => {
            if (isMounted && fallbackRes.data?.success && Array.isArray(fallbackRes.data.data) && fallbackRes.data.data.length > 0) {
              setEnquiryJob(fallbackRes.data.data[0]);
            }
          })
          .catch((fErr) => {
            console.warn("Could not fetch integration enquiry job for upload modal:", fErr);
          });
      })
      .finally(() => {
        if (isMounted) setLoadingEnq(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, order]);

  if (!open) return null;

  // Derive live financial figures
  const enqPiComm = enquiryJob?.wizard_state?.pi?.commercials || {};
  const enqFin = enquiryJob?.financials || {};
  const enqSubJobs = Array.isArray(enquiryJob?.sub_jobs) ? enquiryJob.sub_jobs.filter((sj) => !sj.is_dropped) : [];

  // Calculate sample charges
  const isPreProductionSample = Boolean(
    enquiryJob?.order_mode?.charge === "foc" ||
    order?.is_pre_production ||
    order?.charge === "foc"
  );

  const sampleRate = Number(
    enqPiComm.sampleRate ||
    enquiryJob?.order_mode?.sample_rate ||
    order?.sample_rate ||
    order?.sampleRate ||
    (enqSubJobs.length > 0 ? enqSubJobs[0]?.sample_rate : 0) ||
    0
  );

  const sampleQty = Number(
    enqPiComm.sampleQty ||
    enquiryJob?.order_mode?.sample_qty ||
    order?.sample_qty ||
    order?.sampleQty ||
    1
  );

  const hasCompletedSample = Boolean(
    !isPreProductionSample &&
    (
      sampleRate > 0 ||
      enqPiComm.sampleCharge > 0 ||
      enqFin.sample_charges > 0 ||
      enquiryJob?.order_mode?.charge === "charge" ||
      enquiryJob?.order_mode?.charge === "adjust" ||
      enquiryJob?.sample_rates_approved ||
      enquiryJob?.wizard_state?.sampleConfirmed ||
      order?.sample_order_id ||
      (order?.order_type === "sample" && order?.type === "production")
    )
  );

  const sampleChargeTotal = hasCompletedSample
    ? Number(enqPiComm.sampleCharge || enqFin.sample_charges || (sampleRate * sampleQty) || 0)
    : 0;

  // Items total calculation
  let bulkItemsTotal = 0;
  if (enqSubJobs.length > 0) {
    bulkItemsTotal = enqSubJobs.reduce((sum, sj) => {
      const q = Number(sj.quantity || sj.qty || order?.job_quantity || 1);
      const r = Number(sj.target_rate || sj.unit_rate || sj.calculated_cost || order?.unit_price || order?.finalUnitPrice || 0);
      return sum + (q * r);
    }, 0);
  } else {
    const q = Number(order?.job_quantity || order?.quantity || 1);
    const r = Number(order?.finalUnitPrice || order?.target_rate || order?.unit_price || order?.rate || 0);
    bulkItemsTotal = q * r;
  }

  const taxableSubtotal = Number(
    enqPiComm.taxableValue ||
    enqFin.subtotal ||
    (bulkItemsTotal + sampleChargeTotal) ||
    0
  );

  const gstPercent = Number(enqPiComm.prodGst || enqFin.gst_rate || 18);
  const gstAmount = Number(
    ((enqPiComm.cgstAmt || 0) + (enqPiComm.sgstAmt || 0)) ||
    enqFin.gst_amount ||
    Math.round(taxableSubtotal * (gstPercent / 100)) ||
    0
  );

  const invoiceTotal = Number(
    enqPiComm.invoiceTotal ||
    enqFin.total ||
    (taxableSubtotal + gstAmount) ||
    0
  );

  const advanceDue = Number(
    enqPiComm.advanceDue !== undefined
      ? enqPiComm.advanceDue
      : (enqFin.advance_required !== undefined
          ? enqFin.advance_required
          : Math.round(invoiceTotal * 0.5))
  );

  const balanceDue = Number(
    enqPiComm.balanceDue !== undefined
      ? enqPiComm.balanceDue
      : (enqFin.balance_due !== undefined
          ? enqFin.balance_due
          : Math.max(0, invoiceTotal - advanceDue))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto animate-fadeIn">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UploadFileIcon className="text-indigo-600" />
            <span>Upload Proforma Invoice (PI)</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition"
            disabled={loading}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Financial & Order Details Card (Above File Upload) */}
        {order && (
          <div className="mb-4 bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex justify-between items-start pb-2 border-b border-slate-200">
              <div>
                <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {order.sub_job_no || order.job_no || "RD-ORDER"}
                </span>
                <span className="font-extrabold text-gray-900 ml-2">
                  {order.client_name || order.enquiry_id?.name || "Client"}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 font-semibold">
                {order.product_name || order.enquiry_id?.product_name || "Custom Trophy"}
              </div>
            </div>

            {/* Financial Breakdown Table / Rows */}
            <div className="space-y-1.5">
              {/* Sub-jobs / Products items */}
              {enqSubJobs.length > 0 ? (
                enqSubJobs.map((sj, idx) => {
                  const itQty = Number(sj.quantity || sj.qty || order.job_quantity || order.sample_salesorder_id?.job_quantity || 1);
                  const itRate = Number(sj.target_rate || sj.unit_rate || sj.calculated_cost || order.unit_price || order.finalUnitPrice || order.sample_salesorder_id?.unit_price || 0);
                  const itTotal = Number(sj.line_total || (itQty * itRate));
                  return (
                    <div key={sj.sub_job_no || idx} className="flex justify-between items-center text-gray-700">
                      <span className="text-[11px]">
                        • {sj.sub_job_no || `Item ${idx + 1}`} ({sj.theme || sj.product_name || order.product_name || "Trophy"}): {itQty} pcs @ ₹{itRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="font-semibold text-gray-900">
                        ₹{itTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex justify-between items-center text-gray-700">
                  <span className="text-[11px]">
                    • Bulk run: {Number(order.job_quantity || order.sample_salesorder_id?.job_quantity || 1)} pcs @ ₹{Number(order.finalUnitPrice || order.target_rate || order.unit_price || order.sample_salesorder_id?.unit_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="font-semibold text-gray-900">
                    ₹{Number(bulkItemsTotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Sample Charge Row */}
              {hasCompletedSample && sampleChargeTotal > 0 && (
                <div className="flex justify-between items-center text-amber-900 bg-amber-50/80 px-2 py-1 rounded border border-amber-200 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>🏆</span>
                    <span>Sample Charges ({sampleQty} pc{sampleQty > 1 ? "s" : ""} × ₹{sampleRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):</span>
                  </span>
                  <span className="font-extrabold">₹{sampleChargeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Taxable Subtotal */}
              <div className="flex justify-between items-center text-gray-600 pt-1.5 border-t border-slate-200">
                <span className="font-medium">Taxable Subtotal:</span>
                <span className="font-bold text-gray-900">₹{taxableSubtotal.toLocaleString("en-IN")}</span>
              </div>

              {/* GST */}
              <div className="flex justify-between items-center text-gray-600">
                <span className="font-medium">GST ({gstPercent}%):</span>
                <span className="font-semibold text-gray-800">₹{gstAmount.toLocaleString("en-IN")}</span>
              </div>

              {/* Invoice Total */}
              <div className="flex justify-between items-center text-indigo-950 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200 font-extrabold text-sm">
                <span>Total Invoice Value:</span>
                <span>₹{invoiceTotal.toLocaleString("en-IN")}</span>
              </div>

              {/* Advance & Balance */}
              <div className="flex justify-between items-center text-[11px] text-gray-500 pt-0.5">
                <span>Advance Required: <b className="text-emerald-700">₹{advanceDue.toLocaleString("en-IN")}</b></span>
                <span>Balance Due: <b className="text-gray-800">₹{balanceDue.toLocaleString("en-IN")}</b></span>
              </div>
            </div>
          </div>
        )}

        {/* File Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 block">
            Attach Official PI Document:
          </label>
          <label className="flex items-center gap-2.5 px-4 py-3 border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl cursor-pointer hover:bg-gray-50/80 transition">
            <UploadFileIcon className="text-indigo-600" />
            <span className="text-xs font-semibold text-gray-600">Click to select PI files (.pdf, .cdr, images)</span>
            <input type="file" multiple accept=".cdr,.pdf,application/pdf,image/*" onChange={onFileChange} className="hidden" disabled={loading} />
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-3 max-h-36 overflow-y-auto space-y-1.5">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex justify-between items-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              >
                <span className="flex items-center gap-2 truncate text-gray-700 font-medium">
                  <UploadFileIcon fontSize="small" className="text-gray-400" />
                  <span className="truncate">{file.name}</span>
                </span>

                <button
                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"
                  onClick={() => onRemoveFile(index)}
                  disabled={loading}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-50 transition"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || files.length === 0}
            className={`px-5 py-2 text-white font-bold text-xs rounded-xl transition shadow-sm ${
              loading || files.length === 0
                ? "bg-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Uploading..." : "Submit PI File"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignerFileUploadModal;
