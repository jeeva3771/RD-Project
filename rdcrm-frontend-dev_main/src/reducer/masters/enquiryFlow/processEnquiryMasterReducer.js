import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "processEnquiryMaster",
  endpoint: "process"
});

export const {
  fetchList: fetchProcessEnquiryMasters,
  fetchActive: fetchActiveProcessEnquiryMasters,
  getById: getProcessEnquiryMasterById,
  createItem: createProcessEnquiryMaster,
  updateItem: updateProcessEnquiryMaster,
  deleteItem: deleteProcessEnquiryMaster
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
