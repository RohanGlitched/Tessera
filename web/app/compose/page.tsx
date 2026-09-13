import type { Metadata } from "next";
import { Composer } from "@/components/composer";

export const metadata: Metadata = {
  title: "Lay a basket",
  description:
    "Choose tokenised equities and weights, and mint the result as one token backed share for share.",
};

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <Composer />
    </div>
  );
}
