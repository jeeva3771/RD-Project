import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "attachmentMaster",
  endpoint: "attachment"
});

export const {
  fetchList: fetchAttachments,
  fetchActive: fetchActiveAttachments,
  getById: getAttachmentById,
  createItem: createAttachment,
  updateItem: updateAttachment,
  deleteItem: deleteAttachment
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
