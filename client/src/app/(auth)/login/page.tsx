"use client";

const GOOGLE_LOGIN = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/google`;

export default function LoginPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* left hero  */}
      <div className="relative hidden md:block">
        {/* 👉 replace /cover-bg.png with your own brand image  */}
        <img
          src="/cover-bg.png"
          alt="cover"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative z-10 flex h-full flex-col justify-center bg-black/60 p-12 text-white">
          <img src="/logo-white-cover.png" alt="logo" className="h-8" />
          <h1 className="mt-10 text-3xl font-bold leading-tight">
            FIND THE BEST PRICE WITH A NEW LEVEL OF EFFICIENCY
          </h1>
          <ul className="mt-6 space-y-1 text-sm text-gray-200">
            <li>Tailor-made and Automated RFQ with Multiple Issuers</li>
            <li>Data Analytics for Making Smart Decisions</li>
            <li>Order Management</li>
            <li>Post-trade Life Cycle Management</li>
          </ul>
        </div>
      </div>

      {/* right card */}
      <div className="flex flex-col items-center justify-center px-8">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-wide">
          Fund Pilot
        </h2>

        <a
          href={GOOGLE_LOGIN}
          className="w-56 rounded-md bg-black py-3 text-center text-white transition hover:bg-gray-800"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
