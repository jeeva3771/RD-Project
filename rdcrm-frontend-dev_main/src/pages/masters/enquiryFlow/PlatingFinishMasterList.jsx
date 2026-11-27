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
import PlatingFinishMasterForm from "./PlatingFinishMasterForm";
import SubMasterViewModal from "./SubMasterViewModal";
import {
  fetchPlatingFinishes,
  createPlatingFinish,
  updatePlatingFinish,
  deletePlatingFinish
} from "../../../reducer/masters/enquiryFlow/platingFinishMasterReducer";

const INITIAL_FORM_DATA = {
  name: "",
  code: "#D4AF37",
  applicable_products: ["all"],
  extra_rate: 0,
  is_active: true,
  sort_order: 0,
};

const PlatingFinishMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  const { items = [], totalCount = 0, totalPages = 1 } = useSelector(
    (state) => state.platingFinishMaster || {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "sort_order", direction: "asc" });

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

      await dispatch(fetchPlatingFinishes(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch plating finishes");
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

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "Finish name is required";
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
      code: item.code || "#D4AF37",
      applicable_products: item.applicable_products || [],
      extra_rate: item.extra_rate ?? 0,
      is_active: item.is_active ?? true,
      sort_order: item.sort_order ?? 0,
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
        await dispatch(updatePlatingFinish({ id: currentId, ...formData })).unwrap();
        toast.success("Plating finish updated successfully");
      } else {
        await dispatch(createPlatingFinish(formData)).unwrap();
        toast.success("Plating finish created successfully");
      }
      handleReset();
      setIsFormOpen(false);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to save plating finish");
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
      await dispatch(deletePlatingFinish(targetId)).unwrap();
      toast.success("Plating finish deleted successfully");
      setDeleteModalData(null);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to delete plating finish");
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
            <span>✨</span>
            <span>Plating & Metallic Finishes Master</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage electroplating colors, textures, and extra rates for medals, lapel pins, badges, cufflinks, etc.
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
          <span>{isFormOpen ? "✕ Close Form" : "+ Add Plating Finish"}</span>
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
          className="px-3.5 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs"
        >
          ✨ Plating & Finishes
        </Link>
        <Link
          to="/enquiry-processes"
          className="px-3.5 py-1.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
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
        <PlatingFinishMasterForm
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
              placeholder="Search finishes..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:border-indigo-600"
            />
            <span className="absolute left-3 top-2 text-xs text-gray-400">🔍</span>
          </div>

          <span className="text-xs font-bold text-gray-500">
            Total Finishes: <span className="text-gray-900">{totalCount}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Swatch</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Code / Hex</th>
                <th className="py-3 px-4 text-right">Extra Rate</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-400 text-xs">
                    No plating finishes found. Click "+ Add Plating Finish" above to add one.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item._id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-gray-400">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-300 shadow-xs"
                        style={{
                          background: item.code?.startsWith("#") ? item.code : item.code || "#D4AF37",
                        }}
                      />
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-600">{item.code || "—"}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-700">
                      {item.extra_rate ? `₹${item.extra_rate}` : "₹0"}
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
          masterType="plating"
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

export default PlatingFinishMasterList;
