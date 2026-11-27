import React, { useState, useEffect } from "react";
import { axiosInstance } from "../../../../utils/url/config";
import { inr } from "../../utils/helpers";
import { toast } from "react-toastify";

/**
 * QuotationDeskIntegration.jsx
 * Independent Quotation Desk for Enquiry Flow Integration:
 * - Lists sub-jobs awaiting BOM costing without requiring separate Sales Order forms.
 * - Simple, robust BOM costing calculator: Material + Process + Packaging + Margin%.
 * - Syncs ONLY the single Unit Rate (₹/pc for ordered qty), Sample Rate, and Artwork Fee to the enquiry.
 * - 100% isolated: Does NOT touch or affect legacy `/quotation` desk.
 */
const QuotationDeskIntegration = ({ onOpenJob, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "completed" | "all"
  const [searchQuery, setSearchQuery] = useState("");

  // Costing Modal state
  const [selectedSubJob, setSelectedSubJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [materialCost, setMaterialCost] = useState("");
  const [processCost, setProcessCost] = useState("");
  const [packagingCost, setPackagingCost] = useState("");
  const [marginPercent, setMarginPercent] = useState(35);
  const [artworkFee, setArtworkFee] = useState(1500);
  const [sampleMarkup, setSampleMarkup] = useState(500);
  const [costingNotes, setCostingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPendingCostings = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/enquiry-flow-integration/pending-costings?status=pending");
      if (res.data?.success) {
        setJobs(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching pending costings:", err);
      toast.error("Failed to fetch pending costing sub-jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCostings();
  }, []);

  // Flatten sub-jobs across all jobs
  const allSubJobs = jobs.flatMap((job) => {
    const sjs = Array.isArray(job.sub_jobs) ? job.sub_jobs : [];
    return sjs.map((sj) => ({
      ...sj,
      jobId: job._id,
      enquiryNo: job.enquiry_no,
      clientName: job.customer_id?.name || job.customer_id?.company_name || "Client",
      fullJob: job,
    }));
  });

  const filteredSubJobs = allSubJobs.filter((sj) => {
    if (activeTab === "pending" && sj.costing_status === "completed") return false;
    if (activeTab === "completed" && sj.costing_status !== "completed") return false;
    if (sj.is_dropped) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        sj.sub_job_no?.toLowerCase().includes(q) ||
        sj.product_name?.toLowerCase().includes(q) ||
        sj.clientName?.toLowerCase().includes(q) ||
        sj.enquiryNo?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate live BOM rate
  const mat = Number(materialCost) || 0;
  const proc = Number(processCost) || 0;
  const pack = Number(packagingCost) || 0;
  const baseCost = mat + proc + pack;
  const marginAmt = Math.round(baseCost * (Number(marginPercent || 0) / 100));
  const calculatedUnitRate = Math.round(baseCost + marginAmt);
  const calculatedSampleRate = calculatedUnitRate + Number(sampleMarkup || 0);

  const otherSubJobsInJob = (selectedJob?.sub_jobs || []).filter(
    (s) => s.sub_job_no !== selectedSubJob?.sub_job_no && !s.is_dropped
  );
  const otherSubJobWithArtwork = otherSubJobsInJob.find((s) => Number(s.artwork_charge) > 0);

  const handleOpenCostingModal = (sj) => {
    setSelectedSubJob(sj);
    setSelectedJob(sj.fullJob);
    setMaterialCost("");
    setProcessCost("");
    setPackagingCost("");
    setMarginPercent(35);
    setSampleMarkup(500);
    setCostingNotes("");

    // Check if another sub-job in this enquiry already has an artwork charge applied
    const otherSubJobs = (sj.fullJob?.sub_jobs || []).filter(
      (s) => s.sub_job_no !== sj.sub_job_no && !s.is_dropped
    );
    const otherWithArtwork = otherSubJobs.find((s) => Number(s.artwork_charge) > 0);

    if (Number(sj.artwork_charge) > 0) {
      setArtworkFee(Number(sj.artwork_charge));
    } else if (otherWithArtwork) {
      // 1-time fee already applied to another sub-job, default to 0 for this one
      setArtworkFee(0);
    } else {
      // First sub-job in enquiry to be costed: default 1500
      setArtworkFee(1500);
    }

    // If already has target_rate, pre-fill
    if (sj.target_rate > 0) {
      setMaterialCost(Math.round(sj.target_rate * 0.4));
      setProcessCost(Math.round(sj.target_rate * 0.25));
      setPackagingCost(Math.round(sj.target_rate * 0.05));
    }
  };

  const handleSubmitRate = async () => {
    if (!selectedSubJob || !selectedJob) return;
    if (calculatedUnitRate <= 0) {
      toast.warning("Please enter valid costing items to calculate unit rate");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        subJobNo: selectedSubJob.sub_job_no,
        unit_rate: calculatedUnitRate,
        sample_rate: calculatedSampleRate,
        artwork_charge: Number(artworkFee) || 0,
        notes: `BOM: Mat ₹${mat}, Proc ₹${proc}, Pack ₹${pack}, Margin ${marginPercent}%. ${costingNotes}`.trim(),
      };

      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${selectedJob._id}/submit-bom-rate`,
        payload
      );

      if (res.data?.success) {
        toast.success(`Unit Rate ₹${calculatedUnitRate}/pc synced to ${selectedSubJob.sub_job_no}!`);
        setSelectedSubJob(null);
        fetchPendingCostings();
      }
    } catch (err) {
      console.error("Error submitting BOM rate:", err);
      toast.error(err.response?.data?.message || "Failed to submit BOM rate");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📐</span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Quotation & Costing Desk (Integration)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
              Direct Sub-Job Costing
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Calculate material, process & margin directly for enquiry sub-jobs. Syncs single unit rate for ordered qty without separate sales orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchPendingCostings}
            className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-xl text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              Back to Board
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="max-w-7xl mx-auto mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "pending"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Pending Costing ({allSubJobs.filter((s) => s.costing_status !== "completed" && !s.is_dropped).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "completed"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Costing Completed ({allSubJobs.filter((s) => s.costing_status === "completed" && !s.is_dropped).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            All Sub-Jobs ({allSubJobs.filter((s) => !s.is_dropped).length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sub-job, product, client..."
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Sub-Jobs Costing Queue Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-500">
            <span className="animate-spin inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mb-2"></span>
            <p>Loading pending costing sub-jobs...</p>
          </div>
        ) : filteredSubJobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500 space-y-1">
            <span className="text-3xl block mb-2">🎉</span>
            <p className="font-bold text-gray-700">No sub-jobs in this queue!</p>
            <p className="text-[11px] text-gray-400">All requested sub-jobs have been costed or none are currently pending.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[10px] tracking-wider bg-gray-50/70">
                  <th className="py-3 px-4">Sub-Job No</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4 text-right">Ordered Qty</th>
                  <th className="py-3 px-4 text-right">Current Unit Rate</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubJobs.map((sj) => {
                  const isCosted = sj.costing_status === "completed";
                  const isPending = sj.costing_status === "pending";

                  return (
                    <tr key={sj.sub_job_no} className="hover:bg-gray-50/50 transition">
                      {/* Sub-Job No */}
                      <td className="py-3.5 px-4 font-mono font-black text-indigo-700">
                        {sj.sub_job_no}
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {sj.clientName}
                        <span className="block text-[10px] font-normal text-gray-400">{sj.enquiryNo}</span>
                      </td>

                      {/* Product Details */}
                      <td className="py-3.5 px-4 text-gray-800">
                        <div className="font-bold">{sj.theme || sj.product_name || "Custom Trophy"}</div>
                        <div className="text-[10px] text-gray-500">
                          {sj.size} in · {sj.material || "MDF"}
                        </div>
                      </td>

                      {/* Ordered Qty */}
                      <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                        {sj.quantity || 50} pcs
                      </td>

                      {/* Current Unit Rate */}
                      <td className="py-3.5 px-4 text-right">
                        {sj.target_rate > 0 ? (
                          <span className="font-extrabold text-sm text-gray-900">
                            ₹{sj.target_rate.toLocaleString("en-IN")}/pc
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isCosted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                            ✓ Costing Completed
                          </span>
                        ) : isPending ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                            ⏳ In Costing
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            Ready for Costing
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenCostingModal(sj)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            {isCosted ? "Recost / Edit" : "Calculate BOM"}
                          </button>
                          {onOpenJob && (
                            <button
                              type="button"
                              onClick={() => onOpenJob(sj.fullJob)}
                              className="px-2.5 py-1.5 border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-600 transition cursor-pointer"
                              title="Open in Enquiry Flow"
                            >
                              Open Job ↗
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOM Costing Modal */}
      {selectedSubJob && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 fade">
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/50 border-b border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">BOM Costing & Margin Entry</span>
                <h3 className="font-extrabold text-sm text-gray-900">
                  {selectedSubJob.sub_job_no} · {selectedSubJob.product_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubJob(null)}
                className="w-7 h-7 rounded-full bg-white/80 hover:bg-white text-gray-400 hover:text-gray-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl flex justify-between items-center text-indigo-950">
                <div>
                  <span className="font-bold block">Client: {selectedSubJob.clientName}</span>
                  <span className="text-[11px] text-indigo-700">
                    Ordered Qty: <b>{selectedSubJob.quantity || 50} pcs</b> · Size: <b>{selectedSubJob.size} in</b>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 font-bold text-[10px]">
                  Single Unit Rate Sync
                </span>
              </div>

              {/* Approved Design & Artwork Files */}
              {(selectedSubJob.approved_design_url || (Array.isArray(selectedSubJob.dtp_files) && selectedSubJob.dtp_files.length > 0) || (Array.isArray(selectedSubJob.designer_files) && selectedSubJob.designer_files.length > 0)) && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <span className="font-bold text-gray-800 block text-[11px]">
                    Approved Design Preview & Production Artwork:
                  </span>
                  <div className="flex items-center gap-3">
                    {selectedSubJob.approved_design_url && (
                      <img
                        src={selectedSubJob.approved_design_url}
                        alt="Approved Design"
                        className="w-16 h-16 rounded-lg object-contain border border-gray-200 bg-white shadow-2xs shrink-0"
                      />
                    )}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {(selectedSubJob.dtp_files || []).map((f, fIdx) => (
                        <div key={fIdx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-gray-200">
                          <span className="truncate pr-2 font-medium text-gray-800">{f.file_name || f.file_url?.split("/").pop()}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={f.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-bold text-[10px] transition"
                            >
                              View ↗
                            </a>
                            <a
                              href={f.file_url}
                              download={f.file_name || "artwork"}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] transition"
                            >
                              Download ↓
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Raw Materials (₹)</label>
                  <input
                    type="number"
                    value={materialCost}
                    onChange={(e) => setMaterialCost(e.target.value)}
                    placeholder="e.g. 420"
                    className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Machining / Fab (₹)</label>
                  <input
                    type="number"
                    value={processCost}
                    onChange={(e) => setProcessCost(e.target.value)}
                    placeholder="e.g. 180"
                    className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Packaging (₹)</label>
                  <input
                    type="number"
                    value={packagingCost}
                    onChange={(e) => setPackagingCost(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              {/* Margin & Markup */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Margin (%)</label>
                  <input
                    type="number"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(e.target.value)}
                    placeholder="35"
                    className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Sample Markup (₹)</label>
                  <input
                    type="number"
                    value={sampleMarkup}
                    onChange={(e) => setSampleMarkup(e.target.value)}
                    placeholder="500"
                    className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-700 font-medium">Artwork Fee (₹)</label>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      1-Time Fee Per Enquiry
                    </span>
                  </div>
                  <input
                    type="number"
                    value={artworkFee}
                    onChange={(e) => setArtworkFee(e.target.value)}
                    placeholder="1500"
                    className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {otherSubJobWithArtwork && (
                    <p className="text-[10px] text-amber-700 mt-1 leading-tight">
                      Note: ₹{otherSubJobWithArtwork.artwork_charge} 1-time fee is already applied to {otherSubJobWithArtwork.sub_job_no}.
                    </p>
                  )}
                </div>
              </div>

              {/* Live Calculation Preview */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Base Unit Cost:</span>
                  <span className="font-semibold text-gray-900">₹{baseCost}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Margin ({marginPercent}%):</span>
                  <span className="font-semibold text-emerald-700">+ ₹{marginAmt}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Calculated Unit Rate (Ordered Qty):</span>
                  <span className="font-black text-lg text-indigo-900">₹{calculatedUnitRate} / pc</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-gray-500">
                  <span>Sample Rate: <b>₹{calculatedSampleRate} / pc</b></span>
                  <span>Artwork Charge: <b>₹{artworkFee} one-time</b></span>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Costing Notes (Optional)</label>
                <input
                  type="text"
                  value={costingNotes}
                  onChange={(e) => setCostingNotes(e.target.value)}
                  placeholder="e.g. UV print on 8mm acrylic + 12mm MDF base"
                  className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedSubJob(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || calculatedUnitRate <= 0}
                onClick={handleSubmitRate}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Rate to Enquiry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationDeskIntegration;

