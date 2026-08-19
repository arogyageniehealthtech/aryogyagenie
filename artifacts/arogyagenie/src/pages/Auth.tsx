import { SignIn, SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4 py-8 relative">
      <div className="mb-6 sm:absolute sm:top-8 sm:left-8 sm:mb-0 flex items-center gap-2">
        <img src={`${basePath}/logo.png`} alt="ArogyaGenie" className="h-8 w-8" />
        <span className="font-bold text-xl text-primary">ArogyaGenie</span>
      </div>
      <div className="w-full max-w-md flex justify-center">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4 py-8 relative">
      <div className="mb-6 sm:absolute sm:top-8 sm:left-8 sm:mb-0 flex items-center gap-2">
        <img src={`${basePath}/logo.png`} alt="ArogyaGenie" className="h-8 w-8" />
        <span className="font-bold text-xl text-primary">ArogyaGenie</span>
      </div>
      <div className="w-full max-w-md flex justify-center">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}
