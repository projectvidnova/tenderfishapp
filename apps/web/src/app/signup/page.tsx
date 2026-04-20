"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { signUp, signIn } from "@/lib/auth-client";
import { config } from "@/lib/config";

function getPasswordStrength(pw: string): {
  label: string;
  color: string;
  width: string;
} {
  if (pw.length === 0) return { label: "", color: "", width: "w-0" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2)
    return { label: "Weak", color: "bg-status-danger", width: "w-1/3" };
  if (score <= 3)
    return { label: "Fair", color: "bg-status-warning", width: "w-2/3" };
  return { label: "Strong", color: "bg-status-success", width: "w-full" };
}

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    country: "Germany",
  });

  const strength = getPasswordStrength(form.password);

  const isValid =
    form.name.trim().length > 0 &&
    form.email.includes("@") &&
    form.password.length >= 8 &&
    form.company.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      // 1. Sign up with Better Auth (creates user + credential account)
      const result = await signUp.email({
        email: form.email,
        password: form.password,
        name: form.name,
      });

      if (result.error) {
        setError(result.error.message || "Signup failed");
        return;
      }

      // 2. Create workspace for the new user
      const wsRes = await fetch(`${config.apiUrl}/api/auth/setup-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ company: form.company, country: form.country }),
      });

      if (!wsRes.ok) {
        const wsData = await wsRes.json();
        setError(wsData.error || "Failed to create workspace");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    await signIn.social({ provider: "google", callbackURL: "/onboarding/workspace" });
  }

  async function handleMicrosoftSignup() {
    await signIn.social({ provider: "microsoft", callbackURL: "/onboarding/workspace" });
  }

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: e.target.value });
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-black flex-col justify-between p-12">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/tenderfish-icon.svg"
              alt="Tenderfish"
              width={28}
              height={28}
            />
            <span className="text-white text-lg font-bold tracking-tight">
              tender<span className="text-brand-orange">fish</span>
            </span>
          </Link>
        </div>
        <div>
          <p className="text-white/80 text-3xl font-medium leading-snug max-w-md">
            Structure every project.
            <br />
            Control every phase.
          </p>
          <p className="text-white/40 text-sm mt-4 max-w-sm">
            The AI-powered project management platform for German architectural
            practices, built around HOAI LPH 1&ndash;9.
          </p>
        </div>
        <p className="text-white/20 text-xs">&copy; 2026 Tenderfish</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-bg-bg-bg-page">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">
              Create your account
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Start managing your projects in minutes.
            </p>
          </div>

          {/* Social login */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border bg-white text-sm font-medium text-text-primary hover:bg-bg-inset transition-colors rounded-md"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleMicrosoftSignup}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border bg-white text-sm font-medium text-text-primary hover:bg-bg-inset transition-colors rounded-md"
          >
            <svg width="18" height="18" viewBox="0 0 23 23">
              <rect x="1" y="1" width="10" height="10" fill="#f25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
              <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
              <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
            </svg>
            Continue with Microsoft
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-quaternary">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                type="text"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="Anna Muller"
              />
            </div>

            <div>
              <label className="label">Work email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={set("email")}
                placeholder="anna@architekten.de"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary hover:text-text-primary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-border-light rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} ${strength.width} transition-all`}
                    />
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="label">Office / company name</label>
              <input
                className="input"
                type="text"
                required
                value={form.company}
                onChange={set("company")}
                placeholder="e.g. Muller Architekten GmbH"
              />
            </div>

            <div>
              <label className="label">Country</label>
              <select
                className="input"
                value={form.country}
                onChange={set("country")}
              >
                <option value="Germany">Germany</option>
                <option value="Austria">Austria</option>
                <option value="Switzerland">Switzerland</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-status-danger bg-status-danger-light px-3 py-2 rounded-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-sm text-text-secondary text-center">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-brand-orange font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}