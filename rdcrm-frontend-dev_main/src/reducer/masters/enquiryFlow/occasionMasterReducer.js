import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "occasionMaster",
  endpoint: "occasion"
});

export const {
  fetchList: fetchOccasions,
  fetchActive: fetchActiveOccasions,
  getById: getOccasionById,
  createItem: createOccasion,
  updateItem: updateOccasion,
  deleteItem: deleteOccasion
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
