import mongoose from "mongoose";

const unitSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    quantity_measured: {
      type: String,
      required: true,
      trim: true,
    },
    si_unit:{
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    }, 
    imperial_unit: {
      type: String,
      required: true,
      trim: true,
    },
     imperial_symbol: {
      type: String,
      required: true,
      trim: true,
    },
     values: {
      type: Array,
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

export default mongoose.model("unit", unitSchema);
