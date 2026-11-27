import mongoose from "mongoose";

const shopFloorInventorySchema = new mongoose.Schema(
  {
    shopfloor_name: { type: String, required: true, trim: true }, // e.g. "Laser", "UV"

    id: { type: String, required: true }, // Internal ID
    item_code: { type: String, required: true, trim: true },

    name: {
      type: String,
      required: true,
      trim: true
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

    // Inventory levels on the shopfloor
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

    inward_history: [
      {
        requisition_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_requisition" },
        requisition_no: { type: String },
        requested_by: { type: String },
        requested_by_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        requested_at: { type: String },
        issued_by: { type: String },
        issued_at: { type: String },
        qty: { type: Number },
        size: { type: String },
        size_id: { type: mongoose.Schema.Types.ObjectId, ref: "stock_sizes" },
        shopfloor_name: { type: String }
      }
    ],

    usage_history: [
      {
        job_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_job" },
        job_no: { type: String },
        sub_job_no: { type: String },
        inward_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_inward" },
        inward_number: { type: String },
        operator_name: { type: String },
        qty: { type: Number },
        good_qty: { type: Number },
        bad_qty: { type: Number },
        size: { type: String },
        recorded_at: { type: String }
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure item code and name are unique per shopfloor
shopFloorInventorySchema.index({ shopfloor_name: 1, item_code: 1 }, { unique: true });
shopFloorInventorySchema.index({ shopfloor_name: 1, name: 1 }, { unique: true });
shopFloorInventorySchema.index({ shopfloor_name: 1 });

export default mongoose.model("shop_floor_inventory", shopFloorInventorySchema);
