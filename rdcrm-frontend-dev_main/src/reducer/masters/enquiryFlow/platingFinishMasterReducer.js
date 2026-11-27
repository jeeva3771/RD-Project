import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "platingFinishMaster",
  endpoint: "plating-finish"
});

export const {
  fetchList: fetchPlatingFinishes,
  fetchActive: fetchActivePlatingFinishes,
  getById: getPlatingFinishById,
  createItem: createPlatingFinish,
  updateItem: updatePlatingFinish,
  deleteItem: deletePlatingFinish
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
