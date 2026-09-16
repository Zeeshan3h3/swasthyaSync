export const audioTranslations = {
  "en-IN": {
    welcome: "Welcome to SwasthyaSync. Please login with your ABHA ID or mobile number.",
    enter_abha: "Please enter your 14-digit ABHA address.",
    enter_mobile: "Please enter your 10 digit mobile number.",
    enter_otp: "Please enter the 6 digit OTP sent to your mobile.",
    enter_name: "check your details in the table and fill the empty fields.",
    enter_age: "Please enter your age.",
    select_gender: "Please select your gender.",
    upload_docs: "If you have any old prescriptions or lab reports, please upload them now. Otherwise, you can skip.",
    interview_start: "Your clinical interview will start now. You can speak naturally or tap the screen.",
    final_check: "Please review your medical summary on the screen. If it looks correct, click confirm.",
    token_gen: "Thank you. Your token number is {token} for {dest}. Please wait in the waiting area for your turn.",
    consent_intro: "Please read and accept the data consent checkboxes to proceed.",
  },
  "hi-IN": {
    welcome: "SwasthyaSync mein aapka swagat hai. Kripya apna ABHA ID ya mobile number darj karein.",
    enter_abha: "Kripya apna ABHA address darj karein.",
    enter_mobile: "Kripya apna 10 digit mobile number darj karein.",
    enter_otp: "Kripya aapke mobile par bheja gaya 6-digit OTP darj karein.",
    enter_name: "table me apna details check kijiye aur khali fields fill kijiye.",
    enter_age: "Kripya apni umar darj karein.",
    select_gender: "Kripya apna ling chunein.",
    upload_docs: "Yadi aapke paas purani report ya parchi hai, toh unhe abhi upload karein. Varna aage badhein.",
    interview_start: "Aapka checkup ab shuru hoga. Aap bol kar ya screen chhoo kar jawaab de sakte hain.",
    final_check: "Kripya apni medical summary check karein aur confirm karein.",
    token_gen: "Dhanyawaad. Aapka token number {token} hai {dest} ke liye. Kripya waiting area mein pratiksha karein.",
    consent_intro: "Kripya aage badhne ke liye sabhi data consent checkboxes ko padhein aur sweekar karein.",
  },
  "bn-IN": {
    welcome: "SwasthyaSync-এ আপনাকে স্বাগতম। অনুগ্রহ করে আপনার ABHA ID বা মোবাইল নম্বর দিয়ে লগইন করুন।",
    enter_abha: "অনুগ্রহ করে আপনার ১৪ সংখ্যার ABHA ঠিকানা লিখুন।",
    enter_mobile: "অনুগ্রহ করে আপনার ১০ সংখ্যার মোবাইল নম্বর লিখুন।",
    enter_otp: "অনুগ্রহ করে আপনার মোবাইলে পাঠানো ৬ সংখ্যার OTP লিখুন।",
    enter_name: "অনুগ্রহ করে আপনার পুরো নাম লিখুন।",
    enter_age: "অনুগ্রহ করে আপনার বয়স লিখুন।",
    select_gender: "অনুগ্রহ করে আপনার লিঙ্গ নির্বাচন করুন।",
    upload_docs: "আপনার কাছে কোনো পুরানো প্রেসক্রিপশন বা ল্যাব রিপোর্ট থাকলে এখন আপলোড করুন। না থাকলে এড়িয়ে যান।",
    interview_start: "আপনার ক্লিনিক্যাল সাক্ষাৎকার এখন শুরু হবে। আপনি স্বাভাবিকভাবে বলতে বা স্ক্রিন স্পর্শ করতে পারেন।",
    final_check: "অনুগ্রহ করে স্ক্রিনে আপনার মেডিকেল সারাংশ পর্যালোচনা করুন এবং নিশ্চিত করুন।",
    token_gen: "ধন্যবাদ। আপনার টোকেন নম্বর {token} {dest} এর জন্য। অনুগ্রহ করে ওয়েটিং এরিয়ায় অপেক্ষা করুন।",
    consent_intro: "অনুগ্রহ করে এগিয়ে যেতে সমস্ত ডেটা সম্মতি চেকবক্স পড়ুন এবং গ্রহণ করুন।",
  }
} as const;

export type TranslationKey = keyof typeof audioTranslations["en-IN"];
export type SupportedLanguage = keyof typeof audioTranslations;
