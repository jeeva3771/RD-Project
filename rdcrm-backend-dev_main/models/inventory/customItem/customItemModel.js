import mongoose from "mongoose";

const customItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    item_code: { type: String, required: true, unique: true, trim: true },

    name: {
      type: String,
      required: true,
      trim: true
    },

    type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "material_types",
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "material_categories",
    },

    item_type: {
      type: String,
      enum: [
        "sheet",          // Acrylic, MDF, Mirrors
        "direct",         // Bases, Hardware, Consumables
        "unit",           // Packing units
        "capacity",       // Master carton
        "logic"           // Custom logic items
      ],
      required: true
    },

    rate_unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rate_units",
      required: true
      // sqin, pc, unit
    },

    price: { type: String, required: true, default: 0 },

    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
    thickness: { type: Number },
    dimension_unit: { type: mongoose.Schema.Types.ObjectId, ref: "units" },

    // Inventory
    stock: {
      type: Number,
      default: 0
    },

    is_active: {
      type: Boolean,
      default: true
    },
    // Keep is_inventory_item for backwards compatibility/front-end checks
    is_inventory_item: {
      type: Boolean,
      default: false
    },

    reference_vendor_name: {
      type: String
    },

    sheet_size: {
      type: String
    },

    source_bom_id: { type: mongoose.Schema.Types.ObjectId },
    source_bom_type: { type: String, enum: ["quotation", "standalone"] },
    job_no: { type: String },
    sub_job_no: { type: String },
    reference_no: { type: String },

    supplier_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "vendors",
      },
    ],

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    created_at: { type: String, required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    updated_at: { type: String },
  },
  {
    timestamps: true,
  }
);

const CustomItem = mongoose.model("custom_item", customItemSchema);

// Programmatically drop the old unique name_1 index if it exists in the database
CustomItem.on("index", async (err) => {
  if (err) {
    console.error("CustomItem index build warning/error:", err);
  }
  try {
    const indexes = await CustomItem.collection.indexes();
    const nameIndex = indexes.find(idx => idx.name === "name_1");
    if (nameIndex && nameIndex.unique) {
      console.log("Found legacy unique index 'name_1' on custom_items. Dropping it to allow duplicate item names...");
      await CustomItem.collection.dropIndex("name_1");
      console.log("Successfully dropped 'name_1' unique index programmatically!");
    }
  } catch {
    // This is safe to ignore (e.g. if the collection doesn't exist yet in a fresh DB)
    // console.log("CustomItem index self-healing check passed/skipped.");
  }
});

export default CustomItem;

