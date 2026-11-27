import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { invalidateMasterCache } from "../../enquiry-flow/utils/masterService";
import { useLoader } from "../../../context/LoaderContext";
import { toast } from "react-toastify";
import ActionButtons from "../../components/ActionButtons";
import SortableHeader from "../../components/SortableHeader";
import StatusBadge from "../../components/StatusBadge";
import EnquiryDeleteModal from "./EnquiryDeleteModal";
import Pagination from "../../components/Pagination";
import {
  fetchGenericMasterList,
  createGenericMasterItem,
  updateGenericMasterItem,
  deleteGenericMasterItem
} from "../../../reducer/masters/enquiryFlow/createMasterSlice";

const EnquiryMasterView = ({
  title,
  singularTitle,
  endpoint,
  columns = [],
  formFields = [],
}) => {
  const dispatch = useDispatch();
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  const [viewModalData, setViewModalData] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showLoader, hideLoader } = useLoader();

  const fetchData = useCallback(async () => {
    showLoader();
    try {
      const res = await dispatch(
        fetchGenericMasterList({
          endpoint,
          params: {
            page,
            limit,
            search,
            sortKey: sortConfig.key,
            sortDir: sortConfig.direction,
          },
        })
      ).unwrap();
      if (res?.success) {
        setData(res.data || []);
        setTotalCount(res.totalCount || 0);
      }
    } catch (err) {
      toast.error(typeof err === "string" ? err : `Failed to fetch ${title}`);
    } finally {
      hideLoader();
    }
  }, [endpoint, page, limit, search, sortConfig, dispatch, showLoader, hideLoader, title]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const openAddModal = () => {
    setEditingItem(null);
    const initial = {};
    formFields.forEach((f) => {
      initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : f.type === "number" ? 0 : f.type === "boolean" ? true : "";
    });
    setFormData(initial);
    setFormErrors({});
    setFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const initial = {};
    formFields.forEach((f) => {
      initial[f.name] = item[f.name] !== undefined ? item[f.name] : f.defaultValue !== undefined ? f.defaultValue : "";
    });
    setFormData(initial);
    setFormErrors({});
    setFormModalOpen(true);
  };

  const handleFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    formFields.forEach((f) => {
      if (f.required && (formData[f.name] === undefined || formData[f.name] === null || String(formData[f.name]).trim() === "")) {
        errs[f.name] = `${f.label} is required`;
      }
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    showLoader();
    try {
      if (editingItem) {
        await dispatch(
          updateGenericMasterItem({
            endpoint,
            id: editingItem._id,
            payload: formData,
          })
        ).unwrap();
        toast.success(`${singularTitle || title} updated successfully`);
      } else {
        await dispatch(
          createGenericMasterItem({
            endpoint,
            payload: formData,
          })
        ).unwrap();
        toast.success(`${singularTitle || title} created successfully`);
      }
      invalidateMasterCache(endpoint);
      setFormModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Operation failed");
    } finally {
      setIsSubmitting(false);
      hideLoader();
    }
  };

  const handleDelete = async () => {
    if (!deleteModalData?._id) return;
    showLoader();
    try {
      await dispatch(
        deleteGenericMasterItem({
          endpoint,
          id: deleteModalData._id,
        })
      ).unwrap();
      toast.success(`${singularTitle || title} deleted successfully`);
      invalidateMasterCache(endpoint);
      setDeleteModalData(null);
      fetchData();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to delete");
    } finally {
      hideLoader();
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="p-6 bg-gray-50 min-h-screen" style={{ marginTop: "70px" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500 mt-1">Manage master entries for Standalone Enquiry Flow</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>+</span> Add {singularTitle || "Record"}
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        {/* Top Controls: Search & Limit */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-indigo-500"
            >
              {[5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                {columns.map((c) => (
                  <SortableHeader
                    key={c.key}
                    label={c.label}
                    sortKey={c.key}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                ))}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 3} className="text-center py-8 text-gray-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item._id || idx} className="hover:bg-indigo-50/30 transition">
                    <td className="px-4 py-3 text-center text-gray-400 font-medium">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.render ? c.render(item[c.key], item) : String(item[c.key] ?? "-")}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <StatusBadge isActive={item.is_active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionButtons
                        item={item}
                        onView={() => setViewModalData(item)}
                        onEdit={() => openEditModal(item)}
                        onDelete={() => setDeleteModalData(item)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-gray-500">
            Showing {(page - 1) * limit + (data.length > 0 ? 1 : 0)} to {Math.min(page * limit, totalCount)} of {totalCount} entries
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-sm text-gray-900">
                {editingItem ? `Edit ${singularTitle || "Record"}` : `Add New ${singularTitle || "Record"}`}
              </h3>
              <button
                onClick={() => setFormModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formFields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === "select" ? (
                    <select
                      value={formData[field.name] ?? ""}
                      onChange={(e) => handleFormChange(field.name, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value ?? opt} value={opt.value ?? opt}>
                          {opt.label ?? opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "boolean" ? (
                    <select
                      value={formData[field.name] ? "true" : "false"}
                      onChange={(e) => handleFormChange(field.name, e.target.value === "true")}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      placeholder={field.placeholder || ""}
                      value={formData[field.name] ?? ""}
                      onChange={(e) => handleFormChange(field.name, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  ) : field.type === "tags" ? (
                    <input
                      type="text"
                      placeholder="Comma-separated values (e.g. Courier, Tempo)"
                      value={Array.isArray(formData[field.name]) ? formData[field.name].join(", ") : formData[field.name] || ""}
                      onChange={(e) =>
                        handleFormChange(
                          field.name,
                          e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      placeholder={field.placeholder || ""}
                      value={formData[field.name] ?? ""}
                      onChange={(e) => handleFormChange(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  )}

                  {formErrors[field.name] && (
                    <p className="text-[11px] text-red-500">{formErrors[field.name]}</p>
                  )}
                </div>
              ))}

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
                >
                  {isSubmitting ? "Saving..." : editingItem ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW MODAL --- */}
      {viewModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-sm text-gray-900">{singularTitle || "Record"} Details</h3>
              <button onClick={() => setViewModalData(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
              {Object.keys(viewModalData)
                .filter((k) => !["_id", "__v", "createdAt", "updatedAt", "created_by", "updated_by"].includes(k))
                .map((key) => (
                  <div key={key} className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="font-semibold text-gray-500 uppercase text-[10px] tracking-wider">{key.replace(/_/g, " ")}:</span>
                    <span className="font-medium text-gray-900 text-right">
                      {typeof viewModalData[key] === "boolean" ? (
                        <StatusBadge isActive={viewModalData[key]} />
                      ) : Array.isArray(viewModalData[key]) ? (
                        viewModalData[key].map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ")
                      ) : (
                        String(viewModalData[key] ?? "-")
                      )}
                    </span>
                  </div>
                ))}
              {viewModalData.createdAt && (
                <div className="flex justify-between py-1.5 text-gray-400 text-[11px]">
                  <span>Created:</span>
                  <span>{new Date(viewModalData.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setViewModalData(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <EnquiryDeleteModal
        isOpen={Boolean(deleteModalData)}
        onClose={() => setDeleteModalData(null)}
        onConfirm={handleDelete}
        title={`Delete ${singularTitle || "Record"}`}
        itemName={deleteModalData?.name || deleteModalData?.title || deleteModalData?.label || deleteModalData?.code || ""}
      />
    </div>
  );
};

export default EnquiryMasterView;
