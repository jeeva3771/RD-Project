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
import ProductConfigMasterForm from "./ProductConfigMasterForm";
import ProductConfigViewModal from "./ProductConfigViewModal";
import {
  fetchProductConfigs,
  createProductConfig,
  updateProductConfig,
  deleteProductConfig,
  resetProductConfigDefaults
} from "../../../reducer/masters/enquiryFlow/productConfigMasterReducer";

const INITIAL_FORM_DATA = {
  product_id: "",
  name: "",
  icon: "📦",
  sub_label: "",
  sort_order: 0,
  is_active: true,
  has_sub_types: false,
  sub_types: [],
  route_config: {
    route: "In-house",
    moq: "MOQ 25 pcs",
    sample_time: "Sample in 2 working days",
    note: "",
  },
  design_fields: [
    {
      _clientId: "df_material",
      field_key: "material",
      label: "Material",
      sub_text: "",
      field_type: "pills",
      is_required: true,
      default_value: "",
      options: [
        { label: "Material 1", value: "Material 1", is_usual: true },
        { label: "Material 2", value: "Material 2", is_usual: false },
      ],
    },
    {
      _clientId: "df_packaging",
      field_key: "packaging",
      label: "Packaging",
      sub_text: "",
      field_type: "pills",
      is_required: true,
      default_value: "",
      options: [
        { label: "Individual box", value: "Individual box", is_usual: true },
        { label: "Polybag", value: "Polybag", is_usual: false },
      ],
    },
  ],
  size_config: {
    size_mode: "custom_2d",
    size_row_title: "Size",
    size_row_subtitle: "Dimensions",
    dimensions: [],
    preset_sizes: [],
    allow_custom: true,
    default_size: "",
    default_dimensions: { d1: "4", d2: "4", unit: "in" },
    preset_quantities: [25, 50, 100],
    default_qty: 0,
    default_budget: 150,
    budget_subtitle: "What the client expects",
    default_design_options: 2,
  },
  presets: [],
  spec_line_template: "{product} · {size} · {material} · {packaging}",
};

