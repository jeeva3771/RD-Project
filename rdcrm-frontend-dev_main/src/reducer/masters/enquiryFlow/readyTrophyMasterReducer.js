import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "readyTrophyMaster",
  endpoint: "ready-trophy"
});

export const {
  fetchList: fetchReadyTrophies,
  fetchActive: fetchActiveReadyTrophies,
  getById: getReadyTrophyById,
  createItem: createReadyTrophy,
  updateItem: updateReadyTrophy,
  deleteItem: deleteReadyTrophy
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
