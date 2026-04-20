import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-[1120px] mx-auto px-8 h-[52px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Image src="/tenderfish-icon.svg" alt="Tenderfish" width={28} height={28} className="flex-shrink-0" />
            <span className="text-brand-black">tender</span>
            <span className="text-brand-orange -ml-1.5">fish</span>
          </Link>
          <div className="hidden md:flex gap-7 text-[13px] font-medium text-text-secondary">
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-text-primary transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
          </div>
          <div className="flex gap-2.5 items-center">
            <Link href="/login" className="text-[13px] font-semibold px-4 py-1.5 rounded-full hover:bg-bg-inset transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="text-[13px] font-semibold px-5 py-1.5 rounded-full bg-brand-orange text-white hover:bg-brand-orange-hover transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-[140px] pb-20 text-center px-8">
        <div className="max-w-[800px] mx-auto">
          <h1 className="text-[3.5rem] font-bold tracking-[-1.5px] leading-[1.08] mb-4">
            Automated. Secure. Efficient.{" "}
            <span className="bg-gradient-to-br from-brand-orange to-amber-400 bg-clip-text text-transparent">
              For architecture and construction.
            </span>
          </h1>
          <p className="text-xl text-text-secondary leading-relaxed max-w-[600px] mx-auto mb-8">
            Tenderfish structures tendering, awarding, execution, documentation, and acceptance into a clear project flow for architectural projects.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="inline-flex items-center text-[15px] font-semibold px-7 py-3 rounded-full bg-brand-orange text-white hover:bg-brand-orange-hover transition-colors">
              Start Free Trial
            </Link>
            <a href="#features" className="inline-flex items-center text-[15px] font-semibold px-7 py-3 rounded-full border border-border-default text-text-primary hover:bg-bg-inset transition-colors">
              Book a Demo
            </a>
          </div>
        </div>

        {/* App Preview */}
        <div className="max-w-[960px] mx-auto mt-12">
          <div className="bg-bg-inset rounded-[20px] border border-black/[0.04] overflow-hidden">
            <div className="h-8 bg-white border-b border-black/[0.06] flex items-center px-3 gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
              <div className="w-2 h-2 rounded-full bg-[#27c93f]" />
            </div>
            <div className="p-6 bg-gradient-to-b from-bg-inset to-[#e8e8ed] min-h-[300px] flex items-center justify-center">
              <span className="text-sm text-text-tertiary font-medium">Interactive Tenderfish Dashboard Preview</span>
            </div>
          </div>
        </div>
      </section>

      {/* TRUSTED BY */}
      <div className="py-10 px-8 text-center border-t border-bg-inset">
        <p className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-5">Trusted by leading construction firms</p>
        <div className="flex items-center justify-center gap-12 opacity-35 flex-wrap">
          {["HOCHTIEF", "STRABAG", "GOLDBECK", "ZÜBLIN", "BREMER"].map((name) => (
            <span key={name} className="text-lg font-bold tracking-tight">{name}</span>
          ))}
        </div>
      </div>

      {/* FOUR PRODUCT CORES */}
      <section id="features" className="py-20 px-8 bg-bg-inset">
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center max-w-[600px] mx-auto mb-12">
            <div className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">Product</div>
            <h2 className="text-[2.5rem] font-bold tracking-[-1px] leading-tight mb-3">Four cores. One platform.</h2>
            <p className="text-[17px] text-text-secondary leading-relaxed">Everything a project controller needs — from first tender to final invoice — in one unified workspace.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {[
              { title: "Core A — Tender Builder", desc: "AI-assisted creation of tender packages. Upload plans and specs, and Tenderfish extracts line items, assigns DIN cost groups, and drafts your LV in minutes.", color: "bg-brand-orange-light", icon: "📄" },
              { title: "Core B — Supplier & Comparison", desc: "Invite suppliers, collect bids in a branded portal, and auto-generate a Preisspiegel with AI-flagged outliers and negotiation recommendations.", color: "bg-brand-blue-light", icon: "👥" },
              { title: "Core C — Budget & Margin Engine", desc: "4-layer budget tracking (Baseline → Forecast → Committed → Variations) with real-time margin indicators and automated approval workflows.", color: "bg-[rgba(52,199,89,0.1)]", icon: "💰" },
              { title: "Core D — Workspace Inbox", desc: "Unified inbox that captures emails, documents, and supplier responses — AI classifies, routes, and links every message to the right project context.", color: "bg-[rgba(131,56,236,0.1)]", icon: "📬" },
            ].map((core) => (
              <div key={core.title} className="bg-bg-page border border-black/[0.04] rounded-[20px] p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className={`w-12 h-12 rounded-[14px] ${core.color} flex items-center justify-center mb-4 text-xl`}>
                  {core.icon}
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{core.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{core.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY TENDERFISH */}
      <section id="how-it-works" className="py-20 px-8">
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center max-w-[600px] mx-auto mb-12">
            <div className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">Why Tenderfish</div>
            <h2 className="text-[2.5rem] font-bold tracking-[-1px] leading-tight mb-3">Built for German construction.</h2>
            <p className="text-[17px] text-text-secondary leading-relaxed">Every feature is designed around HOAI fee structures, DIN 276 cost groups, and VOB regulations.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { title: "AI That Speaks HOAI", desc: "Claude-powered pipelines trained on German construction standards. Extracts items from PDFs, assigns DIN codes, and suggests pricing.", color: "bg-brand-orange-light" },
              { title: "GAEB Import & Export", desc: "Native support for GAEB X83/X84 exchange formats. Import existing LVs and export for any AVA system.", color: "bg-brand-blue-light" },
              { title: "Multi-Gate Approvals", desc: "Configurable approval workflows with thresholds, delegation rules, and complete audit trails.", color: "bg-[rgba(52,199,89,0.08)]" },
              { title: "Site Reporting", desc: "Capture progress photos, notes, and evidence directly from the construction site. Automatic GPS tagging and timestamping.", color: "bg-[rgba(131,56,236,0.08)]" },
              { title: "Enterprise Security", desc: "Row-level security, SSO via SAML/OIDC, complete audit logging, and EU-hosted infrastructure. GDPR compliant.", color: "bg-brand-orange-light" },
              { title: "Real-Time Analytics", desc: "Live dashboards for budget status, tender progress, and supplier performance across all your active projects.", color: "bg-brand-blue-light" },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-black/[0.05] rounded-2xl p-7">
                <div className={`w-9 h-9 rounded-[10px] ${f.color} mb-3`} />
                <h4 className="text-[15px] font-semibold mb-1.5">{f.title}</h4>
                <p className="text-[13px] text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-8 bg-bg-inset">
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center max-w-[600px] mx-auto mb-12">
            <div className="text-xs uppercase tracking-widest text-brand-orange font-bold mb-2">Pricing</div>
            <h2 className="text-[2.5rem] font-bold tracking-[-1px] leading-tight mb-3">Simple, transparent pricing.</h2>
            <p className="text-[17px] text-text-secondary leading-relaxed">Start small, scale as you grow. All plans include AI features and German-language support.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Starter */}
            <div className="bg-white border border-black/[0.06] rounded-[20px] p-8">
              <div className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2">Starter</div>
              <div className="text-[2.5rem] font-bold tracking-[-1px] mb-1">€149<span className="text-base font-medium text-text-tertiary">/mo</span></div>
              <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">For small firms and individual project controllers getting started.</p>
              <ul className="space-y-1.5 mb-6">
                {["Up to 3 active projects", "5 tender packages / month", "AI tender item generation", "Basic Preisspiegel", "Email support"].map((f) => (
                  <li key={f} className="text-[13px] text-text-secondary flex items-center gap-2"><span className="text-brand-orange font-bold text-xs">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center text-[13px] font-semibold px-5 py-2.5 rounded-full border border-border-default hover:bg-bg-inset transition-colors">Start Free Trial</Link>
            </div>

            {/* Studio (featured) */}
            <div className="bg-white border-2 border-brand-orange rounded-[20px] p-8 relative shadow-lg shadow-brand-orange/10">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-orange text-white text-[11px] font-semibold px-3 py-0.5 rounded-full">Popular</div>
              <div className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2">Studio</div>
              <div className="text-[2.5rem] font-bold tracking-[-1px] mb-1">€399<span className="text-base font-medium text-text-tertiary">/mo</span></div>
              <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">For growing teams managing multiple projects simultaneously.</p>
              <ul className="space-y-1.5 mb-6">
                {["Up to 15 active projects", "Unlimited tender packages", "Full AI pipeline + inbox", "Supplier portal with branding", "Budget & margin engine", "Priority support"].map((f) => (
                  <li key={f} className="text-[13px] text-text-secondary flex items-center gap-2"><span className="text-brand-orange font-bold text-xs">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center text-[13px] font-semibold px-5 py-2.5 rounded-full bg-brand-orange text-white hover:bg-brand-orange-hover transition-colors">Start Free Trial</Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white border border-black/[0.06] rounded-[20px] p-8">
              <div className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2">Enterprise</div>
              <div className="text-[2.5rem] font-bold tracking-[-1px] mb-1">Custom</div>
              <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">For large firms needing SSO, dedicated infrastructure, and SLA.</p>
              <ul className="space-y-1.5 mb-6">
                {["Unlimited projects", "SSO (SAML / OIDC)", "Dedicated account manager", "Custom integrations", "On-premise option", "99.9% SLA"].map((f) => (
                  <li key={f} className="text-[13px] text-text-secondary flex items-center gap-2"><span className="text-brand-orange font-bold text-xs">✓</span>{f}</li>
                ))}
              </ul>
              <a href="#" className="block text-center text-[13px] font-semibold px-5 py-2.5 rounded-full border border-border-default hover:bg-bg-inset transition-colors">Contact Sales</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-8 bg-brand-black text-white text-center">
        <h2 className="text-[2.5rem] font-bold tracking-[-1px] mb-3">Ready to transform your tenders?</h2>
        <p className="text-[17px] text-white/60 mb-7">Join forward-thinking German construction firms already using Tenderfish.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup" className="text-[15px] font-semibold px-8 py-3 rounded-full bg-brand-orange text-white hover:bg-brand-orange-hover transition-colors">
            Start Free Trial
          </Link>
          <a href="#features" className="text-[15px] font-semibold px-8 py-3 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors">
            Book a Demo
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-8 border-t border-black/[0.06]">
        <div className="max-w-[1120px] mx-auto flex justify-between items-center">
          <div className="text-xs text-text-tertiary">© 2026 Tenderfish. All rights reserved.</div>
          <div className="flex gap-6 text-xs text-text-tertiary">
            <a href="#" className="hover:text-text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-text-primary transition-colors">Imprint</a>
            <a href="#" className="hover:text-text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
