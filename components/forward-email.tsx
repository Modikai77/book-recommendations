"use client";

import { useState } from "react";

export function ForwardEmail({ address }: { address: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setMessage("Copied");
    } catch {
      setMessage("Select the address above to copy it.");
    }
  }
  return <section className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5">
    <h2 className="font-serif text-2xl">Forward an email</h2>
    <p className="mt-2 text-sm">Save this private address as Marginalia. Forward a newsletter to add its books to your library.</p>
    <p className="my-3 select-all font-mono text-sm">{address}</p>
    <button type="button" onClick={copy} className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white">Copy address</button>
    <span role="status" className="ml-3 text-sm">{message}</span>
  </section>;
}