const ProductConfigMasterList = () => {
  const dispatch = useDispatch();
  const { showLoader, hideLoader } = useLoader();

  const { items: products = [], totalCount = 0, totalPages = 1 } = useSelector(
    (state) => state.productConfigMaster || {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "sort_order", direction: "asc" });

  // Form State
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [currentId, setCurrentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState(null);

  // Fetch Products
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

      await dispatch(fetchProductConfigs(params)).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to fetch dynamic products");
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
    if (!formData.product_id?.trim()) newErrors.product_id = "Product ID is required";
    if (!formData.name?.trim()) newErrors.name = "Product name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA);
    setCurrentId(null);
    setErrors({});
  };

  const handleEdit = (item) => {
    const cleanItem = JSON.parse(JSON.stringify(item || {}));
    setFormData({
      product_id: cleanItem.product_id || "",
      name: cleanItem.name || "",
      icon: cleanItem.icon || "📦",
      sub_label: cleanItem.sub_label || "",
      sort_order: cleanItem.sort_order ?? 0,
      is_active: cleanItem.is_active ?? true,
      has_sub_types: !!cleanItem.has_sub_types,
      sub_types: cleanItem.sub_types || [],
      route_config: cleanItem.route_config || {
        route: "In-house",
        moq: "MOQ 25 pcs",
        sample_time: "Sample in 2 working days",
        note: "",
      },
      design_fields: (cleanItem.design_fields || []).map((f, i, all) => {
        const preceding = all.filter((_, idx) => idx < i);
        const pKey = f.depends_on_field || f.show_if_field;
        const isValid = pKey && preceding.some((pf) => pf.field_key === pKey);
        return {
          ...f,
          depends_on_field: isValid ? f.depends_on_field : "",
          show_if_field: isValid ? f.show_if_field : "",
          option_mapping: isValid ? f.option_mapping || {} : {},
          _clientId: f._clientId || f._id || `df_${i}_${Date.now()}`,
        };
      }),
      size_config: {
        ...(cleanItem.size_config || {}),
        preset_sizes: [],
        dimensions: cleanItem.size_config?.dimensions || [],
      },
      presets: cleanItem.presets || [],
      spec_line_template: cleanItem.spec_line_template || "{product} · {size}",
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
      const sanitizedFields = (formData.design_fields || []).map(({ _clientId, ...rest }, i, all) => {
        const preceding = all.filter((_, idx) => idx < i);
        const pKey = rest.depends_on_field || rest.show_if_field;
        const isValid = pKey && preceding.some((pf) => pf.field_key === pKey);
        return {
          ...rest,
          depends_on_field: isValid ? rest.depends_on_field : "",
          show_if_field: isValid ? rest.show_if_field : "",
          option_mapping: isValid ? rest.option_mapping || {} : {},
        };
      });

      // Sanitize size_config: deduplicate dimensions preset_sizes & preset_quantities
      const sanitizedDimensions = (formData.size_config?.dimensions || []).map((dim) => {
        const seen = new Set();
        const uniquePresets = (dim.preset_sizes || []).filter((ps) => {
          const clean = (ps.label || "").trim().toLowerCase();
          if (!clean || seen.has(clean)) return false;
          seen.add(clean);
          return true;
        });
        return { ...dim, preset_sizes: uniquePresets };
      });

      const uniqueQuantities = Array.from(new Set(formData.size_config?.preset_quantities || []));

      const payload = {
        ...formData,
        size_config: {
          ...(formData.size_config || {}),
          dimensions: sanitizedDimensions,
          preset_quantities: uniqueQuantities,
          preset_sizes: [],
        },
        design_fields: sanitizedFields,
        sub_types: formData.has_sub_types
          ? (formData.sub_types || []).filter((s) => s.label?.trim() && s.sub_id?.trim())
          : [],
      };

      if (currentId) {
        await dispatch(updateProductConfig({ id: currentId, ...payload })).unwrap();
        toast.success("Product configuration updated successfully");
      } else {
        await dispatch(createProductConfig(payload)).unwrap();
        toast.success("Product configuration created successfully");
      }
      handleReset();
      setIsFormOpen(false);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to save product configuration");
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
      await dispatch(deleteProductConfig(targetId)).unwrap();
      toast.success("Product configuration deleted successfully");
      setDeleteModalData(null);
      fetchList();
    } catch (error) {
      console.error(error);
      toast.error(typeof error === "string" ? error : "Failed to delete product configuration");
    } finally {
      setIsDeleting(false);
      hideLoader();
    }
  };

  const handleSyncDefaults = async () => {
    if (!window.confirm("Sync all standard products with default seed templates? Any missing standard options and fields will be refreshed.")) {
      return;
    }
    showLoader();
    try {
      await dispatch(resetProductConfigDefaults()).unwrap();
      toast.success("Standard products synced successfully!");
      fetchList();
    } catch (err) {
      console.error(err);
      toast.error(typeof err === "string" ? err : "Failed to sync defaults");
    } finally {
      hideLoader();
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>⚙️</span>
            <span>Product Configuration Engine</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage Section 2 questionnaire cards and Section 3 size panels for existing and future products
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSyncDefaults}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer transition flex items-center gap-1.5"
            title="Re-sync default product fields and options from seed templates"
          >
            <span>🔄</span>
            <span>Sync Defaults</span>
          </button>

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
            className="px-4 py-2 bg-[#4B3BF5] hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-2"
          >
            <span>{isFormOpen ? "✕ Close Form" : "+ Create New Product"}</span>
          </button>
        </div>
      </div>

      {/* Masters Hub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 overflow-x-auto text-xs">
        <Link
          to="/product-configs"
          className="px-3.5 py-1.5 rounded-xl font-bold bg-[#4B3BF5] text-white shadow-xs"
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

      {/* Form (Collapsible / Toggleable) */}
      {isFormOpen && (
        <ProductConfigMasterForm
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

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search products by name or slug..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:border-[#4B3BF5]"
            />
            <span className="absolute left-3 top-2 text-xs text-gray-400">🔍</span>
          </div>

          <span className="text-xs font-bold text-gray-500">
            Total Products: <span className="text-gray-900">{totalCount}</span>
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Icon & Name</th>
                <th className="py-3 px-4">Product Slug</th>
                <th className="py-3 px-4">Dimensions</th>
                <th className="py-3 px-4">Route Type</th>
                <th className="py-3 px-4 text-center">Question Rows</th>
                <th className="py-3 px-4 text-center">Presets</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-400 text-xs">
                    No products found. Click "+ Create New Product" above to add one.
                  </td>
                </tr>
              ) : (
                products.map((item, idx) => (
                  <tr key={item._id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-gray-400">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon || "📦"}</span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-900">{item.name}</span>
                            {item.has_sub_types && item.sub_types?.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {item.sub_types.length} sub-types
                              </span>
                            )}
                          </div>
                          {item.sub_label && (
                            <div className="text-[10px] text-gray-400 font-normal">{item.sub_label}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-mono text-[11px]">
                        {item.product_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">
                      {item.size_config?.dimensions?.length > 0 ? (
                        <span className="text-gray-900 font-bold">
                          {item.size_config.dimensions.map((d) => d.label).join(" × ")}
                        </span>
                      ) : item.product_id === "trophy" ? (
                        <span className="text-gray-600 font-medium">Height presets (6"–18")</span>
                      ) : (
                        <span className="text-gray-400 font-normal">Standard size</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.route_config?.route || "In-house"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#4B3BF5]">
                      {item.design_fields?.length || 0} rows
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-gray-600">
                      {item.presets?.length || 0}
                    </td>
                    <td className="py-3 px-4">
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
          visibleItemCount={products.length}
          listType={true}
        />
      </div>

      {/* View Details Modal */}
      {viewModalData && (
        <ProductConfigViewModal
          isOpen={!!viewModalData}
          onClose={() => setViewModalData(null)}
          product={viewModalData}
          onEdit={(item) => handleEdit(item)}
        />
      )}

      {/* Delete Modal */}
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

export default ProductConfigMasterList;
