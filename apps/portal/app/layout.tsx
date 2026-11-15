import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { HardwareGuard } from "@/components/HardwareGuard"; // Import the Guard
import { AppShell } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700", "800", "900"] });

const SITE_URL = process.env.PORTAL_URL || "http://localhost:3001";
const DESCRIPTION =
  "Manage software licenses, product releases, and customer entitlements with FXCRUX License Engine.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FXCRUX | Command Center",
    template: "%s | FXCRUX",
  },
  description: DESCRIPTION,
  keywords: ["software licensing", "entitlements", "product releases"],
  openGraph: {
    title: "FXCRUX | Command Center",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "FXCRUX",
    images: ["/brand/fxcrux-lockup.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FXCRUX | Command Center",
    description: DESCRIPTION,
    images: ["/brand/fxcrux-lockup.png"],
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FXCRUX",
  applicationCategory: "BusinessApplication",
  description: DESCRIPTION,
  url: SITE_URL,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-background text-foreground antialiased selection:bg-gold/30`}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="flex min-h-screen">
          <AppShell>
            {/* Wrap children with the Guard - it also owns rendering the
            Navigation sidebar, gated on a confirmed authenticated state
            (see HardwareGuard.tsx for why). */}
            <HardwareGuard>
              {children}
            </HardwareGuard>
          </AppShell>
        </div>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "!bg-black-light !border !border-black-border !text-white !rounded-xl",
              title: "!text-white !font-semibold",
              description: "!text-gray-400",
              success: "!border-emerald-500/30",
              error: "!border-rose-500/30",
              actionButton: "!bg-gold !text-black",
              cancelButton: "!bg-black !text-gray-400",
            },
          }}
        />
      </body>
    </html>
  );
}
