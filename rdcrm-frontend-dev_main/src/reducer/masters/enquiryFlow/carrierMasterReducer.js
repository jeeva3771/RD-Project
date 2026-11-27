import { createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../../utils/url/config";
import { createMasterSlice } from "./createMasterSlice";

export const resetStandardCarriers = createAsyncThunk(
  "carrierMaster/resetStandardCarriers",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post("/enquiry-masters/carrier/reset-standard");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "carrierMaster",
  endpoint: "carrier",
  extraThunks: { resetStandardCarriers },
  customExtraReducers: (builder) => {
    builder
      .addCase(resetStandardCarriers.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        if (action.payload?.data) {
          state.items = action.payload.data;
        }
      });
  }
});

export const {
  fetchList: fetchCarriers,
  fetchActive: fetchActiveCarriers,
  getById: getCarrierById,
  createItem: createCarrier,
  updateItem: updateCarrier,
  deleteItem: deleteCarrier
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
