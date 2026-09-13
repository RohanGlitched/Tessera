import type { Metadata } from "next";
import { Explorer } from "@/components/explorer";

export const metadata: Metadata = {
  title: "Every basket",
  description:
    "Every basket on the program, read straight from the chain, with what a share holds and what it is worth.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <Explorer />
    </div>
  );
}
