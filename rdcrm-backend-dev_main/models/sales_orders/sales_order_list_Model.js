import mongoose from "mongoose";

const sampleorderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    enquiry_id: {
      type: mongoose.ObjectId,
      ref: "enquiry",
      required: false,
    },
    enquiry_flow_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "enquiry_flow_integration",
      default: null,
    },
    source: {
      type: String,
      enum: ["legacy_enquiry", "enquiry_flow_integration"],
      default: "legacy_enquiry",
    },
    job_quantity: {
      type: Number,
      default: 1,
    },
    job_no: {
      type: String,
      required: true,
    },
    sub_job_no: {
      type: String,
      required: true,
    },
    sample_salesorder_id: {
      type: mongoose.ObjectId,
      ref: "salesorderform",
    },
    category: {
      type: String,
      default: "",
    },
    subcategory: {
      type: String,
      default: "",
    },
    image: {
      type: String,
    },
    is_sales_order_filled: {
      type: Boolean,
      default: false,
    },
    is_client_design: {
      type: Boolean,
      default: false,
    },
    production_team_person: {
      type: mongoose.ObjectId,
      ref: "users",
      default: null,
    },
    type: {
      type: String
    },
    is_bom_filled: {
      type: Boolean,
      default: false,
    },
    is_bom_verified: {
      type: Boolean,
      default: false,
    },
    is_bom_verified_remarks: {
      type: String,
      default: "",
    },
    is_bom_rework: {
      type: Boolean,
      default: false,
    },
    bom_history: [
      {
        action: { type: String },
        action_by_type: { type: String },
        action_by_user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        action_by_name: { type: String },
        action_by_role: { type: String },
        remarks: { type: String },
        date_time: { type: String },
        before_qty: { type: Number },
        after_qty: { type: Number },
        file_url: { type: String },
      }
    ],
    is_qty_pending_approval: {
      type: Boolean,
      default: false,
    },
    is_reprocessed_approved: {
      type: Boolean,
      default: false,
    },
    bom_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bom",
      default: null,
      set: function (v) {
        if (!v) return null;
        if (mongoose.Types.ObjectId.isValid(v)) return v;
        if (this) this.bom_nanoid = String(v);
        return null;
      },
    },
    bom_nanoid: {
      type: String,
      default: "",
    },
    quatation_files: [{
      type: String,
    }],
    job_sheet_files: [{
      type: String,
    }],

    is_verified_to_proceed: {
      type: Boolean,
      default: false,
    },
    designer_files: [{
      type: String,
    }],
    is_design_uploaded: {
      type: Boolean,
      default: false,
    },
    is_pi_verified: {
      type: Boolean,
      default: false,
    },

    is_pi_verified_remarks: {
      type: String,
      default: "",
    },
    is_pi_rework: {
      type: Boolean,
      default: false,
    },
    pi_history: [
      {
        action: { type: String },
        action_by_type: { type: String },
        action_by_user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        action_by_name: { type: String },
        action_by_role: { type: String },
        remarks: { type: String },
        date_time: { type: String },
      }
    ],
    is_pi_uploaded: {
      type: Boolean,
      default: false,
    },
    Pi_files: [{
      type: String,
    }],
    process_files: [
      {
        section_id: String,
        section_name: String,
        process_id: String,
        process_name: String,
        production_file: String,
        dtp_file: String,
        production_instruction: String,
        dtp_instruction: String,
      }
    ],
    additional_files: [
      {
        tag_name: String,
        file_url: String,
        name: String,
        designation: String,
        uploaded_by: { type: mongoose.ObjectId, ref: "users" },
        uploaded_at: String,
      },
    ],
    recipe_materials: [
      {
        material_type: { type: String },
        size: { type: String },
        ups: { type: String },
        quantity: { type: Number },
        process: [{ type: String }],
      },
    ],
    consumables: [
      {
        consumable_type: { type: String },
        quantity: { type: Number },
        process: [{ type: String }],
      },
    ],
    packing_materials: [
      {
        packing_material_type: { type: String },
        quantity: { type: Number },
        process: [{ type: String }],
      },
    ],
    process_priority: [
      {
        type: String,
      },
    ],
    material_total: {
      type: Number,
    },
    consumable_total: {
      type: Number,
    },
    packing_total: {
      type: Number,
    },
    labour_total: {
      type: Number,
    },
    shipping_total: {
      type: Number,
    },
    custom_costing: [
      {
        type: String,
      },
    ],
    final_total: {
      type: Number,
    },
    to_production_plan_id: {
      type: mongoose.ObjectId,
      ref: "toproductionplan",
    },
    is_to_production_plan: {
      type: Boolean,
      default: false,
    },
    is_price_approved: {
      type: Boolean,
      default: false,
    },
    price_approved_by: {
      type: mongoose.ObjectId,
      ref: "users",
    },
    price_approved_datetime: {
      type: String,
    },
    price_rejection_log: {
      type: String,
    },
    is_challan_uploaded: {
      type: Boolean,
      default: false,
    },
    challan_files: {
      type: String,
    },
    is_pushed_shop_floor: {
      type: Boolean,
      default: false,
    },
    pushed_to_shop_floor_datetime: {
      type: String,
      default: "",
    },
    proceed_to_production_datetime: {
      type: String,
      default: "",
    },
    designer_person: [
      {
        type: mongoose.ObjectId, ref: 'users',
      }
    ],
    delivery_date: {
      type: String,
      default: "",
    },
    job_completion_datetime: {
      type: String,
      default: "",
    },
    status: {
      type: String,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_on_hold: {
      type: Boolean,
      default: false,
    },
    hold_history: [
      {
        reason: String,
        start_time: String,
        end_time: String,
        hold_by: {
          type: mongoose.ObjectId,
          ref: "users",
        },
        unhold_by: {
          type: mongoose.ObjectId,
          ref: "users",
        },
      }
    ],
    blocked_materials: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "blocked_material",
      }
    ],
    generator_rfq: [
      {
        uid: String,
        rfq_id: { type: mongoose.Schema.Types.ObjectId, ref: "rfq" },
        material_name: String,
        size: String,
        generated_at: String
      }
    ],
    edit_remarks: [
      {
        remark: { type: String, required: true },
        edited_by: { type: mongoose.ObjectId, ref: "users" },
        edited_at: { type: String },
        field_changes: [
          {
            field: { type: String },   // e.g. "Quantity", "Delivery Date", "Job Completion Date"
            before: { type: String },  // value before the edit
            after: { type: String },   // value after the edit
          }
        ],
      }
    ],
    created_by: {
      type: mongoose.ObjectId,
      ref: "users",
      required: true,
    },
    created_at: {
      type: String,
      required: true,
    },
    updated_by: [
      {
        user: {
          type: mongoose.ObjectId,
          ref: "users",
        },
        date: String,
      },
    ],
    updated_at: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

sampleorderSchema.index({ is_verified_to_proceed: 1, is_pushed_shop_floor: 1 });
sampleorderSchema.index({ sub_job_no: 1 });
sampleorderSchema.index({ job_no: 1 });
sampleorderSchema.index({ type: 1, category: 1 });

export default mongoose.model("salesorder", sampleorderSchema);


