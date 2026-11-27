import React, { useEffect, useState } from "react";
import { getStatusBadge, getStatusText } from "../../utils/enquiry/statusHelpers";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import axios from "axios";
import { toast } from "react-toastify";
import { axiosInstance, backendUrl } from "../../utils/url/config";
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import DeliveryPriorityColor from "../../components/deliveryPriorityColor/priorityColor";
import { capitalizeFirst } from "../../utils/helper/capitalize";
import { colors } from "@mui/material";
import EnquiryShareModal from "../enquiry/EnquiryShareModal";
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate } from "react-router-dom";
import { isOverdue, formatDayMonth } from '../../utils/dateUtils';
import { useDispatch } from "react-redux";
import { useAuthData } from "../../utils/hooks/useAuthData";
import { holdEnquiry, unholdEnquiry } from "../../reducer/enquiryReducer";
import HoldModal from "./HoldModal";
import UnholdModal from "./UnholdModal";
import { formatDateToYYYYMMDD, formatDateToDDMMYYYY } from "../../utils/enquiry/dateformat";
import ImageLightbox from "../common/ImageLightbox";
import DesignerDueCountdownBadge from "./DesignerDueCountdownBadge";


const EnquiryCard = ({
  enquiry,
  openViewModal,
  openUploadModal,
  onUserAction,
  showDesignerButton = false,
  handleAccept,
  showAcceptButton = false,
  handleFileUpload,
  uploading,
  handleComplete,
  showEditButton = false,
  showadminbuttons = false,
  canSeeDesignHeadbutton = false,
  fetchEnquiries,
  onCountRefresh,
  designerview = false,
  handleimagessizeinput,
  AssociateRole = true,
  SalesRole,
  clientdesginerscreen = false,
  CloneButton = false,

}) => {
  const navigate = useNavigate();
  const images = (enquiry.images && enquiry.images.length > 0)
    ? enquiry.images
    : (Array.isArray(enquiry.reference_images) && enquiry.reference_images.length > 0
        ? enquiry.reference_images.map((url, i) => ({ id: i, url, is_accepted: true }))
        : (Array.isArray(enquiry.client_design_files) && enquiry.client_design_files.length > 0
            ? enquiry.client_design_files.map((url, i) => ({ id: i, url, is_accepted: true }))
            : []));


  const validImages = images.filter(
    (img) => img.url && typeof img.url === "string" && img.url.trim() !== "" && img.is_accepted !== false
  );

  const shouldShowShareButton =
    !(enquiry.images?.length === 1 && !enquiry.images[0]?.url);

  const shareoptionshowforclientdesign = enquiry.is_client_design && enquiry.is_designer_allocated

  const hasImageSizeInputs = images.some(img => img._id && img.imageunit === "");

  const theme = localStorage.getItem('app-theme');

  const [imageIndex, setImageIndex] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [noOfOptions, setNoOfOptions] = useState(enquiry.no_of_options || "");
  const [budget, setBudget] = useState(enquiry.budget || "");
  const [budgetTo, setBudgetTo] = useState(enquiry.budget_to || "");
  const [productQuantity, setProductQuantity] = useState(enquiry.product_quantity || "");
  const [deliveryDate, setDeliveryDate] = useState(enquiry.delivery_date ? formatDateToYYYYMMDD(enquiry.delivery_date) : "");
  const [updating, setUpdating] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [unholdModalOpen, setUnholdModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const dispatch = useDispatch();
  const { AdminRole, isHead } = useAuthData();

  const canHoldUnhold = AdminRole || (SalesRole && isHead);

  useEffect(() => {
    if (imageIndex >= validImages.length) {
      setImageIndex(0);
    }
  }, [validImages.length, imageIndex]);

  const currentImage = validImages[imageIndex]?.url;

  const navigateImage = (direction) => {
    if (direction === "next") {
      setImageIndex((prevIndex) => (prevIndex + 1) % validImages.length);
    } else if (direction === "prev") {
      setImageIndex((prevIndex) =>
        prevIndex === 0 ? validImages.length - 1 : prevIndex - 1
      );
    }
  };

  const handleUpdate = async () => {
    if (!noOfOptions && !budget && !budgetTo && !productQuantity && !deliveryDate) {
      toast.error("At least one field is required");
      return;
    }

    if ((noOfOptions && isNaN(noOfOptions)) || (budget && isNaN(budget)) || (budgetTo && isNaN(budgetTo)) || (productQuantity && isNaN(productQuantity))) {
      toast.error("Only numeric values are allowed for quantity, options and budget");
      return;
    }

    if (budget && budgetTo && Number(budgetTo) < Number(budget)) {
      toast.error("Budget To must be greater than or equal to Budget");
      return;
    }

    const payload = {};
    if (Number(noOfOptions) !== Number(enquiry.no_of_options || 0)) {
      payload.no_of_options = Number(noOfOptions);
    }
    if (Number(budget) !== Number(enquiry.budget || 0)) {
      payload.budget = Number(budget);
    }
    if (Number(budgetTo) !== Number(enquiry.budget_to || 0)) {
      payload.budget_to = Number(budgetTo);
    }
    if (Number(productQuantity) !== Number(enquiry.product_quantity || 0)) {
      payload.product_quantity = Number(productQuantity);
    }
    if (deliveryDate !== (enquiry.delivery_date ? formatDateToYYYYMMDD(enquiry.delivery_date) : "")) {
      payload.delivery_date = formatDateToDDMMYYYY(deliveryDate);
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No changes detected");
      return;
    }

    setUpdating(true);
    try {
      let response;
      if (enquiry.is_flow || enquiry.rawJob) {
        const jobId = enquiry._id || enquiry.rawJob?._id || enquiry.id;
        const flowPayload = {
          ...(payload.product_quantity ? { "the_ask.quantity": payload.product_quantity, "delivery_details.quantity": payload.product_quantity } : {}),
          ...(payload.delivery_date ? {
            "the_ask.delivery_date": payload.delivery_date,
            "the_ask.needed_by_date": payload.delivery_date,
            "delivery_details.delivery_date": payload.delivery_date,
            "delivery_details.needed_by_date": payload.delivery_date,
            delivery_date: payload.delivery_date,
            needed_by_date: payload.delivery_date,
            "wizard_state.e.neededByDate": payload.delivery_date,
            "wizard_state.e.deliveryDate": payload.delivery_date,
          } : {}),
          ...(payload.budget ? { "the_ask.approx_budget": payload.budget } : {}),
          ...(payload.no_of_options ? { "the_brief.options_count": Number(payload.no_of_options) } : {}),
          remarks: "Updated enquiry details from card",
        };
        response = await axiosInstance.put(`/enquiry-flow-integration/${jobId}`, flowPayload);
      } else {
        response = await axiosInstance.put(`${backendUrl}/enquiry/${enquiry.id}`, payload);
      }

      if (response.data.success) {
        toast.success("Enquiry updated successfully");
        setEditModalOpen(false);
        fetchEnquiries();
        onCountRefresh();
      } else {
        toast.error(response.data.message || "Update failed");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Server error");
    } finally {
      setUpdating(false);
    }
  };

  const handleHoldSubmit = async (reason) => {
    try {
      await dispatch(holdEnquiry({ id: enquiry.id, reason, hold_all_sub_jobs: true })).unwrap();
      // toast.success("Enquiry and all sub-jobs put on hold");
      // toast.success("Enquiry placed on hold. If sub-jobs exist, they have also been placed on hold")
      toast.success("Enquiry placed on hold")
      setHoldModalOpen(false);
      if (fetchEnquiries) fetchEnquiries();
      if (onCountRefresh) onCountRefresh();
    } catch (error) {
      toast.error(error || "Failed to hold enquiry");
    }
  };

  const handleUnholdSubmit = async (data) => {
    try {
      await dispatch(unholdEnquiry({ id: enquiry.id, ...data, hold_all_sub_jobs: true })).unwrap();
      toast.success("Enquiry successfully removed from hold");
      setUnholdModalOpen(false);
      if (fetchEnquiries) fetchEnquiries();
      if (onCountRefresh) onCountRefresh();
    } catch (error) {
      toast.error(error || "Failed to unhold enquiry");
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full group">
        {/* Top colored border */}
        {/* <div className='h-2 w-full' style={{...getStatusBadge(enquiry.status), width: "auto"}}></div> */}
        <DeliveryPriorityColor
          deliveryDate={enquiry.delivery_date}
          className="h-2 w-full"
        />

        {/* <div className="p-4 flex flex-col h-full"> */}
        <div className="p-3 flex flex-col h-full">
          {/* Header Section */}
          {/* <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-lg mb-1">{enquiry.job_no}</h3>
              <p className="text-xs text-slate-500 truncate">
                <i className="fa-regular fa-building mr-1"></i>
                {capitalizeFirst(enquiry.name)}
              </p>
            </div>
            {enquiry.is_on_hold && (
              <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ml-2 flex-shrink-0 bg-red-100 text-red-600 border border-red-200">
                ON HOLD
              </span>
            )}
            <DeliveryPriorityColor
              deliveryDate={enquiry.delivery_date}
              as="span"
              className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ml-2 flex-shrink-0"
              style={{ color: "#f6f2f2ff" }}
              showPriorityName={true}
            >
              {getStatusText(enquiry.status)}
            </DeliveryPriorityColor>

          </div> */}

          {/* Header Section - Updated for Responsiveness */}
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <div className="flex-1 min-w-[120px]">
              <h3 className="font-bold text-slate-800 text-base sm:text-lg mb-1">
                {enquiry.job_no}{enquiry.reference_no ? ` - ${enquiry.reference_no}` : ""}
              </h3>
              {/* <p className="text-xs text-slate-600 font-semibold truncate mb-1">
                <i className="fa-regular fa-building mr-1 text-slate-400"></i>
                {enquiry.name}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Created by: {enquiry.created_by?.name || '—'}
              </p> */}
            </div>

            {/* Badges Container */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {enquiry.is_on_hold && (
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-red-100 text-red-600 border border-red-200 whitespace-nowrap">
                  ON HOLD
                </span>
              )}
              <DeliveryPriorityColor
                deliveryDate={enquiry.delivery_date}
                as="span"
                className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{ color: "#f6f2f2ff" }}
                showPriorityName={true}
              >
                {getStatusText(enquiry.status)}
              </DeliveryPriorityColor>
            </div>
          </div>

          {/* Designer Due Timing Live Countdown Banner */}
          {(designerview || enquiry.options_due_in || enquiry.the_brief?.options_due_in) && (
            <div className="mb-2.5">
              <DesignerDueCountdownBadge enquiry={enquiry} className="w-full justify-center py-1.5" />
            </div>
          )}

          {/* Image Carousel Section */}
          {/* <div className="mb-4 relative h-40 rounded-lg overflow-hidden" style={{border: "1px solid #e2e8f0"}}> */}
          <div className="mb-4 relative h-40 overflow-hidden">

            {currentImage ? (
              <>
                <div className="flex overflow-x-auto h-full w-full snap-x snap-mandatory scrollbar-hide relative z-0">
                  <img
                    src={currentImage}
                    alt={enquiry.product_name || "Enquiry Design"}
                    loading="lazy"
                    className="w-full h-full flex-shrink-0 object-cover snap-center cursor-zoom-in"
                    onClick={() => setPreviewImage(currentImage)}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = "none";
                      if (e.currentTarget.parentElement) {
                        const fb = document.createElement("div");
                        fb.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 bg-slate-100 p-2 text-center";
                        fb.innerHTML = '<span class="text-2xl mb-1">🖼️</span><span class="text-[10px] font-medium text-slate-500">Preview Unavailable</span>';
                        e.currentTarget.parentElement.appendChild(fb);
                      }
                    }}
                  />
                </div>

                {/* Image dots indicator */}
                {validImages.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 p-1 rounded-full bg-black/20 backdrop-blur-sm">
                    {validImages.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${idx === imageIndex ? 'bg-white shadow-sm' : 'bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                )}

                {/* Navigation arrows */}
                {validImages.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/70 rounded-full p-1 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateImage("prev");
                      }}
                    >
                      <i className="fa-solid fa-chevron-left text-gray-700 text-xs"></i>
                    </button>
                    <button
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/70 rounded-full p-1 cursor-pointer"

                      onClick={(e) => {
                        e.stopPropagation();
                        navigateImage("next");
                      }}
                    >
                      <i className="fa-solid fa-chevron-right text-gray-700 text-xs"></i>
                    </button>
                  </>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 pointer-events-none bg-black/0 group-hover:bg-black/5 transition-all z-0"></div>
              </>
            ) : (
              enquiry.is_flow ? (
                <div className="flex flex-col items-center justify-center h-full bg-slate-50/80 border border-dashed border-slate-200 rounded-xl text-center p-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1 text-sm font-bold shadow-2xs">
                    🎨
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">Awaiting Design Upload</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Click View to add options</span>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <i className="fa-solid fa-image text-3xl mb-2"></i>
                    <p className="text-xs">No Image</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Product Details Row */}
          {/* <div className="flex justify-between text-sm mb-3 border-b border-gray-100 pb-3"> */}
          <div className="flex justify-between text-xs mb-2 border-b border-gray-100 pb-2">
            <div>
              <span className="text-gray-400 text-xs uppercase block font-semibold">QTY</span>
              <span className="font-bold text-slate-700">{enquiry.product_quantity}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs uppercase block font-semibold">DESIGNER</span>
              <div className="text-xs text-slate-700 font-bold flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[8px] flex-shrink-0">
                  <i className="fa-solid fa-user"></i>
                </div>
                <span className="truncate max-w-[80px]">
                  {enquiry.designer_person?.length > 0
                    ? enquiry.designer_person[enquiry.designer_person.length - 1]?.user?.name || "—"
                    : "—"}
                </span>
              </div>
            </div>
            <div>
              <span className="text-gray-400 text-xs uppercase block font-semibold">PRODUCT</span>
              <span className="text-slate-700 truncate block max-w-[90px] capitalize">{enquiry.product_name}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 text-xs uppercase block font-semibold">
                DELIVERY
              </span>

              <span
                className={`font-bold ${isOverdue(enquiry.delivery_date)
                  ? 'text-red-600'
                  : 'text-slate-700'
                  }`}
              >
                {formatDayMonth(enquiry.delivery_date)}
              </span>
            </div>
          </div>


          {/* Action Buttons - Always at bottom */}
          <div className="grid grid-cols-2 gap-2 mt-auto flex-shrink-0">
            {/* View Button - Always visible */}
            <button
              className="py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 text-sm font-medium transition flex items-center justify-center gap-2"
              onClick={() => openViewModal(enquiry)}
            >
              <VisibilityIcon fontSize="small" />
              <span>View</span>
            </button>

            {/* Upload Design Button for Designer View */}
            {designerview && openUploadModal && (
              <button
                type="button"
                className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openUploadModal(enquiry);
                }}
              >
                <CloudUploadIcon fontSize="small" />
                <span>Upload Design</span>
              </button>
            )}

            {(AdminRole || SalesRole) && showEditButton && showadminbuttons && !enquiry.is_on_hold && (
              <button
                className="py-2 px-3 rounded-lg bg-gray-500 text-white hover:bg-gray-600 shadow-sm text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={() => setEditModalOpen(true)}
              >
                <EditNoteOutlinedIcon fontSize="small" />
                <span>Edit</span>
              </button>
            )}
            {/* Dynamic Second Button */}
            {!AssociateRole && showEditButton && shouldShowShareButton && images.length >= 1 && showadminbuttons && !clientdesginerscreen && !enquiry.is_on_hold && (
              <button
                className="py-2 px-3 rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={() => setShareModalOpen(true)}
              >
                <ShareIcon fontSize="small" />
                <span>Share</span>
              </button>
            )}

            {!AssociateRole && showAcceptButton && !enquiry.is_flow && !enquiry.is_accept && !enquiry?.accept_button && !SalesRole && !enquiry.is_on_hold && (
              <button
                className="py-2 px-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 shadow-sm hover:shadow text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={() => handleAccept(enquiry)}
              >
                <i className="fa-solid fa-check"></i>
                <span>Accept</span>
              </button>
            )}

            {!AssociateRole && showAcceptButton && enquiry.submit_button && !enquiry.is_completed && !SalesRole && !enquiry.is_on_hold && (
              <button
                className="py-2 px-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={() => handleComplete(enquiry.id)}
              >
                <SendIcon fontSize="small" />
                <span>Submit</span>
              </button>
            )}

            {enquiry.is_accept && hasImageSizeInputs && !enquiry.is_on_hold && (
              <button
                className="py-2 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={(e) => handleimagessizeinput(e, enquiry)}
              >
                <EditIcon fontSize="small" />
                <span>Add Sizes</span>
              </button>
            )}

            {!AssociateRole && showAcceptButton && enquiry.is_accept && !hasImageSizeInputs && !enquiry.is_on_hold && (
              <label className="py-2 px-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, enquiry)}
                  className="hidden"
                />
                {uploading ? (
                  <CircularProgress size={20} thickness={5} sx={{ color: 'white' }} />
                ) : (
                  <>
                    <CloudUploadIcon fontSize="small" />
                    <span>Upload</span>
                  </>
                )}
              </label>
            )}

            {!AssociateRole && (enquiry.is_designer_needed || enquiry.is_client_design) &&
              (showDesignerButton || canSeeDesignHeadbutton) &&
              (!enquiry.is_designer_allocated) && !enquiry.is_on_hold && (
                <button
                  onClick={onUserAction}
                  className="py-2 px-3 rounded-lg bg-green-500 text-white hover:bg-purple-700 shadow-sm hover:shadow text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <PersonAddIcon fontSize="small" />
                  <span>Designer</span>
                </button>
              )}


            {/* Additional buttons row if needed */}
            {((!AssociateRole && showEditButton && showadminbuttons) ||
              (CloneButton && enquiry.is_completed)) && (
                <>


                  {CloneButton && enquiry.is_completed && !enquiry.is_on_hold && (
                    <button
                      className="py-2 px-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 shadow-sm text-sm font-medium transition flex items-center justify-center gap-2"
                      onClick={() => navigate(`/enquiries/edit/${enquiry.id}`)}
                    >
                      <ContentCopyIcon fontSize="small" />
                      <span>Clone</span>
                    </button>
                  )}
                </>
              )}

            {/* Hold Button */}
            {!enquiry.is_on_hold && canHoldUnhold && (
              <button
                className="py-2 px-3 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={() => setHoldModalOpen(true)}
              >
                <i className="fa-solid fa-pause"></i>
                <span>Hold</span>
              </button>
            )}

            {/* Unhold Button */}
            {enquiry.is_on_hold && canHoldUnhold && (
              <button
                className="py-2 px-3 rounded-lg border border-green-300 text-green-600 hover:bg-green-50 text-sm font-medium transition flex items-center justify-center gap-2"
                onClick={() => setUnholdModalOpen(true)}
              >
                <i className="fa-solid fa-play"></i>
                <span>Unhold</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <HoldModal
        open={holdModalOpen}
        onClose={() => setHoldModalOpen(false)}
        onConfirm={handleHoldSubmit}
      />

      <UnholdModal
        open={unholdModalOpen}
        onClose={() => setUnholdModalOpen(false)}
        onConfirm={handleUnholdSubmit}
        enquiry={enquiry}
        currentDate={enquiry.delivery_date}
      />

      {/* Share Modal */}
      {shareModalOpen && (
        <EnquiryShareModal
          enquiry={enquiry}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* EDIT MODAL */}
      {editModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-[90%] sm:max-w-md shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">
              Edit Enquiry
            </h2>
            <div className="mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
                No of Options
              </label>
              <input
                type="number"
                value={noOfOptions}
                onChange={(e) => setNoOfOptions(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
                Budget To
              </label>
              <input
                type="number"
                value={budgetTo}
                onChange={(e) => setBudgetTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={productQuantity}
                onChange={(e) => setProductQuantity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">
                Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 mt-4">
              <button
                className="w-full sm:w-auto px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm sm:text-base font-medium transition-colors"
                onClick={() => setEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleUpdate}
                disabled={updating}
              >
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        src={previewImage}
        fileName={enquiry.job_no || "Enquiry Image"}
        onClose={() => setPreviewImage(null)}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default EnquiryCard;