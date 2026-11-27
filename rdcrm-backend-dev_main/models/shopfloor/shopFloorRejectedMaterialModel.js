import mongoose from "mongoose";

const shopFloorRejectedMaterialSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    category: { type: String },
    subcategory: { type: String },
    shopfloor_job_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_job", required: true },
    group_id: { type: String, required: true },
    flow_rejection_item_id: { type: mongoose.Schema.Types.ObjectId, default: null }, // _id of the item in ShopFloorProcessFlow.rejection[]
    material_name: { type: String, required: true },
    size: { type: String },
    rejected_qty: { type: Number, required: true },
    recut_qty: { type: Number, default: 0 },
    net_rejected_qty: { type: Number, required: true }, // rejected_qty - recut_qty
    sqin_lost: { type: Number, default: 0 },
    sqft_lost: { type: Number, default: 0 },
    machine: { type: String },
    est_loss: { type: Number, default: 0 },
    recut_status: { type: String },
    write_off_status: { type: String, default: "Pending" },
    is_dispose: { type: Boolean, default: false },
    resold: { type: Boolean, default: false },
    disposal_method: { type: String },
    authorised_by: { type: String },
    remarks: { type: String },
    sale_amount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("shop_floor_rejected_material", shopFloorRejectedMaterialSchema);
