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
    <div className="rounded-[2rem] border border-stone-200/70 bg-white/75 p-6 shadow-lg shadow-stone-900/5">
      <div className="flex gap-2 rounded-full bg-stone-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-full px-4 py-2 ${mode === "signin" ? "bg-stone-900 text-white" : ""}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full px-4 py-2 ${mode === "signup" ? "bg-stone-900 text-white" : ""}`}
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

        <button className="w-full rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white" type="submit">
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full rounded-full border border-stone-300 px-5 py-3 text-sm font-medium"
        >
          Continue with Google
        </button>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </form>
    </div>
  );
}
