import type { Metadata } from "next";
import SocialFlowWorkspaceLayout from "@/modules/socialflow-app/layout";

export const metadata: Metadata = {
  title: "SocialFlow Workspace",
  description: "Canonical authenticated workspace for SocialFlow operators",
  robots: {
    index: false,
    follow: false,
  },
};

export default SocialFlowWorkspaceLayout;
