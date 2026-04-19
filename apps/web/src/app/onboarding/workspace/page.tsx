"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Copy, Check, Plus, Trash2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken() {
  if (typeof window !== "undefined") return localStorage.getItem("tf_token") || "";
  return "";
}

export default function OnboardingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [workspace, setWorkspace] = useState({
    name: "",
    street: "",
    city: "",
    postcode: "",
    country: "Germany",
    taxId: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 2 state
  const [invites, setInvites] = useState([{ email: "", role: "team_member" }]);

  // Step 3 state
  const [inboxEmail, setInboxEmail] = useState("");
  const [copied, setCopied] = useState(false);

  // Loading
  const [loading, setLoading] = useState(false);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function addInviteRow() {
    setInvites([...invites, { email: "", role: "team_member" }]);
  }

  function removeInviteRow(index: number) {
    setInvites(invites.filter((_, i) => i !== index));
  }

  function updateInvite(index: number, field: string, value: string) {
    const updated = [...invites];
    updated[index] = { ...updated[index], [field]: value };
    setInvites(updated);
  }

  async function handleStep1Submit() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/onboarding/workspace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(workspace),
      });
      const data = await res.json();
      if (res.ok && data.data?.inboxEmail) {
        setInboxEmail(data.data.inboxEmail);
      }
      setStep(2);
    } catch {
      // In dev mode without API, just advance
      setInboxEmail(`${workspace.name.toLowerCase().replace(/\s+/g, "-")}@in.tenderfish.ai`);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2Submit() {
    setLoading(true);
    const validInvites = invites.filter((inv) => inv.email.includes("@"));

    if (validInvites.length > 0) {
      try {
        await fetch(`${API}/api/onboarding/invitations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ invitations: validInvites }),
        });
      } catch {
        // Continue even if invite sending fails
      }
    }

    setStep(3);
    setLoading(false);
  }

  function copyInboxEmail() {
    navigator.clipboard.writeText(inboxEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-bg-bg-page flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">Set up your workspace</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Step {step} of 3
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? "bg-brand-orange" : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Office Profile */}
        {step === 1 && (
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-text-primary">Office profile</h2>
              <p className="text-sm text-text-tertiary mt-1">
                Tell us about your practice. This can be updated later in Settings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Workspace name</label>
                <input
                  className="input"
                  value={workspace.name}
                  onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })}
                  placeholder="e.g. Müller Architekten"
                />
              </div>

              <div className="col-span-2">
                <label className="label">Street address</label>
                <input
                  className="input"
                  value={workspace.street}
                  onChange={(e) => setWorkspace({ ...workspace, street: e.target.value })}
                  placeholder="Friedrichstraße 123"
                />
              </div>

              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  value={workspace.city}
                  onChange={(e) => setWorkspace({ ...workspace, city: e.target.value })}
                  placeholder="Berlin"
                />
              </div>

              <div>
                <label className="label">Postcode</label>
                <input
                  className="input"
                  value={workspace.postcode}
                  onChange={(e) => setWorkspace({ ...workspace, postcode: e.target.value })}
                  placeholder="10117"
                />
              </div>

              <div>
                <label className="label">Country</label>
                <select
                  className="input"
                  value={workspace.country}
                  onChange={(e) => setWorkspace({ ...workspace, country: e.target.value })}
                >
                  <option value="Germany">Germany</option>
                  <option value="Austria">Austria</option>
                  <option value="Switzerland">Switzerland</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="label">Tax ID (optional)</label>
                <input
                  className="input"
                  value={workspace.taxId}
                  onChange={(e) => setWorkspace({ ...workspace, taxId: e.target.value })}
                  placeholder="DE123456789"
                />
              </div>
            </div>

            {/* Logo upload */}
            <div>
              <label className="label">Logo (optional)</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 rounded-xl object-cover border border-border"
                    />
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-ink text-white rounded-full flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-brand-orange transition-colors">
                    <Upload size={20} className="text-text-quaternary" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </label>
                )}
                <p className="text-xs text-text-quaternary">Square image, PNG or JPG</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleStep1Submit}
                disabled={!workspace.name.trim() || loading}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Invite Team */}
        {step === 2 && (
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-text-primary">Invite your team</h2>
              <p className="text-sm text-text-tertiary mt-1">
                Add colleagues now, or skip and do this later from Settings.
              </p>
            </div>

            <div className="space-y-3">
              {invites.map((inv, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    className="input flex-1"
                    type="email"
                    placeholder="colleague@architekten.de"
                    value={inv.email}
                    onChange={(e) => updateInvite(i, "email", e.target.value)}
                  />
                  <select
                    className="input w-44"
                    value={inv.role}
                    onChange={(e) => updateInvite(i, "role", e.target.value)}
                  >
                    <option value="project_lead">Project Lead</option>
                    <option value="team_member">Team Member</option>
                  </select>
                  {invites.length > 1 && (
                    <button
                      onClick={() => removeInviteRow(i)}
                      className="p-2 hover:bg-bg-inset rounded-sm transition-colors text-text-quaternary hover:text-status-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addInviteRow}
              className="flex items-center gap-2 text-sm text-brand-orange hover:underline"
            >
              <Plus size={14} />
              Add another
            </button>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                onClick={() => setStep(3)}
                className="text-sm text-text-quaternary hover:text-text-secondary"
              >
                I&apos;ll do this later
              </button>
              <button
                onClick={handleStep2Submit}
                disabled={loading}
                className="btn-primary disabled:opacity-40"
              >
                {loading ? "Sending..." : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Workspace Inbox */}
        {step === 3 && (
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-text-primary">Your workspace inbox</h2>
              <p className="text-sm text-text-tertiary mt-1">
                Forward project emails to this address. Tenderfish will
                automatically read incoming emails, extract attachments, and
                suggest project matches.
              </p>
            </div>

            <div className="bg-bg-inset rounded-xl p-4 flex items-center justify-between">
              <code className="text-sm font-mono text-text-primary">
                {inboxEmail || "your-office@in.tenderfish.ai"}
              </code>
              <button
                onClick={copyInboxEmail}
                className="flex items-center gap-1.5 text-sm text-brand-orange hover:underline"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="bg-bg-inset/50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-text-primary">How to set up forwarding</p>
              <ol className="text-sm text-text-tertiary space-y-1 list-decimal list-inside">
                <li>Open your email provider settings</li>
                <li>Add a forwarding rule for project-related emails</li>
                <li>Set the forwarding address to your inbox above</li>
                <li>Incoming emails will appear in your Tenderfish inbox</li>
              </ol>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={() => router.push("/dashboard")}
                className="btn-primary"
              >
                Go to dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
