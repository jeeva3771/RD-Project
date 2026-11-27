import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

import Loadable from "./utils/lazy/Loadable";
import { ToastContainer } from "react-toastify";
// import { ThemeProvider } from "@mui/styles";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as LegacyThemeProvider } from "@mui/styles";
import defaultTheme from "./utils/Styles/Theme/defaultTheme";
import NoAccess from "./pages/common/NoAccess";
import LocationChecker from "./utils/guard/LocationChecker";
import { PriorityColorProvider } from "./context/PriorityColorContext";
import Cookies from "js-cookie";
import RouteGuard from "./utils/guard/RouteGuard";
import ClientConfirmation from "./pages/enquiry/ClientConfirmation";
import VendorQuotePage from "./pages/rfq/VendorQuotePage";

const PublicDesignPreviewView = Loadable(
  React.lazy(() => import("./pages/enquiry-flow-integration/public/PublicDesignPreviewView"))
);

const PublicQuotePreviewView = Loadable(
  React.lazy(() => import("./pages/enquiry-flow-integration/public/PublicQuotePreviewView"))
);

const PublicProformaPreviewView = Loadable(
  React.lazy(() => import("./pages/enquiry-flow-integration/public/PublicProformaPreviewView"))
);

const PublicSampleProofView = Loadable(
  React.lazy(() => import("./pages/enquiry-flow-integration/public/PublicSampleProofView"))
);

const VendorConfirmation = Loadable(
  React.lazy(() => import("./pages/shopfloor/VendorConfirmation"))
);

const Login = Loadable(React.lazy(() => import("./pages/common/Login")));
const DefaultLayout = Loadable(
  React.lazy(() => import("./layout/DefaultLayout"))
);
const PageNotFound = Loadable(
  React.lazy(() => import("./pages/common/PageNotFound"))
);

const TeamPrintView = Loadable(
  React.lazy(() => import("./pages/team/component/TeamPrintView"))
);

const App = () => {
  return (
    <MuiThemeProvider theme={defaultTheme}>
      <LegacyThemeProvider theme={defaultTheme}>
        {/* <ThemeProvider theme={defaultTheme}> */}
        <BrowserRouter>
          <ToastContainer />

          {/*    <Routes>
            <Route path="/no-access" element={<NoAccess />} />
            </Routes>
        <LocationChecker> */}
          <PriorityColorProvider>
            <RouteGuard>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/*" element={<DefaultLayout />} />
                <Route path="*" element={<PageNotFound />} />

                {/* clientscreen */}
                <Route path="/rd/clientconfirmation/:id" element={<ClientConfirmation />} />
                <Route path="/rd/clientconfirmation/:id/:salesid" element={<ClientConfirmation />} />
                <Route path="/rd/clientconfirmation/:id/:salesid/:dtpid" element={<ClientConfirmation />} />

                {/* Public: Integration Client Design Preview */}
                <Route path="/rd/design-view/:jobId" element={<PublicDesignPreviewView />} />

                {/* Public: Integration Client Quotation Preview */}
                <Route path="/rd/quote-view/:jobId" element={<PublicQuotePreviewView />} />

                {/* Public: Integration Client Proforma Invoice Preview */}
                <Route path="/rd/proforma-view/:jobId" element={<PublicProformaPreviewView />} />

                {/* Public: Integration Client Sample Proof Preview & Inspection */}
                <Route path="/rd/sample-proof/:jobId" element={<PublicSampleProofView />} />


                {/* Print Route */}
                <Route path="/print/team/:type/:id?" element={<TeamPrintView />} />

                {/* Public: Vendor Quote Submission */}
                <Route path="/vendor-quote/:id/:token" element={<VendorQuotePage />} />

                {/* Public: Vendor Outsource Confirmation */}
                <Route path="/outsource/confirmation/:token" element={<VendorConfirmation />} />


              </Routes>
            </RouteGuard>
          </PriorityColorProvider>

          {/* </LocationChecker> */}
        </BrowserRouter>
        {/* </ThemeProvider> */}
      </LegacyThemeProvider>
    </MuiThemeProvider>
  );
};

export default App;
