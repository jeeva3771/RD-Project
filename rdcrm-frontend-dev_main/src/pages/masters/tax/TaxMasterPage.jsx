import React, { useState, useEffect } from "react";
import { axiosInstance } from "../../../utils/url/config";
import { toast } from "react-toastify";
import ActionButtons from "../../components/ActionButtons";
import DeleteModal from "../../components/DeleteModal";
import Pagination from "../../components/Pagination";

export default function TaxMasterPage() {
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taxId, setTaxId] = useState(null); // For editing
  const [deleteModalData, setDeleteModalData] = useState(null);

  // Server-Side Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    tax_name: "",
    tax_type: "GST",
    tax_rate: "",
    description: "",
    is_active: true,
  });

  const fetchTaxes = async (page = currentPage, limit = itemsPerPage) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/taxmaster", {
        params: { page, limit },
      });
      if (res.data?.success) {
        setTaxes(res.data.data || []);
        setTotalCount(res.data.total !== undefined ? res.data.total : (res.data.data ? res.data.data.length : 0));
        setTotalPages(res.data.totalPages || 1);
        setCurrentPage(res.data.page || page);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to fetch tax list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxes(currentPage, itemsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!formData.tax_name.trim()) {
      toast.error("Tax Name is required");
      return;
    }
    if (formData.tax_rate === "" || isNaN(Number(formData.tax_rate))) {
      toast.error("Tax Rate percentage is required");
      return;
    }
    if (Number(formData.tax_rate) < 0) {
      toast.error("Tax Rate percentage cannot be negative");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tax_name: formData.tax_name.trim(),
        tax_type: formData.tax_type,
        tax_rate: Number(formData.tax_rate),
        description: formData.description.trim(),
        is_active: Boolean(formData.is_active),
      };

      if (taxId) {
        const res = await axiosInstance.put(`/taxmaster/${taxId}`, payload);
        if (res.data?.success) {
          toast.success(res.data.message || "Tax updated successfully");
        }
      } else {
        const res = await axiosInstance.post("/taxmaster", payload);
        if (res.data?.success) {
          toast.success(res.data.message || "Tax added successfully");
        }
      }

      // Reset form
      setFormData({
        tax_name: "",
        tax_type: "GST",
        tax_rate: "",
        description: "",
        is_active: true,
      });
      setTaxId(null);
      fetchTaxes(currentPage, itemsPerPage);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save tax");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      tax_name: item.tax_name || "",
      tax_type: item.tax_type || "GST",
      tax_rate: item.tax_rate !== undefined ? item.tax_rate : "",
      description: item.description || "",
      is_active: item.is_active !== undefined ? item.is_active : true,
    });
    setTaxId(item._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };



  const confirmDelete = async () => {
    if (!deleteModalData) return;
    try {
      const res = await axiosInstance.delete(`/taxmaster/${deleteModalData._id}`);
      if (res.data?.success) {
        toast.success("Tax deleted successfully");
        fetchTaxes(currentPage, itemsPerPage);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete tax");
    } finally {
      setDeleteModalData(null);
    }
  };

  return (
    <div className="bg-gray-50 min-h-[70vh]">
      <div className="container mx-auto px-4 py-6">
        {/* CREATE / EDIT FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tax Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Type <span className="text-red-500">*</span>
              </label>
              <select
                name="tax_type"
                value={formData.tax_type}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                required
              >
                <option value="GST">GST</option>
                <option value="TDS">TDS</option>
              </select>
            </div>

            {/* Tax Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                name="tax_name"
                value={formData.tax_name}
                onChange={handleChange}
                placeholder="e.g. GST 18%"
                className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>

            {/* Tax Rate (%) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Rate (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                name="tax_rate"
                value={formData.tax_rate}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="is_active"
                value={formData.is_active ? "true" : "false"}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, is_active: e.target.value === "true" }))
                }
                className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {/* Description (Full width) */}
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description / Remarks (Optional)
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g. Standard rate for goods and services"
                className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6 gap-3">
            {taxId && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setTaxId(null);
                  setFormData({
                    tax_name: "",
                    tax_type: "GST",
                    tax_rate: "",
                    description: "",
                    is_active: true,
                  });
                }}
                className={`px-6 py-2 border border-gray-300 rounded-lg text-gray-700 transition-colors font-medium text-sm ${
                  submitting ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm flex items-center shadow-sm ${
                submitting ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-700 cursor-pointer"
              }`}
            >
              <i
                className={
                  submitting
                    ? "fa-solid fa-circle-notch fa-spin mr-2"
                    : taxId
                    ? "fa-solid fa-save mr-2"
                    : "fa-solid fa-plus mr-2"
                }
              ></i>
              {submitting
                ? taxId
                  ? "Updating Tax..."
                  : "Adding Tax..."
                : taxId
                ? "Update Tax"
                : "Add Tax"}
            </button>
          </div>
        </form>

        {/* TABLE (Refer UI from Bank Master) */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    Tax Name
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase text-right">
                    Tax Rate (%)
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase text-center">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500 text-sm">
                      Loading...
                    </td>
                  </tr>
                ) : taxes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No tax records added yet.
                    </td>
                  </tr>
                ) : (
                  taxes.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50">
                      {/* Tax Name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{t.tax_name}</div>
                        {t.description && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">
                            {t.description}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                        {t.tax_type}
                      </td>

                      {/* Tax Rate (%) — Highlighted like Bank Master Balance */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-emerald-600">
                        {Number(t.tax_rate || 0).toFixed(2)} %
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${t.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                          ></span>
                          {t.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                        <div className="flex items-center justify-center">
                          <ActionButtons
                            item={t}
                            onEdit={() => handleEdit(t)}
                            onDelete={() => setDeleteModalData(t)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              fetchTaxes(page, itemsPerPage);
            }}
            onItemsPerPageChange={(limit) => {
              setItemsPerPage(limit);
              setCurrentPage(1);
              fetchTaxes(1, limit);
            }}
            startIndex={(currentPage - 1) * itemsPerPage}
            visibleItemCount={taxes.length}
            listType={true}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        deleteModalData={deleteModalData}
        onCancel={() => setDeleteModalData(null)}
        confirmDelete={confirmDelete}
        message={
          deleteModalData
            ? `Are you sure you want to delete the tax "${deleteModalData.tax_name}"? This action cannot be undone.`
            : ""
        }
      />
    </div>
  );
}
