import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import ActionButtons from "../../components/ActionButtons";
import SortableHeader from "../../components/SortableHeader";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import EnquiryDeleteModal from "./EnquiryDeleteModal";
import PackagingMasterForm, { PACKAGING_CATEGORIES } from "./PackagingMasterForm";
import { invalidateMasterCache } from "../../enquiry-flow/utils/masterService";
import {
  fetchPackagingOptions,
  createPackagingOption,
  updatePackagingOption,
  deletePackagingOption
} from "../../../reducer/masters/enquiryFlow/packagingOptionMasterReducer";

const PackagingMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  // Tab & Filters
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { items: options = [], totalCount = 0, totalPages = 1 } = useSelector(
    (state) => state.packagingOptionMaster || {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  // Form State
  const [formData, setFormData] = useState({
    category: "outer_box",
    name: "",
    sub_text: "",
    icon: "📦",
    extra_cost: 0,
    is_active: true,
  });
  const [currentId, setCurrentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Options
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
      if (selectedCategory !== "all") {
        params.category = selectedCategory;
      }

      await dispatch(fetchPackagingOptions(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch packaging options");
    } finally {
      hideLoader();
    }
  }, [currentPage, itemsPerPage, search, selectedCategory, sortConfig.key, sortConfig.direction, dispatch, showLoader, hideLoader]);

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

  const handleCategoryTabChange = (cat) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
    if (cat !== "all") {
      setFormData((prev) => ({
        ...prev,
        category: cat,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.name?.trim()) newErrors.name = "Name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = () => {
    setFormData({
      category: selectedCategory !== "all" ? selectedCategory : "outer_box",
      name: "",
      sub_text: "",
      icon: "📦",
      extra_cost: 0,
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
      const payload = {
        category: formData.category,
        name: formData.name.trim(),
        sub_text: formData.sub_text?.trim() || "",
        icon: formData.icon?.trim() || "📦",
        extra_cost: Number(formData.extra_cost) || 0,
        is_active: formData.is_active ?? true,
      };

      if (currentId) {
        await dispatch(updatePackagingOption({ id: currentId, ...payload })).unwrap();
        toast.success("Option updated successfully");
      } else {
        await dispatch(createPackagingOption(payload)).unwrap();
        toast.success("Option created successfully");
      }
      invalidateMasterCache("packaging-option");
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
      category: item.category || "outer_box",
      name: item.name || "",
      sub_text: item.sub_text || "",
      icon: item.icon || "📦",
      extra_cost: item.extra_cost ?? 0,
      is_active: item.is_active ?? true,
    });
    setCurrentId(item._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    const targetId = deleteModalData?._id || deleteModalData?.id;
    if (!targetId) return;
    try {
      setIsDeleting(true);
      showLoader();
      await dispatch(deletePackagingOption(targetId)).unwrap();
      toast.success("Option deleted successfully");
      invalidateMasterCache("packaging-option");
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

  const getCategoryBadge = (catVal) => {
    const found = PACKAGING_CATEGORIES.find((c) => c.value === catVal);
    return found ? `${found.icon} ${found.label}` : catVal;
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Packaging & Delivery Master
          </h1>
          <p className="text-sm text-gray-500">
            Manage outer boxes, protection materials, labels, add-ons, packing modes, and box colours
          </p>
        </div>
      </div>

      {/* Form */}
      <PackagingMasterForm
        formData={formData}
        errors={errors}
        isSubmitting={isSubmitting}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        currentId={currentId}
        handleReset={handleReset}
      />

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => handleCategoryTabChange("all")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${selectedCategory === "all"
            ? "bg-indigo-600 text-white shadow-sm"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          All Categories
        </button>
        {PACKAGING_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => handleCategoryTabChange(c.value)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${selectedCategory === c.value
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Table Filter Top Bar */}
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search option name or description..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-xs text-gray-500">
            Total Items: <span className="font-bold text-gray-800">{totalCount}</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Icon</th>
                <SortableHeader
                  label="Category"
                  sortKey="category"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Option Name"
                  sortKey="name"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <th className="py-3 px-4">Specification / Sub-text</th>
                <SortableHeader
                  label="Extra Cost"
                  sortKey="extra_cost"
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
              {options.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400">
                    No packaging options found. Add an option using the form above.
                  </td>
                </tr>
              ) : (
                options.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-xl">{item.icon || "📦"}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {getCategoryBadge(item.category)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {item.sub_text || "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700">
                      {item.extra_cost ? `₹${item.extra_cost}` : "Free (₹0)"}
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
          visibleItemCount={options.length}
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

export default PackagingMasterList;
