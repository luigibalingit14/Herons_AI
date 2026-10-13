import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Herons.AI | Your ideas deserve a place to take flight",
  description: "A private research workspace for the UMak community.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
