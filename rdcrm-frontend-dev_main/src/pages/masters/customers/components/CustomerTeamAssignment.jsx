import React, { useState, useEffect, useRef } from "react";
import { axiosInstance, backendUrl } from "../../../../utils/url/config";
import RoleBadge from "../../../users/RoleBadge";

const MultiUserSelect = ({
  label,
  sublabel,
  placeholder,
  users,
  selectedIds = [],
  onChange,
  loading = false,
  badgeColorClass = "bg-blue-50 text-blue-700 border-blue-200",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const normalizedSelectedIds = (selectedIds || []).map((id) =>
    typeof id === "object" && id?._id ? String(id._id) : String(id)
  );

  const selectedUsers = users.filter((u) =>
    normalizedSelectedIds.includes(String(u._id))
  );

  const filteredUsers = users.filter((u) => {
    const nameMatch = u.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const roleName = u.role?.name || u.roleName || "";
    const roleMatch = roleName.toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch || roleMatch;
  });

  const handleToggleUser = (user) => {
    const userId = String(user._id);
    let newIds;
    let newUsers;
    if (normalizedSelectedIds.includes(userId)) {
      newIds = normalizedSelectedIds.filter((id) => id !== userId);
      newUsers = selectedUsers.filter((u) => String(u._id) !== userId);
    } else {
      newIds = [...normalizedSelectedIds, userId];
      newUsers = [...selectedUsers, user];
    }
    onChange(newIds, newUsers);
  };

  const handleRemoveUser = (userId, e) => {
    e.stopPropagation();
    const newIds = normalizedSelectedIds.filter((id) => id !== String(userId));
    const newUsers = selectedUsers.filter((u) => String(u._id) !== String(userId));
    onChange(newIds, newUsers);
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange([], []);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          {sublabel && (
            <p className="text-[11px] text-gray-500">{sublabel}</p>
          )}
        </div>
        {selectedUsers.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] text-red-500 hover:text-red-700 hover:underline"
          >
            Clear all ({selectedUsers.length})
          </button>
        )}
      </div>

      {/* Control Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[44px] w-full px-3 py-1.5 rounded-lg border bg-white cursor-pointer transition flex flex-wrap items-center gap-1.5 ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-100"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-sm text-gray-400 select-none py-1">
            {loading ? "Loading users..." : placeholder}
          </span>
        ) : (
          selectedUsers.map((user) => (
            <span
              key={user._id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badgeColorClass} transition`}
            >
              <span>{user.name}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveUser(user._id, e)}
                className="text-gray-400 hover:text-gray-700 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold"
                title={`Remove ${user.name}`}
              >
                ×
              </button>
            </span>
          ))
        )}

        <div className="ml-auto flex items-center gap-1.5 text-gray-400 pl-2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-xs">{isOpen ? "▲" : "▼"}</span>
          )}
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-30 mt-1.5 w-full bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden animate-in fade-in duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user or role..."
              className="w-full px-3 py-1.5 text-xs bg-white rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* List Options */}
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 text-center text-xs text-gray-500">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">
                {searchTerm
                  ? "No matching users found."
                  : "No active users found for this role."}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = normalizedSelectedIds.includes(
                  String(user._id)
                );
                const roleName = user.role?.name || user.roleName || "Staff";

                return (
                  <div
                    key={user._id}
                    onClick={() => handleToggleUser(user)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-xs transition ${
                      isSelected
                        ? "bg-blue-50/70 hover:bg-blue-100/70"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                      />
                      <div>
                        <div className="font-medium text-gray-800">
                          {user.name}
                        </div>
                        {user.email && (
                          <div className="text-[10px] text-gray-400">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {user.role ? (
                        <RoleBadge role={user.role} />
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {roleName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>
              {normalizedSelectedIds.length} person
              {normalizedSelectedIds.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-blue-600 hover:underline font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CustomerTeamAssignment = ({
  accountManagers = [],
  onChangeAccountManagers,
  clientServicing = [],
  onChangeClientServicing,
}) => {
  const [accountUsers, setAccountUsers] = useState([]);
  const [clientServiceUsers, setClientServiceUsers] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingClientService, setLoadingClientService] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchTeamUsers = async () => {
      setLoadingAccounts(true);
      setLoadingClientService(true);

      try {
        // Fetch Account Managers / Assistants
        const accRes = await axiosInstance.get(
          `${backendUrl}/user?roleName=Accounts Manager,Account Manager,Accounts Assistant,Account Assistant&is_active=true&limit=100`
        );
        if (isMounted && accRes.data?.data) {
          setAccountUsers(accRes.data.data);
        }
      } catch (err) {
        console.error("Error fetching account manager users:", err);
      } finally {
        if (isMounted) setLoadingAccounts(false);
      }

      try {
        // Fetch Client Servicing Managers / Executives
        const csRes = await axiosInstance.get(
          `${backendUrl}/user?roleName=Client Servicing Manager,Client Service Manager,Client Servicing Executive,Client Service Executive&is_active=true&limit=100`
        );
        if (isMounted && csRes.data?.data) {
          setClientServiceUsers(csRes.data.data);
        }
      } catch (err) {
        console.error("Error fetching client servicing users:", err);
      } finally {
        if (isMounted) setLoadingClientService(false);
      }
    };

    fetchTeamUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* RD Account Manager (Multi-Select) */}
      <MultiUserSelect
        label="RD Account Manager(s)"
        sublabel="Select Account Manager & Assistant roles"
        placeholder="Select one or more account managers..."
        users={accountUsers}
        selectedIds={accountManagers}
        onChange={onChangeAccountManagers}
        loading={loadingAccounts}
        badgeColorClass="bg-purple-50 text-purple-700 border-purple-200"
      />

      {/* Client Servicing Person (Multi-Select) */}
      <MultiUserSelect
        label="Client Servicing Person(s)"
        sublabel="Select Client Servicing Manager & Executive roles"
        placeholder="Select one or more servicing persons..."
        users={clientServiceUsers}
        selectedIds={clientServicing}
        onChange={onChangeClientServicing}
        loading={loadingClientService}
        badgeColorClass="bg-blue-50 text-blue-700 border-blue-200"
      />
    </div>
  );
};

export default CustomerTeamAssignment;
