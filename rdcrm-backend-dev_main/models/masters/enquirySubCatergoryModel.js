import mongoose from "mongoose";

const enquirysubcategorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
    },
     created_by: {
       type: mongoose.ObjectId,
       ref: 'users',
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
           ref: 'users',
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
  },
);

export default mongoose.model("enquirysubcategory", enquirysubcategorySchema);
