"use client";
import Image from "next/image";

const GOOGLE_LOGIN = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/google`;
const GOOGLE_SIGNUP = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/google/signup`;

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Left Hero Section */}
      <div className="relative hidden md:block bg-[#091728]">
        <img
          src="/Fund-Pilot-Login-cover.png"
          alt="cover"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        {/* <div className="relative z-10 flex h-full flex-col justify-center px-12 py-16 text-white"> */}
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="w-[70%] text-white">

            {/* <Image src="/fund-pilot-logo-white.png" alt="Fund Pilot Logo" width={120} height={48}/> */}

            <h1 className="text-3xl font-bold leading-tight">
              Automated Operations. Smarter Fund Management.
            </h1>
            <ul className="mt-6 space-y-2 text-sm text-gray-200">
              <li>Auto NAV reconciliation & return tracking</li>
              <li>Real-time AUM and investor dashboards</li>
              <li>Consolidated multi-fund reporting</li>
              <li>KYC & client submission syncing</li>
              <li>Excel/PDF data capture & onboarding</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Login Section */}
      <div className="flex flex-col justify-center px-10">
        {/* <div className="mb-20 flex items-center justify-center w-full max-w-sm mx-auto"> */}
        {/* <div className="mb-20 flex flex-col items-center justify-center w-full max-w-sm mx-auto space-y-4">
          
          <h2 className="text-4xl font-semibold">Login</h2>
        </div> */}
        {/* <div className="my-8  w-[50%] mx-auto flex items-center">
        </div> */}
        <div className="flex justify-center mb-6">
          <Image
            src="/fund-pilot-logo-black.png"
            alt="Fund Pilot Logo"
            width={150}
            height={150}
            className="object-contain"
          />
        </div>
        {/* Email Login Form */}
        <form className="space-y-6 w-full max-w-sm mx-auto">
          <div>
            <label className="block text-sm font-medium mb-1">Username or Email</label>
            <input
              type="text"
              placeholder="Enter Username or Email"
              className="w-full border px-4 py-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter Password"
              className="w-full border px-4 py-2 rounded"
            />
          </div>
          <button type="submit" className="w-full bg-black text-white py-2 rounded hover:bg-gray-800"> Login </button>
          <button type="submit" className="w-full bg-[#0666CC] text-white py-2 rounded hover:bg-[#0552A3]"> Sign up with Email </button>
        </form>
        
        {/* Separator */}
        <div className="my-8  w-[50%] mx-auto flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-gray-500 text-sm">or</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Google Login Button */}
        <div className="space-y-6 w-full max-w-sm mx-auto">
          <a href={GOOGLE_LOGIN} className="block w-full rounded-md bg-black py-3 text-center text-white transition hover:bg-gray-800" >Sign in with Google </a>
          <a href={GOOGLE_SIGNUP} className="block w-full rounded-md bg-[#0666CC] py-3 text-center text-white transition hover:bg-[#0552A3]" >Sign up with Google </a>
        </div>

        

        {/* Additional Footer */}
        <div className="mt-4 text-sm text-center text-gray-500">
          <a href="#" className="text-blue-600 hover:underline">
            Forget Password?
          </a>
        </div>
        {/* 
        <p className="mt-4 text-xs text-center text-gray-400">
          By logging in, you acknowledge and agree to our{" "}
          <a href="#" className="text-blue-500 underline">Terms of Service</a> and{" "}
          <a href="#" className="text-blue-500 underline">Privacy Policy</a>.
        </p> */}

      </div>
    </div>
  );
}