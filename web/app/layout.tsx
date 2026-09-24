import type { Metadata } from "next";
import { Fraunces, Archivo } from "next/font/google";
import "./globals.css";
import { DevnetNotice } from "@/components/devnet-notice";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/components/wallet-provider";
import { MarketProvider } from "@/components/market-provider";

/**
 * Fraunces for anything that speaks, Archivo for anything that counts.
 *
 * Fraunces is a variable serif with an optical-size axis and a "wonk" axis; at
 * display sizes the wonky terminals read as cut stone rather than as a webfont.
 * Archivo is a plain grotesque with real tabular figures, which every price in
 * the product depends on.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tessera-fund.vercel.app"),
  title: {
    default: "Tessera — index funds anyone can lay",
    template: "%s · Tessera",
  },
  description:
    "Compose tokenised stocks into one tradeable token, backed share for share in a vault you can audit. Built on Solana.",
  openGraph: {
    title: "Tessera",
    description:
      "Compose tokenised stocks into one tradeable token, backed share for share.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground-deep">
        <WalletProvider>
          <MarketProvider>
            <SiteHeader />
            <DevnetNotice />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </MarketProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
