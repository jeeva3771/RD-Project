import { createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../../utils/url/config";
import { createMasterSlice } from "./createMasterSlice";

export const seedDefaultMaterials = createAsyncThunk(
  "trophyMaterialMaster/seedDefaultMaterials",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post("/enquiry-masters/trophy-material/seed-default");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "trophyMaterialMaster",
  endpoint: "trophy-material",
  extraThunks: { seedDefaultMaterials },
  customExtraReducers: (builder) => {
    builder
      .addCase(seedDefaultMaterials.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        if (action.payload?.data) {
          state.items = action.payload.data;
        }
      });
  }
});

export const {
  fetchList: fetchTrophyMaterials,
  fetchActive: fetchActiveTrophyMaterials,
  getById: getTrophyMaterialById,
  createItem: createTrophyMaterial,
  updateItem: updateTrophyMaterial,
  deleteItem: deleteTrophyMaterial
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
