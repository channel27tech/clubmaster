import { Geist, Geist_Mono, Poppins, Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ClubProvider } from './context/ClubContext';
import { BetGameProvider } from '@/context/BetGameContext';
import { metadata } from './metadata';

// Font setup
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${roboto.variable}`}
    >
      <body className="antialiased">
        <Providers>
          <ClubProvider>
            <BetGameProvider>
              {children}
            </BetGameProvider>
          </ClubProvider>
        </Providers>
      </body>
    </html>
  );
}
