import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "personalisationMaster",
  endpoint: "personalisation-option"
});

export const {
  fetchList: fetchPersonalisationOptions,
  fetchActive: fetchActivePersonalisationOptions,
  getById: getPersonalisationOptionById,
  createItem: createPersonalisationOption,
  updateItem: updatePersonalisationOption,
  deleteItem: deletePersonalisationOption
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
