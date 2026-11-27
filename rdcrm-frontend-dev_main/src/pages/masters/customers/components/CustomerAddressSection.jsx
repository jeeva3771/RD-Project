import React from "react";

const CustomerAddressSection = ({
  addresses = [],
  fieldErrors = {},
  onAddressChange,
  onAddAddress,
  onRemoveAddress,
}) => {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b-2 border-gray-200">
        <i className="fa fa-building mr-2"></i>
        Address
      </h2>
      <div className="p-6">
        {addresses.map((address, index) => (
          <div
            key={index}
            className="p-4 mb-4 rounded-md bg-white border border-gray-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Office / Branch Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="label"
                  value={address.label || ""}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="e.g. Head Office, Lower Parel or Pune Branch"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                />
              </div>
              <div className="flex items-center pt-8">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isShipping"
                    checked={address.isShipping ?? true}
                    onChange={(e) =>
                      onAddressChange(index, {
                        target: { name: "isShipping", value: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 font-medium">
                    Available as delivery / shipping destination
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="streetAddress"
                  value={address.streetAddress}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="123 Main Street"
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    fieldErrors.addresses?.[index]?.streetAddress
                      ? "border-red-500 focus:ring-red-300 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-300 focus:border-blue-500"
                  } focus:ring-2 outline-none transition`}
                />
                {fieldErrors.addresses?.[index]?.streetAddress && (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.addresses[index].streetAddress}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address 2
                </label>
                <input
                  type="text"
                  name="streetAddress2"
                  value={address.streetAddress2}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="Apartment, suite, unit, etc."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={address.city}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="New York"
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    fieldErrors.addresses?.[index]?.city
                      ? "border-red-500 focus:ring-red-300 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-300 focus:border-blue-500"
                  } focus:ring-2 outline-none transition`}
                />
                {fieldErrors.addresses?.[index]?.city && (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.addresses[index].city}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="state"
                  value={address.state}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="NY"
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    fieldErrors.addresses?.[index]?.state
                      ? "border-red-500 focus:ring-red-300 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-300 focus:border-blue-500"
                  } focus:ring-2 outline-none transition`}
                />
                {fieldErrors.addresses?.[index]?.state && (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.addresses[index].state}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postal Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="postalCode"
                  maxLength={6}
                  value={address.postalCode}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="100010"
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    fieldErrors.addresses?.[index]?.postalCode
                      ? "border-red-500 focus:ring-red-300 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-300 focus:border-blue-500"
                  } focus:ring-2 outline-none transition`}
                />
                {fieldErrors.addresses?.[index]?.postalCode && (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldErrors.addresses[index].postalCode}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Number
                </label>
                <input
                  type="text"
                  name="gstNumber"
                  value={address.gstNumber}
                  onChange={(e) => onAddressChange(index, e)}
                  placeholder="27AAECS1234F1Z5"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              {index === addresses.length - 1 && (
                <button
                  type="button"
                  onClick={onAddAddress}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                >
                  + Add Another Address
                </button>
              )}
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => onRemoveAddress(index)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Remove Address
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerAddressSection;
