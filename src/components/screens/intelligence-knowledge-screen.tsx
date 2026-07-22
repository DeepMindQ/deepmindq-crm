'use client';

import { PageTransition, SectionHeader } from '@/components/ui/animated-components';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Search, Filter, Database } from 'lucide-react';
import { useState } from 'react';

// ─── Knowledge entry type (mirrors Prisma KnowledgeEntry) ──
interface KnowledgeEntry {
  id: string;
  companyId: string;
  companyName?: string;
  category: string;
  subCategory: string | null;
  content: string;
  source: string | null;
  confidence: number;
  version: number;
  updatedAt: string;
}

// ─── Knowledge categories (4 groups, 14 total) ──
const KNOWLEDGE_GROUPS: Record<string, string[]> = {
  Company: ['Strategy', 'Products', 'Technology', 'Leadership'],
  Sales: ['Opportunities', 'Stakeholders', 'Conversations'],
  Technical: ['Platforms', 'Architecture', 'Patents'],
  Competitive: ['Competitors', 'Partnerships', 'Market'],
};

export default function IntelligenceKnowledgeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <SectionHeader
          title="Knowledge Fabric"
          subtitle="Structured business intelligence memory organized by company and category."
        />

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search knowledge entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-black/[0.04] border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>

        {/* Category Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(KNOWLEDGE_GROUPS).map(([group, categories]) => (
            <Card key={group} className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                <CardDescription className="text-xs">
                  {categories.length} categories
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Placeholder content area — will be populated with real data in Sprint 3 */}
        <Card className="border-border/50">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Database className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Knowledge entries will appear here once intelligence is acquired.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use the Intelligence Sources screen to upload data and populate the knowledge fabric.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}