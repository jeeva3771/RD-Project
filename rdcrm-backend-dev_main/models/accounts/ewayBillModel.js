import mongoose from "mongoose";

const ewayBillSchema = new mongoose.Schema(
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
    ewayBillNo: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    ewayDate: {
      type: String,
      trim: true,
      default: "",
    },
    validUpto: {
      type: String,
      trim: true,
      default: "",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    file_url: {
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
  },
  {
    timestamps: true,
  }
);

const EwayBill = mongoose.model("eway_bills", ewayBillSchema);
export default EwayBill;
