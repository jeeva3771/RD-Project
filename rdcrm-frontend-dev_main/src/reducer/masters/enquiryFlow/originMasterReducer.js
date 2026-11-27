import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "originMaster",
  endpoint: "origin"
});

export const {
  fetchList: fetchOrigins,
  fetchActive: fetchActiveOrigins,
  getById: getOriginById,
  createItem: createOrigin,
  updateItem: updateOrigin,
  deleteItem: deleteOrigin
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
