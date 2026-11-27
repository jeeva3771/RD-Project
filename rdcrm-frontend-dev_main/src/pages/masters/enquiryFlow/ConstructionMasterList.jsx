import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import ActionButtons from "../../components/ActionButtons";
import SortableHeader from "../../components/SortableHeader";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import EnquiryDeleteModal from "./EnquiryDeleteModal";
import ConstructionMasterForm from "./ConstructionMasterForm";
import { invalidateMasterCache } from "../../enquiry-flow/utils/masterService";
import {
  fetchConstructions,
  createConstruction,
  updateConstruction,
  deleteConstruction
} from "../../../reducer/masters/enquiryFlow/constructionMasterReducer";

const ConstructionMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  // Master Data & Table State
  const { items: constructions = [], totalCount = 0, totalPages = 1 } = useSelector(
    (state) => state.constructionMaster || {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    icon: "🏗️",
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

      await dispatch(fetchConstructions(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch constructions");
    } finally {
      hideLoader();
    }
  }, [currentPage, itemsPerPage, search, sortConfig.key, sortConfig.direction, dispatch, showLoader, hideLoader]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "Construction name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = () => {
    setFormData({
      name: "",
      icon: "🏗️",
      is_active: true,
    });
    setCurrentId(null);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    showLoader();
    try {
      if (currentId) {
        await dispatch(updateConstruction({ id: currentId, ...formData })).unwrap();
        toast.success("Construction updated successfully");
      } else {
        await dispatch(createConstruction(formData)).unwrap();
        toast.success("Construction created successfully");
      }
      invalidateMasterCache("construction");
      handleReset();
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Operation failed");
    } finally {
      setIsSubmitting(false);
      hideLoader();
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      icon: item.icon || "🏗️",
      is_active: item.is_active ?? true,
    });
    setCurrentId(item._id || item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (!deleteModalData) return;
    setIsDeleting(true);
    showLoader();
    try {
      await dispatch(deleteConstruction(deleteModalData._id || deleteModalData.id)).unwrap();
      toast.success("Construction deleted successfully");
      invalidateMasterCache("construction");
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

  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search constructions..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              🔍
            </span>
          </div>
        </div>

        {/* Form Component */}
        <ConstructionMasterForm
          formData={formData}
          errors={errors}
          isSubmitting={isSubmitting}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          currentId={currentId}
          handleReset={handleReset}
        />

        {/* Table */}
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
                    label="Construction Name"
                    sortKey="name"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="is_active"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {constructions.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No constructions found
                    </td>
                  </tr>
                ) : (
                  constructions.map((item, idx) => (
                    <tr
                      key={item._id || item.id || idx}
                      className={`hover:bg-gray-50 ${idx % 2 === 1 ? "bg-gray-50" : ""
                        }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {startIndex + idx + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-lg">
                        {item.icon || "🏗️"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge isActive={item.is_active} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <ActionButtons
                          item={item}
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
            visibleItemCount={constructions.length}
            listType={true}
          />
        </div>
      </div>

      <EnquiryDeleteModal
        isOpen={!!deleteModalData}
        onClose={() => setDeleteModalData(null)}
        onConfirm={confirmDelete}
        itemName={deleteModalData?.name}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ConstructionMasterList;
