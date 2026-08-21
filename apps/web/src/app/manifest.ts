import type { MetadataRoute } from "next";

/** Lets the CRM be installed to a phone home screen and open without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peoples CRM",
    short_name: "Peoples",
    description: "Outreach CRM for construction firms without websites",
    start_url: "/",
    display: "standalone",
    background_color: "#16181c",
    theme_color: "#16181c",
    orientation: "portrait",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
