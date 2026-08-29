import { AuditCta } from "@/components/audit-cta";
import { BackgroundField } from "@/components/background-field";
import { CaseStudies } from "@/components/case-studies";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { LiveDemo } from "@/components/live-demo";
import { Nav } from "@/components/nav";
import { Positioning } from "@/components/positioning";
import { Problem } from "@/components/problem";
import { Systems } from "@/components/systems";
import { WhyUs } from "@/components/why-us";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  email: CONTACT_EMAIL,
  areaServed: { "@type": "Country", name: "Aruba" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Oranjestad",
    addressCountry: "AW",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BackgroundField />
      <Nav />
      <main id="main">
        <Hero />
        <Problem />
        <HowItWorks />
        <LiveDemo />
        <Systems />
        <WhyUs />
        <CaseStudies />
        <Positioning />
        <AuditCta />
      </main>
      <Footer />
    </>
  );
}
