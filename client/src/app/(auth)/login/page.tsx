"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";


const API = process.env.NEXT_PUBLIC_API_BASE_URL!;
const GOOGLE_LOGIN = `${API}/api/auth/google`;
const GOOGLE_SIGNUP = `${API}/api/auth/google/signup`;

export default function LoginPage() {
  const router = useRouter();

  /* local state */
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]        = useState(false);
  const togglePwd  = () => setShowPwd((v) => !v);
  const [mode, setMode]         = useState<"login" | "signup">("login");
  const [err , setErr]          = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const endpoint =
      mode === "login" ? "/api/auth/login-email" : "/api/auth/signup-email";

    const r = await fetch(API + endpoint, {
      method : "POST",
      credentials : "include",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ email, password, name: email.split("@")[0] }),
    });

    if (r.ok) {
      router.push("/dashboard");
    } else {
      const { error } = await r.json();
      setErr(error ?? "Request failed");
    }
  }
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

        <div className="flex justify-center mb-6">
          <Image src="/fund-pilot-logo-black.png" alt="Fund Pilot Logo" width={150} height={150} className="object-contain" />
        </div>
        {/* Email Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-sm mx-auto">
          <div>
            <label className="block text-sm font-medium mb-1">Username&nbsp;or&nbsp;Email</label>
            <input
              type="email"
              placeholder="Enter Username or Email"
              className="w-full border px-4 py-2 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>

            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Enter Password"
                className="w-full border px-4 py-2 rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* eye / eye-off toggle */}
              <button
                type="button"
                onClick={togglePwd}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" className="w-full bg-black text-white py-2 rounded hover:bg-gray-800">{mode === "login" ? "Login" : "Sign up"}</button>
          <button type="button" onClick={() => setMode(m => (m === "login" ? "signup" : "login"))} className="w-full bg-[#0666CC] text-white py-2 rounded hover:bg-[#0552A3]" >
            {mode === "login" ? "Sign up with Email" : "Back to Login"}
          </button>
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