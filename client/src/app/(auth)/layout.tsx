import "@/app/globals.css";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}

// export default function AuthLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <body className="min-h-screen bg-white">{children}</body>
//     </html>
//   );
// }
