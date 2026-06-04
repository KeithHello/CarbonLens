import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "CarbonLens - AI Carbon Footprint Tracker",
    template: "%s | CarbonLens",
  },
  description:
    "Track daily activities with text or voice. CarbonLens calculates, saves, and explains your carbon footprint.",
  authors: [{ name: "CarbonLens Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2E7D32",
};

function NavBar() {
  const navItems = [
    { href: "/record", label: "Record" },
    { href: "/insights", label: "Insights" },
    { href: "/discovery-hub", label: "Discovery Hub" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/record"
          className="flex min-w-0 items-center gap-2 text-base font-bold text-primary transition-colors hover:text-primary-700 sm:text-lg"
        >
          <span>🌍</span>
          <span className="truncate">CarbonLens</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-green-50 hover:text-primary sm:px-3"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
