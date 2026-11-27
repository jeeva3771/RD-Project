import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../../utils/url/config";

// Generic CRUD thunks for dynamic endpoint usage
export const fetchGenericMasterList = createAsyncThunk(
  "enquiryMasters/fetchGenericList",
  async ({ endpoint, params = {} }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get(`/enquiry-masters/${endpoint}`, { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch list");
    }
  }
);

export const createGenericMasterItem = createAsyncThunk(
  "enquiryMasters/createGenericItem",
  async ({ endpoint, payload }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post(`/enquiry-masters/${endpoint}`, payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || "Failed to create item");
    }
  }
);

export const updateGenericMasterItem = createAsyncThunk(
  "enquiryMasters/updateGenericItem",
  async ({ endpoint, id, payload }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.put(`/enquiry-masters/${endpoint}/${id}`, payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || "Failed to update item");
    }
  }
);

export const deleteGenericMasterItem = createAsyncThunk(
  "enquiryMasters/deleteGenericItem",
  async ({ endpoint, id }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.delete(`/enquiry-masters/${endpoint}/${id}`);
      return { id, ...res.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || "Failed to delete item");
    }
  }
);

/**
 * Higher-Order Slice Factory for Enquiry Flow Masters
 * Generates standard CRUD thunks and state management for each master
 */
export const createMasterSlice = ({
  name,
  endpoint,
  customInitialState = {},
  extraThunks = {},
  customExtraReducers = () => {}
}) => {
  const fetchList = createAsyncThunk(
    `${name}/fetchList`,
    async (params = {}, { rejectWithValue }) => {
      try {
        const res = await axiosInstance.get(`/enquiry-masters/${endpoint}`, { params });
        return res.data;
      } catch (err) {
        return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch list");
      }
    }
  );

  const fetchActive = createAsyncThunk(
    `${name}/fetchActive`,
    async (_, { rejectWithValue }) => {
      try {
        const res = await axiosInstance.get(`/enquiry-masters/${endpoint}/active`);
        return res.data;
      } catch (err) {
        return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch active items");
      }
    }
  );

  const getById = createAsyncThunk(
    `${name}/getById`,
    async (id, { rejectWithValue }) => {
      try {
        const res = await axiosInstance.get(`/enquiry-masters/${endpoint}/${id}`);
        return res.data;
      } catch (err) {
        return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch item");
      }
    }
  );

  const createItem = createAsyncThunk(
    `${name}/createItem`,
    async (payload, { rejectWithValue }) => {
      try {
        const res = await axiosInstance.post(`/enquiry-masters/${endpoint}`, payload);
        return res.data;
      } catch (err) {
        return rejectWithValue(err.response?.data?.message || err.message || "Failed to create item");
      }
    }
  );

  const updateItem = createAsyncThunk(
    `${name}/updateItem`,
    async ({ id, ...payload }, { rejectWithValue }) => {
      try {
        const res = await axiosInstance.put(`/enquiry-masters/${endpoint}/${id}`, payload);
        return res.data;
      } catch (err) {
        return rejectWithValue(err.response?.data?.message || err.message || "Failed to update item");
      }
    }
  );

  const deleteItem = createAsyncThunk(
    `${name}/deleteItem`,
    async (id, { rejectWithValue }) => {
      try {
        const res = await axiosInstance.delete(`/enquiry-masters/${endpoint}/${id}`);
        return { id, ...res.data };
      } catch (err) {
        return rejectWithValue(err.response?.data?.message || err.message || "Failed to delete item");
      }
    }
  );

  const initialState = {
    items: [],
    activeItems: [],
    selectedItem: null,
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    loading: false,
    error: null,
    success: false,
    ...customInitialState
  };

  const slice = createSlice({
    name,
    initialState,
    reducers: {
      clearSelectedItem: (state) => {
        state.selectedItem = null;
      },
      clearError: (state) => {
        state.error = null;
      },
      resetSuccess: (state) => {
        state.success = false;
      },
      setPage: (state, action) => {
        state.currentPage = action.payload;
      }
    },
    extraReducers: (builder) => {
      builder
        // fetchList
        .addCase(fetchList.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(fetchList.fulfilled, (state, action) => {
          state.loading = false;
          state.items = action.payload?.data || [];
          state.totalCount = action.payload?.totalCount || 0;
          state.totalPages = action.payload?.totalPages || 1;
        })
        .addCase(fetchList.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })

        // fetchActive
        .addCase(fetchActive.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(fetchActive.fulfilled, (state, action) => {
          state.loading = false;
          state.activeItems = action.payload?.data || [];
        })
        .addCase(fetchActive.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })

        // getById
        .addCase(getById.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(getById.fulfilled, (state, action) => {
          state.loading = false;
          state.selectedItem = action.payload?.data || null;
        })
        .addCase(getById.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        })

        // createItem
        .addCase(createItem.pending, (state) => {
          state.loading = true;
          state.error = null;
          state.success = false;
        })
        .addCase(createItem.fulfilled, (state, action) => {
          state.loading = false;
          state.success = true;
          if (action.payload?.data) {
            state.items.unshift(action.payload.data);
            state.totalCount += 1;
          }
        })
        .addCase(createItem.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
          state.success = false;
        })

        // updateItem
        .addCase(updateItem.pending, (state) => {
          state.loading = true;
          state.error = null;
          state.success = false;
        })
        .addCase(updateItem.fulfilled, (state, action) => {
          state.loading = false;
          state.success = true;
          const updated = action.payload?.data;
          const updatedId = updated?._id || updated?.id;
          if (updated && updatedId) {
            state.items = state.items.map((i) => ((i._id === updatedId || i.id === updatedId) ? updated : i));
          }
        })
        .addCase(updateItem.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
          state.success = false;
        })

        // deleteItem
        .addCase(deleteItem.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(deleteItem.fulfilled, (state, action) => {
          state.loading = false;
          const delId = action.payload?.id;
          state.items = state.items.filter((i) => i._id !== delId && i.id !== delId);
          state.totalCount = Math.max(0, state.totalCount - 1);
        })
        .addCase(deleteItem.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        });

      customExtraReducers(builder);
    }
  });

  return {
    slice,
    reducer: slice.reducer,
    actions: slice.actions,
    thunks: {
      fetchList,
      fetchActive,
      getById,
      createItem,
      updateItem,
      deleteItem,
      ...extraThunks
    }
  };
};

export default createMasterSlice;
