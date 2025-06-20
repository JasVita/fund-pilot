import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  reactStrictMode: true,
  images: {
    /** allow <Image> / <AvatarImage> to fetch from Google  */
    domains: ["lh3.googleusercontent.com"],
  },
};

module.exports = nextConfig;

