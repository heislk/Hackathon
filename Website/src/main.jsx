import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import RiskScan from './pages/risk-scan.jsx';
import OurMission from './pages/our-mission.jsx';
import SignIn from "./pages/sign-in.jsx";
import Login from "./pages/login.jsx";
import Account from "./pages/account.jsx";
import ForBusiness from "./pages/for-business.jsx";
import WikiPage from "./pages/wiki.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SubscriptionProvider } from "./context/SubscriptionContext.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/risk-scan",
    element: <RiskScan />,
  },
  {
    path: "/our-mission",
    element: <OurMission />,
  },
  {
    path: "/sign-in",
    element: <SignIn />,
  },
  {
    path: "/register",
    element: <SignIn />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/account",
    element: <Account />,
  },
  {
    path: "/for-business",
    element: <ForBusiness />,
  },
  {
    path: "/wiki",
    element: <WikiPage />,
  },
]);
createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <SubscriptionProvider>
      <RouterProvider router={router} />
    </SubscriptionProvider>
  </AuthProvider>,
);
