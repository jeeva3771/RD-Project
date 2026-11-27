import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../utils/url/config";

// Helper to group trophy types dynamically from DB records
export const groupTrophyTypesByCategory = (typesList = []) => {
  const list = Array.isArray(typesList) ? typesList : [];
  const grouped = {};

  list.forEach((item) => {
    const rawCat = (item.category || "General").trim();
    let catKey = rawCat.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (rawCat.toLowerCase().includes("classic")) catKey = "classic";
    else if (rawCat.toLowerCase().includes("theme")) catKey = "themed";
    else if (rawCat.toLowerCase().includes("outdoor")) catKey = "outdoor";
    else if (rawCat.toLowerCase().includes("indoor")) catKey = "indoor";

    if (!grouped[catKey]) {
      grouped[catKey] = {
        label: rawCat,
        icon: item.icon || "🏆",
        count: 0,
        options: []
      };
    }

    const optName = item.label || item.name;
    if (optName && !grouped[catKey].options.includes(optName)) {
      grouped[catKey].options.push(optName);
      grouped[catKey].count++;
    }
  });

  return grouped;
};

// ============================================
// Async Thunks (100% Dynamic DB Data)
// ============================================

export const fetchActiveMaterials = createAsyncThunk(
  "enquiryFlowMasters/fetchActiveMaterials",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/enquiry-masters/trophy-material/active");
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((m) => ({
          ...m,
          base_rate: Number(m.base_rate) || 0,
          unit: m.unit || "inch"
        }));
      }
      return [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchActiveElements = createAsyncThunk(
  "enquiryFlowMasters/fetchActiveElements",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/enquiry-masters/element/active");
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((el) => ({
          id: el.name,
          label: el.name,
          name: el.name,
          icon: el.icon || "⚙️",
          extra_cost: Number(el.extra_cost) || 0
        }));
      }
      return [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchActiveConstructions = createAsyncThunk(
  "enquiryFlowMasters/fetchActiveConstructions",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/enquiry-masters/construction/active");
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((c) => ({
          id: c.name,
          label: c.name,
          name: c.name,
          icon: c.icon || "🔲"
        }));
      }
      return [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchActiveTrophyTypes = createAsyncThunk(
  "enquiryFlowMasters/fetchActiveTrophyTypes",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/enquiry-masters/trophy-type/active");
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      return [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// Parallel thunk to fetch all 4 masters simultaneously from DB
export const fetchAllActiveEnquiryMasters = createAsyncThunk(
  "enquiryFlowMasters/fetchAllActive",
  async (_, { dispatch }) => {
    const results = await Promise.allSettled([
      dispatch(fetchActiveMaterials()).unwrap(),
      dispatch(fetchActiveElements()).unwrap(),
      dispatch(fetchActiveConstructions()).unwrap(),
      dispatch(fetchActiveTrophyTypes()).unwrap()
    ]);
    return {
      materials: results[0].status === "fulfilled" && Array.isArray(results[0].value) ? results[0].value : [],
      elements: results[1].status === "fulfilled" && Array.isArray(results[1].value) ? results[1].value : [],
      constructions: results[2].status === "fulfilled" && Array.isArray(results[2].value) ? results[2].value : [],
      trophyTypes: results[3].status === "fulfilled" && Array.isArray(results[3].value) ? results[3].value : []
    };
  }
);

// Initial State (100% Dynamic DB Data)
const initialState = {
  materials: [],
  elements: [],
  constructions: [],
  trophyTypes: [],
  typeCategoryData: null,
  loading: false,
  error: null
};

const enquiryFlowMastersSlice = createSlice({
  name: "enquiryFlowMasters",
  initialState,
  reducers: {
    invalidateMasters: (state) => {
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // All Masters Parallel
      .addCase(fetchAllActiveEnquiryMasters.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllActiveEnquiryMasters.fulfilled, (state, action) => {
        state.loading = false;
        state.materials = action.payload.materials || [];
        state.elements = action.payload.elements || [];
        state.constructions = action.payload.constructions || [];
        state.trophyTypes = action.payload.trophyTypes || [];
        state.typeCategoryData = groupTrophyTypesByCategory(action.payload.trophyTypes || []);
      })
      .addCase(fetchAllActiveEnquiryMasters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || "Failed to fetch enquiry masters";
      })

      // Materials
      .addCase(fetchActiveMaterials.fulfilled, (state, action) => {
        state.materials = action.payload || [];
      })

      // Elements
      .addCase(fetchActiveElements.fulfilled, (state, action) => {
        state.elements = action.payload || [];
      })

      // Constructions
      .addCase(fetchActiveConstructions.fulfilled, (state, action) => {
        state.constructions = action.payload || [];
      })

      // Trophy Types
      .addCase(fetchActiveTrophyTypes.fulfilled, (state, action) => {
        state.trophyTypes = action.payload || [];
        state.typeCategoryData = groupTrophyTypesByCategory(action.payload || []);
      });
  }
});

export const { invalidateMasters } = enquiryFlowMastersSlice.actions;
export default enquiryFlowMastersSlice.reducer;
