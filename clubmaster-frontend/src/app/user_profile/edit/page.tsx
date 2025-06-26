"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BottomNavigation from "../../components/BottomNavigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import firebaseApp from "../../../lib/firebase"; // Your Firebase app initialization

// Helper function to convert file to base64 (similar to backend's imageProcessor)
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

interface UserProfile {
  username: string;
  first_name: string | null;
  last_name: string | null;
  location: string | null;
  effective_photo_url: string | null; // Combined field from backend
  custom_photo_base64?: string | null; // Store the new base64 string if image is changed
  photo_url?: string | null; // Original google photo url
  display_name?: string;
  email?: string;
  // Add other fields your user profile might have from the DB
}

export default function EditProfilePage() {
  const router = useRouter();
  const auth = getAuth(firebaseApp);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsFetchingProfile(true);
        try {
          const token = await user.getIdToken();
          const response = await fetch("/api/profile", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to fetch profile");
          }
          const profileData: UserProfile = await response.json();
          setCurrentUser(profileData);
          setUsername(profileData.username || profileData.display_name || "");
          setFirstName(profileData.first_name || "");
          setLastName(profileData.last_name || "");
          setLocation(profileData.location || "");
          setProfilePicturePreview(profileData.effective_photo_url || "/images/abhi icon.svg"); 
        } catch (err: any) {
          setError(err.message || "Could not load profile data.");
          console.error(err);
        } finally {
          setIsFetchingProfile(false);
        }
      } else {
        router.push("/login"); // Redirect if not logged in
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const handlePictureChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePictureFile(file);
      try {
        const base64Preview = await convertFileToBase64(file);
        setProfilePicturePreview(base64Preview);
      } catch (err) {
        console.error("Failed to convert image to base64 preview", err);
        setError("Could not preview image.");
      }
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to update your profile.");
      setIsLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      let custom_photo_base64: string | undefined = undefined;

      if (profilePictureFile) {
        custom_photo_base64 = await convertFileToBase64(profilePictureFile);
      }

      const payload: any = {
        username: username.trim() === currentUser?.username ? undefined : username.trim(), // Send only if changed
        first_name: firstName.trim() === (currentUser?.first_name || "") ? undefined : (firstName.trim() || null),
        last_name: lastName.trim() === (currentUser?.last_name || "") ? undefined : (lastName.trim() || null),
        location: location.trim() === (currentUser?.location || "") ? undefined : (location.trim() || null),
      };
      
      // Only add custom_photo_base64 if a new picture was selected
      if (custom_photo_base64) {
        payload.custom_photo_base64 = custom_photo_base64;
      }
      
      // Remove undefined fields from payload to avoid sending them
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      if (Object.keys(payload).length === 0 && !custom_photo_base64) {
        setSuccessMessage("No changes to save.");
        setIsLoading(false);
        return;
      }

      // Log the user-entered location
      console.log('User-entered location:', location);
      
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to update profile.");
      }

      setSuccessMessage("Profile updated successfully!");
      // Optionally, update currentUser state with responseData.user or refetch
      if (responseData.user) {
        setCurrentUser(responseData.user);
        // Update form fields if they were modified by the backend (e.g. username sanitization)
        setUsername(responseData.user.username || "");
        setFirstName(responseData.user.first_name || "");
        setLastName(responseData.user.last_name || "");
        setLocation(responseData.user.location || "");
        if(responseData.user.custom_photo_base64) {
            setProfilePicturePreview(responseData.user.custom_photo_base64);
        } else if (responseData.user.photo_url) {
            setProfilePicturePreview(responseData.user.photo_url);
        } // else keep current preview if file was selected but somehow not returned

      }
      setProfilePictureFile(null); // Reset file input state

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      console.error("Profile update error:", err);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isFetchingProfile) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#333939] max-w-[430px] mx-auto">
            <p className="text-[#FAF3DD]">Loading profile...</p>
            {/* You can add a spinner here */}
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#333939] max-w-[430px] mx-auto pb-20 relative">
      {/* Header with logo and back arrow */}
      <div className="flex flex-col items-center pt-4 pb-2 relative">
        <button onClick={() => router.back()} className="absolute left-4 top-1/2 -translate-y-1/2">
          <Image src="/icons/back arrow option.svg" alt="Back" width={24} height={24} />
        </button>
        <Image 
          src="/logos/clubmaster-logo.svg" 
          alt="Club Master Logo" 
          width={120} 
          height={40} 
          className="w-auto h-[40px]" 
          style={{ width: 'auto' }} 
        />
      </div>
      {/* Green Profile header with border */}
      <div className="flex justify-center px-4">
        <div className="w-full max-w-[380px]  py-2 text-center text-[22px] font-semibold text-[#FAF3DD] mt-3" >Edit Profile</div>
      </div>

      {error && <p className="text-red-500 text-center mb-4 p-2 bg-red-100 border border-red-500 rounded-md mx-4 max-w-[380px] self-center">{error}</p>}
      {successMessage && <p className="text-green-500 text-center mb-4 p-2 bg-green-100 border border-green-500 rounded-md mx-4 max-w-[380px] self-center">{successMessage}</p>}

      {/* Profile fields form */}
      <form onSubmit={handleSave} className="flex-1 w-full mt-12 max-w-[380px] mx-auto flex flex-col gap-3">
        {/* Profile Picture */}
        <div className="flex items-center justify-between px-2 py-2">
          <label htmlFor="profilePictureInput" className="text-[#D9D9D9] text-base cursor-pointer">Profile Picture</label>
          <div className="flex items-center gap-3">
            <Image 
                src={profilePicturePreview || "/images/abhi icon.svg"} 
                alt="Profile Preview" 
                width={44} 
                height={44} 
                className="rounded-full object-cover" 
                style={{ width: '44px', height: '44px' }} 
            />
            <input 
                type="file" 
                id="profilePictureInput" 
                accept="image/*" 
                onChange={handlePictureChange} 
                className="hidden" 
            />
             <button type="button" onClick={() => document.getElementById('profilePictureInput')?.click()} className="text-sm text-[#E9CB6B] hover:underline">
                Change
            </button>
          </div>
        </div>
        
        {/* Username */}
        <div className="flex flex-col px-2 py-1">
          <label htmlFor="username" className="text-[#D9D9D9] text-base mb-1">Username</label>
          <input 
            type="text" 
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-[#1E2424] text-[#FAF3DD] p-2 rounded-[5px] border border-[#4A5C59] focus:border-[#E9CB6B] outline-none"
            required
          />
        </div>

        {/* First Name */}
        <div className="flex flex-col px-2 py-1">
          <label htmlFor="firstName" className="text-[#D9D9D9] text-base mb-1">First Name</label>
          <input 
            type="text" 
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="bg-[#1E2424] text-[#FAF3DD] p-2 rounded-[5px] border border-[#4A5C59] focus:border-[#E9CB6B] outline-none"
          />
        </div>

        {/* Last Name */}
        <div className="flex flex-col px-2 py-1">
          <label htmlFor="lastName" className="text-[#D9D9D9] text-base mb-1">Last Name</label>
          <input 
            type="text" 
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="bg-[#1E2424] text-[#FAF3DD] p-2 rounded-[5px] border border-[#4A5C59] focus:border-[#E9CB6B] outline-none"
          />
        </div>

        {/* Location */}
        <div className="flex flex-col px-2 py-1">
          <label htmlFor="location" className="text-[#D9D9D9] text-base mb-1">Location</label>
          <input 
            type="text" 
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-[#1E2424] text-[#FAF3DD] p-2 rounded-[5px] border border-[#4A5C59] focus:border-[#E9CB6B] outline-none"
          />
        </div>

        {/* Save Button - moved inside form */}
        <div className="w-full px-2 pt-4">
            <button 
                type="submit" 
                disabled={isLoading || isFetchingProfile}
                className="w-full text-[#D9D9D9] text-lg font-semibold py-3 border rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#4A7C59', borderColor: '#E9CB6B' }}
            >
                {isLoading ? 'Saving...' : 'Save'}
            </button>
        </div>
      </form>
      
      {/* Footer Navigation - Adjusted fixed positioning with form taking flex-1 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30">
        <BottomNavigation />
      </div>
    </div>
  );
} 