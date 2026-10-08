import type { Metadata } from "next";
import LandingPage from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Intelar — Research, learn, and think together",
  description:
    "Explore questions with cited research, turn your resources into personal learning paths, and share ideas in collaborative workspaces with Intelar.",
};

export default function Home() {
  return <LandingPage />;
}
