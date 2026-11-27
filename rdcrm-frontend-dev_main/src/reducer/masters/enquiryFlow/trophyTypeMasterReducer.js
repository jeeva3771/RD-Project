import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "trophyTypeMaster",
  endpoint: "trophy-type"
});

export const {
  fetchList: fetchTrophyTypes,
  fetchActive: fetchActiveTrophyTypes,
  getById: getTrophyTypeById,
  createItem: createTrophyType,
  updateItem: updateTrophyType,
  deleteItem: deleteTrophyType
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
