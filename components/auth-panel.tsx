"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        const signupResponse = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password })
        });

        const signupPayload = (await signupResponse.json()) as { error?: string };
        if (!signupResponse.ok) {
          throw new Error(signupPayload.error || "Unable to create account");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      window.location.href = "/dashboard";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[1.75rem] border border-stone-200/70 bg-white/75 p-5 shadow-lg shadow-stone-900/5 sm:rounded-[2rem] sm:p-6">
      <p id="google-hint" className="mb-2 text-center text-sm text-stone-600">
        Recommended for sign-up and sign-in
      </p>
      <button
        type="button"
        aria-describedby="google-hint"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-stone-500 bg-white px-4 py-3 font-sans text-sm font-medium text-stone-900 shadow-sm transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:bg-stone-100"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
          <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.17v5.12h6.6c3.86-3.55 6.09-8.78 6.09-14.79Z" />
          <path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.95l-6.6-5.12c-1.83 1.23-4.17 1.97-6.91 1.97-5.32 0-9.84-3.59-11.46-8.43H5.77v5.28A20.4 20.4 0 0 0 24 44Z" />
          <path fill="#FBBC05" d="M12.54 27.47a12.3 12.3 0 0 1 0-7.85v-5.28H5.77a20 20 0 0 0 0 18.41Z" />
          <path fill="#EA4335" d="M24 11.1c3 0 5.68 1.03 7.81 3.07l5.85-5.85C34.12 5.02 29.51 3 24 3A20.4 20.4 0 0 0 5.77 14.34l6.77 5.28C14.16 14.69 18.68 11.1 24 11.1Z" />
        </svg>
        Continue with Google
      </button>
      <p className="my-5 text-center text-sm text-stone-600">Or continue with email</p>
      <div className="flex gap-2 rounded-full bg-stone-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-full px-4 py-3 ${mode === "signin" ? "bg-stone-900 text-white" : ""}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full px-4 py-3 ${mode === "signup" ? "bg-stone-900 text-white" : ""}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {mode === "signup" ? (
          <label className="block space-y-2 text-sm">
            <span>Name</span>
            <input
              className="w-full rounded-2xl border border-stone-200 px-4 py-3"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Reader name"
            />
          </label>
        ) : null}

        <label className="block space-y-2 text-sm">
          <span>Email</span>
          <input
            className="w-full rounded-2xl border border-stone-200 px-4 py-3"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reader@example.com"
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span>Password</span>
          <input
            className="w-full rounded-2xl border border-stone-200 px-4 py-3"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>

        <button className="w-full rounded-full bg-stone-900 px-5 py-3.5 text-sm font-medium text-white" type="submit">
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </form>
    </div>
  );
}
