import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {

    id: { type: String, required: true, unique: true },
    item_code: { type: String, required: true, unique: true, trim: true },

    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "material_types",
      required: true,
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

    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rate_units",
      required: true
      // sqin, pc, unit
    },


    price: { type: String, required: true, default: 0 },
    cost: { type: String, required: true, default: 0 },

    // Only for sheet materials
    stock_sizes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "stock_sizes",
    }],

    size_wise_stock: [{
      size_id: { type: mongoose.Schema.Types.ObjectId, ref: "stock_sizes" },
      count: { type: Number, default: 0 },
      sqinch: { type: Number, default: 0 }
    }],


    // Inventory
    stock: {
      type: Number,
      default: 0
    },

    min_stock: {
      type: Number,
      default: 0
    },

    max_stock: {
      type: Number,
      default: 0
    },

    logical_rate: [
      {
        condition: {
          field: String,
          operator: String,
          value: mongoose.Schema.Types.Mixed
        },
        rate: { type: String, required: true }
      }
    ],

    is_active: {
      type: Boolean,
      default: true
    },

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

export default mongoose.model("item", itemSchema);
