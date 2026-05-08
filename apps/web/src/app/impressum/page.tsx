// Impressum page (German legal imprint, required by TMG §5).
// Reads operator details from NEXT_PUBLIC_IMPRESSUM_* env vars.
// In dev, falls back to obvious placeholder values; production deployments
// MUST set the real values.

import Link from "next/link";

const company = process.env.NEXT_PUBLIC_IMPRESSUM_COMPANY ?? "[Firma noch nicht konfiguriert]";
const address = process.env.NEXT_PUBLIC_IMPRESSUM_ADDRESS ?? "[Adresse noch nicht konfiguriert]";
const email = process.env.NEXT_PUBLIC_IMPRESSUM_EMAIL ?? "kontakt@example.com";
const phone = process.env.NEXT_PUBLIC_IMPRESSUM_PHONE ?? "";
const vatId = process.env.NEXT_PUBLIC_IMPRESSUM_VAT_ID ?? "";
const registerCourt = process.env.NEXT_PUBLIC_IMPRESSUM_REGISTER_COURT ?? "";
const registerNumber = process.env.NEXT_PUBLIC_IMPRESSUM_REGISTER_NUMBER ?? "";
const managingDirector = process.env.NEXT_PUBLIC_IMPRESSUM_MANAGING_DIRECTOR ?? "";

export default function ImpressumPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 prose prose-sm prose-slate">
      <h1 className="text-2xl font-semibold">Impressum</h1>
      <p className="text-sm text-text-tertiary">Angaben gemäß § 5 TMG</p>

      <section className="mt-8 space-y-1">
        <p className="font-medium">{company}</p>
        <p className="whitespace-pre-line">{address}</p>
      </section>

      <section className="mt-6 space-y-1">
        <h2 className="text-base font-semibold">Kontakt</h2>
        <p>
          E-Mail: <a className="text-brand-orange" href={`mailto:${email}`}>{email}</a>
        </p>
        {phone && <p>Telefon: {phone}</p>}
      </section>

      {(vatId || registerCourt || registerNumber || managingDirector) && (
        <section className="mt-6 space-y-1">
          <h2 className="text-base font-semibold">Rechtliche Angaben</h2>
          {managingDirector && <p>Vertretungsberechtigt: {managingDirector}</p>}
          {registerCourt && (
            <p>
              Registergericht: {registerCourt}
              {registerNumber && ` · Registernummer: ${registerNumber}`}
            </p>
          )}
          {vatId && <p>Umsatzsteuer-Identifikationsnummer (§ 27a UStG): {vatId}</p>}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-base font-semibold">Verantwortlich für den Inhalt</h2>
        <p>
          Verantwortlich gemäß § 18 Abs. 2 MStV: {managingDirector || company}, {address.split("\n")[0]}.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit:{" "}
          <a className="text-brand-orange" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
            https://ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Haftungsausschluss</h2>
        <p className="text-sm">
          Die Inhalte dieser Seite wurden mit größter Sorgfalt erstellt. Für
          die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können
          wir jedoch keine Gewähr übernehmen.
        </p>
      </section>

      <section className="mt-10 text-xs text-text-tertiary">
        <Link href="/datenschutz" className="text-brand-orange hover:underline">
          Datenschutzerklärung
        </Link>
        {" · "}
        <Link href="/" className="hover:underline">
          Zurück zur Startseite
        </Link>
      </section>
    </main>
  );
}
