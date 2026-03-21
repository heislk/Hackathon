import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import RiskScan from './pages/risk-scan.jsx';
import OurMission from './pages/our-mission.jsx';

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
]);
createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />,
);
