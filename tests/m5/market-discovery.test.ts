/**
 * M5 Phase 3 — Market Discovery Query Parsing Unit Tests
 *
 * Tests the NL query parser that extracts industry, geography, size,
 * and theme criteria from natural language queries.
 */

import { describe, it, expect } from 'vitest';
import { parseMarketQuery } from '@/lib/market-discovery';

describe('parseMarketQuery', () => {
  it('should extract European geography keywords', () => {
    const result = parseMarketQuery('Find technology companies in Europe');
    expect(result.geographies).toContain('europe');
    expect(result.industries).toContain('technology');
  });

  it('should extract UK geography from multiple aliases', () => {
    const uk = parseMarketQuery('companies in UK');
    expect(uk.geographies).toContain('united kingdom');

    const britain = parseMarketQuery('companies in Britain');
    expect(britain.geographies).toContain('united kingdom');
  });

  it('should extract US geography', () => {
    const result = parseMarketQuery('Find enterprise companies in the US');
    expect(result.geographies).toContain('united states');
  });

  it('should extract enterprise size preference', () => {
    const result = parseMarketQuery('enterprise companies in finance');
    expect(result.sizePreferences).toContain('enterprise');
  });

  it('should extract mid-market size preference', () => {
    const result = parseMarketQuery('mid-market SaaS companies');
    expect(result.sizePreferences).toContain('mid-market');
  });

  it('should extract SMB/Startup size', () => {
    const result = parseMarketQuery('small business startups in healthcare');
    expect(result.sizePreferences).toContain('smb');
  });

  it('should extract technology industry themes', () => {
    const result = parseMarketQuery('AI and machine learning companies');
    expect(result.industries).toContain('technology');
  });

  it('should extract financial services industry', () => {
    const result = parseMarketQuery('banking and insurance companies');
    expect(result.industries).toContain('financial services');
  });

  it('should extract healthcare industry', () => {
    const result = parseMarketQuery('pharma and biotech companies');
    expect(result.industries).toContain('healthcare');
  });

  it('should extract manufacturing industry', () => {
    const result = parseMarketQuery('automotive manufacturing companies');
    expect(result.industries).toContain('manufacturing');
  });

  it('should extract technology themes (AI, cloud, etc.)', () => {
    const result = parseMarketQuery('companies using AWS and Azure cloud');
    expect(result.themes).toContain('aws');
    expect(result.themes).toContain('azure');
    expect(result.themes).toContain('cloud');
  });

  it('should extract cybersecurity theme', () => {
    const result = parseMarketQuery('cybersecurity companies');
    expect(result.industries).toContain('technology');
  });

  it('should extract multiple geographies', () => {
    const result = parseMarketQuery('companies in Germany and France');
    expect(result.geographies).toContain('germany');
    expect(result.geographies).toContain('france');
  });

  it('should preserve raw query', () => {
    const query = 'Find AI companies in the US with 5000+ employees';
    const result = parseMarketQuery(query);
    expect(result.rawQuery).toBe(query);
  });

  it('should handle empty/minimal queries gracefully', () => {
    const result = parseMarketQuery('companies');
    expect(result.industries).toHaveLength(0);
    expect(result.geographies).toHaveLength(0);
    expect(result.sizePreferences).toHaveLength(0);
    expect(result.themes).toHaveLength(0);
  });

  it('should extract APAC and EMEA regions', () => {
    const apac = parseMarketQuery('companies in APAC');
    expect(apac.geographies).toContain('asia pacific');

    const emea = parseMarketQuery('companies in EMEA');
    expect(emea.geographies).toContain('emea');
  });

  it('should extract India and other specific countries', () => {
    const result = parseMarketQuery('fintech companies in India');
    expect(result.geographies).toContain('india');
    expect(result.industries).toContain('financial services');
  });

  it('should not duplicate industries or geographies', () => {
    const result = parseMarketQuery('technology tech companies in europe european');
    expect(result.industries).toHaveLength(1);
    expect(result.geographies).toHaveLength(1);
  });

  it('should extract digital transformation theme', () => {
    const result = parseMarketQuery('companies focused on digital transformation');
    expect(result.themes).toContain('digital transformation');
    expect(result.themes).toContain('digital');
  });
});
