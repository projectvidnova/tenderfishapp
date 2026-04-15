"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "error">("loading");
  const [invite, setInvite] = useState<{
    workspaceName: string;
    role: string;
    inviterName: string;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      try {
        const res = await fetch(`${API}/api/invitations/${token}/verify`);
        const data = await res.json();
        if (res.ok) {
          setInvite(data.data);
          setStatus("valid");
        } else if (res.status === 410) {
          setStatus("expired");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }
    verifyToken();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const authToken = localStorage.getItem("tf_token");
      const res = await fetch(`${API}/api/invitations/${token}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

      if (res.ok) {
        router.push("/dashboard");
      } else if (res.status === 401) {
        // User needs to sign up or log in first
        router.push(`/signup?invite=${token}`);
      }
    } catch {
      setStatus("error");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {status === "loading" && (
          <div className="card p-8 text-center">
            <p className="text-sm text-gray-500">Verifying invitation...</p>
          </div>
        )}

        {status === "valid" && invite && (
          <div className="card p-8 space-y-6 text-center">
            <div>
              <h1 className="text-xl font-semibold text-ink">
                You&apos;re invited to join
              </h1>
              <p className="text-2xl font-semibold text-bronze mt-2">
                {invite.workspaceName}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {invite.inviterName} invited you as{" "}
                <span className="font-medium">{invite.role.replace("_", " ")}</span>
              </p>
            </div>

            <button
              onClick={handleAccept}
              disabled={accepting}
              className="btn-primary w-full disabled:opacity-40"
            >
              {accepting ? "Joining..." : "Accept invitation"}
            </button>

            <p className="text-xs text-gray-400">
              By accepting, you&apos;ll join this workspace and gain access to its projects.
            </p>
          </div>
        )}

        {status === "expired" && (
          <div className="card p-8 space-y-4 text-center">
            <h1 className="text-xl font-semibold text-ink">Invitation expired</h1>
            <p className="text-sm text-gray-500">
              This invitation link has expired. Ask the workspace admin to send a new one.
            </p>
            <Link href="/login" className="btn-secondary inline-block">
              Go to login
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="card p-8 space-y-4 text-center">
            <h1 className="text-xl font-semibold text-ink">Invalid invitation</h1>
            <p className="text-sm text-gray-500">
              This invitation link is not valid.
            </p>
            <Link href="/login" className="btn-secondary inline-block">
              Go to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
