import mongoose from "mongoose";

const deliveryChallanSchema = new mongoose.Schema(
  {
    sub_job_no: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    job_no: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    client_name: {
      type: String,
      trim: true,
      default: "",
    },
    product_name: {
      type: String,
      trim: true,
      default: "",
    },
    challanNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    challanDate: {
      type: String,
      trim: true,
      default: "",
    },
    destName: {
      type: String,
      trim: true,
      default: "Main Destination",
    },
    dispatchMode: {
      type: String,
      trim: true,
      default: "Courier",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    // File upload metadata
    challanFile: {
      type: String,
      trim: true,
      default: "",
    },
    file_name: {
      type: String,
      trim: true,
      default: "",
    },
    file_size: {
      type: Number,
      default: 0,
    },
    file_type: {
      type: String,
      trim: true,
      default: "",
    },
    by: {
      type: String,
      trim: true,
      default: "Accounts",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    pack_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ct_pack",
    },
  },
  {
    timestamps: true,
  }
);

const DeliveryChallan = mongoose.model("delivery_challans", deliveryChallanSchema);
export default DeliveryChallan;
