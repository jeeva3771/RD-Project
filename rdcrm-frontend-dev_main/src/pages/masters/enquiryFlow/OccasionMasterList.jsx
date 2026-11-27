import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import ActionButtons from "../../components/ActionButtons";
import SortableHeader from "../../components/SortableHeader";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import EnquiryDeleteModal from "./EnquiryDeleteModal";
import OccasionMasterForm from "./OccasionMasterForm";
import OccasionGroupMasterForm from "./OccasionGroupMasterForm";
import { invalidateMasterCache } from "../../enquiry-flow/utils/masterService";
import {
  fetchOccasions,
  createOccasion,
  updateOccasion,
  deleteOccasion,
} from "../../../reducer/masters/enquiryFlow/occasionMasterReducer";
import {
  fetchOccasionGroups,
  fetchActiveOccasionGroups,
  createOccasionGroup,
  updateOccasionGroup,
  deleteOccasionGroup,
} from "../../../reducer/masters/enquiryFlow/occasionGroupMasterReducer";

const OccasionMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  // Active Tab: "groups" | "occasions" (Occasion Group in first)
  const [activeTab, setActiveTab] = useState("groups");

  // --- Occasion Groups State ---
  const {
    items: groups = [],
    activeItems: activeGroups = [],
    totalCount: groupTotalCount = 0,
    totalPages: groupTotalPages = 1,
  } = useSelector((state) => state.occasionGroupMaster || {});

  const [groupPage, setGroupPage] = useState(1);
  const [groupLimit, setGroupLimit] = useState(10);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSort, setGroupSort] = useState({ key: "sort_order", direction: "asc" });

  const [groupFormData, setGroupFormData] = useState({
    name: "",
    icon: "📁",
    description: "",
    sort_order: 0,
    is_active: true,
  });
  const [groupCurrentId, setGroupCurrentId] = useState(null);
  const [groupErrors, setGroupErrors] = useState({});
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  // --- Occasions State ---
  const {
    items: occasions = [],
    totalCount: occasionTotalCount = 0,
    totalPages: occasionTotalPages = 1,
  } = useSelector((state) => state.occasionMaster || {});

  const [occasionPage, setOccasionPage] = useState(1);
  const [occasionLimit, setOccasionLimit] = useState(10);
  const [occasionSearch, setOccasionSearch] = useState("");
  const [occasionGroupFilter, setOccasionGroupFilter] = useState("");
  const [occasionSort, setOccasionSort] = useState({ key: "createdAt", direction: "desc" });

  const [occasionFormData, setOccasionFormData] = useState({
    group_id: "",
    name: "",
    icon: "🎯",
    is_active: true,
  });
  const [occasionCurrentId, setOccasionCurrentId] = useState(null);
  const [occasionErrors, setOccasionErrors] = useState({});
  const [isSubmittingOccasion, setIsSubmittingOccasion] = useState(false);

  // --- Delete Modal State ---
  // deleteModal: { type: "occasion" | "group", item: Object }
  const [deleteModal, setDeleteModal] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Fetch Active Groups (for Dropdowns) ---
  const loadActiveGroups = useCallback(async () => {
    try {
      await dispatch(fetchActiveOccasionGroups()).unwrap();
    } catch (err) {
      console.error("Failed to load active occasion groups:", err);
    }
  }, [dispatch]);

  useEffect(() => {
    loadActiveGroups();
  }, [loadActiveGroups]);

  // --- Fetch Occasions List ---
  const fetchOccasionsList = useCallback(async () => {
    try {
      showLoader();
      const params = {
        page: occasionPage,
        limit: occasionLimit,
        search: occasionSearch.trim(),
        sortKey: occasionSort.key,
        sortDir: occasionSort.direction,
        ...(occasionGroupFilter ? { group_id: occasionGroupFilter } : {}),
      };
      await dispatch(fetchOccasions(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch occasions");
    } finally {
      hideLoader();
    }
  }, [occasionPage, occasionLimit, occasionSearch, occasionSort, occasionGroupFilter, dispatch, showLoader, hideLoader]);

  // --- Fetch Occasion Groups List ---
  const fetchGroupsList = useCallback(async () => {
    try {
      showLoader();
      const params = {
        page: groupPage,
        limit: groupLimit,
        search: groupSearch.trim(),
        sortKey: groupSort.key,
        sortDir: groupSort.direction,
      };
      await dispatch(fetchOccasionGroups(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch occasion groups");
    } finally {
      hideLoader();
    }
  }, [groupPage, groupLimit, groupSearch, groupSort, dispatch, showLoader, hideLoader]);

  // Trigger list loads depending on active tab
  useEffect(() => {
    if (activeTab === "groups") {
      fetchGroupsList();
    } else {
      fetchOccasionsList();
      loadActiveGroups();
    }
  }, [activeTab, fetchGroupsList, fetchOccasionsList, loadActiveGroups]);

  // ==========================================
  // Occasion Group Handlers
  // ==========================================
  const handleGroupInputChange = (e) => {
    const { name, value } = e.target;
    setGroupFormData((prev) => ({ ...prev, [name]: value }));
    setGroupErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateGroupForm = () => {
    const errors = {};
    if (!groupFormData.name?.trim()) errors.name = "Group name is required";
    setGroupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGroupReset = () => {
    setGroupFormData({
      name: "",
      icon: "📁",
      description: "",
      sort_order: 0,
      is_active: true,
    });
    setGroupCurrentId(null);
    setGroupErrors({});
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!validateGroupForm()) return;

    setIsSubmittingGroup(true);
    showLoader();
    try {
      if (groupCurrentId) {
        await dispatch(updateOccasionGroup({ id: groupCurrentId, ...groupFormData })).unwrap();
        toast.success("Occasion group updated successfully");
      } else {
        await dispatch(createOccasionGroup(groupFormData)).unwrap();
        toast.success("Occasion group created successfully");
      }
      invalidateMasterCache("occasion-group");
      invalidateMasterCache("occasion");
      handleGroupReset();
      fetchGroupsList();
      loadActiveGroups();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Operation failed");
    } finally {
      setIsSubmittingGroup(false);
      hideLoader();
    }
  };

  const handleGroupEdit = (item) => {
    setGroupFormData({
      name: item.name || "",
      icon: item.icon || "📁",
      description: item.description || "",
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active ?? true,
    });
    setGroupCurrentId(item._id || item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ==========================================
  // Occasion Handlers
  // ==========================================
  const handleOccasionInputChange = (e) => {
    const { name, value } = e.target;
    setOccasionFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setOccasionErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateOccasionForm = () => {
    const errors = {};
    if (!occasionFormData.group_id) errors.group_id = "Occasion group is required";
    if (!occasionFormData.name?.trim()) errors.name = "Occasion name is required";
    setOccasionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOccasionReset = () => {
    setOccasionFormData({
      group_id: "",
      name: "",
      icon: "🎯",
      is_active: true,
    });
    setOccasionCurrentId(null);
    setOccasionErrors({});
  };

  const handleOccasionSubmit = async (e) => {
    e.preventDefault();
    if (!validateOccasionForm()) return;

    setIsSubmittingOccasion(true);
    showLoader();
    try {
      if (occasionCurrentId) {
        await dispatch(updateOccasion({ id: occasionCurrentId, ...occasionFormData })).unwrap();
        toast.success("Occasion updated successfully");
      } else {
        await dispatch(createOccasion(occasionFormData)).unwrap();
        toast.success("Occasion created successfully");
      }
      invalidateMasterCache("occasion");
      handleOccasionReset();
      fetchOccasionsList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Operation failed");
    } finally {
      setIsSubmittingOccasion(false);
      hideLoader();
    }
  };

  const handleOccasionEdit = (item) => {
    setOccasionFormData({
      group_id: item.group_id?._id || item.group_id || "",
      name: item.name || "",
      icon: item.icon || "🎯",
      is_active: item.is_active ?? true,
    });
    setOccasionCurrentId(item._id || item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ==========================================
  // Delete Confirmation Handler
  // ==========================================
  const confirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    showLoader();
    try {
      const id = deleteModal.item?._id || deleteModal.item?.id;
      if (deleteModal.type === "occasion") {
        await dispatch(deleteOccasion(id)).unwrap();
        toast.success("Occasion deleted successfully");
        invalidateMasterCache("occasion");
        fetchOccasionsList();
      } else if (deleteModal.type === "group") {
        await dispatch(deleteOccasionGroup(id)).unwrap();
        toast.success("Occasion group deleted successfully");
        invalidateMasterCache("occasion-group");
        invalidateMasterCache("occasion");
        fetchGroupsList();
        loadActiveGroups();
      }
      setDeleteModal(null);
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Delete failed");
    } finally {
      setIsDeleting(false);
      hideLoader();
    }
  };

  // Pagination start index
  const groupStartIndex = (groupPage - 1) * groupLimit;
  const occasionStartIndex = (occasionPage - 1) * occasionLimit;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-6">
        {/* Page Title & Navigation Tabs */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Occasion Master</h1>
              <p className="text-sm text-gray-500">
                Manage occasion categories and individual occasions for the enquiry flow
              </p>
            </div>
          </div>

          {/* Two Tabs: Occasion Groups & Occasions */}
          <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("groups")}
              className={`pb-3 px-5 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "groups"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <span className="text-base">📁</span>
              <span>Occasion Groups</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeTab === "groups"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {groupTotalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("occasions")}
              className={`pb-3 px-5 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "occasions"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <span className="text-base">🎯</span>
              <span>Occasions</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeTab === "occasions"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {occasionTotalCount}
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: OCCASION GROUPS                                    */}
        {/* ========================================================= */}
        {activeTab === "groups" && (
          <div>
            {/* Group Form */}
            <OccasionGroupMasterForm
              formData={groupFormData}
              errors={groupErrors}
              isSubmitting={isSubmittingGroup}
              onInputChange={handleGroupInputChange}
              onSubmit={handleGroupSubmit}
              currentId={groupCurrentId}
              handleReset={handleGroupReset}
            />

            {/* Search Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={groupSearch}
                  onChange={(e) => {
                    setGroupSearch(e.target.value);
                    setGroupPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                />
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  🔍
                </span>
              </div>
            </div>

            {/* Occasion Groups Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Icon
                      </th>
                      <SortableHeader
                        label="Group Name"
                        sortKey="name"
                        sortConfig={groupSort}
                        onSort={(key) =>
                          setGroupSort((prev) => ({
                            key,
                            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      />
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <SortableHeader
                        label="Sort Order"
                        sortKey="sort_order"
                        sortConfig={groupSort}
                        onSort={(key) =>
                          setGroupSort((prev) => ({
                            key,
                            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      />
                      <SortableHeader
                        label="Status"
                        sortKey="is_active"
                        sortConfig={groupSort}
                        onSort={(key) =>
                          setGroupSort((prev) => ({
                            key,
                            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      />
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {groups.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-6 py-8 text-center text-sm text-gray-500"
                        >
                          No occasion groups found. Click "Seed Standard Groups" to load defaults.
                        </td>
                      </tr>
                    ) : (
                      groups.map((item, idx) => (
                        <tr
                          key={item._id || item.id || idx}
                          className={`hover:bg-gray-50 transition-colors ${
                            idx % 2 === 1 ? "bg-gray-50/50" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {groupStartIndex + idx + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xl">
                            {item.icon || "📁"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {item.description || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.sort_order ?? 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge isActive={item.is_active} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <ActionButtons
                              item={item}
                              onEdit={() => handleGroupEdit(item)}
                              onDelete={() => setDeleteModal({ type: "group", item })}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={groupPage}
                totalPages={groupTotalPages}
                onPageChange={(page) => setGroupPage(page)}
                itemsPerPage={groupLimit}
                onItemsPerPageChange={(limit) => {
                  setGroupLimit(limit);
                  setGroupPage(1);
                }}
                totalCount={groupTotalCount}
                startIndex={groupStartIndex}
                visibleItemCount={groups.length}
                listType={true}
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: OCCASIONS                                          */}
        {/* ========================================================= */}
        {activeTab === "occasions" && (
          <div>
            {/* Occasion Form */}
            <OccasionMasterForm
              formData={occasionFormData}
              errors={occasionErrors}
              isSubmitting={isSubmittingOccasion}
              onInputChange={handleOccasionInputChange}
              onSubmit={handleOccasionSubmit}
              currentId={occasionCurrentId}
              handleReset={handleOccasionReset}
              occasionGroups={activeGroups}
              onSwitchToGroupsTab={() => setActiveTab("groups")}
            />

            {/* Search Bar & Occasion Group Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto flex-1">
                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Search occasions..."
                    value={occasionSearch}
                    onChange={(e) => {
                      setOccasionSearch(e.target.value);
                      setOccasionPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                  />
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    🔍
                  </span>
                </div>

                {/* Occasion Group Filter Dropdown */}
                <div className="relative w-full sm:w-64">
                  <select
                    value={occasionGroupFilter}
                    onChange={(e) => {
                      setOccasionGroupFilter(e.target.value);
                      setOccasionPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm text-gray-700 cursor-pointer"
                  >
                    <option value="">📁 All Occasion Groups</option>
                    {activeGroups.map((grp) => (
                      <option key={grp._id} value={grp._id}>
                        {grp.icon ? `${grp.icon} ` : ""}{grp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filter Button */}
                {(occasionGroupFilter || occasionSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setOccasionGroupFilter("");
                      setOccasionSearch("");
                      setOccasionPage(1);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer whitespace-nowrap self-center"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Occasions Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Icon
                      </th>
                      <SortableHeader
                        label="Occasion Name"
                        sortKey="name"
                        sortConfig={occasionSort}
                        onSort={(key) =>
                          setOccasionSort((prev) => ({
                            key,
                            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      />
                      <SortableHeader
                        label="Occasion Group"
                        sortKey="group_id"
                        sortConfig={occasionSort}
                        onSort={(key) =>
                          setOccasionSort((prev) => ({
                            key,
                            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      />
                      <SortableHeader
                        label="Status"
                        sortKey="is_active"
                        sortConfig={occasionSort}
                        onSort={(key) =>
                          setOccasionSort((prev) => ({
                            key,
                            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                      />
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {occasions.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-6 py-8 text-center text-sm text-gray-500"
                        >
                          No occasions found
                        </td>
                      </tr>
                    ) : (
                      occasions.map((item, idx) => (
                        <tr
                          key={item._id || item.id || idx}
                          className={`hover:bg-gray-50 transition-colors ${
                            idx % 2 === 1 ? "bg-gray-50/50" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {occasionStartIndex + idx + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xl">
                            {item.icon || "🎯"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              <span>{item.group_id?.icon || "📁"}</span>
                              <span>{item.group_id?.name || "—"}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge isActive={item.is_active} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <ActionButtons
                              item={item}
                              onEdit={() => handleOccasionEdit(item)}
                              onDelete={() => setDeleteModal({ type: "occasion", item })}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={occasionPage}
                totalPages={occasionTotalPages}
                onPageChange={(page) => setOccasionPage(page)}
                itemsPerPage={occasionLimit}
                onItemsPerPageChange={(limit) => {
                  setOccasionLimit(limit);
                  setOccasionPage(1);
                }}
                totalCount={occasionTotalCount}
                startIndex={occasionStartIndex}
                visibleItemCount={occasions.length}
                listType={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <EnquiryDeleteModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title={deleteModal?.type === "group" ? "Delete Occasion Group" : "Delete Occasion"}
        itemName={deleteModal?.item?.name}
        message={
          deleteModal?.type === "group"
            ? `Are you sure you want to delete occasion group "${deleteModal?.item?.name}"? Make sure no occasions are currently assigned to it.`
            : undefined
        }
        isLoading={isDeleting}
      />
    </div>
  );
};

export default OccasionMasterList;
