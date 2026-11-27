import React, { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LayersIcon from "@mui/icons-material/Layers";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CircularProgress from "@mui/material/CircularProgress";
import { axiosInstance } from "../../utils/url/config";
import DesignerDueCountdownBadge from "../components/DesignerDueCountdownBadge";

const DesignerEnquiryDetailModal = ({
  enquiry,
  jobId,
  onClose,
  onOpenUploadDesign,
}) => {
  const [jobData, setJobData] = useState(enquiry?.rawJob || null);
  const [loading, setLoading] = useState(false);

  // Fetch full details if sub_jobs or deeper client details are missing
  useEffect(() => {
    const idToFetch = jobId || enquiry?._id || enquiry?.rawJob?._id;
    if (!idToFetch) return;

    // If sub_jobs already exist in rawJob, use it, but fetch fresh data in background
    let isMounted = true;
    const fetchFullDetails = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/enquiry-flow-integration/${idToFetch}`);
        if (res.data?.success && isMounted) {
          setJobData(res.data.data);
        }
      } catch (err) {
        console.error("Error fetching enquiry job details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFullDetails();
    return () => {
      isMounted = false;
    };
  }, [jobId, enquiry]);

  const targetJob = jobData || enquiry?.rawJob || enquiry || {};
  const customer = targetJob.customer_id || {};
  const theAsk = targetJob.the_ask || targetJob.wizard_state?.the_ask || {};
  const theBrief = targetJob.the_brief || targetJob.wizard_state?.the_brief || {};
  const subJobs = targetJob.sub_jobs || [];

  const enquiryNo = targetJob.enquiry_no || enquiry?.job_no || "RD";
  const clientName = customer.name || enquiry?.name || "Client";
  const contactPerson = customer.contact_person || "—";
  const mobile = customer.mobile_no || customer.mobile || "—";
  const email = customer.email || "—";
  const city = theAsk.destination_city || customer.address?.city || customer.city || "—";

  const productName = theAsk.product_name || theAsk.theme || enquiry?.product_name || "Custom Trophy";
  const totalQty = theAsk.quantity || enquiry?.product_quantity || "—";
  const size = theAsk.size || "—";
  const material = theAsk.material || "—";
  const budget = theAsk.approx_budget ? `₹${theAsk.approx_budget}` : "—";
  const deliveryDate = theAsk.delivery_date || theAsk.needed_by_date || targetJob.delivery_date || enquiry?.delivery_date || "—";
  const eventDate = theAsk.event_date || targetJob.event_date || "—";
  const occasion = theAsk.occasion || "—";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <EmojiEventsIcon className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wide">{enquiryNo}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  {theBrief.design_status || enquiry?.design_status || "Pending"}
                </span>
                <DesignerDueCountdownBadge enquiry={{ ...enquiry, rawJob: targetJob, ...targetJob }} />
              </div>
              <p className="text-xs text-slate-300">Enquiry Details & Trophy Overview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !jobData ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CircularProgress size={32} />
              <p className="text-sm mt-3 font-medium">Loading enquiry details...</p>
            </div>
          ) : (
            <>
              {/* 1. Client Details Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm uppercase tracking-wider">
                  <PersonIcon fontSize="small" className="text-indigo-600" />
                  <span>Client Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Client / Company Name</span>
                    <span className="font-semibold text-slate-800 text-base">{clientName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Contact Person</span>
                    <span className="font-semibold text-slate-800">{contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneIcon fontSize="small" className="text-slate-400" />
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">Mobile</span>
                      <span className="font-semibold text-slate-800">{mobile}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <EmailIcon fontSize="small" className="text-slate-400" />
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">Email</span>
                      <span className="font-semibold text-slate-800 truncate block max-w-[360px]">{email}</span>
                    </div>
                  </div>
                  {city !== "—" && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <LocationOnIcon fontSize="small" className="text-slate-400" />
                      <div>
                        <span className="text-xs text-slate-500 font-medium block">Destination City</span>
                        <span className="font-semibold text-slate-800">{city}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Trophy Details Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm uppercase tracking-wider">
                  <EmojiEventsIcon fontSize="small" className="text-amber-500" />
                  <span>Trophy Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-500 font-medium block">Product Name</span>
                    <span className="font-bold text-slate-800 truncate block" title={productName}>
                      {productName}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-500 font-medium block">Total Quantity</span>
                    <span className="font-bold text-indigo-600 text-base">{totalQty}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-500 font-medium block">Size / Height</span>
                    <span className="font-bold text-slate-800">{size}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-500 font-medium block">Material</span>
                    <span className="font-bold text-slate-800">{material}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <CalendarTodayIcon fontSize="small" className="text-indigo-500" />
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">Delivery Date</span>
                      <span className="font-semibold text-slate-800">{deliveryDate}</span>
                    </div>
                  </div>
                  {eventDate !== "—" && (
                    <div className="flex items-center gap-2">
                      <CalendarTodayIcon fontSize="small" className="text-amber-500" />
                      <div>
                        <span className="text-xs text-slate-500 font-medium block">Event Date</span>
                        <span className="font-semibold text-slate-800">{eventDate}</span>
                      </div>
                    </div>
                  )}
                  {budget !== "—" && (
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">Approx Budget</span>
                      <span className="font-semibold text-emerald-600">{budget}</span>
                    </div>
                  )}
                  {occasion !== "—" && (
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">Occasion</span>
                      <span className="font-semibold text-slate-800">{occasion}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Sub-Jobs / Multi-Trophy Variations (if present) */}
              {Array.isArray(subJobs) && subJobs.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold text-sm uppercase tracking-wider">
                    <LayersIcon fontSize="small" className="text-indigo-600" />
                    <span>Trophy Variations & Sub-Jobs ({subJobs.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200/70 text-slate-700 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 rounded-l-lg">Sub Job #</th>
                          <th className="py-2.5 px-3">Trophy Name / Group</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3">Material</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-center rounded-r-lg">Design Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {subJobs.map((sj, idx) => (
                          <tr key={sj.sub_job_no || idx} className={`transition ${sj.is_dropped ? 'bg-rose-50/40 opacity-60' : 'hover:bg-slate-100/60'}`}>
                            <td className="py-2 px-3 font-bold text-indigo-700">
                              <span className={sj.is_dropped ? 'line-through text-slate-400' : ''}>{sj.sub_job_no}</span>
                              {sj.is_dropped && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-semibold uppercase">Dropped</span>
                              )}
                              {sj.is_on_hold && !sj.is_dropped && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-semibold uppercase">Hold</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {sj.product_name || sj.theme || `Group ${sj.design_group || "A"}`}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{sj.size || "—"}</td>
                            <td className="py-2 px-3 text-slate-600">{sj.material || "—"}</td>
                            <td className="py-2 px-3 font-bold text-slate-800 text-right">{sj.quantity || "—"}</td>
                            <td className="py-2 px-3 text-center">
                              {sj.design_status === "approved" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                  ✓ Approved
                                </span>
                              ) : sj.design_status === "rework" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                                  ⚠️ Rework
                                </span>
                              ) : sj.design_status === "uploaded" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                                  Uploaded
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                                  {sj.design_status || "Pending"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
          >
            Close
          </button>
          {onOpenUploadDesign && (
            <button
              onClick={() => {
                onClose();
                onOpenUploadDesign({
                  ...(enquiry || {}),
                  ...targetJob,
                  rawJob: targetJob,
                  job_no: targetJob.enquiry_no || enquiry?.job_no || `RD${targetJob.seq}`,
                  customer: targetJob.customer_id?.name || enquiry?.customer || enquiry?.name || "Client",
                });
              }}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <CloudUploadIcon fontSize="small" />
              <span>Proceed to Upload Design</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesignerEnquiryDetailModal;

