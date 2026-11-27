import { createMasterSlice } from "./createMasterSlice";

const { slice, reducer, actions, thunks } = createMasterSlice({
  name: "deliveryScopeMaster",
  endpoint: "delivery-scope"
});

export const {
  fetchList: fetchDeliveryScopes,
  fetchActive: fetchActiveDeliveryScopes,
  getById: getDeliveryScopeById,
  createItem: createDeliveryScope,
  updateItem: updateDeliveryScope,
  deleteItem: deleteDeliveryScope
} = thunks;

export const { clearSelectedItem, clearError, resetSuccess, setPage } = actions;
export default reducer;
