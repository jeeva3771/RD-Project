import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import ActionButtons from "../../components/ActionButtons";
import SortableHeader from "../../components/SortableHeader";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import EnquiryDeleteModal from "./EnquiryDeleteModal";
import CarrierMasterForm, { CARRIER_APPLIES_TO } from "./CarrierMasterForm";
import { invalidateMasterCache } from "../../enquiry-flow/utils/masterService";
import {
  fetchCarriers,
  createCarrier,
  updateCarrier,
  deleteCarrier,
  resetStandardCarriers
} from "../../../reducer/masters/enquiryFlow/carrierMasterReducer";

const CarrierMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  // Filters & Pagination
  const [selectedAppliesTo, setSelectedAppliesTo] = useState("all");
  const { items: carriers = [], totalCount = 0, totalPages = 1 } = useSelector(
    (state) => state.carrierMaster || {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    icon: "🚚",
    has_charges: false,
    applies_to: "both",
    is_active: true,
  });
  const [currentId, setCurrentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch List
  const fetchList = useCallback(async () => {
    try {
      showLoader();
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: search.trim(),
        sortKey: sortConfig.key,
        sortDir: sortConfig.direction,
      };
      if (selectedAppliesTo !== "all") {
        params.applies_to = selectedAppliesTo;
      }

      await dispatch(fetchCarriers(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch carriers");
    } finally {
      hideLoader();
    }
  }, [currentPage, itemsPerPage, search, selectedAppliesTo, sortConfig, dispatch, showLoader, hideLoader]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Form Input Change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleReset = () => {
    setFormData({
      name: "",
      icon: "🚚",
      has_charges: false,
      applies_to: "both",
      is_active: true,
    });
    setCurrentId(null);
    setErrors({});
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      icon: item.icon || "🚚",
      has_charges: item.has_charges || false,
      applies_to: item.applies_to || "both",
      is_active: item.is_active ?? true,
    });
    setCurrentId(item._id);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name?.trim()) {
      newErrors.name = "Carrier name is required";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      showLoader();

      const payload = {
        name: formData.name.trim(),
        icon: formData.icon?.trim() || "🚚",
        has_charges: formData.has_charges === true || formData.has_charges === "true",
        applies_to: formData.applies_to || "both",
        is_active: formData.is_active,
      };

      if (currentId) {
        await dispatch(updateCarrier({ id: currentId, ...payload })).unwrap();
        toast.success("Carrier updated successfully");
      } else {
        await dispatch(createCarrier(payload)).unwrap();
        toast.success("Carrier created successfully");
      }

      invalidateMasterCache("carrier");
      handleReset();
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to save carrier");
    } finally {
      setIsSubmitting(false);
      hideLoader();
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteModalData) return;
    try {
      setIsDeleting(true);
      showLoader();
      await dispatch(deleteCarrier(deleteModalData._id || deleteModalData.id)).unwrap();
      toast.success("Carrier deleted successfully");
      invalidateMasterCache("carrier");
      setDeleteModalData(null);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Delete failed");
    } finally {
      setIsDeleting(false);
      hideLoader();
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const getAppliesToBadge = (appliesTo) => {
    if (appliesTo === "delivery") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          Delivery Only
        </span>
      );
    }
    if (appliesTo === "sample") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
          Sample Only
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
        Both
      </span>
    );
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  const handleResetToStandard = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove all unnecessary carrier data and reset to the 8 standard carriers from constants (Our vehicle, Hand delivery, Tempo, Porter, Courier, Air cargo, Client's courier, Client pickup)?"
      )
    ) {
      return;
    }

    try {
      showLoader();
      const res = await dispatch(resetStandardCarriers()).unwrap();
      toast.success(res?.message || "Carriers reset to standard constants successfully");
      invalidateMasterCache("carrier");
      fetchList();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to reset carriers");
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery Carrier Master</h1>
          <p className="text-sm text-gray-500">
            Configure delivery & sample carriers (e.g. Tempo, Porter, Courier, Our vehicle, Hand delivery)
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetToStandard}
          className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 transition cursor-pointer shadow-2xs self-start md:self-auto"
          title="Remove dummy carriers and populate the 8 standard carriers from constants"
        >
          <i className="fa-solid fa-arrows-rotate"></i>
          Reset to Standard Constants (8)
        </button>
      </div>

      {/* Form */}
      <CarrierMasterForm
        formData={formData}
        errors={errors}
        isSubmitting={isSubmitting}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        currentId={currentId}
        handleReset={handleReset}
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setSelectedAppliesTo("all");
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            selectedAppliesTo === "all"
              ? "bg-[#2815f5] text-white shadow-2xs"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          All Carriers
        </button>
        {CARRIER_APPLIES_TO.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setSelectedAppliesTo(opt.value);
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedAppliesTo === opt.value
                ? "bg-[#2815f5] text-white shadow-2xs"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search carriers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-800">{carriers.length}</span> of{" "}
          <span className="font-semibold text-gray-800">{totalCount}</span> carriers
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 w-16">Icon</th>
                <SortableHeader
                  label="Carrier Name"
                  sortKey="name"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Freight Charges"
                  sortKey="has_charges"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Applies To"
                  sortKey="applies_to"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="is_active"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carriers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-400">
                    No carriers found. Add a carrier using the form above.
                  </td>
                </tr>
              ) : (
                carriers.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-xl">{item.icon || "🚚"}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {item.name}
                    </td>
                    <td className="py-3 px-4">
                      {item.has_charges ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Freight Charged
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Free / Included
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {getAppliesToBadge(item.applies_to)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge isActive={item.is_active} />
                    </td>
                    <td className="py-3 px-4">
                      <ActionButtons
                        onEdit={() => handleEdit(item)}
                        onDelete={() => setDeleteModalData(item)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
          }}
          totalCount={totalCount}
          startIndex={startIndex}
          visibleItemCount={carriers.length}
          listType={true}
        />
      </div>

      {/* Delete Modal */}
      <EnquiryDeleteModal
        isOpen={Boolean(deleteModalData)}
        onClose={() => setDeleteModalData(null)}
        onConfirm={handleDelete}
        itemName={deleteModalData?.name}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default CarrierMasterList;
