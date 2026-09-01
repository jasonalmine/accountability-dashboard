import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl">That link isn&apos;t valid</h1>
      <p className="mt-2 text-sm text-muted">
        Check-in links are personal. Use the one from your reminder email, or register again on <Link href="/" className="text-accent">the sign-up page</Link>.
      </p>
    </main>
  );
}
