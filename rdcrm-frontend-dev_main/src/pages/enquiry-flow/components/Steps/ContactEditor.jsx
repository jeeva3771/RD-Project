import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { contactsOf, validMobile, validEmail } from "../../utils/helpers";
import { axiosInstance } from "../../../../utils/url/config";
import { fetchAllCustomers } from "../../../../reducer/customerReducer";

const ContactEditor = ({ s, set, client, selId, onSelect }) => {
  const dispatch = useDispatch();
  const list = contactsOf(client, s);
  const c = list.find((x) => x.id === selId);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ name: '', role: '', phone: '', email: '' });

  const upd = (field, v) => {
    if (!c) return;
    if (c.extra) {
      set({ cExtra: (s.cExtra || []).map((x) => (x.id === c.id ? { ...x, [field]: v } : x)) });
    } else {
      set({ cEdits: { ...(s.cEdits || {}), [c.id]: { ...((s.cEdits || {})[c.id] || {}), [field]: v } } });
    }
  };

  const save = async () => {
    let id = 'x' + Date.now();
    const newContactObj = { ...nc, id, clientId: client?.id || client?._id, extra: true, role: nc.role || 'Contact' };

    // Save permanently to Customer Master in MongoDB if client exists
    const clientId = client?.id || client?._id;
    if (clientId) {
      try {
        const res = await axiosInstance.post(`/customer/${clientId}/contact`, {
          name: nc.name,
          role: nc.role || 'Contact',
          mobile_no: nc.phone,
          email: nc.email,
          is_primary: false,
        });
        if (res.data?.newContact?._id) {
          id = String(res.data.newContact._id);
          newContactObj.id = id;
        }
        dispatch(fetchAllCustomers());
      } catch (err) {
        console.warn("Could not save contact to customer master:", err);
      }
    }

    set({
      cExtra: [
        ...(s.cExtra || []).filter(
          (x) => x.name?.trim().toLowerCase() !== nc.name.trim().toLowerCase()
        ),
        newContactObj,
      ],
    });
    onSelect(id);
    setAdding(false);
    setNc({ name: '', role: '', phone: '', email: '' });
  };

  return (
    <div className="ceditor my-3">
      <div className="flex gap-2 flex-wrap mb-3">
        {list.map((x) => (
          <button
            key={x.id}
            className={`px-3 py-1.5 rounded border text-sm text-left transition ${
              selId === x.id ? "bg-indigo-600 text-white border-indigo-600 font-medium" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => onSelect(x.id)}
          >
            <div>{x.name}</div>
            {x.role && <div className={`text-xs ${selId === x.id ? "text-indigo-100" : "text-gray-400"}`}>{x.role}</div>}
          </button>
        ))}
      </div>

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

      {!adding && (
        <button className="text-indigo-600 text-sm font-medium hover:underline" onClick={() => setAdding(true)}>
          + Add another contact
        </button>
      )}

      {adding && (
        <div className="cfields cnew grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg fade">
          <label className="block text-xs font-semibold text-gray-600">
            <span>Name</span>
            <input className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={nc.name} onChange={(ev) => setNc({ ...nc, name: ev.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Role</span>
            <input className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" value={nc.role} placeholder="e.g. Accounts" onChange={(ev) => setNc({ ...nc, role: ev.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Mobile / WhatsApp</span>
            <div className="flex items-center mt-1 border border-gray-200 rounded-lg bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition overflow-hidden">
              <span className="px-2 bg-gray-100 text-gray-500 text-xs py-1.5 border-r border-gray-200">+91</span>
              <input className="w-full px-2 py-1.5 text-sm outline-none" inputMode="tel" value={nc.phone} onChange={(ev) => setNc({ ...nc, phone: ev.target.value })} />
            </div>
            {nc.phone && !validMobile(nc.phone) && <small className="text-red-500 text-xs mt-1 block">Needs 10 digits</small>}
          </label>
          <label className="block text-xs font-semibold text-gray-600">
            <span>Email</span>
            <input className="w-full mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" inputMode="email" value={nc.email} onChange={(ev) => setNc({ ...nc, email: ev.target.value })} />
            {nc.email && !validEmail(nc.email) && <small className="text-red-500 text-xs mt-1 block">Check the email</small>}
          </label>
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" onClick={() => setAdding(false)}>Cancel</button>
            <button
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
              disabled={!nc.name || !nc.role || !(validMobile(nc.phone) || validEmail(nc.email))}
              onClick={save}
            >
              Save contact
            </button>
          </div>
        </div>
      )}

      {(adding ? nc : c) && (
        <div className="cstatus flex gap-3 text-xs mt-3 pt-3 border-t border-gray-200 text-gray-600">
          <span className={validMobile((adding ? nc : c).phone) ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
            {validMobile((adding ? nc : c).phone) ? "✓ WhatsApp ready" : "! WhatsApp needs a mobile"}
          </span>
          <span className={validEmail((adding ? nc : c).email) ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
            {validEmail((adding ? nc : c).email) ? "✓ Email ready" : "! Email needs an address"}
          </span>
        </div>
      )}
    </div>
  );
};

export default ContactEditor;
