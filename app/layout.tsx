import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Modak } from "next/font/google";
import "./globals.css";

const modak = Modak({
  variable: "--font-modak",
  weight: "400",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Donut — glazed every morning",
  description:
    "Hand-glazed donuts: strawberry, black cocoa and a gold one, twelve a day.",
};

export const viewport: Viewport = {
  themeColor: "#f5d98e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${modak.variable} ${bricolage.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
