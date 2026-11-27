import React, { useEffect, useState } from "react";
import { FormControl, Select, MenuItem, Autocomplete, TextField } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllTypes } from "../../../reducer/inventory/common/materialTypeReducer";
import { fetchAllCategories } from "../../../reducer/inventory/common/materialCategoryReducer";
import { fetchAllRateUnits } from "../../../reducer/inventory/common/rateUnitReducer";
import { createItem, fetchAllItems, deleteItem } from "../../../reducer/inventory/itemReducer";
import { createCustomItem, deleteCustomItem } from "../../../reducer/inventory/customItemReducer";
import { fetchAllUnits } from "../../../reducer/unitReducer";
import { nanoid } from "@reduxjs/toolkit";
import { toast } from "react-toastify";
import ImageLightbox from "../../common/ImageLightbox";



export default function MaterialSelect({ handleNext, handleBack, handleSaveDraft, formData, setFormData, isViewMode, SamplesalesOrderdata }) {
  const dispatch = useDispatch();

  const [localData, setLocalData] = useState({
    master: formData.master || "",
    secondarycategory: formData.secondarycategory || "",
    subCategory: formData.subCategory || "",
    itemType: formData.itemType || "Standard",
    alias: formData.alias || "",
    color: formData.color || "",
  });

  const [customFields, setCustomFields] = useState({
    itemName: "",
    rate: "",
    customItemType: "Direct",
    length: "",
    width: "",
    height: "",
    thickness: "",
    unit: "",
    vendorName: "",
    rateUnit: "",
  });


  const [itemsList, setItemsList] = useState(formData.customItems || []);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [errors, setErrors] = useState({});
  const [previewLightboxImg, setPreviewLightboxImg] = useState(null);

  // ── Universal Job Specifications Banner Data (All Product Types: Trophy, Medal, Plaque, Badge, Frame, etc.) ──
  const subJobNo = formData?.subJobNo || SamplesalesOrderdata?.sub_job_no || SamplesalesOrderdata?.id || "—";
  const productName = formData?.productName || SamplesalesOrderdata?.product_name || "Custom Trophy";
  const jobNo = formData?.jobNo || SamplesalesOrderdata?.job_no || "";
  const refNo = formData?.reference_no || SamplesalesOrderdata?.enquiry_id?.reference_no || "";
  const jobQty = formData?.jobQty || SamplesalesOrderdata?.job_quantity || SamplesalesOrderdata?.quantity || 1;

  const rawProductType = (
    formData?.trophy_type ||
    formData?.product_type ||
    SamplesalesOrderdata?.trophy_type ||
    SamplesalesOrderdata?.product_type ||
    "custom"
  ).toLowerCase();

  const chosenMaterial =
    formData?.material ||
    SamplesalesOrderdata?.material ||
    SamplesalesOrderdata?.enquiry_id?.preferred_material ||
    (Array.isArray(SamplesalesOrderdata?.the_ask?.materials)
      ? SamplesalesOrderdata.the_ask.materials.join(", ")
      : SamplesalesOrderdata?.the_ask?.materials) ||
    "Not Specified";

  const chosenSize =
    formData?.size ||
    SamplesalesOrderdata?.size ||
    (Array.isArray(SamplesalesOrderdata?.enquiry_id?.product_size) &&
      (SamplesalesOrderdata.enquiry_id.product_size[0]?.size ||
        SamplesalesOrderdata.enquiry_id.product_size[0]?.cms ||
        SamplesalesOrderdata.enquiry_id.product_size[0]?.inch)) ||
    (Array.isArray(SamplesalesOrderdata?.the_ask?.sizes)
      ? SamplesalesOrderdata.the_ask.sizes.join(", ")
      : SamplesalesOrderdata?.the_ask?.size) ||
    "Not Specified";

  const specLine =
    formData?.spec_line ||
    SamplesalesOrderdata?.spec_line ||
    formData?.specs ||
    SamplesalesOrderdata?.specs ||
    SamplesalesOrderdata?.job_description ||
    SamplesalesOrderdata?.the_ask?.brief_text ||
    "";

  const specObj =
    formData?.spec ||
    SamplesalesOrderdata?.spec ||
    SamplesalesOrderdata?.enquiry_id?.spec ||
    {};

  const theme =
    formData?.theme ||
    SamplesalesOrderdata?.theme ||
    SamplesalesOrderdata?.subcategory ||
    "";

  const previewImg =
    formData?.orgimage ||
    SamplesalesOrderdata?.image ||
    SamplesalesOrderdata?.orgimage ||
    null;

  const designerFiles =
    formData?.designer_files ||
    SamplesalesOrderdata?.designer_files ||
    [];

  // Dynamic Product Type Meta
  const productMetaMap = {
    medal: { label: "Medal", icon: "🥇", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
    plaque: { label: "Plaque", icon: "📜", bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
    badge: { label: "Badge", icon: "🏷️", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
    frame: { label: "Certificate Frame", icon: "🖼️", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
    trophy: { label: "Custom Trophy", icon: "🏆", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
    custom: { label: "Custom Trophy", icon: "🏆", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
    lapel_pin: { label: "Lapel Pin", icon: "📌", bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" },
    cufflinks: { label: "Cufflinks", icon: "👔", bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300" },
    tie_pin: { label: "Tie Bar", icon: "👔", bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300" },
    fridge_magnet: { label: "Fridge Magnet", icon: "🧲", bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-300" },
  };

  const currentMeta = productMetaMap[rawProductType] || {
    label: rawProductType ? rawProductType.toUpperCase() : "Custom Product",
    icon: "📦",
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    border: "border-indigo-300"
  };

  // Extract selected design options from "What's the design?" questionnaire
  const designOptionChips = [];
  if (specObj && typeof specObj === "object") {
    if (specObj.ribbon) designOptionChips.push({ label: "Ribbon", val: specObj.ribbon });
    if (specObj.front_treatment) designOptionChips.push({ label: "Front", val: specObj.front_treatment });
    if (specObj.back_treatment && specObj.back_treatment !== "Blank") designOptionChips.push({ label: "Back", val: specObj.back_treatment });
    if (specObj.medalType) designOptionChips.push({ label: "Medal Type", val: specObj.medalType === "zinc_cast" ? "Zinc Die-cast" : "MS Punched" });
    if (specObj.badgeType) designOptionChips.push({ label: "Badge Type", val: specObj.badgeType });
    if (specObj.shape) designOptionChips.push({ label: "Shape", val: specObj.shape });
    if (specObj.layers) designOptionChips.push({ label: "Layers", val: `${specObj.layers} layer${specObj.layers > 1 ? "s" : ""}` });
    if (specObj.display) designOptionChips.push({ label: "Display", val: specObj.display });
    if (specObj.fix) designOptionChips.push({ label: "Fixing", val: specObj.fix });
    if (specObj.plating) designOptionChips.push({ label: "Plating", val: specObj.plating });
    if (specObj.metal) designOptionChips.push({ label: "Metal", val: specObj.metal });
    if (specObj.glazing) designOptionChips.push({ label: "Glazing", val: specObj.glazing });
    if (specObj.mWidth) designOptionChips.push({ label: "Moulding", val: `${specObj.mWidth} in` });
    if (specObj.stand) designOptionChips.push({ label: "Stand", val: specObj.stand });
    if (specObj.edge) designOptionChips.push({ label: "Edge", val: specObj.edge });
    if (specObj.thk) designOptionChips.push({ label: "Thickness", val: `${specObj.thk} mm` });
    if (specObj.deco) designOptionChips.push({ label: "Decoration", val: specObj.deco });
    if (specObj.print) designOptionChips.push({ label: "Print", val: Array.isArray(specObj.print) ? specObj.print.join(", ") : specObj.print });
    if (specObj.colour && specObj.colour !== "+ Client colour") designOptionChips.push({ label: "Colour", val: specObj.colour });
  }

  const { types, loading: typesLoading } = useSelector((state) => state.materialTypes);
  const { categories, loading: categoriesLoading } = useSelector((state) => state.materialCategories);
  const { items, loading: itemsLoading } = useSelector((state) => state.items);

  const { units, loading: unitsLoading } = useSelector((state) => state.unit);
  const { rateUnits } = useSelector((state) => state.rateUnit);


  const masterOptions = types
    .filter(item => item.name !== "Packing Material")
    .map((item) => ({ id: item._id, name: item.name }));
  const secondarycategoryOptions = categories.map((cat) => ({ id: cat._id, name: cat.name }));
  const subCategoryOptions = items.map((item) => ({
    id: item._id,
    name: item.name,
    item_type: item.item_type,
    category_type: item.type?.name || "",
    stock_sizes: item.stock_sizes || [],
    price: item.price,
  }));
  const unitOptions = units.map((unit) => ({ id: unit._id, name: unit.name }));

  const rateUnitOptions = rateUnits.map((ru) => ({
    id: ru._id,
    name: ru.symbol,
  }));



  useEffect(() => {
    dispatch(fetchAllRateUnits());
    dispatch(fetchAllTypes({ order: "asc" }));
    dispatch(fetchAllCategories({ order: "asc" }));
    dispatch(fetchAllUnits({ order: "asc" }));
  }, [dispatch]);

  useEffect(() => {
    if (!localData.master) return;

    const payload = { sortOrder: "asc", type_id: localData.master };


    if (localData.masterName === "Raw Material" && localData.secondarycategory) {
      payload.category = localData.secondarycategory;
    }

    dispatch(fetchAllItems(payload));
  }, [dispatch, localData.master, localData.secondarycategory, localData.masterName]);


  const handleChange = (e) => {
    const { name, value } = e.target;

    let masterName = localData.masterName;
    if (name === "master") {
      const selectedMaster = types.find((t) => t._id === value);
      masterName = selectedMaster ? selectedMaster.name : "";
    }

    setLocalData({ ...localData, [name]: value, masterName });
    setErrors({ ...errors, [name]: "" });
  };

  // Add this function inside your MaterialSelect component
  const handleRefresh = () => {
    setLocalData({
      master: "",
      secondarycategory: "",
      subCategory: "",
      itemType: "Standard",
      alias: "",
      color: "",
      masterName: ""
    });
    setCustomFields({
      itemName: "",
      rate: "",
      customItemType: "Direct",
      length: "",
      width: "",
      height: "",
      thickness: "",
      unit: "",
      vendorName: "",
      rateUnit: "",
    });
    setItemsList([]);
    setErrors({});

    // 2. Clear Parent formData (specifications, grouping, process)
    // We pass an object that explicitly empties these keys
    setFormData({
      ...formData,
      customItems: [],
      materialSpecification: [], // Removes specification data
      materialGroups: [],      // Removes material grouping
      materialprocess: []         // Removes material process
    });
  };



  const handleCustomChange = (e) => {
    const { name, value } = e.target;

    if (["length", "width", "height", "rate"].includes(name)) {
      if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    }

    setCustomFields({ ...customFields, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const addItem = async () => {
    let newErrors = {};

    if (localData.itemType === "Standard") {
      if (!localData.master) newErrors.master = "Select a Primary category";
      // if (!localData.secondarycategory) newErrors.secondarycategory = "Select a category";
      if (!localData.subCategory) newErrors.subCategory = "Select an item";
    } else {
      if (!customFields.itemName) newErrors.itemName = "Item Name required";
      if (!customFields.rateUnit)
        newErrors.rateUnit = "Rate unit required";

      if (!customFields.rate) newErrors.rate = "Rate required";
      if (!customFields.customItemType)
        newErrors.customItemType = "Select item type";
      if (!customFields.vendorName) newErrors.vendorName = "Vendor Name required";

    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    const selectedSubCategory = subCategoryOptions.find(s => s.id === localData.subCategory);

    let finalId = nanoid();
    let inventoryRef = null;

    if (localData.itemType === "Custom") {
      try {
        // Option B: Automatically save custom item to master inventory
        const unitObj = units.find(u => u.name === customFields.unit);
        const rateUnitObj = rateUnits.find(ru => ru.symbol === customFields.rateUnit);

        // Removed master requirement

        const createPayload = {
          name: customFields.itemName.trim(),
          type_id: localData.master || undefined,
          category_id: localData.secondarycategory || undefined,
          item_type: customFields.customItemType.toLowerCase(),
          rate_unit: rateUnitObj?._id || rateUnitObj?.id, // Rate Unit is the primary unit in master
          price: customFields.rate,
          is_inventory_item: false,
          length: customFields.length || undefined,
          width: customFields.width || undefined,
          height: customFields.height || undefined,
          thickness: customFields.thickness || undefined,
          dimension_unit: unitObj?._id || unitObj?.id || undefined,
          reference_vendor_name: customFields.vendorName || undefined,
          source_bom_id: formData._id || formData.id,
          source_bom_type: formData.standalone_bom ? "standalone" : "quotation",
          job_no: formData.jobNo || formData.job_no || SamplesalesOrderdata?.job_no || null,
          sub_job_no: formData.subJobNo || formData.sub_job_no || SamplesalesOrderdata?.sub_job_no || null,
          reference_no: formData.reference_no || SamplesalesOrderdata?.enquiry_id?.reference_no || null,
        };

        console.log("Creating Custom Item Payload:", createPayload);

        const resultAction = await dispatch(createCustomItem(createPayload)).unwrap();
        console.log("Custom Item Created Successfully:", resultAction);
        finalId = resultAction.id;
        inventoryRef = resultAction._id;
        toast.success(`"${customFields.itemName}" saved to Custom Items list`);
      } catch (error) {
        console.error("Failed to save custom item to inventory:", error);
        // If it already exists, we might want to use the existing one, but for now we'll just alert
        if (error.message?.includes("already exists")) {
          toast.info("Item with this name already exists in inventory master.");
        } else {
          toast.warning("Could not save to master inventory, but adding to BOM locally.");
        }
      }
    }

    const customStockSizes =
      customFields.customItemType === "sheet" &&
        customFields.length &&
        customFields.width
        ? [`${customFields.length}x${customFields.width}`]
        : [];

    const newItem = localData.itemType === "Standard"
      ? {
        item_id: finalId,
        type: "Standard",
        subCategoryId: selectedSubCategory?._id || localData.subCategory,
        itemName: selectedSubCategory?.name || "",
        itemType: selectedSubCategory?.item_type || "",
        category_type: selectedSubCategory?.category_type || "",
        stockSizes: selectedSubCategory?.stock_sizes?.map(s => s.size) || [],
        master: localData.master,
        secondarycategory: localData.secondarycategory,
        alias: localData.alias,
        color: localData.color,
        rate: selectedSubCategory?.price || "",
        is_inventory_item: true,
      }
      : {
        item_id: finalId,
        master_id: inventoryRef, // Store reference to inventory if created
        type: "Custom",
        itemName: customFields.itemName,
        rate: customFields.rate,
        itemType: customFields.customItemType,
        thickness: customFields.thickness,
        length: customFields.length,
        width: customFields.width,
        height: customFields.height,
        alias: localData.alias,
        color: localData.color,
        unit: customFields.unit,
        vendorName: customFields.vendorName,
        rateUnit: customFields.rateUnit,
        stockSizes: customStockSizes,
        is_inventory_item: false,
      };




    setItemsList([...itemsList, newItem]);

    // Reset form fields
    setCustomFields({ itemName: "", rate: "", length: "", width: "", height: "", unit: "", vendorName: "", thickness: "", customItemType: "Direct", rateUnit: "" });
    setLocalData({
      master: "",
      secondarycategory: "",
      subCategory: "",
      itemType: "Standard",
      alias: "",
      color: ""
    });
  };




  const removeItem = async (index) => {
    const itemToRemove = itemsList[index];
    
    // If it's a custom item that was saved to the master inventory, delete it there too
    if (itemToRemove.type === "Custom" && itemToRemove.master_id && !itemToRemove.is_inventory_item) {
      try {
        await dispatch(deleteCustomItem(itemToRemove.item_id)).unwrap();
        toast.success(`Removed "${itemToRemove.itemName}" from system`);
      } catch (error) {
        console.error("Failed to delete custom item from inventory:", error);
        toast.error("Failed to fully remove custom item from inventory");
      }
    }
    
    setItemsList(itemsList.filter((_, i) => i !== index));
  };

  // Reordering functions
  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newItems = [...itemsList];
    const draggedItem = newItems[draggedItemIndex];

    // Remove dragged item and insert at new position
    newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setItemsList(newItems);
    setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const getSubCategoryName = (id) => subCategoryOptions.find((s) => s.id === id)?.name || "";
  const getSubCategorytypeName = (id) => subCategoryOptions.find((s) => s.id === id)?.item_type || "";


  const getSubCategorysizes = (id) => {
    const subCategory = subCategoryOptions.find((s) => s.id === id);
    return subCategory?.stock_sizes?.map(s => s.size) || [];
  };



  const onNextClick = () => {
    handleNext({
      ...localData,
      customItems: [...itemsList]
    });
  };

  const onSaveDraftClick = () => {
    handleSaveDraft({
      ...localData,
      customItems: [...itemsList]
    });
  };


  return (
    <>
      {/* ── Universal Job Specifications Banner (Trophy, Medal, Plaque, Badge, Frame, etc.) ── */}
      <div className="mb-6 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Approved Design / Reference Image Preview */}
          {previewImg ? (
            <div
              className="relative group flex-shrink-0 cursor-pointer"
              onClick={() => setPreviewLightboxImg(previewImg)}
              title="Click to zoom approved design"
            >
              <img
                src={previewImg}
                alt={productName}
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg border-2 border-indigo-200 bg-white p-1 shadow-sm group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                <i className="fa-solid fa-magnifying-glass-plus mr-1"></i> Zoom
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs flex-shrink-0">
              <i className="fa-solid fa-image text-2xl mb-1 text-gray-300"></i>
              <span>No Image</span>
            </div>
          )}

          {/* Job Details & Requirements */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border ${currentMeta.bg} ${currentMeta.text} ${currentMeta.border}`}>
                <span>{currentMeta.icon}</span>
                <span>{currentMeta.label}</span>
              </span>

              <span className="font-extrabold text-indigo-700 text-base sm:text-lg tracking-wide">
                {subJobNo}
              </span>
              {jobNo && jobNo !== subJobNo && (
                <span className="text-xs text-gray-500 font-medium">({jobNo})</span>
              )}
              {refNo && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                  Ref: {refNo}
                </span>
              )}
              <span className="text-sm font-bold text-slate-800 ml-1">
                — {productName}
              </span>
            </div>

            {/* Badges for Material, Size, Quantity */}
            <div className="flex flex-wrap items-center gap-2 my-2">
              {/* Chosen Material Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg shadow-2xs">
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-700">Material:</span>
                <span className="text-sm font-black text-amber-950">{chosenMaterial}</span>
              </div>

              {/* Size Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg shadow-2xs">
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-700">Size:</span>
                <span className="text-sm font-black text-emerald-950">{chosenSize}</span>
              </div>

              {/* Quantity Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-900 border border-blue-300 rounded-lg shadow-2xs">
                <span className="text-xs uppercase font-extrabold tracking-wider text-blue-700">Quantity:</span>
                <span className="text-sm font-black text-blue-950">{jobQty}</span>
              </div>

              {/* Theme Badge */}
              {theme && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-xs font-semibold">
                  <span>Theme: {theme}</span>
                </div>
              )}
            </div>

            {/* "What's the design?" Selected Options Chips */}
            {designOptionChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Selected Design Specs:
                </span>
                {designOptionChips.map((chip, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <span className="text-slate-400 font-normal">{chip.label}:</span>
                    <span className="font-semibold">{chip.val}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Spec Line / Brief Text Summary */}
            {specLine && (
              <div className="mt-2 text-xs text-slate-600 bg-white/80 border border-indigo-50 rounded-md px-3 py-1.5">
                <span className="font-bold text-slate-700">Brief / Specs Summary: </span>
                {specLine}
              </div>
            )}
          </div>

          {/* Designer / Production Files Download Shortcut */}
          {designerFiles.length > 0 && (
            <div className="flex-shrink-0 self-center">
              <button
                type="button"
                onClick={() => window.open(designerFiles[0], "_blank")}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-700 transition cursor-pointer"
                title="Download / View Approved Production Artwork (.cdr / .pdf)"
              >
                <i className="fa-solid fa-file-arrow-down text-sm"></i>
                <span>Artwork File</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800">Add Material</h2>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isViewMode}
          className="flex items-center gap-1 text-red-600 hover:text-red-800 transition-colors text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh All
        </button>
      </div>
      <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">

          <div className="flex flex-col gap-4">
            {/* Item Type */}
            <FormControl fullWidth size="small">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Item Type</label>
              <Select name="itemType" value={localData.itemType} onChange={handleChange} disabled={isViewMode}>
                <MenuItem value="Standard">Standard</MenuItem>
                <MenuItem value="Custom">Custom</MenuItem>
              </Select>
            </FormControl>

            {/* Standard Fields */}
            {localData.itemType === "Standard" && (
              <>
                <FormControl fullWidth size="small">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Primary Category <span className="text-red-500">*</span>
                  </label>
                  <Autocomplete
                    options={masterOptions}
                    getOptionLabel={(option) => option.name || ""}
                    value={masterOptions.find(opt => opt.id === localData.master) || null}
                    onChange={(event, newValue) => {
                      const value = newValue ? newValue.id : "";
                      let masterName = "";
                      if (newValue) {
                        const selectedMaster = types.find((t) => t._id === value);
                        masterName = selectedMaster ? selectedMaster.name : "";
                      }
                      setLocalData({ ...localData, master: value, masterName });
                      setErrors({ ...errors, master: "" });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select Primary Category"
                        size="small"
                        error={!!errors.master}
                      />
                    )}
                    disabled={isViewMode}
                    loading={typesLoading}
                  />
                  {errors.master && <p className="text-red-600 text-sm mt-1">{errors.master}</p>}
                </FormControl>

                {localData.masterName === "Raw Material" && (
                  <FormControl fullWidth size="small">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Category <span className="text-red-500">*</span>
                    </label>
                    <Autocomplete
                      options={secondarycategoryOptions}
                      getOptionLabel={(option) => option.name || ""}
                      value={secondarycategoryOptions.find(opt => opt.id === localData.secondarycategory) || null}
                      onChange={(event, newValue) => {
                        const value = newValue ? newValue.id : "";
                        setLocalData({ ...localData, secondarycategory: value });
                        setErrors({ ...errors, secondarycategory: "" });
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Category"
                          size="small"
                          error={!!errors.secondarycategory}
                        />
                      )}
                      disabled={isViewMode}
                      loading={categoriesLoading}
                    />
                    {errors.secondarycategory && <p className="text-red-600 text-sm mt-1">{errors.secondarycategory}</p>}
                  </FormControl>
                )}


                <FormControl fullWidth size="small">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Item <span className="text-red-500">*</span>
                  </label>
                  <Autocomplete
                    options={subCategoryOptions}
                    getOptionLabel={(option) => option.name ? `${option.name} (${option.item_type || "-"})` : ""}
                    value={subCategoryOptions.find(opt => opt.id === localData.subCategory) || null}
                    onChange={(event, newValue) => {
                      const value = newValue ? newValue.id : "";
                      setLocalData({ ...localData, subCategory: value });
                      setErrors({ ...errors, subCategory: "" });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select Sub Category"
                        size="small"
                        error={!!errors.subCategory}
                      />
                    )}
                    disabled={isViewMode}
                    loading={itemsLoading}
                  />
                  {errors.subCategory && <p className="text-red-600 text-sm mt-1">{errors.subCategory}</p>}
                </FormControl>
              </>
            )}

            {/* Custom Fields */}
            {localData.itemType === "Custom" && (
              <>


                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name <span className="text-red-500">*</span></label>
                  <input type="text" name="itemName" value={customFields.itemName} onChange={handleCustomChange} placeholder="Enter item name" disabled={isViewMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.itemName ? "border-red-500" : "border-gray-300"}`} />
                  {errors.itemName && <span className="text-red-500 text-xs mt-1">{errors.itemName}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* RATE */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Rate <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="rate"
                      value={customFields.rate}
                      onChange={handleCustomChange}
                      disabled={isViewMode}
                      placeholder="Enter rate"
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.rate ? "border-red-500" : "border-gray-300"
                        }`}
                    />
                    {errors.rate && (
                      <span className="text-red-500 text-xs">{errors.rate}</span>
                    )}
                  </div>

                  {/* RATE UNIT */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Rate Unit  <span className="text-red-500">*</span>
                    </label>

                    <FormControl fullWidth size="small">
                      <Select
                        name="rateUnit"
                        value={customFields.rateUnit}
                        onChange={handleCustomChange}
                        displayEmpty
                        disabled={isViewMode}
                      >
                        <MenuItem value="">
                          <span className="text-gray-500">Select Unit</span>
                        </MenuItem>
                        {rateUnitOptions.map((ru) => (
                          <MenuItem key={ru.id} value={ru.name}>
                            {ru.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {errors.rateUnit && (
                      <span className="text-red-500 text-xs">{errors.rateUnit}</span>
                    )}
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Item Type <span className="text-red-500">*</span>
                  </label>

                  <FormControl fullWidth size="small">
                    <Select
                      name="customItemType"
                      value={customFields.customItemType}
                      onChange={handleCustomChange}
                      displayEmpty
                      disabled={isViewMode}
                    >
                      <MenuItem value="">
                        <span className="text-gray-500">Select Item Type</span>
                      </MenuItem>
                      <MenuItem value="Direct">Direct</MenuItem>
                      <MenuItem value="sheet">Sheet</MenuItem>
                    </Select>
                  </FormControl>

                  {errors.customItemType && (
                    <span className="text-red-500 text-xs">{errors.customItemType}</span>
                  )}
                </div>


                {/* Length, Width, Height, and Unit */}
                <div className="grid grid-cols-4 gap-2">
                  {/* {["length", "width", "height"].map((dim) => (
                    <div key={dim}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        {dim.charAt(0).toUpperCase() + dim.slice(1)}
                      </label>
                      <input
                        type="number"
                        name={dim}
                        value={customFields[dim]}
                        onChange={handleCustomChange}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors[dim] ? "border-red-500" : "border-gray-300"}`}
                        min="0"
                      />
                      {errors[dim] && <span className="text-red-500 text-xs mt-1">{errors[dim]}</span>}
                    </div>
                  ))} */}
                  {/* DIRECT → Length, Width, Height */}
                  {customFields.customItemType === "Direct" &&
                    ["length", "width", "height"].map((dim) => (
                      <div key={dim}>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          {dim.charAt(0).toUpperCase() + dim.slice(1)}
                        </label>
                        <input
                          type="number"
                          name={dim}
                          value={customFields[dim]}
                          onChange={handleCustomChange}
                          disabled={isViewMode}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                    ))}

                  {/* SHEET → Length, Width, Thickness */}
                  {customFields.customItemType === "sheet" && (
                    <>
                      {["length", "width", "thickness"].map((dim) => (
                        <div key={dim}>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            {dim.charAt(0).toUpperCase() + dim.slice(1)}
                          </label>
                          <input
                            type="number"
                            name={dim}
                            value={customFields[dim]}
                            onChange={handleCustomChange}
                            disabled={isViewMode}
                            placeholder={["length", "width"].includes(dim) ? "inch" : ""}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>
                      ))}
                    </>
                  )}


                  {/* Unit Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
                    <FormControl fullWidth size="small">
                      <Select
                        name="unit"
                        value={customFields.unit}
                        onChange={handleCustomChange}
                        displayEmpty
                        disabled={isViewMode}
                      >
                        <MenuItem value=""><span className="text-gray-500">Select Unit</span></MenuItem>
                        {unitsLoading ? <MenuItem disabled>Loading...</MenuItem> :
                          unitOptions.map((u) => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vendorName"
                    value={customFields.vendorName}
                    onChange={handleCustomChange}
                    disabled={isViewMode}
                    placeholder="Enter vendor name"
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.vendorName ? "border-red-500" : "border-gray-300"
                      }`}
                  />
                  {errors.vendorName && (
                    <span className="text-red-500 text-xs">{errors.vendorName}</span>
                  )}
                </div>

              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Alias */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Alias (Optional)</label>
                <input type="text" name="alias" value={localData.alias} onChange={handleChange} placeholder="Enter alias" disabled={isViewMode}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Color (Optional)</label>
                <input type="text" name="color" value={localData.color} onChange={handleChange} placeholder="Enter color" disabled={isViewMode}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>

          {/* Add Item */}
          <button type="button" onClick={addItem} className="mt-2 px-4 py-2 text-white rounded-md" disabled={isViewMode}
            style={{ backgroundColor: "#4f46e5" }}>
            Add Item
          </button>
        </div>

        <div className="flex flex-col">
          {itemsList.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2 text-sm">Selected Items</h3>

              {/* SCROLL CONTAINER */}
              <div className="flex flex-col gap-2 pr-1">
                {itemsList.map((item, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex justify-between items-start border rounded-lg p-2 bg-gray-50 w-full cursor-move transition-all ${draggedItemIndex === idx ? "opacity-50 border-blue-400 bg-blue-50" : ""
                      }`}
                  >
                    <div className="flex flex-col w-full pointer-events-none">
                      {/* TITLE */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {item.type === "Standard" ? item.itemName : item.itemName}

                          <span className="text-xs text-gray-500">({item.type})</span>
                        </span>

                        {item.alias && (
                          <span className="text-blue-600 text-xs">"{item.alias}"</span>
                        )}
                        {item.category_type && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] border border-gray-200">
                            {item.category_type}
                          </span>
                        )}
                      </div>

                      {/* META INFO */}
                      <div className="flex gap-2 text-xs text-gray-600 mt-0.5 flex-wrap">
                        {item.itemType && (
                          <span>{item.itemType}</span>
                        )}

                        {item.rate && <span> ₹{item.rate} {item.rateUnit}</span>}


                        {item.color && <span className="text-gray-400">•</span>}
                        {item.color && <span>{item.color}</span>}


                        {item.type === "Custom" &&
                          ["length", "width", "height", "thickness"].map(
                            (d) => item[d] && <span key={d}>{d}:{item[d]}
                            </span>
                          )}
                        {item.unit && <span>{item.unit}</span>}

                        {item.vendorName && (
                          <span className="text-xs text-blue-500">
                            Vendor: {item.vendorName}
                          </span>
                        )}


                      </div>
                    </div>

                    {/* REMOVE BUTTON */}
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={isViewMode}
                      className="text-red-500 hover:text-red-700 text-xs ml-3 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Next / Back */}
        <div className="col-span-full flex justify-between mt-6">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-md bg-orange-500 text-white border border-orange-600 hover:bg-orange-600"
          >
            Back
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraftClick}
              className="px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700"
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={onNextClick}
              disabled={itemsList.length === 0}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        </div>

      </form>
      {previewLightboxImg && (
        <ImageLightbox
          src={previewLightboxImg}
          fileName={productName || subJobNo}
          onClose={() => setPreviewLightboxImg(null)}
        />
      )}
    </>
  );
}
