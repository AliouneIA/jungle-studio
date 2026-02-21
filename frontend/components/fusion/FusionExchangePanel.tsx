'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Brain, AlertCircle, ArrowRight } from 'lucide-react'
import type { Exchange, FusionPhases, RawResponse } from '@/hooks/useFusionEngine'

interface FusionExchangePanelProps {
  phases: FusionPhases | null
  exchanges: Exchange[]
  isLoading?: boolean
  rawResponses?: RawResponse[]
  status?: string
}

// Model positions for triangle layout with real logos
const MODEL_POSITIONS = {
  'claude': { x: 50, y: 21, color: '#E07B54', name: 'Claude', logo: '/claude 2.jpg' },     // Top
  'gemini': { x: 15, y: 82, color: '#4285F4', name: 'Gemini', logo: '/gemini.png' },      // Bottom left
  'gpt': { x: 85, y: 82, color: '#000000', name: 'GPT', logo: '/gpt 1.png' },            // Bottom right
}

function getModelKey(slug: string): keyof typeof MODEL_POSITIONS {
  if (slug.toLowerCase().includes('claude')) return 'claude'
  if (slug.toLowerCase().includes('gemini')) return 'gemini'
  return 'gpt'
}

export default function FusionExchangePanel({ phases, exchanges, isLoading, rawResponses = [], status }: FusionExchangePanelProps) {
  const hasData = phases && (phases.initial.length > 0 || phases.crossAnalysis.length > 0)

  return (
    <div className="w-full min-h-full flex flex-col items-center py-8 px-6">
      {/* Triangle Diagram — reste centré en haut */}
      <div className="relative w-full max-w-sm aspect-square mb-8">
        {/* SVG for arrows with real markers */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="5"
              markerHeight="3"
              refX="4"
              refY="1.5"
              orient="auto"
            >
              <polygon points="0 0, 5 1.5, 0 3" fill="#5C4B40" fillOpacity="0.5" />
            </marker>
          </defs>

          {/* Bidirectional arrows - Mathematically Offset for Perfect Symmetry */}
          {/* Gemini (15,82) <-> Claude (50,21) | Gap: 16 | Len: 38 */}
          {/* Forward */}
          <motion.line
            x1="24" y1="67" x2="43" y2="34"
            stroke="#5C4B40" strokeWidth="0.4" strokeOpacity="0.3"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          />
          {/* Backward */}
          <motion.line
            x1="41" y1="33" x2="22" y2="66"
            stroke="#5C4B40" strokeWidth="0.4" strokeOpacity="0.3"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          />

          {/* Claude (50,21) <-> GPT (85,82) | Gap: 16 | Len: 38 */}
          {/* Forward */}
          <motion.line
            x1="57" y1="34" x2="76" y2="67"
            stroke="#5C4B40" strokeWidth="0.4" strokeOpacity="0.3"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
          />
          {/* Backward */}
          <motion.line
            x1="78" y1="66" x2="59" y2="33"
            stroke="#5C4B40" strokeWidth="0.4" strokeOpacity="0.3"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
          />

          {/* Gemini (15,82) <-> GPT (85,82) | Gap: 16 | Len: 38 */}
          {/* Bottom */}
          <motion.line
            x1="31" y1="80.5" x2="69" y2="80.5"
            stroke="#5C4B40" strokeWidth="0.4" strokeOpacity="0.3"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 1 }}
          />
          {/* Top */}
          <motion.line
            x1="69" y1="83.5" x2="31" y2="83.5"
            stroke="#5C4B40" strokeWidth="0.4" strokeOpacity="0.3"
            markerEnd="url(#arrowhead)"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
          />

          {/* Animated data flow indicators */}
          {isLoading && (
            <>
              <motion.circle
                cx="50" cy="50" r="0.8" fill="#5C4B40" fillOpacity="0.4"
                animate={{ cx: [25, 45, 75, 25], cy: [70, 30, 70, 70] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </>
          )}
        </svg>

        {/* Model Nodes */}
        {Object.entries(MODEL_POSITIONS).map(([key, pos]) => {
          const modelResponse = rawResponses.find(r => getModelKey(r.slug) === key);
          const hasFailed = modelResponse?.status === 'failed';

          return (
            <motion.div
              key={key}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <div className="relative">
                <motion.div
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 bg-white ${hasFailed ? 'border-red-500 bg-red-50' : ''}`}
                  style={{ borderColor: !hasFailed ? pos.color : undefined }}
                  animate={isLoading && !hasFailed ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Image
                    src={pos.logo}
                    alt={pos.name}
                    width={40}
                    height={40}
                    style={{ height: 'auto' }}
                    className={`object-contain ${hasFailed ? 'opacity-40 grayscale' : ''}`}
                  />
                </motion.div>

                {hasFailed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white"
                  >
                    <AlertCircle size={14} />
                  </motion.div>
                )}
              </div>
              <span className={`mt-2 text-xs font-bold ${hasFailed ? 'text-red-500' : 'text-foreground/80'}`}>
                {pos.name} {hasFailed ? '(Échec)' : ''}
              </span>
            </motion.div>
          );
        })}

        {/* Center - Master indicator */}
        {phases?.synthesis?.masterSlug && (
          <motion.div
            className="absolute left-1/2 top-[62%] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-30"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.8, type: 'spring', damping: 12 }}
          >
            <div className="relative group">
              {/* Orb background effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#EAE1D3] to-[#c1b2a2] rounded-full blur-md opacity-30 group-hover:opacity-60 transition-opacity" />

              <div className="relative w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.8)] border-2 border-[#5C4B40]/10 overflow-hidden">
                {(() => {
                  const slug = phases.synthesis?.masterSlug || '';
                  const masterSlug = slug.toLowerCase();
                  let logo = '/fusion.png'; // Fallback
                  if (masterSlug.includes('claude')) logo = '/claude 2.jpg';
                  else if (masterSlug.includes('gemini')) logo = '/gemini.png';
                  else if (masterSlug.includes('gpt') || masterSlug.includes('o3')) logo = '/gpt 1.png';
                  else if (masterSlug.includes('grok')) logo = '/logos/Grok-Logo-PNG.png';

                  return (
                    <Image
                      src={logo}
                      alt="Master"
                      width={40}
                      height={40}
                      style={{ height: 'auto' }}
                      className={`relative z-10 object-contain ${logo === '/fusion.png' ? 'contrast-[10] grayscale invert scale-75' : ''}`}
                    />
                  );
                })()}

                {/* White shimmer glow effect - Pulses for a magical look */}
                <motion.div
                  className="absolute inset-0 bg-white/40 rounded-full"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.2, 0.6, 0.2]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>

              {/* Shimmering Aura around the orb */}
              <motion.div
                className="absolute inset-[-10px] bg-white rounded-full blur-xl z-[-1]"
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                  scale: [0.9, 1.1, 0.9]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Glowing label */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-[10px] font-black tracking-[0.2em] text-[#5C4B40] uppercase bg-[#EAE1D3]/80 px-2 py-0.5 rounded-full border border-[#5C4B40]/10">
                  MASTER IA
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Layout 2 colonnes : Phases à gauche | Logs à droite */}
      <div className="w-full max-w-4xl flex gap-8">

        {/* COLONNE GAUCHE — Phases (compact) */}
        <div className="w-64 flex-shrink-0 space-y-4 phase-connector">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-4">Progression</h4>

          {/* Phase 1 */}
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 ${phases?.initial?.length ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              {phases?.initial?.length ? '✓' : '1'}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Analyse Initiale</p>
              <p className="text-[10px] text-foreground/40">{phases?.initial?.length || 0} réponses</p>
            </div>
          </div>

          {/* Phase 2 */}
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 ${phases?.crossAnalysis?.length ? 'bg-green-100 text-green-600' : (status === 'cross-analysis' || isLoading) ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
              {phases?.crossAnalysis?.length ? '✓' : (status === 'cross-analysis' || isLoading) ? '🔥' : '2'}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Cross-Analyse</p>
              <p className="text-[10px] text-foreground/40">
                {phases?.crossAnalysis?.length
                  ? `${exchanges?.length || phases.crossAnalysis.length * 2} échanges`
                  : (status === 'cross-analysis' || isLoading) ? 'En cours...' : 'Non applicable'
                }
              </p>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 ${phases?.refinement?.length
              ? 'bg-green-100 text-green-600'
              : status === 'refining'
                ? 'bg-amber-100 text-amber-600 animate-pulse'
                : 'bg-gray-100 text-gray-400'
              }`}>
              {phases?.refinement?.length ? '✓' : status === 'refining' ? '⟳' : '3'}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Affinement</p>
              <p className="text-[10px] text-foreground/40">
                {phases?.refinement?.length
                  ? `${phases.refinement.length} réponses affinées`
                  : status === 'refining' ? 'Optimisation en cours...' : 'Non applicable'
                }
              </p>
            </div>
          </div>

          {/* Phase 4 */}
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 ${phases?.synthesis ? 'bg-green-100 text-green-600' : status === 'synthesizing' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
              {phases?.synthesis ? '✓' : status === 'synthesizing' ? '⚡' : '4'}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Fact-Check & Synthèse</p>
              <p className="text-[10px] text-foreground/40">
                {phases?.synthesis ? `Par ${phases.synthesis.masterSlug || 'Master'}` : 'En attente'}
              </p>
            </div>
          </div>

          <style>{`
            .phase-connector { position: relative; }
            .phase-connector::before {
              content: '';
              position: absolute;
              left: 13px;
              top: 40px;
              bottom: 20px;
              width: 1px;
              background: rgba(92, 75, 64, 0.1);
              z-index: 0;
            }
          `}</style>
        </div>

        {/* COLONNE DROITE — Logs détaillés */}
        <div className="flex-1 space-y-8 overflow-y-auto max-h-[600px] no-scrollbar pr-2">

          {/* Log Cross-Analyses */}
          {exchanges && exchanges.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Cross-Analyses</h4>
                <div className="h-px flex-1 bg-foreground/5"></div>
              </div>
              <div className="space-y-3">
                {Object.entries(
                  exchanges.reduce((acc, ex) => {
                    if (!ex || !ex.from) return acc
                    const sender = ex.from
                    if (!acc[sender]) acc[sender] = []
                    acc[sender].push(ex)
                    return acc
                  }, {} as Record<string, Exchange[]>)
                ).map(([senderKey, senderExchanges]) => {
                  const senderPos = MODEL_POSITIONS[getModelKey(senderKey)]
                  return (
                    <div key={senderKey} className="flex items-center gap-3 bg-white/30 backdrop-blur-sm p-3 rounded-xl border border-white/50 shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-white border border-secondary/20 flex items-center justify-center p-1 shadow-sm flex-shrink-0">
                        <Image
                          src={senderPos?.logo || '/fusion.png'}
                          alt="sender"
                          width={24}
                          height={24}
                          style={{ height: 'auto' }}
                          className="object-contain"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-foreground/50 uppercase w-14 flex-shrink-0">{senderPos?.name}</span>
                      <span className="text-foreground/20 italic text-[10px]">→</span>
                      <div className="flex gap-2 flex-wrap flex-1">
                        {senderExchanges.map((ex, i) => {
                          if (!ex || !ex.to) return null
                          const targetPos = MODEL_POSITIONS[getModelKey(ex.to)]
                          return (
                            <div key={i} className="flex items-center gap-1.5 bg-white/60 px-2.5 py-1 rounded-full border border-white/80 shadow-xs">
                              <Image
                                src={targetPos?.logo || '/fusion.png'}
                                alt="target"
                                width={14}
                                height={14}
                                style={{ height: 'auto' }}
                                className="object-contain"
                              />
                              <span className="text-[10px] font-medium text-foreground/60">{targetPos?.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Log Réponses Affinées */}
          {phases?.refinement && phases.refinement.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Réponses affinées</h4>
                <div className="h-px flex-1 bg-foreground/5"></div>
              </div>
              <div className="space-y-3">
                {phases.refinement.map((ref, i) => {
                  const pos = MODEL_POSITIONS[getModelKey(ref.slug)]
                  return (
                    <div key={i} className="flex items-start gap-3 bg-gradient-to-r from-amber-50/40 to-white/20 p-3 rounded-xl border border-amber-200/20 shadow-sm transition-all hover:border-amber-200/40">
                      <div className="w-8 h-8 rounded-full bg-white border-2 border-amber-300/40 flex items-center justify-center p-1.5 flex-shrink-0 shadow-sm">
                        <Image
                          src={pos?.logo || '/fusion.png'}
                          alt={ref.slug}
                          width={24}
                          height={24}
                          style={{ height: 'auto' }}
                          className="object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tighter">{pos?.name}</span>
                          {ref.tokens && <span className="text-[9px] font-medium text-foreground/25">{ref.tokens} tok</span>}
                        </div>
                        <p className="text-[11px] text-[#5C4B40]/70 leading-relaxed italic line-clamp-2">"{ref.content}"</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fact-Check Report */}
          {phases?.synthesis?.fact_check_report && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Rapport de vérification Master</h4>
                <div className="h-px flex-1 bg-foreground/5"></div>
              </div>
              <div className="bg-gradient-to-br from-blue-50/50 via-white/40 to-blue-50/20 p-5 rounded-3xl border border-blue-200/30 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-center group">
                    <div className="text-2xl font-black text-blue-600 transition-transform group-hover:scale-110">{phases.synthesis.fact_check_report.verified_claims || 0}</div>
                    <div className="text-[9px] font-black text-[#5C4B40]/40 uppercase tracking-widest">Points Clés</div>
                  </div>
                  <div className="w-px h-10 bg-[#5C4B40]/10" />
                  <div className="text-center group">
                    <div className="text-2xl font-black text-green-600 transition-transform group-hover:scale-110">{phases.synthesis.fact_check_report.consensus_percentage || 0}%</div>
                    <div className="text-[9px] font-black text-[#5C4B40]/40 uppercase tracking-widest">Consensus</div>
                  </div>
                  <div className="w-px h-10 bg-[#5C4B40]/10" />
                  <div className="text-center group">
                    <div className="text-2xl font-black text-orange-500 transition-transform group-hover:scale-110">{phases.synthesis.fact_check_report.contradictions_found || 0}</div>
                    <div className="text-[9px] font-black text-[#5C4B40]/40 uppercase tracking-widest">Divergences</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
