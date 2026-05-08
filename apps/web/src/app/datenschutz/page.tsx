// Datenschutzerklärung — DSGVO Art. 13 information requirements.
// This is a starting template; the operator is responsible for keeping it
// in sync with the actual data-processing reality of their deployment.

import Link from "next/link";

const company = process.env.NEXT_PUBLIC_IMPRESSUM_COMPANY ?? "[Anbieter]";
const email = process.env.NEXT_PUBLIC_IMPRESSUM_EMAIL ?? "datenschutz@example.com";
const dpoEmail = process.env.NEXT_PUBLIC_DPO_EMAIL ?? email;

export default function DatenschutzPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 prose prose-sm prose-slate">
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
      <p className="text-sm text-text-tertiary">
        Stand: {new Date().toLocaleDateString("de-DE")}
      </p>

      <section className="mt-8">
        <h2 className="text-base font-semibold">1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website ist
          {" "}{company}. Die vollständigen Kontaktdaten finden Sie im{" "}
          <Link href="/impressum" className="text-brand-orange hover:underline">
            Impressum
          </Link>
          .
        </p>
        <p>
          Bei Fragen zum Datenschutz erreichen Sie uns unter:{" "}
          <a className="text-brand-orange" href={`mailto:${dpoEmail}`}>{dpoEmail}</a>
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">2. Welche Daten wir verarbeiten</h2>
        <ul className="list-disc list-inside">
          <li>Konto- und Profildaten (Name, E-Mail-Adresse, Workspace-Zuordnung)</li>
          <li>
            Projektinhalte, die Sie hochladen (Dokumente, Tabellen, GAEB-Dateien,
            Pläne, Notizen)
          </li>
          <li>Aus diesen Inhalten abgeleitete strukturierte Daten</li>
          <li>Audit-Log-Einträge (Aktion, Zeitstempel, Benutzer-ID, vorheriger/neuer Zustand)</li>
          <li>Technische Logdaten (IP-Adresse, Zeitstempel, Useragent) in begrenztem Umfang</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">3. Rechtsgrundlagen</h2>
        <ul className="list-disc list-inside">
          <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) für die Bereitstellung des Dienstes</li>
          <li>Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung) für gesetzliche Aufbewahrungspflichten</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) für IT-Sicherheit und Audit-Trails</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">4. Empfänger und Auftragsverarbeiter</h2>
        <p>Wir nutzen folgende Auftragsverarbeiter (Art. 28 DSGVO):</p>
        <ul className="list-disc list-inside">
          <li>Hosting-Anbieter für Anwendungs- und Datenbank-Hosting (EU-Rechenzentrum)</li>
          <li>S3-kompatibler Speicheranbieter für Dokumenten-Uploads</li>
          <li>
            KI-Dienste (Anthropic, IONOS / Groq) für die Strukturierung von
            hochgeladenen Inhalten. Die Übermittlung erfolgt verschlüsselt;
            Inhalte werden nicht zum Modelltraining verwendet.
          </li>
        </ul>
        <p className="mt-2 text-xs text-text-tertiary">
          AVV-Verträge gemäß Art. 28 DSGVO sind mit allen Auftragsverarbeitern abgeschlossen.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">5. Speicherdauer</h2>
        <p>
          Projektdaten werden so lange gespeichert, wie das Projekt aktiv ist.
          Audit-Logs werden zur Erfüllung gesetzlicher Aufbewahrungspflichten
          und zur Sicherstellung der revisionssicheren Dokumentation länger
          aufbewahrt. Bei Kontolöschung werden personenbezogene Profildaten
          unverzüglich entfernt; projektbezogene Audit-Einträge können aus
          Gründen der Beweissicherung pseudonymisiert erhalten bleiben.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">6. Ihre Rechte (Art. 15–22 DSGVO)</h2>
        <ul className="list-disc list-inside">
          <li>Auskunft (Art. 15)</li>
          <li>Berichtigung (Art. 16)</li>
          <li>Löschung (Art. 17) — siehe „Konto löschen&ldquo; in den Einstellungen</li>
          <li>Einschränkung (Art. 18)</li>
          <li>Datenübertragbarkeit (Art. 20) — siehe „Daten exportieren&ldquo; in den Einstellungen</li>
          <li>Widerspruch (Art. 21)</li>
        </ul>
        <p className="mt-2">
          Zur Ausübung dieser Rechte schreiben Sie uns an{" "}
          <a className="text-brand-orange" href={`mailto:${dpoEmail}`}>{dpoEmail}</a>.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">7. Beschwerderecht</h2>
        <p>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu
          beschweren. Eine Liste der Aufsichtsbehörden in Deutschland finden
          Sie unter{" "}
          <a
            className="text-brand-orange"
            href="https://www.bfdi.bund.de/DE/Service/Anschriften/anschriften_table.html"
            target="_blank"
            rel="noreferrer"
          >
            bfdi.bund.de
          </a>
          .
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">8. Cookies</h2>
        <p>
          Wir verwenden ausschließlich technisch notwendige Sitzungs-Cookies
          zur Authentifizierung. Es findet kein Tracking, keine Analyse und
          keine Werbung statt. Auf eine Einwilligung gemäß § 25 TTDSG wird
          daher verzichtet, da die Cookies zur Erbringung des ausdrücklich
          gewünschten Dienstes unbedingt erforderlich sind.
        </p>
      </section>

      <section className="mt-10 text-xs text-text-tertiary">
        <Link href="/impressum" className="text-brand-orange hover:underline">
          Impressum
        </Link>
        {" · "}
        <Link href="/" className="hover:underline">
          Zurück zur Startseite
        </Link>
      </section>
    </main>
  );
}
