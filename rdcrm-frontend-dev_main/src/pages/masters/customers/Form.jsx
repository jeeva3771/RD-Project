import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCustomerById,
  createCustomer,
  updateCustomer,
  clearSelectedCustomer,
} from "../../../reducer/customerReducer";
import axios from "axios";
import { axiosInstance, backendUrl } from "../../../utils/url/config";
import { toast } from "react-toastify";
import { useLoader } from "../../../context/LoaderContext";
import KeyboardBackspaceIcon from "@mui/icons-material/KeyboardBackspace";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CustomerTeamAssignment from "./components/CustomerTeamAssignment";
import CustomerAddressSection from "./components/CustomerAddressSection";

const CustomerForm = () => {
  const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();
  const { customerId } = useParams();
  const dispatch = useDispatch();

  const { selectedCustomer, loading } = useSelector((state) => state.customer);

  const [formData, setFormData] = useState({
    clientName: "",
    contacts: [
      {
        name: "",
        role: "Primary Contact",
        mobile_no: "",
        email: "",
        is_primary: true,
      },
    ],
    rd_account_managers: [],
    client_servicing_persons: [],
    ownerName: "",
    sinceYear: 2024,
    seasonInsight: "",
    termsText: "50% advance against order",
    advancePercentage: 50,
    creditDays: 0,
    gst_tax: "",
    gst_rate: 0,
    tds_tax: "",
    tds_rate: 0,
    addresses: [
      {
        label: "Head Office",
        streetAddress: "",
        streetAddress2: "",
        city: "",
        state: "",
        postalCode: "",
        gstNumber: "",
        isShipping: true,
      },
    ],
    status: null,
  });

  const [gstTaxes, setGstTaxes] = useState([]);
  const [tdsTaxes, setTdsTaxes] = useState([]);

  const [fieldErrors, setFieldErrors] = useState({
    clientName: "",
    status: "",
    contacts: [],
    addresses: [],
  });

  const [gstMode, setGstMode] = useState("have"); // 'have' | 'later' | 'none'
  const [gstRemindAt, setGstRemindAt] = useState(["sample"]);

  // Fetch active taxes from tax master on mount
  useEffect(() => {
    const fetchActiveTaxes = async () => {
      try {
        const res = await axiosInstance.get("/taxmaster", {
          params: { limit: "all", status: true },
        });
        if (res.data?.success && Array.isArray(res.data.data)) {
          const activeList = res.data.data.filter((t) => t.is_active);
          setGstTaxes(activeList.filter((t) => t.tax_type === "GST"));
          setTdsTaxes(activeList.filter((t) => t.tax_type === "TDS"));
        }
      } catch (err) {
        console.warn("Failed to load active taxes from tax master:", err);
      }
    };
    fetchActiveTaxes();
  }, []);

  // Fetch customer data when editing
  useEffect(() => {
    if (customerId) {
      const fetchData = async () => {
        try {
          await dispatch(fetchCustomerById(customerId)).unwrap();
        } catch (error) {
          toast.error(error?.message || "Failed to load customer data");
        }
      };
      fetchData();
    }

    return () => {
      dispatch(clearSelectedCustomer());
    };
  }, [customerId, dispatch]);

  // Populate form when selectedCustomer is loaded
  useEffect(() => {
    if (selectedCustomer && customerId) {
      let customerContacts = [];
      if (selectedCustomer.contacts && selectedCustomer.contacts.length > 0) {
        customerContacts = selectedCustomer.contacts.map((c, idx) => ({
          name: c.name || "",
          role: c.role || (idx === 0 ? "Primary Contact" : "Contact Person"),
          mobile_no: c.mobile_no || "",
          email: c.email || "",
          is_primary: c.is_primary !== undefined ? c.is_primary : idx === 0,
        }));
      } else if (selectedCustomer.contact_person) {
        customerContacts.push({
          name: selectedCustomer.contact_person || "",
          role: "Primary Contact",
          mobile_no: selectedCustomer.mobile_no ? String(selectedCustomer.mobile_no) : "",
          email: selectedCustomer.email || "",
          is_primary: true,
        });
      }

      if (Array.isArray(selectedCustomer.additional_contacts)) {
        selectedCustomer.additional_contacts.forEach((ac) => {
          if (
            ac.name &&
            !customerContacts.some(
              (c) => c.name?.trim().toLowerCase() === ac.name.trim().toLowerCase()
            )
          ) {
            customerContacts.push({
              name: ac.name || "",
              role: ac.role || "Contact Person",
              mobile_no: ac.mobile_no || "",
              email: ac.email || "",
              is_primary: false,
            });
          }
        });
      }

      if (customerContacts.length === 0) {
        customerContacts = [
          {
            name: "",
            role: "Primary Contact",
            mobile_no: "",
            email: "",
            is_primary: true,
          },
        ];
      }

      const initialAccountManagers = Array.isArray(selectedCustomer.rd_account_managers) && selectedCustomer.rd_account_managers.length > 0
        ? selectedCustomer.rd_account_managers.map((u) => u._id || u)
        : (selectedCustomer.owner ? [selectedCustomer.owner._id || selectedCustomer.owner] : []);

      const initialClientServicing = Array.isArray(selectedCustomer.client_servicing_persons)
        ? selectedCustomer.client_servicing_persons.map((u) => u._id || u)
        : [];

      setFormData({
        clientName: selectedCustomer.name || "",
        contacts: customerContacts,
        rd_account_managers: initialAccountManagers,
        client_servicing_persons: initialClientServicing,
        ownerName: selectedCustomer.owner_name || selectedCustomer.owner?.name || "",
        sinceYear: selectedCustomer.since_year || 2024,
        seasonInsight: selectedCustomer.season_insight || "",
        termsText: selectedCustomer.terms_text || "50% advance against order",
        advancePercentage:
          selectedCustomer.advance_percentage !== undefined
            ? selectedCustomer.advance_percentage
            : 50,
        creditDays: selectedCustomer.credit_days || 0,
        gst_tax: selectedCustomer.gst_tax?._id || selectedCustomer.gst_tax || "",
        gst_rate:
          selectedCustomer.gst_tax?.tax_rate !== undefined
            ? selectedCustomer.gst_tax.tax_rate
            : (selectedCustomer.gst_rate || 0),
        tds_tax: selectedCustomer.tds_tax?._id || selectedCustomer.tds_tax || "",
        tds_rate:
          selectedCustomer.tds_tax?.tax_rate !== undefined
            ? selectedCustomer.tds_tax.tax_rate
            : (selectedCustomer.tds_rate || 0),
        addresses:
          selectedCustomer.address?.map((addr) => ({
            label: addr.label || "Office",
            streetAddress: addr.address_1,
            streetAddress2: addr.address_2 || "",
            city: addr.city,
            state: addr.state,
            postalCode: addr.postal_code,
            gstNumber: addr.gst_no || "",
            isShipping: addr.is_shipping ?? true,
          })) || [
            {
              label: "Head Office",
              streetAddress: "",
              streetAddress2: "",
              city: "",
              state: "",
              postalCode: "",
              gstNumber: "",
              isShipping: true,
            },
          ],
        status: selectedCustomer.is_active,
      });

      if (selectedCustomer.gst_status) {
        setGstMode(selectedCustomer.gst_status);
      }
      if (selectedCustomer.gst_remind_stages?.length > 0) {
        setGstRemindAt(selectedCustomer.gst_remind_stages);
      }
    }
  }, [selectedCustomer, customerId]);

  // Keep form rates in sync with live Tax Master options
  useEffect(() => {
    if (formData.gst_tax && gstTaxes.length > 0) {
      const match = gstTaxes.find((t) => t._id === formData.gst_tax);
      if (match && match.tax_rate !== formData.gst_rate) {
        setFormData((prev) => ({ ...prev, gst_rate: match.tax_rate }));
      }
    }
  }, [gstTaxes, formData.gst_tax, formData.gst_rate]);

  useEffect(() => {
    if (formData.tds_tax && tdsTaxes.length > 0) {
      const match = tdsTaxes.find((t) => t._id === formData.tds_tax);
      if (match && match.tax_rate !== formData.tds_rate) {
        setFormData((prev) => ({ ...prev, tds_rate: match.tax_rate }));
      }
    }
  }, [tdsTaxes, formData.tds_tax, formData.tds_rate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => {
      if (name === "status") {
        return { ...prev, status: value === "active" };
      }
      if (name === "gst_tax") {
        const selected = gstTaxes.find((t) => t._id === value);
        return {
          ...prev,
          gst_tax: value,
          gst_rate: selected ? selected.tax_rate : 0,
        };
      }
      if (name === "tds_tax") {
        const selected = tdsTaxes.find((t) => t._id === value);
        return {
          ...prev,
          tds_tax: value,
          tds_rate: selected ? selected.tax_rate : 0,
        };
      }

      return {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
    });

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleAddressChange = (index, e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = [...prev.addresses];

      if (name === "postalCode") {
        updated[index][name] = value.replace(/\D/g, "").slice(0, 6);
      } else {
        updated[index][name] = value;
      }

      return { ...prev, addresses: updated };
    });

    if (fieldErrors.addresses?.[index]?.[name]) {
      setFieldErrors((prev) => {
        const updatedAddressErrors = [...prev.addresses];
        if (updatedAddressErrors[index]) {
          updatedAddressErrors[index] = {
            ...updatedAddressErrors[index],
            [name]: "",
          };
        }
        return { ...prev, addresses: updatedAddressErrors };
      });
    }
  };

  const addBillingAddress = () => {
    setFormData((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses,
        {
          label: `Branch Office ${prev.addresses.length + 1}`,
          streetAddress: "",
          streetAddress2: "",
          city: "",
          state: "",
          postalCode: "",
          gstNumber: "",
          isShipping: true,
        },
      ],
    }));
  };

  const removeBillingAddress = (index) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((_, i) => i !== index),
    }));
    setFieldErrors((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((_, i) => i !== index),
    }));
  };

  const addContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        {
          name: "",
          role: "",
          mobile_no: "",
          email: "",
          is_primary: prev.contacts.length === 0,
        },
      ],
    }));
  };

  const removeContact = (index) => {
    setFormData((prev) => {
      const updated = prev.contacts.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((c) => c.is_primary)) {
        updated[0].is_primary = true;
      }
      return { ...prev, contacts: updated };
    });
  };

  const handleContactChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.contacts];
      if (field === "mobile_no") {
        updated[index][field] = value.replace(/\D/g, "").slice(0, 10);
      } else {
        updated[index][field] = value;
      }
      return { ...prev, contacts: updated };
    });

    if (fieldErrors.contacts?.[index]?.[field]) {
      setFieldErrors((prev) => {
        const updatedErrors = [...(prev.contacts || [])];
        if (updatedErrors[index]) {
          updatedErrors[index] = { ...updatedErrors[index], [field]: "" };
        }
        return { ...prev, contacts: updatedErrors };
      });
    }
  };

  const handleSetPrimaryContact = (index) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({
        ...c,
        is_primary: i === index,
      })),
    }));
  };

  const handleReset = () => {
    setFormData({
      clientName: "",
      contacts: [
        {
          name: "",
          role: "Primary Contact",
          mobile_no: "",
          email: "",
          is_primary: true,
        },
      ],
      rd_account_managers: [],
      client_servicing_persons: [],
      ownerName: "",
      sinceYear: 2024,
      seasonInsight: "",
      termsText: "50% advance against order",
      advancePercentage: 50,
      creditDays: 0,
      gst_tax: "",
      gst_rate: 0,
      tds_tax: "",
      tds_rate: 0,
      addresses: [
        {
          label: "Head Office",
          streetAddress: "",
          streetAddress2: "",
          city: "",
          state: "",
          postalCode: "",
          gstNumber: "",
          isShipping: true,
        },
      ],
      status: null,
    });
    setFieldErrors({
      clientName: "",
      status: "",
      contacts: [],
      addresses: [],
    });
  };

  const handleSubmit = async () => {
    const contactErrors = formData.contacts.map(() => ({
      name: "",
      mobile_no: "",
      email: "",
    }));

    const newErrors = {
      clientName: "",
      status: "",
      contacts: contactErrors,
      addresses: formData.addresses.map(() => ({
        streetAddress: "",
        city: "",
        state: "",
        postalCode: "",
      })),
    };

    let hasError = false;

    if (!formData.clientName.trim()) {
      newErrors.clientName = "Client Name is required";
      hasError = true;
    }

    if (formData.status === null || formData.status === "") {
      newErrors.status = "Status is required";
      hasError = true;
    }

    if (formData.contacts.length === 0) {
      toast.error("At least one contact person is required");
      hasError = true;
    } else {
      formData.contacts.forEach((contact, idx) => {
        if (idx === 0 || contact.is_primary) {
          if (!contact.name.trim()) {
            newErrors.contacts[idx].name = "Contact Person name is required";
            hasError = true;
          }
        }
        if (contact.mobile_no && !/^[0-9]{10}$/.test(contact.mobile_no)) {
          newErrors.contacts[idx].mobile_no = "Mobile must be 10 digits";
          hasError = true;
        }
        if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          newErrors.contacts[idx].email = "Invalid email format";
          hasError = true;
        }
      });
    }

    formData.addresses.forEach((address, index) => {
      if (!address.streetAddress.trim()) {
        newErrors.addresses[index].streetAddress = "Street Address is required";
        hasError = true;
      }

      if (!address.city.trim()) {
        newErrors.addresses[index].city = "City is required";
        hasError = true;
      }

      if (!address.state.trim()) {
        newErrors.addresses[index].state = "State is required";
        hasError = true;
      }

      if (!address.postalCode.trim()) {
        newErrors.addresses[index].postalCode = "Postal Code is required";
        hasError = true;
      } else if (!/^[0-9]{6}$/.test(address.postalCode)) {
        newErrors.addresses[index].postalCode =
          "Postal Code must be exactly 6 digits";
        hasError = true;
      }
    });

    setFieldErrors(newErrors);

    if (hasError) {
      toast.error("Please fix the highlighted errors");
      return;
    }

    const primaryContact = formData.contacts.find((c) => c.is_primary) || formData.contacts[0] || {};

    // Auto-generate short monogram and theme hue
    const words = formData.clientName.trim().split(/\s+/);
    const autoShort = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : formData.clientName.slice(0, 2).toUpperCase();
    const hues = ["ind", "mint", "gold", "coral"];
    const hash = formData.clientName.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const autoHue = hues[hash % hues.length];

    const payload = {
      name: formData.clientName,
      contact_person: primaryContact.name || "",
      mobile_no: Number(primaryContact.mobile_no) || 0,
      email: primaryContact.email || "",
      contacts: formData.contacts
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          role: c.role.trim() || "Contact Person",
          mobile_no: String(c.mobile_no || "").trim(),
          email: String(c.email || "").trim(),
          is_primary: !!c.is_primary,
        })),
      short_name: autoShort,
      color_hue: autoHue,
      rd_account_managers: formData.rd_account_managers || [],
      client_servicing_persons: formData.client_servicing_persons || [],
      owner: formData.rd_account_managers?.[0] || null,
      owner_name: formData.ownerName || null,
      since_year: Number(formData.sinceYear) || 2024,
      season_insight: formData.seasonInsight,
      terms_text: formData.termsText,
      advance_percentage: Number(formData.advancePercentage) || 0,
      credit_days: Number(formData.creditDays) || 0,
      gst_tax: formData.gst_tax || null,
      gst_rate: Number(formData.gst_rate) || 0,
      tds_tax: formData.tds_tax || null,
      tds_rate: Number(formData.tds_rate) || 0,
      address: formData.addresses.map((a, i) => ({
        label: a.label || `Office ${i + 1}`,
        address_1: a.streetAddress,
        address_2: a.streetAddress2,
        city: a.city,
        state: a.state,
        postal_code: a.postalCode,
        gst_no: a.gstNumber,
        is_billing: true,
        is_shipping: a.isShipping ?? true,
      })),
      gst_status: gstMode,
      gst_remind_stages: gstMode === "later" ? gstRemindAt : [],
      is_active: formData.status,
    };

    try {
      if (customerId) {
        await dispatch(
          updateCustomer({ id: customerId, formData: payload })
        ).unwrap();
        toast.success("Customer updated successfully");
      } else {
        await dispatch(createCustomer(payload)).unwrap();
        toast.success("Customer created successfully");
      }
      navigate("/customer");
    } catch (err) {
      const errorMessage = err?.message || "Something went wrong";
      toast.error(errorMessage);
    }
  };

  return (
    <div
      className="bg-gray-100 font-sans min-h-screen form-display"
      style={{ marginTop: "80px" }}
    >
      <div className="form-display flex items-center justify-center p-4">
        <div className="w-full max-w-6xl bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 p-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">
              {customerId ? "Edit Customer" : "Create Customer"}
            </h1>
            <button
              onClick={() => navigate(-1)}
              className="text-sm hover:bg-blue-200 text-blue-600 font-semibold py-2 px-4 rounded"
            >
              <KeyboardBackspaceIcon />
            </button>
          </div>

          <div className="p-6">
            {/* Basic Information Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">
                <i className="fa fa-building mr-2"></i>
                Basic Information
              </h2>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      htmlFor="clientName"
                    >
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="clientName"
                      id="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      placeholder="Enter client / corporate name"
                      className={`w-full px-4 py-2.5 rounded-lg border ${fieldErrors.clientName
                        ? "border-red-500 focus:ring-red-300 focus:border-red-500"
                        : "border-gray-300 focus:ring-blue-300 focus:border-blue-500"
                        } focus:ring-2 outline-none transition`}
                    />
                    {fieldErrors.clientName && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.clientName}
                      </p>
                    )}
                  </div>

                  <div>
                    <FormControl fullWidth variant="outlined" size="small">
                      <label
                        className="block text-sm font-semibold text-gray-700 mb-2"
                        htmlFor="status"
                      >
                        Status <span className="text-red-600">*</span>
                      </label>

                      <Select
                        id="status"
                        name="status"
                        value={
                          formData.status === null
                            ? ""
                            : formData.status
                              ? "active"
                              : "inactive"
                        }
                        onChange={handleChange}
                        displayEmpty
                        size="small"
                        className={`${fieldErrors.status ? "border-red-500" : ""
                          }`}
                      >
                        <MenuItem value="">
                          <span className="text-[var(--theme-text-muted)]">
                            Select status
                          </span>
                        </MenuItem>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                      </Select>

                      {fieldErrors.status && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors.status}
                        </p>
                      )}
                    </FormControl>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      htmlFor="sinceYear"
                    >
                      Client Since (Year)
                    </label>
                    <input
                      type="number"
                      name="sinceYear"
                      id="sinceYear"
                      min={2000}
                      max={2030}
                      value={formData.sinceYear}
                      onChange={handleChange}
                      placeholder="e.g. 2021"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  {/* Team Assignment: RD Account Manager(s) & Client Servicing Person(s) */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 pt-3 border-t border-gray-100">
                    <CustomerTeamAssignment
                      accountManagers={formData.rd_account_managers || []}
                      onChangeAccountManagers={(ids, users) => {
                        const joinedNames = (users || []).map((u) => u.name).filter(Boolean).join(", ");
                        setFormData((prev) => ({
                          ...prev,
                          rd_account_managers: ids,
                          ownerName: joinedNames || prev.ownerName,
                        }));
                      }}
                      clientServicing={formData.client_servicing_persons || []}
                      onChangeClientServicing={(ids) => {
                        setFormData((prev) => ({
                          ...prev,
                          client_servicing_persons: ids,
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Persons Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <i className="fa fa-users text-indigo-600"></i>
                    Contact Persons
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Add key contacts for this client (HR, Procurement, Accounts, Site Incharge). Designate one as Primary.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addContact}
                  className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="text-base font-bold leading-none">+</span> Add Contact Person
                </button>
              </div>

              <div className="space-y-4">
                {formData.contacts.map((contact, index) => (
                  <div
                    key={index}
                    className={`p-5 rounded-xl border transition-all ${contact.is_primary
                        ? "bg-indigo-50/30 border-indigo-200 shadow-2xs"
                        : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="primaryContactRadio"
                            checked={contact.is_primary}
                            onChange={() => handleSetPrimaryContact(index)}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-semibold text-gray-700">
                            Primary Contact
                          </span>
                        </label>
                        {contact.is_primary && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wide">
                            Default for Invoicing & Enquiries
                          </span>
                        )}
                      </div>

                      {formData.contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeContact(index)}
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Contact Name {contact.is_primary && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, "name", e.target.value)}
                          placeholder="e.g. Anita Desai"
                          className={`w-full px-3.5 py-2 text-sm rounded-lg border ${fieldErrors.contacts?.[index]?.name
                              ? "border-red-500 focus:ring-red-300"
                              : "border-gray-300 focus:ring-indigo-300 focus:border-indigo-500"
                            } outline-none focus:ring-2 transition`}
                        />
                        {fieldErrors.contacts?.[index]?.name && (
                          <p className="mt-1 text-xs text-red-600">
                            {fieldErrors.contacts[index].name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Role / Designation
                        </label>
                        <input
                          type="text"
                          value={contact.role}
                          onChange={(e) => handleContactChange(index, "role", e.target.value)}
                          placeholder="e.g. Procurement Manager"
                          className="w-full px-3.5 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Mobile / WhatsApp
                        </label>
                        <div className="flex">
                          <span className="inline-flex items-center px-2.5 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs">
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            value={contact.mobile_no}
                            onChange={(e) => handleContactChange(index, "mobile_no", e.target.value)}
                            placeholder="9820041122"
                            className={`w-full px-3.5 py-2 text-sm rounded-r-lg border ${fieldErrors.contacts?.[index]?.mobile_no
                                ? "border-red-500 focus:ring-red-300"
                                : "border-gray-300 focus:ring-indigo-300 focus:border-indigo-500"
                              } outline-none focus:ring-2 transition`}
                          />
                        </div>
                        {fieldErrors.contacts?.[index]?.mobile_no && (
                          <p className="mt-1 text-xs text-red-600">
                            {fieldErrors.contacts[index].mobile_no}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) => handleContactChange(index, "email", e.target.value)}
                          placeholder="name@company.com"
                          className={`w-full px-3.5 py-2 text-sm rounded-lg border ${fieldErrors.contacts?.[index]?.email
                              ? "border-red-500 focus:ring-red-300"
                              : "border-gray-300 focus:ring-indigo-300 focus:border-indigo-500"
                            } outline-none focus:ring-2 transition`}
                        />
                        {fieldErrors.contacts?.[index]?.email && (
                          <p className="mt-1 text-xs text-red-600">
                            {fieldErrors.contacts[index].email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commercial & Payment Terms Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">
                <i className="fa fa-money mr-2"></i>
                Commercial & Payment Terms
              </h2>
              <div className="p-6 bg-white rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      htmlFor="termsText"
                    >
                      Payment Terms Description
                    </label>
                    <input
                      type="text"
                      name="termsText"
                      id="termsText"
                      value={formData.termsText}
                      onChange={handleChange}
                      placeholder="e.g. 50% advance against order"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <FormControl fullWidth variant="outlined" size="small">
                      <label
                        className="block text-sm font-semibold text-gray-700 mb-2"
                        htmlFor="advancePercentage"
                      >
                        Advance Requirement (%)
                      </label>
                      <Select
                        id="advancePercentage"
                        name="advancePercentage"
                        value={formData.advancePercentage}
                        onChange={handleChange}
                        size="small"
                      >
                        <MenuItem value={0}>0% (Credit terms)</MenuItem>
                        <MenuItem value={25}>25% Advance</MenuItem>
                        <MenuItem value={50}>50% Advance</MenuItem>
                        <MenuItem value={100}>100% Advance</MenuItem>
                      </Select>
                    </FormControl>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 mb-2"
                      htmlFor="creditDays"
                    >
                      Credit Days
                    </label>
                    <input
                      type="number"
                      name="creditDays"
                      id="creditDays"
                      min={0}
                      value={formData.creditDays}
                      onChange={handleChange}
                      placeholder="0 for advance, 30 for credit"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* Tax Configuration (GST & TDS from Tax Master) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
                  <div>
                    <FormControl fullWidth variant="outlined" size="small">
                      <label
                        className="block text-sm font-semibold text-gray-700 mb-2"
                        htmlFor="gst-tax-select"
                      >
                        GST Tax
                      </label>
                      <Select
                        id="gst-tax-select"
                        name="gst_tax"
                        value={formData.gst_tax || ""}
                        onChange={handleChange}
                        displayEmpty
                        size="small"
                      >
                        <MenuItem value="">
                          <span className="text-[var(--theme-text-muted)]">
                            Select GST (From Tax Master)
                          </span>
                        </MenuItem>
                        {gstTaxes.map((tax) => (
                          <MenuItem key={tax._id} value={tax._id}>
                            {tax.tax_name} ({tax.tax_rate}%)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>

                  <div>
                    <FormControl fullWidth variant="outlined" size="small">
                      <label
                        className="block text-sm font-semibold text-gray-700 mb-2"
                        htmlFor="tds-tax-select"
                      >
                        TDS Tax
                      </label>
                      <Select
                        id="tds-tax-select"
                        name="tds_tax"
                        value={formData.tds_tax || ""}
                        onChange={handleChange}
                        displayEmpty
                        size="small"
                      >
                        <MenuItem value="">
                          <span className="text-[var(--theme-text-muted)]">
                            Select TDS (From Tax Master)
                          </span>
                        </MenuItem>
                        {tdsTaxes.map((tax) => (
                          <MenuItem key={tax._id} value={tax._id}>
                            {tax.tax_name} ({tax.tax_rate}%)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                </div>
              </div>
            </div>

            {/* CRM Insights & Seasonality */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">
                <i className="fa fa-lightbulb-o mr-2"></i>
                CRM Insights & Seasonality
              </h2>
              <div className="p-6 bg-white rounded-lg border border-gray-200">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    htmlFor="seasonInsight"
                  >
                    Client Season Insight (Gold Banner in Enquiry Flow)
                  </label>
                  <input
                    type="text"
                    name="seasonInsight"
                    id="seasonInsight"
                    value={formData.seasonInsight}
                    onChange={handleChange}
                    placeholder="e.g. Their annual awards order usually lands in Jan–Feb."
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    This insight automatically displays on the enquiry wizard to guide sales reps when booking jobs.
                  </p>
                </div>
              </div>
            </div>

            {/* GST Registration Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">
                <i className="fa fa-id-card mr-2"></i>
                GST Registration
              </h2>
              <div className="p-6 bg-white rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  GSTIN
                </label>

                {/* Segmented Options */}
                <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200 gap-1 mb-4 flex-wrap">
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${gstMode === "have"
                        ? "bg-white text-indigo-700 shadow-sm border border-indigo-200 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                      }`}
                    onClick={() => setGstMode("have")}
                  >
                    I have it
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${gstMode === "later"
                        ? "bg-white text-indigo-700 shadow-sm border border-indigo-200 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                      }`}
                    onClick={() => {
                      setGstMode("later");
                      if (formData.addresses.length > 0) {
                        handleAddressChange(0, { target: { name: "gstNumber", value: "" } });
                      }
                    }}
                  >
                    Remind me later
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${gstMode === "none"
                        ? "bg-white text-indigo-700 shadow-sm border border-indigo-200 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                      }`}
                    onClick={() => {
                      setGstMode("none");
                      if (formData.addresses.length > 0) {
                        handleAddressChange(0, { target: { name: "gstNumber", value: "" } });
                      }
                    }}
                  >
                    Not registered
                  </button>
                </div>

                {/* Mode: I have it */}
                {gstMode === "have" && (
                  <div>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="15-character GSTIN, e.g. 27AAHCH1234K1Z5"
                      value={formData.addresses[0]?.gstNumber || ""}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/\s/g, "");
                        handleAddressChange(0, { target: { name: "gstNumber", value: val } });
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none uppercase font-mono text-sm"
                    />
                    {formData.addresses[0]?.gstNumber?.length === 15 && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 flex items-center gap-2">
                        <span className="font-bold text-green-600">✓</span> Valid 15-character GSTIN entered.
                      </div>
                    )}
                  </div>
                )}

                {/* Mode: Remind me later */}
                {gstMode === "later" && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">Remind me at:</div>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all ${gstRemindAt.includes("sample")
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                          }`}
                        onClick={() => {
                          setGstRemindAt((prev) =>
                            prev.includes("sample")
                              ? prev.filter((x) => x !== "sample")
                              : [...prev, "sample"]
                          );
                        }}
                      >
                        Sample stage
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all ${gstRemindAt.includes("production")
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                          }`}
                        onClick={() => {
                          setGstRemindAt((prev) =>
                            prev.includes("production")
                              ? prev.filter((x) => x !== "production")
                              : [...prev, "production"]
                          );
                        }}
                      >
                        Production stage
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 italic">
                      The proforma invoice can’t be generated until the GSTIN is added or the client is marked not registered.
                    </p>
                  </div>
                )}

                {/* Mode: Not registered */}
                {gstMode === "none" && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    For individuals, walk-ins and unregistered businesses. Invoices will show no client GSTIN.
                  </div>
                )}
              </div>
            </div>

            {/* Address Section */}
            <CustomerAddressSection
              addresses={formData.addresses}
              fieldErrors={fieldErrors}
              onAddressChange={handleAddressChange}
              onAddAddress={addBillingAddress}
              onRemoveAddress={removeBillingAddress}
            />
            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
              {customerId ? (
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 primary-bgclr hover:bg-blue-600 text-white font-medium rounded-lg transition flex items-center"
                  style={{ backgroundColor: "#574fdd" }}

                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg
                        className="w-4 h-4 mr-2 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </button>
              ) : (
                <>
                  <button
                    className="px-5 py-2.5 bg-white border border-red-500 text-red-500 hover:bg-red-50 font-medium rounded-lg transition flex items-center"
                    type="button"
                    disabled={loading}
                    onClick={handleReset}
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-6 py-2.5 primary-bgclr hover:bg-blue-600 text-white font-medium rounded-lg transition flex items-center"
                    style={{ backgroundColor: "#574fdd" }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="w-4 h-4 mr-2 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerForm;
