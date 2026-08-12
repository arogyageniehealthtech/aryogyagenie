import { SignIn, SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <img src={`${basePath}/logo.png`} alt="ArogyaGenie" className="h-8 w-8" />
        <span className="font-bold text-xl text-primary">ArogyaGenie</span>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <img src={`${basePath}/logo.png`} alt="ArogyaGenie" className="h-8 w-8" />
        <span className="font-bold text-xl text-primary">ArogyaGenie</span>
      </div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}
