"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";

export default function LoginWithPhone() {
  const router = useRouter();
  const { loginWithPhone, error: authError } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isValid = /^\d{10}$/.test(phone);

  // Sync errors from auth context
  useEffect(() => {
    if (authError) {
      setError(authError);
      setLoading(false);
    }
  }, [authError]);

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Format phone number with India country code if not provided
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      
      // Send OTP
      const confirmationResult = await loginWithPhone(formattedPhone);
      
      // Store confirmationResult in sessionStorage to be used in the OTP page
      sessionStorage.setItem('confirmationResult', JSON.stringify(confirmationResult));
      sessionStorage.setItem('phoneNumber', formattedPhone);
      
      // Navigate to OTP verification page
      router.push('/login/login_with_phone_otp');
    } catch (error) {
      console.error("Failed to send verification code:", error);
      // Error will be displayed through the authError sync
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between" style={{ background: "#333939" }}>
      {/* Header */}
      <div className="w-full flex items-center px-4 pt-6 pb-8">
        <button onClick={() => router.push('/login')} className="">
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
          <span className="text-[#FAF3DD] text-[20px] font-semibold font-poppins text-center">Enter Your phone number</span>
          <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal text-center mt-2">We will send a confirmation code to your phone</span>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="w-full max-w-[366px] mb-4 bg-red-600 text-white px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {/* Hidden reCAPTCHA container - required by Firebase Phone Auth */}
        <div id="recaptcha-container"></div>
        
        <input
          type="tel"
          maxLength={10}
          value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="+91"
          className="w-[366px] max-w-full h-[50px] bg-[#4C5454] text-[#D9D9D9] rounded-[8px] px-4 text-[16px] font-roboto outline-none mb-4"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        />
      </div>
      
      {/* Next Button Fixed Bottom */}
      <div className="w-full flex justify-center mb-8 px-[21px] fixed bottom-0 left-0 right-0 z-10" style={{ background: 'transparent' }}>
        <button
          className="w-[366px] max-w-full h-[57px] rounded-[8px] font-poppins font-semibold text-[18px] border-2"
          style={{
            background: isValid ? '#4A7C59' : '#4C5454',
            color: '#FAF3DD',
            borderColor: '#E9CB6B',
            opacity: isValid && !loading ? 1 : 0.6,
            cursor: isValid && !loading ? 'pointer' : 'not-allowed',
          }}
          disabled={!isValid || loading}
          onClick={handleSubmit}
        >
          {loading ? "Sending code..." : "Next"}
        </button>
      </div>
    </div>
  );
} 