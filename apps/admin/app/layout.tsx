import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "FXCRUX Core | Admin Panel",
  description: "Internal licensing and hardware-lock administration for FXCRUX.",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen bg-background">
            <Navigation />

            {/* Navigation is `sticky` (in-flow) at md+, so it already reserves its
                own 256px - no horizontal padding needed there. Below md, Navigation
                renders a fixed top bar instead, so main needs top clearance. */}
            <main className="flex-1 pt-16 md:pt-0">
              {children}
            </main>
          </div>
          <Toaster theme="dark" position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
