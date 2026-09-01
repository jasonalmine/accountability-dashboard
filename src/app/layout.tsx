import type { Metadata } from "next";
import { Poppins, Fira_Code } from "next/font/google";
import "./globals.css";

// Century Gothic is a local system family, so Poppins is loaded as the web
// fallback at the same stepped-down weights.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({ variable: "--font-fira", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Accountability Dashboard",
  description: "Self-reported cohort progress for a community accountability group.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${firaCode.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
