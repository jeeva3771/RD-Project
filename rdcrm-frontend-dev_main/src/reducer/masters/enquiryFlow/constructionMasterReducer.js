import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "constructionMaster",
  endpoint: "construction"
});

export const {
  fetchList: fetchConstructions,
  fetchActive: fetchActiveConstructions,
  getById: getConstructionById,
  createItem: createConstruction,
  updateItem: updateConstruction,
  deleteItem: deleteConstruction
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
