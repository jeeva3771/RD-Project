import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import ActionButtons from "../../components/ActionButtons";
import SortableHeader from "../../components/SortableHeader";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import EnquiryDeleteModal from "./EnquiryDeleteModal";
import ProcessEnquiryMasterForm from "./ProcessEnquiryMasterForm";
import SubMasterViewModal from "./SubMasterViewModal";
import { getProductBadge } from "./ApplicableProductsSelector";
import {
  fetchProcessEnquiryMasters,
  createProcessEnquiryMaster,
  updateProcessEnquiryMaster,
  deleteProcessEnquiryMaster
} from "../../../reducer/masters/enquiryFlow/processEnquiryMasterReducer";

const INITIAL_FORM_DATA = {
  name: "",
  category: "print",
  applicable_products: ["trophy", "plaque"],
  base_cost: 0,
  is_active: true,
};

const ProcessEnquiryMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  const { items = [], totalCount = 0, totalPages = 1 } = useSelector(
    (state) => state.processEnquiryMaster || {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [currentId, setCurrentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState(null);

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

      await dispatch(fetchProcessEnquiryMasters(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch production processes");
    } finally {
      hideLoader();
    }
  }, [currentPage, itemsPerPage, search, sortConfig.key, sortConfig.direction, dispatch, showLoader, hideLoader]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "Technique name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA);
    setCurrentId(null);
    setErrors({});
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      category: item.category || "print",
      applicable_products: item.applicable_products || [],
      base_cost: item.base_cost ?? 0,
      is_active: item.is_active ?? true,
    });
    setCurrentId(item._id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    showLoader();
    try {
      if (currentId) {
        await dispatch(updateProcessEnquiryMaster({ id: currentId, ...formData })).unwrap();
        toast.success("Technique updated successfully");
      } else {
        await dispatch(createProcessEnquiryMaster(formData)).unwrap();
        toast.success("Technique created successfully");
      }
      handleReset();
      setIsFormOpen(false);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to save technique");
    } finally {
      setIsSubmitting(false);
      hideLoader();
    }
  };

  const handleDelete = async () => {
    const targetId = deleteModalData?._id || deleteModalData?.id;
    if (!targetId) return;
    setIsDeleting(true);
    showLoader();
    try {
      await dispatch(deleteProcessEnquiryMaster(targetId)).unwrap();
      toast.success("Technique deleted successfully");
      setDeleteModalData(null);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to delete technique");
    } finally {
      setIsDeleting(false);
      hideLoader();
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🖨️</span>
            <span>Production Techniques Master</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage printing methods, engraving, enameling, and casting options used in product questionnaire cards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isFormOpen && !currentId) {
              setIsFormOpen(false);
            } else {
              handleReset();
              setIsFormOpen(true);
            }
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-2"
        >
          <span>{isFormOpen ? "✕ Close Form" : "+ Add Technique"}</span>
        </button>
      </div>

      {/* Masters Hub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 overflow-x-auto text-xs">
        <Link
          to="/product-configs"
          className="px-3.5 py-1.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
        >
          📦 Product Engine
        </Link>
        <Link
          to="/plating-finishes"
          className="px-3.5 py-1.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
        >
          ✨ Plating & Finishes
        </Link>
        <Link
          to="/enquiry-processes"
          className="px-3.5 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs"
        >
          🖨️ Production Techniques
        </Link>
        <Link
          to="/attachments"
          className="px-3.5 py-1.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
        >
          📎 Hardware Attachments
        </Link>
      </div>

      {isFormOpen && (
        <ProcessEnquiryMasterForm
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          isSubmitting={isSubmitting}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          currentId={currentId}
          handleReset={handleReset}
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search techniques..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:border-indigo-600"
            />
            <span className="absolute left-3 top-2 text-xs text-gray-400">🔍</span>
          </div>

          <span className="text-xs font-bold text-gray-500">
            Total Techniques: <span className="text-gray-900">{totalCount}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Technique Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Applicable Products</th>
                <th className="py-3 px-4 text-right">Base Cost</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400 text-xs">
                    No production techniques found. Click "+ Add Technique" above to add one.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item._id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-gray-400">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">{item.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                        {item.category || "print"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(item.applicable_products || []).map((p) => {
                          const badge = getProductBadge(p);
                          return (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-700 font-medium"
                              title={badge.label}
                            >
                              <span>{badge.icon}</span>
                              <span>{badge.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-700">
                      {item.base_cost ? `₹${item.base_cost}` : "₹0"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge isActive={item.is_active} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ActionButtons
                        onView={() => setViewModalData(item)}
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
          visibleItemCount={items.length}
          listType={true}
        />
      </div>

      {/* View Modal */}
      {viewModalData && (
        <SubMasterViewModal
          isOpen={!!viewModalData}
          onClose={() => setViewModalData(null)}
          onEdit={(item) => handleEdit(item)}
          item={viewModalData}
          masterType="process"
        />
      )}

      {deleteModalData && (
        <EnquiryDeleteModal
          isOpen={!!deleteModalData}
          onClose={() => setDeleteModalData(null)}
          onConfirm={handleDelete}
          itemName={deleteModalData.name}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default ProcessEnquiryMasterList;
