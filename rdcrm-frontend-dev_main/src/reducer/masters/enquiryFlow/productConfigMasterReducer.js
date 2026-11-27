import { createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../../utils/url/config";
import { createMasterSlice } from "./createMasterSlice";

export const fetchProductConfigByProductId = createAsyncThunk(
  "productConfigMaster/fetchByProductId",
  async (productId, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get(`/enquiry-masters/product-config/product/${productId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const resetProductConfigDefaults = createAsyncThunk(
  "productConfigMaster/resetDefaults",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post("/enquiry-masters/product-config/reset-defaults");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "productConfigMaster",
  endpoint: "product-config",
  customInitialState: {
    productConfigMap: {}
  },
  extraThunks: { fetchProductConfigByProductId },
  customExtraReducers: (builder) => {
    builder
      .addCase(fetchProductConfigByProductId.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductConfigByProductId.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.data) {
          const cfg = action.payload.data;
          state.selectedItem = cfg;
          if (cfg.product_id) {
            state.productConfigMap[cfg.product_id] = cfg;
          }
        }
      })
      .addCase(fetchProductConfigByProductId.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  fetchList: fetchProductConfigs,
  fetchActive: fetchActiveProductConfigs,
  getById: getProductConfigById,
  createItem: createProductConfig,
  updateItem: updateProductConfig,
  deleteItem: deleteProductConfig
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
