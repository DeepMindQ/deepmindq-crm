import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

export async function GET() {
  try {
    // ── Companies ──────────────────────────────────────────────────
    const companies = await db.company.findMany({
      where: { status: { not: "archived" } },
      select: {
        domain: true,
        website: true,
        industry: true,
        sizeRange: true,
        country: true,
        location: true,
      },
    });

    const totalCompanies = companies.length;
    const withDomain = companies.filter((c) => !!c.domain).length;
    const withWebsite = companies.filter((c) => !!c.website).length;
    const withIndustry = companies.filter((c) => !!c.industry).length;
    const withEmployeeSize = companies.filter((c) => !!c.sizeRange).length;
    const withCountry = companies.filter((c) => !!c.country).length;
    const withLocation = companies.filter((c) => !!c.location).length;
    const withResearchCard = companies.filter(() => false).length;

    const companyFields = [
      { name: "Domain", filled: withDomain },
      { name: "Website", filled: withWebsite },
      { name: "Industry", filled: withIndustry },
      { name: "Employee Size", filled: withEmployeeSize },
      { name: "Country", filled: withCountry },
      { name: "Location", filled: withLocation },
      { name: "Research Card", filled: withResearchCard },
    ];
    const companyCompletenessByField: Record<string, number> = {};
    for (const f of companyFields) {
      companyCompletenessByField[f.name] =
        totalCompanies > 0 ? Math.round((f.filled / totalCompanies) * 100) : 0;
    }

    // ── Contacts ──────────────────────────────────────────────────
    const contacts = await db.contact.findMany({
      select: {
        email: true,
        title: true,
        phone: true,
        location: true,
        linkedinUrl: true,
        emailHealth: true,
      },
    });

    const totalContacts = contacts.length;
    const withEmail = contacts.filter((c) => !!c.email).length;
    const withJobTitle = contacts.filter((c) => !!c.title).length;
    const withPhone = contacts.filter((c) => !!c.phone).length;
    const contactsWithLocation = contacts.filter((c) => !!c.location).length;
    const withLinkedin = contacts.filter((c) => !!c.linkedinUrl).length;

    const emailHealthBreakdown = {
      valid: contacts.filter((c) => c.emailHealth === "valid").length,
      risky: contacts.filter((c) => c.emailHealth === "risky").length,
      invalid: contacts.filter((c) => c.emailHealth === "invalid").length,
      unknown: contacts.filter((c) => c.emailHealth === "unknown").length,
    };

    const contactFields = [
      { name: "Email", filled: withEmail },
      { name: "Job Title", filled: withJobTitle },
      { name: "Phone", filled: withPhone },
      { name: "Location", filled: contactsWithLocation },
      { name: "LinkedIn", filled: withLinkedin },
    ];
    const contactCompletenessByField: Record<string, number> = {};
    for (const f of contactFields) {
      contactCompletenessByField[f.name] =
        totalContacts > 0 ? Math.round((f.filled / totalContacts) * 100) : 0;
    }

    // ── Overall Score ────────────────────────────────────────────
    const totalEntities = totalCompanies + totalContacts;
    const companyTotalFields = 7; // 7 fields tracked
    const contactTotalFields = 5;

    // Count filled fields
    const companyFilledFields = companyFields.reduce((sum, f) => sum + f.filled, 0);
    const contactFilledFields = contactFields.reduce((sum, f) => sum + f.filled, 0);

    const totalFields = totalCompanies * companyTotalFields + totalContacts * contactTotalFields;
    const filledFields = companyFilledFields + contactFilledFields;
    const emptyFields = totalFields - filledFields;

    // Calculate partial: entities with at least 1 field filled but not all
    let companyPartial = 0;
    let companyComplete = 0;
    let companyEmpty = 0;
    for (const c of companies) {
      const filled = [
        c.domain,
        c.website,
        c.industry,
        c.sizeRange,
        c.country,
        c.location,
        false as unknown as boolean,
      ].filter(Boolean).length;
      if (filled === 0) companyEmpty++;
      else if (filled === companyTotalFields) companyComplete++;
      else companyPartial++;
    }

    let contactPartial = 0;
    let contactComplete = 0;
    let contactEmpty = 0;
    for (const c of contacts) {
      const filled = [c.email, c.title, c.phone, c.location, c.linkedinUrl].filter(
        Boolean
      ).length;
      if (filled === 0) contactEmpty++;
      else if (filled === contactTotalFields) contactComplete++;
      else contactPartial++;
    }

    const overallComplete = companyComplete + contactComplete;
    const overallPartial = companyPartial + contactPartial;
    const overallEmpty = companyEmpty + contactEmpty;

    const score =
      totalFields > 0
        ? Math.round((filledFields / totalFields) * 100)
        : 100;

    // ── Recommendations ──────────────────────────────────────────
    const recommendations: string[] = [];
    if (totalContacts - withJobTitle > 0)
      recommendations.push(
        `${totalContacts - withJobTitle} contacts missing job titles`
      );
    if (totalContacts - withEmail > 0)
      recommendations.push(`${totalContacts - withEmail} contacts missing email addresses`);
    if (totalContacts - withPhone > 0)
      recommendations.push(`${totalContacts - withPhone} contacts missing phone numbers`);
    if (totalCompanies - withIndustry > 0)
      recommendations.push(
        `${totalCompanies - withIndustry} companies missing industry classification`
      );
    if (totalCompanies - withDomain > 0)
      recommendations.push(`${totalCompanies - withDomain} companies missing domain names`);
    if (totalCompanies - withEmployeeSize > 0)
      recommendations.push(
        `${totalCompanies - withEmployeeSize} companies missing employee size`
      );
    if (totalCompanies - withResearchCard > 0)
      recommendations.push(
        `${totalCompanies - withResearchCard} companies without AI research cards`
      );
    if (emailHealthBreakdown.unknown > 0)
      recommendations.push(
        `${emailHealthBreakdown.unknown} contacts have unknown email health — run validation`
      );
    if (emailHealthBreakdown.invalid > 0)
      recommendations.push(
        `${emailHealthBreakdown.invalid} contacts have invalid emails — consider removing or updating`
      );

    return apiSuccess({
      overall: {
        score,
        total: totalEntities,
        complete: overallComplete,
        partial: overallPartial,
        empty: overallEmpty,
      },
      companies: {
        total: totalCompanies,
        withDomain,
        withWebsite,
        withIndustry,
        withEmployeeSize,
        withCountry,
        withLocation,
        withResearchCard,
        completenessByField: companyCompletenessByField,
      },
      contacts: {
        total: totalContacts,
        withEmail,
        withJobTitle,
        withPhone,
        contactsWithLocation,
        withLinkedin,
        emailHealthBreakdown,
        completenessByField: contactCompletenessByField,
      },
      recommendations,
    });
  } catch (error) {
    console.error("Failed to generate data quality report:", error);
    return apiError("Failed to generate data quality report", 500);
  }
}