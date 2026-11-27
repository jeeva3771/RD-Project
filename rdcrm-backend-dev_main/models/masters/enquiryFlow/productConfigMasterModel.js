import mongoose from "mongoose";

const optionItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    is_usual: { type: Boolean, default: false },
    color_swatch: { type: String, default: "" },
    icon: { type: String, default: "", trim: true },
    has_custom_input: { type: Boolean, default: false },
    custom_input_label: { type: String, default: "", trim: true },
    custom_input_placeholder: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const designFieldSchema = new mongoose.Schema(
  {
    field_key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    sub_text: { type: String, default: "", trim: true },
    field_type: {
      type: String,
      enum: [
        "pills",
        "dropdown",
        "multi_pills",
        "text",
        "number",
        "textarea",
        "checkbox",
        "file_upload",
      ],
      default: "pills",
    },
    is_required: { type: Boolean, default: false },
    default_value: { type: String, default: "", trim: true },
    master_source: { type: String, default: "", trim: true },
    applicable_sub_types: [{ type: String, trim: true }],
    is_locked: { type: Boolean, default: false },
    locked_value: { type: String, default: "", trim: true },
    selection_mode: {
      type: String,
      enum: ["single", "multiple"],
      default: "single",
    },
    max_selections: { type: Number, default: 0 },
    unit: { type: String, default: "", trim: true },
    placeholder: { type: String, default: "", trim: true },
    options: [optionItemSchema],

    // Checkbox field specific configuration
    default_checked: { type: Boolean, default: false },
    checkbox_label: { type: String, default: "", trim: true },

    // File Upload field specific configuration
    allowed_extensions: [{ type: String, trim: true }],
    allow_multiple: { type: Boolean, default: true },
    upload_hint: { type: String, default: "", trim: true },

    // Dynamic Conditional Configuration (from database)
    show_if_field: { type: String, default: "", trim: true },
    depends_on_field: { type: String, default: "", trim: true },
    show_if_condition: {
      type: String,
      default: "",
      trim: true,
    },
    show_if_value: { type: mongoose.Schema.Types.Mixed, default: null },
    option_mapping: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const presetSizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    is_usual: { type: Boolean, default: false },
    rate: { type: Number, default: 0 },
    min_qty: { type: Number, default: 1 },
    applicable_sub_types: [{ type: String, trim: true }],
  },
  { _id: false }
);

const dimensionConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    unit: { type: String, default: "in", trim: true },
    allow_custom: { type: Boolean, default: true },
    default_value: { type: String, default: "", trim: true },
    preset_sizes: [presetSizeSchema],
  },
  { _id: false }
);

const productPresetSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    specs: { type: mongoose.Schema.Types.Mixed, default: {} },
    budget: { type: Number, default: 0 },
  },
  { _id: false }
);

const subTypeSchema = new mongoose.Schema(
  {
    sub_id: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    icon: { type: String, default: "📦", trim: true },
    sub_text: { type: String, default: "", trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    default_budget: { type: Number, default: 0 },
    has_colour_wise_qty: { type: Boolean, default: false },
    show_quantities_to_price: { type: Boolean, default: true },
    preset_quantities: [{ type: Number }],
    preset_sizes: [presetSizeSchema],
    available_colours: [{ type: String, trim: true }],
    colour_swatches: { type: mongoose.Schema.Types.Mixed, default: {} },
    size_config: { type: mongoose.Schema.Types.Mixed, default: {} },
    spec_patch: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const productConfigSchema = new mongoose.Schema(
  {
    product_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: "📦",
      trim: true,
    },
    sub_label: {
      type: String,
      default: "",
      trim: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },

    // Sub-Categories / Variations (e.g. Medal -> MS punched vs Zinc cast; Badge -> Name, Emblem, Button)
    has_sub_types: {
      type: Boolean,
      default: false,
    },
    sub_types: [subTypeSchema],

    // Section 2 Header Route Strip
    route_config: {
      route: {
        type: String,
        enum: ["In-house", "Outsourced", "Partly in-house"],
        default: "In-house",
      },
      moq: { type: String, default: "MOQ 1 pcs", trim: true },
      sample_time: { type: String, default: "Sample in 2 working days", trim: true },
      note: { type: String, default: "", trim: true },
    },

    // Section 2 Questionnaire Card Rows
    design_fields: [designFieldSchema],

    // Section 3 Sizes, Quantities & Rates Configuration
    size_config: {
      size_mode: {
        type: String,
        enum: [
          "custom_2d",
          "custom_1d",
          "height_dropdown",
          "colour_wise_qty",
          "fixed_sizes_only",
          "multi_dimensions",
        ],
        default: "custom_2d",
      },
      layout: {
        type: String,
        enum: ["two_column", "classic"],
        default: "two_column",
      },
      uom: { type: String, default: "piece", trim: true },
      qty_title: { type: String, default: "", trim: true },
      qty_subtitle: { type: String, default: "", trim: true },
      rate_title: { type: String, default: "", trim: true },
      size_row_title: { type: String, default: "Size", trim: true },
      size_row_subtitle: { type: String, default: "Dimensions", trim: true },
      dimensions: [dimensionConfigSchema],
      preset_sizes: [presetSizeSchema],
      allow_custom: { type: Boolean, default: true },
      default_size: { type: String, default: "A4", trim: true },
      default_dimensions: {
        d1: { type: String, default: "8.3", trim: true },
        d2: { type: String, default: "11.7", trim: true },
        unit: { type: String, default: "in", trim: true },
      },
      preset_quantities: [{ type: Number }],
      default_qty: { type: Number, default: 0 },
      default_budget: { type: Number, default: 250 },
      budget_subtitle: { type: String, default: "What the client expects", trim: true },
      default_design_options: { type: Number, default: 2 },
      has_colour_wise_qty: { type: Boolean, default: false },
      colour_wise_sub_types: [{ type: String, trim: true }],
      show_quantities_to_price: { type: Boolean, default: true },
      quantities_to_price_sub_types: [{ type: String, trim: true }],
      sub_type_budgets: { type: mongoose.Schema.Types.Mixed, default: {} },
      available_colours: [{ type: String, trim: true }],
      colour_swatches: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // Quick Presets ("One tap fills the card")
    presets: [productPresetSchema],

    // Live Spec Line Template
    spec_line_template: {
      type: String,
      default: "{product} · {size} · {orientation} · {packaging}",
      trim: true,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  { timestamps: true }
);

productConfigSchema.index({ sort_order: 1, is_active: 1 });

export default mongoose.model("ProductConfigMaster", productConfigSchema, "product_config_masters");
