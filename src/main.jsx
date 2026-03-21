import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import RiskScan from './pages/risk-scan.jsx';
import OurMission from './pages/our-mission.jsx';
import SignIn from "./pages/sign-in.jsx";
import Login from "./pages/login.jsx";

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
    path: "/login",
    element: <Login />,
  },
]);
createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />,
);
