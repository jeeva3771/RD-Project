import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "occasionGroupMaster",
  endpoint: "occasion-group",
});

export const {
  fetchList: fetchOccasionGroups,
  fetchActive: fetchActiveOccasionGroups,
  getById: getOccasionGroupById,
  createItem: createOccasionGroup,
  updateItem: updateOccasionGroup,
  deleteItem: deleteOccasionGroup,
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
