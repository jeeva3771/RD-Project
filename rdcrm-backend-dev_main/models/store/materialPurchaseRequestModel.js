import mongoose from "mongoose";

const materialPurchaseRequestItemSchema = new mongoose.Schema({
    item_model_type: {
      type: String,
      enum: ["item", "custom_item"],
      default: "item"
    },
    item_id: { type: mongoose.Schema.Types.ObjectId, refPath: "item_model_type" }, // Optional for new items
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "materialTypesCategory" },
    type_id: { type: mongoose.Schema.Types.ObjectId, ref: "materialTypesMaster" },
    item_name: { type: String, required: true },
    specification: { type: String }, // For new items or more detail
    custom_item_type: { type: String },
    length: { type: String },
    width: { type: String },
    height: { type: String },
    thickness: { type: String },
    required_qty: { type: Number, required: true },
    unit: { type: String },
    purpose: { type: String },
    remarks: { type: String },
    is_new_item: { type: Boolean, default: false }
}, { _id: false });

const materialPurchaseRequestSchema = new mongoose.Schema({
    request_number: { type: String, required: true, unique: true },
    requested_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    items: [materialPurchaseRequestItemSchema],

    status: {
        type: String,
        enum: ['PENDING_STORE_HEAD', 'PENDING_ADMIN_HEAD', 'APPROVED', 'REJECTED'],
        default: 'PENDING_STORE_HEAD'
    },

    // Approval tracking
    store_head_approval: {
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        approved_at: { type: String },
        remark: { type: String }
    },
    admin_head_approval: {
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        approved_at: { type: String },
        remark: { type: String }
    },
    rejection_details: {
        rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        rejected_at: { type: String },
        remark: { type: String }
    },

    is_active: { type: Boolean, default: true },
    created_at: { type: String },
    updated_at: { type: String }
}, { timestamps: true });

export default mongoose.model("material_purchase_request", materialPurchaseRequestSchema);
