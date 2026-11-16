import '@fontsource-variable/atkinson-hyperlegible-next';
import './globals.css';

export const metadata = {
  title: 'HerdSense',
  description: 'Livestock health and breeding record management for dairy farms',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
