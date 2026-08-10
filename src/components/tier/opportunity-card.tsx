'use client'

import { motion } from 'framer-motion'
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Target, DollarSign, ArrowRight, Brain, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AccountTierBadge } from './account-tier-badge'
import { cn } from '@/lib/utils'
import { InlineFeedback } from '@/components/feedback/inline-feedback'

interface OpportunityCardProps {
  id: string
  title: string
  description: string
  companyName: string
  tier: string
  score: number
  probability: number // 0-100
  estimatedValue?: string
  nextAction?: string
  contacts?: { name: string; role: string }[]
  source?: string // 'ai' | 'manual' | 'signal'
  isNew?: boolean
  onClick?: () => void
  className?: string
}

export function OpportunityCard({
  id, title, description, companyName, tier, score, probability,
  estimatedValue, nextAction, contacts, source, isNew, onClick, className
}: OpportunityCardProps) {
  const probColor = probability >= 70 ? tokens.domain.action : probability >= 40 ? tokens.domain.reasoning : tokens.domain.risk

  return (
    <motion.div
      className={cn(
        'rounded-xl border border-border bg-card p-4 transition-all duration-200 cursor-default',
        onClick && 'cursor-pointer',
        isNew && 'ring-1 ring-primary/20',
        className
      )}
      whileHover={onClick ? { y: -1, boxShadow: '0 1px 3px 0 rgba(0,0,0,0.12), 0 1px 2px -1px rgba(0,0,0,0.06)', borderColor: tokens.border.hover } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      role="article"
      aria-label={`Opportunity: ${title} at ${companyName}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isNew && (
              <Badge className="text-[10px] h-4 px-1.5 bg-primary/20 text-primary border-0">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                New
              </Badge>
            )}
            {source === 'ai' && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30">
                <Brain className="w-2.5 h-2.5 mr-0.5" />
                AI
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-semibold mt-1 line-clamp-1">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
        </div>
        <AccountTierBadge tier={tier} score={score} size="sm" />
      </div>

      {/* Company name */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-foreground">{companyName}</span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Probability</span>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={probability} className="h-1 flex-1" />
            <span className="text-xs font-semibold tabular-nums" style={{ color: probColor }}>{probability}%</span>
          </div>
        </div>
        {estimatedValue && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Value</span>
            <div className="flex items-center gap-1.5 mt-1">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-semibold">{estimatedValue}</span>
            </div>
          </div>
        )}
      </div>

      {/* Next action */}
      {nextAction && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 mb-3">
          <Target className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground line-clamp-1">{nextAction}</span>
        </div>
      )}

      {/* Contacts */}
      {contacts && contacts.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Users className="w-3 h-3 text-muted-foreground" />
          {contacts.slice(0, 3).map(c => (
            <Badge key={c.name} variant="outline" className="text-[10px] h-4 px-1.5">
              {c.name}
            </Badge>
          ))}
          {contacts.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{contacts.length - 3} more</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <InlineFeedback context={`opportunity-${id}`} itemId={id} itemType="recommendation" />
        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
          View Details <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  )
}