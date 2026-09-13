import { AuditCta } from "@/components/audit-cta";
import { BackgroundField } from "@/components/background-field";
import { CaseStudies } from "@/components/case-studies";
import { Faq, FAQS } from "@/components/faq";
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

const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": `${SITE_URL}/#business`,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  email: CONTACT_EMAIL,
  image: `${SITE_URL}/og.png`,
  logo: `${SITE_URL}/icon.svg`,
  priceRange: "from Afl. 250/month",
  knowsLanguage: ["en", "es", "nl", "pap"],
  areaServed: { "@type": "Country", name: "Aruba" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Oranjestad",
    addressCountry: "AW",
  },
  makesOffer: [
    {
      "@type": "Offer",
      price: "250",
      priceCurrency: "AWG",
      itemOffered: {
        "@type": "Service",
        name: "Base",
        description:
          "Afl. 250 per month: we design and build your website, then keep it maintained with basic upkeep and small site changes on request.",
      },
    },
    {
      "@type": "Offer",
      price: "500",
      priceCurrency: "AWG",
      itemOffered: {
        "@type": "Service",
        name: "Pro",
        description:
          "Afl. 500 per month, all in one: everything in Base plus SEO and GEO, monthly content changes, and a Google Analytics report sent every month.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Enterprise",
        description:
          "A custom monthly plan for bigger operations: multiple sites or brands, AI agents, booking systems, custom integrations, and priority support. Price on conversation.",
      },
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
        <Faq />
        <AuditCta />
      </main>
      <Footer />
    </>
  );
}
