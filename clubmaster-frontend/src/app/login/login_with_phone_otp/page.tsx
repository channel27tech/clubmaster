"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";

export default function LoginWithPhoneOtp() {
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputs: React.RefObject<HTMLInputElement | null>[] = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const isValid = otp.every((d) => d.length === 1);
  const phone = "+911234567890"; // Replace with actual phone if needed

  const handleChange = (idx: number, val: string) => {
    if (!/^[0-9]?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 3) {
      inputs[idx + 1].current?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputs[idx - 1].current?.focus();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between" style={{ background: "#363C3C" }}>
      {/* Header */}
      <div className="w-full flex items-center px-4 pt-6 pb-8">
        <button onClick={() => router.push('/login/login_with_phone')} className="mr-2">
          <svg width="25" height="25" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 16L8.5 11L13.5 6" stroke="#BFC0C0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1 flex justify-center mr-3">
          <Image src="/logos/clubmaster_logo_no_bg.svg" alt="ClubMaster Logo" width={120} height={40} />
        </div>
      </div>
      {/* Main Content */}
      <div className="flex flex-col items-center w-full flex-1">
        <div className="mt-2 mb-6 w-full flex flex-col items-center">
          <span className="text-[#FAF3DD] text-[20px] font-semibold font-poppins text-center">Enter verification code</span>
          <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal text-center mt-2">We sent a 4-digit code to {phone}</span>
        </div>
        {/* OTP Inputs */}
        <div className="flex gap-6 justify-center items-center mt-4 mb-4">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={inputs[idx]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              className="w-12 h-12 text-center text-[24px] font-poppins font-semibold text-[#FAF3DD] bg-transparent border-b-2 border-[#D9D9D9] outline-none"
              style={{ borderRadius: 0 }}
            />
          ))}
        </div>
        <span className="text-[#D9D9D9] text-[12px] font-poppins font-medium text-center mt-20">Resend code by sms</span>
      </div>
      {/* Next Button Fixed Bottom */}
      <div className="w-full flex justify-center mb-8 px-[21px] fixed bottom-0 left-0 right-0 z-10" style={{ background: 'transparent' }}>
        <button
          className="w-[366px] max-w-full h-[57px] rounded-[8px] font-poppins font-semibold text-[18px] border-2"
          style={{
            background: isValid ? '#4A7C59' : '#4C5454',
            color: '#FAF3DD',
            borderColor: '#E9CB6B',
            opacity: isValid ? 1 : 0.6,
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}
          disabled={!isValid}
        >
          Next
        </button>
      </div>
    </div>
  );
} 