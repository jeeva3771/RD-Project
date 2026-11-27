import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { contactsOf, validMobile, validEmail } from "../../utils/helpers";
import { axiosInstance } from "../../../../utils/url/config";
import { fetchAllCustomers } from "../../../../reducer/customerReducer";

const ContactEditor = ({ s, set, client, selId, onSelect }) => {
  const dispatch = useDispatch();
  const list = contactsOf(client, s);
  const c = list.find((x) => x.id === selId) || list[0];
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ name: '', role: '', phone: '', email: '' });

  // Auto-select first contact if none currently selected and contacts exist
  React.useEffect(() => {
    if (!selId && list.length > 0 && typeof onSelect === "function") {
      onSelect(list[0].id);
      if (typeof set === "function") {
        set({
          contactId: list[0].id,
          e: {
            ...(s.e || {}),
            contactPerson: list[0].name || "",
            contactPhone: list[0].phone || "",
            contactEmail: list[0].email || "",
          }
        });
      }
    }
  }, [selId, list, onSelect, set, s.e]);

  const upd = (field, v) => {
    if (!c) return;
    if (c.extra) {
      set({
        cExtra: (s.cExtra || []).map((x) => (x.id === c.id ? { ...x, [field]: v } : x)),
        e: {
          ...(s.e || {}),
          ...(field === 'phone' ? { contactPhone: v } : {}),
          ...(field === 'email' ? { contactEmail: v } : {}),
        }
      });
    } else {
      set({
        cEdits: { ...(s.cEdits || {}), [c.id]: { ...((s.cEdits || {})[c.id] || {}), [field]: v } },
        e: {
          ...(s.e || {}),
          ...(field === 'phone' ? { contactPhone: v } : {}),
          ...(field === 'email' ? { contactEmail: v } : {}),
        }
      });
    }
  };

  const save = async () => {
    let id = 'x' + Date.now();
    const clientId = client?.id || client?._id || s.clientId;
    const newContactObj = { ...nc, id, clientId, extra: true, role: nc.role || 'Contact' };

    // Save permanently to Customer Master in MongoDB if client exists
    if (clientId) {
      try {
        const res = await axiosInstance.post(`/customer/${clientId}/contact`, {
          name: nc.name.trim(),
          role: nc.role ? nc.role.trim() : 'Contact',
          mobile_no: nc.phone ? nc.phone.trim() : '',
          email: nc.email ? nc.email.trim() : '',
          is_primary: list.length === 0,
        });
        if (res.data?.newContact?._id) {
          id = String(res.data.newContact._id);
          newContactObj.id = id;
          newContactObj._id = id;
        }
        if (client && Array.isArray(client.contacts)) {
          client.contacts.push({ ...newContactObj, id, _id: id });
        }
        dispatch(fetchAllCustomers());
        toast.success(`Contact “${nc.name}” saved to Customer Master!`);
      } catch (err) {
        console.warn("Could not save contact to customer master:", err);
        toast.error(err.response?.data?.message || "Failed to save contact to Customer Master");
      }
    }

    set({
      contactId: id,
      cExtra: [
        ...(s.cExtra || []).filter(
          (x) => x.name?.trim().toLowerCase() !== nc.name.trim().toLowerCase()
        ),
        newContactObj,
      ],
      e: {
        ...(s.e || {}),
        contactPerson: nc.name.trim(),
        contactPhone: nc.phone.trim(),
        contactEmail: nc.email.trim(),
      }
    });
    onSelect(id);
    setAdding(false);
    setNc({ name: '', role: '', phone: '', email: '' });
  };

  return (
    <div className="ceditor my-3">
      {list.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {list.map((x) => (
            <button
              key={x.id}
              className={`px-3 py-1.5 rounded border text-sm text-left transition ${
                selId === x.id ? "bg-indigo-600 text-white border-indigo-600 font-medium" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
              onClick={() => {
                onSelect(x.id);
                set({
                  contactId: x.id,
                  e: {
                    ...(s.e || {}),
                    contactPerson: x.name,
                    contactPhone: x.phone || "",
                    contactEmail: x.email || "",
                  }
                });
              }}
            >
              <div>{x.name}</div>
              {x.role && <div className={`text-xs ${selId === x.id ? "text-indigo-100" : "text-gray-400"}`}>{x.role}</div>}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 && !adding && (
        <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 mb-3 flex items-center justify-between">
          <span>No contact person added yet for this client.</span>
          <button
            type="button"
            className="text-indigo-600 font-semibold hover:underline"
            onClick={() => setAdding(true)}
          >
            + Add Contact Person
          </button>
        </div>
      )}

      {c && !adding && (
        <div className="cfields grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 border rounded-lg mb-3 fade">
          <label className="block text-xs font-semibold text-gray-600">
            <span>Mobile / WhatsApp</span>
            <div className="flex items-center mt-1 border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition">
              <span className="px-2 bg-gray-100 text-gray-500 text-xs py-1.5 border-r border-gray-200">+91</span>
              <input
                className="w-full px-2 py-1.5 text-sm outline-none"
                inputMode="tel"
                value={c.phone || ''}
                placeholder="10-digit mobile"
                onChange={(ev) => upd('phone', ev.target.value)}
              />
            </div>
            {c.phone && !validMobile(c.phone) && <small className="text-red-500 text-xs mt-1 block">Needs 10 digits</small>}
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Email</span>
            <input
              className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
              inputMode="email"
              value={c.email || ''}
              placeholder="name@company.com"
              onChange={(ev) => upd('email', ev.target.value)}
            />
            {c.email && !validEmail(c.email) && <small className="text-red-500 text-xs mt-1 block">Check the email</small>}
          </label>
        </div>
      )}

      {!adding && list.length > 0 && (
        <button className="text-indigo-600 text-sm font-medium hover:underline" onClick={() => setAdding(true)}>
          + Add another contact
        </button>
      )}

      {adding && (
        <div className="cfields cnew grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg fade">
          <label className="block text-xs font-semibold text-gray-600">
            <span>Name *</span>
            <input className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={nc.name} onChange={(ev) => setNc({ ...nc, name: ev.target.value })} placeholder="Full name" />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Role</span>
            <input className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={nc.role} placeholder="e.g. Accounts or Procurement" onChange={(ev) => setNc({ ...nc, role: ev.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Mobile / WhatsApp</span>
            <div className="flex items-center mt-1 border border-gray-200 rounded-lg bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition overflow-hidden">
              <span className="px-2 bg-gray-100 text-gray-500 text-xs py-1.5 border-r border-gray-200">+91</span>
              <input className="w-full px-2 py-1.5 text-sm outline-none" inputMode="tel" value={nc.phone} onChange={(ev) => setNc({ ...nc, phone: ev.target.value })} placeholder="10-digit mobile" />
            </div>
            {nc.phone && !validMobile(nc.phone) && <small className="text-red-500 text-xs mt-1 block">Needs 10 digits</small>}
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Email</span>
            <input className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" inputMode="email" value={nc.email} onChange={(ev) => setNc({ ...nc, email: ev.target.value })} placeholder="name@company.com" />
            {nc.email && !validEmail(nc.email) && <small className="text-red-500 text-xs mt-1 block">Check the email</small>}
          </label>
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" onClick={() => setAdding(false)}>Cancel</button>
            <button
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
              disabled={!nc.name.trim() || !(validMobile(nc.phone) || validEmail(nc.email))}
              onClick={save}
            >
              Save contact
            </button>
          </div>
        </div>
      )}

      {(adding ? nc : c) && (
        <div className="cstatus flex gap-3 text-xs mt-3 pt-3 border-t border-gray-200 text-gray-600">
          <span className={validMobile((adding ? nc : c).phone) ? "text-emerald-600 font-bold" : "text-amber-600 font-medium"}>
            {validMobile((adding ? nc : c).phone) ? "✓ WhatsApp ready" : "! WhatsApp needs a valid 10-digit mobile"}
          </span>
          <span className={validEmail((adding ? nc : c).email) ? "text-emerald-600 font-bold" : "text-amber-600 font-medium"}>
            {validEmail((adding ? nc : c).email) ? "✓ Email ready" : "! Email needs a valid address"}
          </span>
        </div>
      )}
    </div>
  );
};

export default ContactEditor;
