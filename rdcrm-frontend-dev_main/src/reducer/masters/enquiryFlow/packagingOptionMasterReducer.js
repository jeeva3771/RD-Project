import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "packagingOptionMaster",
  endpoint: "packaging-option"
});

export const {
  fetchList: fetchPackagingOptions,
  fetchActive: fetchActivePackagingOptions,
  getById: getPackagingOptionById,
  createItem: createPackagingOption,
  updateItem: updatePackagingOption,
  deleteItem: deletePackagingOption
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
