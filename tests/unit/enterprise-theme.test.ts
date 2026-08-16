/**
 * @vitest-environment node
 * Tests for src/components/shared/enterprise-theme.ts
 *
 * We mock the design-tokens module to avoid pulling in the full token tree.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the design-tokens module before importing enterprise-theme
vi.mock('@/components/intelligence-os/design-tokens', () => ({
  tokens: {
    flat: { white: '#ffffff', black: '#000000' },
    opacity: {
      white: { medium: 'rgba(255,255,255,0.8)' },
      micro: 'rgba(255,255,255,0.05)',
      trace: 'rgba(255,255,255,0.02)',
      whisper: 'rgba(255,255,255,0.3)',
    },
    neutral: {
      '900': '#e8ecf4',
      '400': '#8892a8',
      '100': '#1e2535',
      bg: '#1e2535',
      zinc: '#71717A',
      border: '#1e2535',
    },
    trust: {
      unverified: { value: '#8892a8', low: 'rgba(239,68,68,0.2)' },
      high: { value: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      medium: { value: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      low: { value: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    },
    accent: { DEFAULT: '#2563EB', dim: '#93C5FD', strong: '#1E40AF' },
    extended: {
      emerald: {
        value: '#10b981',
        bgMedium: 'rgba(16,185,129,0.12)',
        border: 'rgba(16,185,129,0.25)',
        emeraldDeep: { value: '#059669' },
      },
      emeraldDeep: { value: '#059669' },
      red: { value: '#ef4444' },
      amberDeep: { value: '#b45309' },
      indigo: { value: '#6366f1' },
      pink: { value: '#ec4899' },
      purpleDeep: { value: '#7c3aed' },
    },
    domain: {
      reasoning: '#7c3aed',
      opportunity: '#059669',
      risk: '#dc2626',
      enrichment: '#d97706',
    },
    priority: {
      critical: { bg: 'rgba(220,38,38,0.15)' },
      medium: { bg: 'rgba(245,158,11,0.12)' },
    },
    confidence: {
      low: { border: 'rgba(239,68,68,0.25)' },
      medium: { border: 'rgba(245,158,11,0.25)' },
    },
    gold: {
      DEFAULT: '#d4af37',
      light: '#e8c860',
      dark: '#B8860B',
      bgMedium: '#FEF3C7',
      borderLight: '#FDE68A',
    },
  },
  getConfidenceTier: vi.fn((s: number) => {
    if (s >= 75) return { label: 'high', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    if (s >= 40) return { label: 'medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { label: 'low', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  }),
  getTrustTier: vi.fn(),
  getPriorityTier: vi.fn(),
  radius: { sm: '4px', md: '8px', lg: '12px' },
  typography: { fontFamily: 'system-ui', fontSize: { xs: '12px' } },
  elevation: { sm: '0 1px 2px' },
}));

import {
  gold,
  goldLight,
  card,
  cardSolid,
  border,
  borderSubtle,
  textPrimary,
  textSecondary,
  textMuted,
  colors,
  glassPanel,
  glassPanelGold,
  cardStyles,
  badgeColors,
  statusColors,
  animations,
  goldButton,
  chartGradients,
  spacing,
  cls,
} from '@/components/shared/enterprise-theme';

describe('enterprise-theme', () => {
  describe('color tokens', () => {
    it('exports gold as a CSS var string', () => {
      expect(gold).toContain('--color-gold-dim');
      expect(gold).toContain('#d4af37');
    });

    it('exports goldLight as a CSS var string', () => {
      expect(goldLight).toContain('--color-gold');
      expect(goldLight).toContain('#e8c860');
    });

    it('exports card from tokens.opacity.white.medium', () => {
      expect(card).toBe('rgba(255,255,255,0.8)');
    });

    it('exports cardSolid from tokens.flat.white', () => {
      expect(cardSolid).toBe('#ffffff');
    });

    it('exports border from tokens.opacity.micro', () => {
      expect(border).toBe('rgba(255,255,255,0.05)');
    });

    it('exports borderSubtle from tokens.opacity.trace', () => {
      expect(borderSubtle).toBe('rgba(255,255,255,0.02)');
    });

    it('exports textPrimary from tokens.neutral[900]', () => {
      expect(textPrimary).toBe('#e8ecf4');
    });

    it('exports textSecondary from tokens.trust.unverified.value', () => {
      expect(textSecondary).toBe('#8892a8');
    });

    it('exports textMuted from tokens.neutral[400]', () => {
      expect(textMuted).toBe('#8892a8');
    });
  });

  describe('colors object', () => {
    it('has blue from tokens.accent.DEFAULT', () => {
      expect(colors.blue).toBe('#2563EB');
    });

    it('has green from tokens.extended.emerald.value', () => {
      expect(colors.green).toBe('#10b981');
    });

    it('has amber from tokens.domain.reasoning', () => {
      expect(colors.amber).toBe('#7c3aed');
    });

    it('has red from tokens.domain.risk', () => {
      expect(colors.red).toBe('#dc2626');
    });

    it('has indigo from tokens.extended.indigo.value', () => {
      expect(colors.indigo).toBe('#6366f1');
    });

    it('has gold from tokens.gold.DEFAULT', () => {
      expect(colors.gold).toBe('#d4af37');
    });
  });

  describe('glassPanel', () => {
    it('has background from card', () => {
      expect(glassPanel.background).toBe(card);
    });

    it('has backdropFilter blur', () => {
      expect(glassPanel.backdropFilter).toBe('blur(20px)');
    });

    it('has border with 1px solid', () => {
      expect(glassPanel.border).toContain('1px solid');
    });
  });

  describe('glassPanelGold', () => {
    it('extends glassPanel', () => {
      expect(glassPanelGold.background).toBe(glassPanel.background);
      expect(glassPanelGold.backdropFilter).toBe(glassPanel.backdropFilter);
    });

    it('has gold-themed border', () => {
      expect(glassPanelGold.borderLeft).toBe('3px solid #d4af37');
    });

    it('has gold box shadow', () => {
      expect(glassPanelGold.boxShadow).toContain('rgba(212, 175, 55');
    });
  });

  describe('cardStyles', () => {
    it('has a default variant', () => {
      expect(cardStyles.default).toBeDefined();
      expect(cardStyles.default.borderRadius).toBe('12px');
      expect(cardStyles.default.overflow).toBe('hidden');
    });

    it('bordered() returns a variant with accent border', () => {
      const bordered = cardStyles.bordered('#ff0000');
      expect(bordered.borderLeft).toBe('3px solid #ff0000');
      expect(bordered.borderRadius).toBe('12px');
    });

    it('gold variant has gold-themed border', () => {
      expect(cardStyles.gold.borderLeft).toBe('3px solid #d4af37');
    });

    it('interactive variant has cursor pointer', () => {
      expect(cardStyles.interactive.cursor).toBe('pointer');
      expect(cardStyles.interactive.transition).toContain('box-shadow');
    });
  });

  describe('badgeColors', () => {
    it('has positive variant', () => {
      expect(badgeColors.positive).toHaveProperty('bg');
      expect(badgeColors.positive).toHaveProperty('text');
      expect(badgeColors.positive).toHaveProperty('border');
    });

    it('has negative variant', () => {
      expect(badgeColors.negative).toHaveProperty('bg');
      expect(badgeColors.negative).toHaveProperty('text');
    });

    it('has warning variant', () => {
      expect(badgeColors.warning).toHaveProperty('bg');
    });

    it('has info variant', () => {
      expect(badgeColors.info).toHaveProperty('bg');
    });

    it('has purple variant', () => {
      expect(badgeColors.purple.bg).toContain('rgba(168, 85, 247');
    });

    it('has neutral variant', () => {
      expect(badgeColors.neutral).toHaveProperty('bg');
    });

    it('has gold variant', () => {
      expect(badgeColors.gold).toHaveProperty('bg');
      expect(badgeColors.gold.text).toBe('#B8860B');
    });
  });

  describe('statusColors', () => {
    it('maps active to green', () => {
      expect(statusColors.active).toBe(colors.green);
    });

    it('maps error to red', () => {
      expect(statusColors.error).toBe(colors.red);
    });

    it('maps pending to amber', () => {
      expect(statusColors.pending).toBe(colors.amber);
    });

    it('maps completed to green', () => {
      expect(statusColors.completed).toBe(colors.green);
    });

    it('maps bounced to red', () => {
      expect(statusColors.bounced).toBe(colors.red);
    });

    it('maps replied to gold', () => {
      expect(statusColors.replied).toBe(colors.gold);
    });

    it('maps clicked to cyan', () => {
      expect(statusColors.clicked).toBe(colors.cyan);
    });

    it('maps enriched to indigo', () => {
      expect(statusColors.enriched).toBe(colors.indigo);
    });

    it('maps stale to amber', () => {
      expect(statusColors.stale).toBe(colors.amber);
    });

    it('maps old to red', () => {
      expect(statusColors.old).toBe(colors.red);
    });
  });

  describe('animations', () => {
    it('fadeIn has initial, animate, and transition', () => {
      expect(animations.fadeIn.initial).toHaveProperty('opacity', 0);
      expect(animations.fadeIn.animate).toHaveProperty('opacity', 1);
      expect(animations.fadeIn.transition).toHaveProperty('duration', 0.5);
    });

    it('fadeInScale starts with scale 0.95', () => {
      expect(animations.fadeInScale.initial.scale).toBe(0.95);
      expect(animations.fadeInScale.animate.scale).toBe(1);
    });

    it('slideIn defaults to left direction', () => {
      const left = animations.slideIn();
      expect(left.initial.x).toBe(-20);
    });

    it('slideIn supports right direction', () => {
      const right = animations.slideIn('right');
      expect(right.initial.x).toBe(20);
    });

    it('stagger calculates delay based on index', () => {
      const s0 = animations.stagger(0, 100);
      const s1 = animations.stagger(1, 100);
      expect(s0.transition.delay).toBe(100);
      expect(s1.transition.delay).toBe(100 + 0.04);
    });

    it('barGrow has initial width 0', () => {
      const bar = animations.barGrow(0);
      expect(bar.initial.width).toBe(0);
    });

    it('hoverLift has whileHover and whileTap', () => {
      expect(animations.hoverLift.whileHover.scale).toBe(1.02);
      expect(animations.hoverLift.whileTap.scale).toBe(0.98);
    });
  });

  describe('goldButton', () => {
    it('has gold gradient background', () => {
      expect(goldButton.background).toContain('linear-gradient');
      expect(goldButton.background).toContain('#d4af37');
    });

    it('has dark text color', () => {
      expect(goldButton.color).toBe('#000000');
    });
  });

  describe('chartGradients', () => {
    it('has gold gradient with id', () => {
      expect(chartGradients.gold.id).toBe('gradGold');
      expect(chartGradients.gold.from).toContain('212,175,55');
    });

    it('has green, blue, purple, dark gradients', () => {
      expect(chartGradients.green).toBeDefined();
      expect(chartGradients.blue).toBeDefined();
      expect(chartGradients.purple).toBeDefined();
      expect(chartGradients.dark).toBeDefined();
    });

    it('each gradient has id, from, and to', () => {
      for (const [name, grad] of Object.entries(chartGradients)) {
        expect(grad).toHaveProperty('id');
        expect(grad).toHaveProperty('from');
        expect(grad).toHaveProperty('to');
      }
    });
  });

  describe('spacing', () => {
    it('has screenPadding', () => {
      expect(typeof spacing.screenPadding).toBe('string');
    });

    it('has sectionGap', () => {
      expect(typeof spacing.sectionGap).toBe('string');
    });

    it('has cardPadding, compactPadding, tightPadding', () => {
      expect(typeof spacing.cardPadding).toBe('string');
      expect(typeof spacing.compactPadding).toBe('string');
      expect(typeof spacing.tightPadding).toBe('string');
    });
  });

  describe('cls', () => {
    it('has scrollContainer class', () => {
      expect(cls.scrollContainer).toContain('overflow-y-auto');
    });

    it('has kpiGrid class with grid', () => {
      expect(cls.kpiGrid).toContain('grid');
    });

    it('iconBox returns a string', () => {
      expect(typeof cls.iconBox('#ff0')).toBe('string');
      expect(cls.iconBox('#ff0')).toContain('rounded-lg');
    });

    it('iconBoxSM returns a string', () => {
      expect(typeof cls.iconBoxSM('#ff0')).toBe('string');
    });

    it('iconBoxXS returns a string', () => {
      expect(typeof cls.iconBoxXS('#ff0')).toBe('string');
    });

    it('iconBoxBg appends 18 to color', () => {
      expect(cls.iconBoxBg('#abc')).toBe('#abc18');
    });

    it('emptyIcon defaults to gold color', () => {
      expect(typeof cls.emptyIcon()).toBe('string');
      expect(cls.emptyIcon()).toContain('rounded-2xl');
    });

    it('emptyIconBg returns background style string', () => {
      expect(typeof cls.emptyIconBg()).toBe('string');
      expect(cls.emptyIconBg()).toContain('background:');
    });

    it('searchInput has sizing classes', () => {
      expect(cls.searchInput).toContain('h-8');
      expect(cls.searchInput).toContain('rounded-lg');
    });

    it('sectionTitle has font styling', () => {
      expect(cls.sectionTitle).toContain('font-bold');
    });
  });
});
