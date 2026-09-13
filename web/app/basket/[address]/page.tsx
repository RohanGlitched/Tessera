import type { Metadata } from "next";
import { BasketDetail } from "@/components/basket-detail";

export const metadata: Metadata = {
  title: "Basket",
  description:
    "What one share holds, what it is worth, and proof the vault is covering every share outstanding.",
};

export default async function BasketPage({
  params,
}: PageProps<"/basket/[address]">) {
  const { address } = await params;
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <BasketDetail address={address} />
    </div>
  );
}
