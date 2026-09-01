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
  priceRange: "from $1,500",
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
      itemOffered: {
        "@type": "Service",
        name: "The 24/7 Booking Engine",
        description:
          "An AI Agent for tour operators, charters, and car rentals: answers customers on WhatsApp and web, checks the live calendar, and collects deposits with secure payment links.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "The Digital Concierge",
        description:
          "An AI Agent for boutique hotels, villas, and vacation rentals: 24/7 guest support in English, Spanish, Dutch, and Papiamento, with maintenance requests routed to staff.",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "The Operations Dispatcher",
        description:
          "An AI Agent for high-volume excursions: collects driver's licenses and digital waivers before arrival and keeps the morning guest manifest updated.",
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
