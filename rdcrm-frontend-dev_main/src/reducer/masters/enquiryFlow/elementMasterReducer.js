import { createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../../utils/url/config";
import { createMasterSlice } from "./createMasterSlice";

export const seedDefaultElements = createAsyncThunk(
  "elementMaster/seedDefaultElements",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post("/enquiry-masters/element/seed-default");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "elementMaster",
  endpoint: "element",
  extraThunks: { seedDefaultElements },
  customExtraReducers: (builder) => {
    builder
      .addCase(seedDefaultElements.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        if (action.payload?.data) {
          state.items = action.payload.data;
        }
      });
  }
});

export const {
  fetchList: fetchElements,
  fetchActive: fetchActiveElements,
  getById: getElementById,
  createItem: createElement,
  updateItem: updateElement,
  deleteItem: deleteElement
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
