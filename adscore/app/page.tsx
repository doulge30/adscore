'use client'

import { useState, useRef, useCallback } from 'react'
import styles from './page.module.css'

// ── Types ──────────────────────────────────────────────
interface Criterion {
  name: string
  score: number
  status: 'strong' | 'ok' | 'weak'
  feedback: string
}

interface AnalysisResult {
  criteria: Criterion[]
  overall_score: number
  overall_title: string
  overall_summary: string
  verdict: string
}

// ── Safe zones ─────────────────────────────────────────
const SAFE_ZONES: Record<string, { top: number; bottom: number; left: number; right: number }> = {
  feed_1_1: { top: .05, bottom: .05, left: .05, right: .05 },
  feed_4_5: { top: .05, bottom: .05, left: .05, right: .05 },
  reels:    { top: .14, bottom: .35, left: .06, right: .06 },
  stories:  { top: .14, bottom: .20, left: .06, right: .06 },
}

const PLACEMENT_LABELS: Record<string, string> = {
  feed_1_1: 'Feed 1:1',
  feed_4_5: 'Feed 4:5',
  reels: 'Reels 9:16',
  stories: 'Stories 9:16',
}

// ── Overlay presets per criterion ──────────────────────
const CRITERION_OVERLAYS: Record<string, Array<{ text: string; type: string; pos: string; style: string }>> = {
  'Call to Action':   [{ text:'Shop Now', type:'cta_button', pos:'bottom_center', style:'dark' },{ text:'Get Yours Today', type:'cta_button', pos:'bottom_center', style:'gold' },{ text:'Claim Your Discount', type:'cta_button', pos:'bottom_center', style:'red' },{ text:'Buy Now — Limited Stock', type:'cta_button', pos:'bottom_center', style:'dark' },{ text:'Try It Free', type:'cta_button', pos:'bottom_center', style:'light' }],
  'Hook Strength':    [{ text:'Stop Scrolling', type:'text_banner', pos:'top_center', style:'dark' },{ text:'You need to see this', type:'text_banner', pos:'top_center', style:'gold' },{ text:'This changes everything', type:'text_banner', pos:'top_center', style:'dark' },{ text:'Warning: Sells out fast', type:'urgency_bar', pos:'top_center', style:'red' },{ text:'Finally, a solution', type:'text_banner', pos:'top_center', style:'light' }],
  'Offer Clarity':    [{ text:'50% Off Today Only', type:'discount_badge', pos:'top_right', style:'red' },{ text:'Free Shipping Included', type:'badge', pos:'top_left', style:'dark' },{ text:'Best Value Pack', type:'badge', pos:'top_right', style:'gold' },{ text:'Save €30 This Week', type:'discount_badge', pos:'top_right', style:'red' },{ text:'Bundle Deal Inside', type:'badge', pos:'top_left', style:'gold' }],
  'Copy & Wording':   [{ text:'Proven Results', type:'text_banner', pos:'bottom_center', style:'dark' },{ text:'Trusted by 10k+ Buyers', type:'text_banner', pos:'bottom_center', style:'light' },{ text:'Join 50k+ Happy Customers', type:'urgency_bar', pos:'bottom_center', style:'dark' },{ text:'Real Results Guaranteed', type:'text_banner', pos:'bottom_center', style:'gold' },{ text:'★★★★★ Rated', type:'badge', pos:'top_right', style:'gold' }],
  'Visual Quality':   [{ text:'As Seen On TV', type:'badge', pos:'top_left', style:'dark' },{ text:'Award Winning', type:'badge', pos:'top_right', style:'gold' },{ text:"Editor's Choice", type:'badge', pos:'top_left', style:'gold' },{ text:'#1 Best Seller', type:'badge', pos:'top_right', style:'dark' },{ text:'Customer Favourite', type:'badge', pos:'top_left', style:'light' }],
  'Scroll-Stop Power':[{ text:'Wait — Read This', type:'text_banner', pos:'top_center', style:'red' },{ text:'Limited Time Offer', type:'urgency_bar', pos:'top_center', style:'red' },{ text:'Only 3 Left in Stock', type:'urgency_bar', pos:'bottom_center', style:'red' },{ text:'Ends Tonight', type:'text_banner', pos:'top_center', style:'dark' },{ text:'Selling Out Fast', type:'urgency_bar', pos:'bottom_center', style:'dark' }],
}

const VARIATION_LABELS = ['Standard', 'Alternative wording', 'High urgency', 'Premium / trust', 'Minimal & clean']

// ── Canvas helper ──────────────────────────────────────
function drawOverlayOnCanvas(
  ctx: CanvasRenderingContext2D,
  overlay: { text: string; type: string; pos: string; style: string },
  cw: number, ch: number,
  sl: number, st: number, sw: number, sh: number
) {
  const fs = Math.max(12, Math.round(cw * 0.034))
  ctx.font = `bold ${fs}px Arial,sans-serif`
  const tw = ctx.measureText(overlay.text).width
  const px = fs * .75, py = fs * .55
  let bw = tw + px * 2, bh = fs + py * 2
  let bg = 'rgba(20,20,18,.88)', fg = '#fff'
  if (overlay.style === 'light') { bg = 'rgba(255,255,255,.93)'; fg = '#1a1917' }
  else if (overlay.style === 'gold') bg = 'rgba(184,151,90,.95)'
  else if (overlay.style === 'red') bg = 'rgba(185,28,28,.92)'
  const gap = 8
  let x = 0, y = 0
  if (overlay.pos.includes('top')) y = st + gap
  else if (overlay.pos.includes('bottom')) y = st + sh - bh - gap
  else y = st + (sh - bh) / 2
  if (overlay.type === 'urgency_bar') {
    ctx.fillStyle = bg; ctx.fillRect(sl, y, sw, bh)
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(overlay.text, sl + sw / 2, y + bh / 2); return
  }
  if (overlay.pos.includes('left')) x = sl + gap
  else if (overlay.pos.includes('right')) x = sl + sw - bw - gap
  else x = sl + (sw - bw) / 2
  x = Math.max(sl, Math.min(x, sl + sw - bw))
  y = Math.max(st, Math.min(y, st + sh - bh))
  if (overlay.type === 'cta_button') {
    const r = bh / 2; ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + bw - r, y)
    ctx.arc(x + bw - r, y + r, r, -Math.PI / 2, Math.PI / 2)
    ctx.lineTo(x + r, y + bh); ctx.arc(x + r, y + r, r, Math.PI / 2, 3 * Math.PI / 2)
    ctx.closePath(); ctx.fillStyle = bg; ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(x + 6, y); ctx.lineTo(x + bw - 6, y); ctx.quadraticCurveTo(x + bw, y, x + bw, y + 6)
    ctx.lineTo(x + bw, y + bh - 6); ctx.quadraticCurveTo(x + bw, y + bh, x + bw - 6, y + bh)
    ctx.lineTo(x + 6, y + bh); ctx.quadraticCurveTo(x, y + bh, x, y + bh - 6)
    ctx.lineTo(x, y + 6); ctx.quadraticCurveTo(x, y, x + 6, y)
    ctx.closePath(); ctx.fillStyle = bg; ctx.fill()
  }
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(overlay.text, x + bw / 2, y + bh / 2)
}

function buildVariations(selected: string[]) {
  return [0, 1, 2, 3, 4].map(i => {
    return selected.slice(0, 3).map(name => {
      const opts = CRITERION_OVERLAYS[name] || []
      const o = opts[i] || opts[0]
      return o ? { text: o.text, type: o.type, pos: o.pos, style: o.style } : null
    }).filter(Boolean) as Array<{ text: string; type: string; pos: string; style: string }>
  })
}

// ── Score color ────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 7 ? '#2d6a4f' : s <= 4 ? '#8b2635' : '#92661a'
}
function scoreBg(s: string) {
  return s === 'strong' ? '#52b788' : s === 'weak' ? '#c1666b' : '#e8c87a'
}

// ── Main Component ─────────────────────────────────────
export default function Home() {
  const [placement, setPlacement] = useState('feed_1_1')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [error, setError] = useState('')
  const [showImages, setShowImages] = useState(false)
  const [showSafeZone, setShowSafeZone] = useState(false)

  const originalImageRef = useRef<HTMLImageElement | null>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ── File handling ──────────────────────────────────
  function handleFile(f: File) {
    if (!f.type.startsWith('image/')) { alert('Please upload an image file.'); return }
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    const img = new Image()
    img.onload = () => { originalImageRef.current = img }
    img.src = url
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  function resetAll() {
    setFile(null); setPreviewUrl(''); setCriteria([]); setResult(null)
    setSelected(new Set()); setPhase('idle'); setProgress(0)
    setError(''); setShowImages(false); setShowSafeZone(false)
    originalImageRef.current = null
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
  }

  // ── Progress ticker ────────────────────────────────
  function startProgressTicker(from: number, to: number, durationMs: number, msg: string) {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    setProgressMsg(msg)
    const steps = durationMs / 200
    const increment = (to - from) / steps
    let current = from
    progressTimerRef.current = setInterval(() => {
      current = Math.min(current + increment, to)
      setProgress(Math.round(current))
      if (current >= to) {
        clearInterval(progressTimerRef.current!)
        progressTimerRef.current = null
      }
    }, 200)
  }

  // ── Analyze ────────────────────────────────────────
  async function runAnalysis() {
    if (!file) { alert('Please upload a creative first.'); return }
    setError(''); setCriteria([]); setResult(null); setSelected(new Set())
    setShowImages(false); setPhase('analyzing')
    setProgress(5); setProgressMsg('Compressing image...')

    const form = new FormData()
    form.append('file', file, file.name)
    form.append('placement', PLACEMENT_LABELS[placement])
    form.append('industry', (document.getElementById('industry') as HTMLInputElement)?.value || 'N/A')
    form.append('audience', (document.getElementById('audience') as HTMLInputElement)?.value || 'N/A')
    form.append('goal', (document.getElementById('goal') as HTMLSelectElement)?.value || 'sales')
    form.append('offer', (document.getElementById('offer') as HTMLTextAreaElement)?.value || 'N/A')

    startProgressTicker(10, 30, 2000, 'Sending to AI...')

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error('API error ' + res.status)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = '', fullText = ''
      let shownCriteria = 0

      startProgressTicker(30, 85, 15000, 'Analyzing your creative...')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') continue
          try {
            const evt = JSON.parse(raw)
            if (evt.error) throw new Error(evt.error)
            if (evt.text) {
              fullText += evt.text
              // Progressive parse
              const criteriaRegex = /\{"name":"([^"]+)","score":(\d+),"status":"([^"]+)","feedback":"([^"]+)"\}/g
              const matches: RegExpExecArray[] = []
              let rm: RegExpExecArray | null
              while ((rm = criteriaRegex.exec(fullText)) !== null) matches.push(rm)
              while (shownCriteria < matches.length) {
                const m = matches[shownCriteria]
                const c: Criterion = { name: m[1], score: parseInt(m[2]), status: m[3] as Criterion['status'], feedback: m[4] }
                setCriteria(prev => [...prev, c])
                setProgressMsg(`Scoring ${m[1]}...`)
                shownCriteria++
              }
            }
          } catch (e: unknown) {
            if (e instanceof Error) throw e
          }
        }
      }

      // Final parse
      try {
        const clean = fullText.replace(/```json|```/g, '').trim()
        const parsed: AnalysisResult = JSON.parse(clean)
        setResult(parsed)
        // Ensure all criteria shown
        setCriteria(parsed.criteria)
      } catch {}

      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      setProgress(100); setProgressMsg('Analysis complete!')
      setTimeout(() => setPhase('done'), 500)

    } catch (e: unknown) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      setProgress(0); setPhase('idle')
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg.includes('overload') ? 'The AI is busy. Please try again.' : 'Something went wrong. Please try again.')
    }
  }

  // ── Toggle criterion selection ─────────────────────
  function toggleCriterion(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  // ── Generate 5 variations ──────────────────────────
  function generateImages() {
    const variations = buildVariations([...selected])
    const sz = SAFE_ZONES[placement]
    setShowImages(true)
    setTimeout(() => {
      variations.forEach((overlays, i) => {
        const canvas = canvasRefs.current[i]
        if (!canvas || !originalImageRef.current) return
        const img = originalImageRef.current
        const MAX = 420, scale = Math.min(1, MAX / img.naturalWidth)
        canvas.width = img.naturalWidth * scale
        canvas.height = img.naturalHeight * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const sl = canvas.width * sz.left, st = canvas.height * sz.top
        const sw = canvas.width * (1 - sz.right) - sl, sh = canvas.height * (1 - sz.bottom) - st
        overlays.forEach(ov => drawOverlayOnCanvas(ctx, ov, canvas.width, canvas.height, sl, st, sw, sh))
        if (showSafeZone) drawSafeZoneViz(ctx, canvas.width, canvas.height, sz)
      })
    }, 100)
  }

  function drawSafeZoneViz(ctx: CanvasRenderingContext2D, cw: number, ch: number, sz: { top: number; bottom: number; left: number; right: number }) {
    const sl = cw * sz.left, st = ch * sz.top, sr = cw * (1 - sz.right), sb = ch * (1 - sz.bottom)
    ctx.fillStyle = 'rgba(0,0,0,.28)'
    ctx.fillRect(0, 0, cw, st); ctx.fillRect(0, sb, cw, ch - sb)
    ctx.fillRect(0, st, sl, sb - st); ctx.fillRect(sr, st, cw - sr, sb - st)
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.setLineDash([6, 4])
    ctx.strokeRect(sl + 1, st + 1, sr - sl - 2, sb - st - 2); ctx.setLineDash([])
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('SAFE ZONE', sl + 8, st + 8)
  }

  function downloadCanvas(i: number) {
    const canvas = canvasRefs.current[i]
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `adscore-variation-${i + 1}.jpg`
    a.href = canvas.toDataURL('image/jpeg', .92)
    a.click()
  }

  // ── Render ─────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>Ad<span>Score</span></div>
        <div className={styles.navTag}>Beta</div>
      </nav>

      <div className={styles.wrap}>
        {/* HERO */}
        <div className={styles.hero}>
          <div className={styles.eyebrow}>Creative Intelligence</div>
          <h1 className={styles.h1}>Know if your ad will<br /><em>perform</em> before you spend</h1>
          <p className={styles.heroSub}>Instant creative scoring. Select what to improve, get 5 ready-to-use variations.</p>
        </div>

        {/* UPLOAD */}
        <div className={styles.sectionLabel}>Creative</div>
        <div className={styles.uploadCard}>
          {!file ? (
            <div
              className={`${styles.uploadZone} ${isDragging ? styles.dragover : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <input id="fileInput" type="file" accept="image/*,video/*" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div className={styles.uploadIcon}>⬆</div>
              <div className={styles.uploadTitle}>Drop your creative here</div>
              <p className={styles.uploadSub}>JPG, PNG, MP4 supported</p>
            </div>
          ) : (
            <div className={styles.previewWrap}>
              <div className={styles.previewMediaBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="preview" className={styles.previewImg} />
              </div>
              <div className={styles.previewActions}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileDot} />
                  <span className={styles.fileName}>{file.name}</span>
                </div>
                <button className={styles.btnGhost} onClick={resetAll}>Change file</button>
              </div>
            </div>
          )}
        </div>

        {/* CONTEXT */}
        <div className={styles.sectionLabel}>Context</div>
        <div className={styles.contextCard}>
          <div className={styles.fieldFull}>
            <label className={styles.label}>Placement</label>
            <div className={styles.placementGroup}>
              {Object.entries(PLACEMENT_LABELS).map(([val, label]) => (
                <button key={val} className={`${styles.pill} ${placement === val ? styles.pillActive : ''}`}
                  onClick={() => setPlacement(val)}>{label}</button>
              ))}
            </div>
          </div>
          <div className={styles.contextGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="industry">Industry</label>
              <input id="industry" className={styles.input} type="text" placeholder="e.g. fashion, supplements" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="audience">Target Audience</label>
              <input id="audience" className={styles.input} type="text" placeholder="e.g. women 25–45" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="goal">Goal</label>
              <select id="goal" className={styles.input}>
                <option value="sales">Drive Sales</option>
                <option value="leads">Generate Leads</option>
                <option value="awareness">Brand Awareness</option>
                <option value="traffic">Website Traffic</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="creativeType">Creative Type</label>
              <select id="creativeType" className={styles.input}>
                <option value="image">Static Image</option>
                <option value="carousel">Carousel</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className={`${styles.field} ${styles.fieldFull2}`}>
              <label className={styles.label} htmlFor="offer">Product & Offer</label>
              <textarea id="offer" className={styles.textarea} placeholder="Describe what you're selling..." />
            </div>
          </div>
        </div>

        {/* ANALYZE BUTTON */}
        {phase === 'idle' && (
          <button className={styles.analyzeBtn} onClick={runAnalysis} disabled={!file}>
            Analyze Creative <span className={styles.btnArrow}>→</span>
          </button>
        )}

        {/* PROGRESS BAR */}
        {(phase === 'analyzing' || (phase === 'done' && progress < 100)) && (
          <div className={styles.progressWrap}>
            <div className={styles.progressCard}>
              <div className={styles.progressTop}>
                <div className={styles.spinnerDark} />
                <span className={styles.progressMsg}>{progressMsg}</span>
                <span className={styles.progressPct}>{progress}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className={styles.errorToast}>
            <span className={styles.errorIcon}>⚠</span>
            <div className={styles.errorBody}>
              <div className={styles.errorTitle}>Analysis failed</div>
              <div className={styles.errorDetail}>{error}</div>
              <div className={styles.errorActions}>
                <button className={styles.errRetry} onClick={() => { setError(''); runAnalysis() }}>Try Again</button>
                <button className={styles.errDismiss} onClick={() => setError('')}>Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* CRITERIA — appear one by one */}
        {criteria.length > 0 && (
          <div className={styles.criteriaList}>
            {criteria.map((c, idx) => (
              <div key={c.name} className={`${styles.criterionCard} slide-in`}
                style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={styles.criterionTop} onClick={() => toggleCriterion(c.name)}>
                  <div className={`${styles.criterionCheck} ${selected.has(c.name) ? styles.checked : ''}`}>
                    {selected.has(c.name) && '✓'}
                  </div>
                  <div className={styles.criterionInfo}>
                    <div className={styles.criterionName}>{c.name}</div>
                    <div className={styles.criterionFeedback}>{c.feedback}</div>
                  </div>
                  <div className={styles.criterionRight}>
                    <div className={styles.criterionScore} style={{ color: scoreColor(c.score) }}>
                      {c.score}<span className={styles.scoreSmall}>/10</span>
                    </div>
                    <span className={`${styles.badge} ${styles['badge_' + c.status]}`}>{c.status}</span>
                  </div>
                </div>
                <div className={styles.criterionBar}>
                  <div className={styles.criterionBarFill}
                    style={{ width: `${c.score * 10}%`, background: scoreBg(c.status) }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AVERAGE SCORE */}
        {result && (
          <div className={`${styles.avgCard} slide-in`}>
            <div className={styles.avgNum} style={{ color: scoreColor(result.overall_score) }}>
              {result.overall_score}
            </div>
            <div className={styles.avgDivider} />
            <div className={styles.avgMeta}>
              <h2 className={styles.avgTitle}>{result.overall_title}</h2>
              <p className={styles.avgSummary}>{result.overall_summary}</p>
            </div>
          </div>
        )}

        {/* VERDICT */}
        {result?.verdict && (
          <div className={`${styles.verdictCard} slide-in`}>
            <div className={styles.verdictLabel}>Expert Assessment</div>
            <p className={styles.verdictText}>{result.verdict}</p>
          </div>
        )}

        {/* GENERATE BAR */}
        {selected.size > 0 && (
          <div className={`${styles.generateBar} slide-in`}>
            <div className={styles.generateBarLeft}>
              <span className={styles.selCount}><strong>{selected.size}</strong> criteria selected</span>
              <button className={styles.selAllBtn}
                onClick={() => setSelected(new Set(Object.keys(CRITERION_OVERLAYS)))}>
                Select all
              </button>
            </div>
            <button className={styles.generateBtn} onClick={generateImages}>
              Generate 5 Variations →
            </button>
          </div>
        )}

        {/* 5 IMAGE GRID */}
        {showImages && (
          <div className={`${styles.imagesSection} slide-in`}>
            <div className={styles.sectionLabel}>Your 5 Creative Variations</div>
            <div className={styles.imagesHeader}>
              <button className={styles.btnGhost} onClick={() => {
                setShowSafeZone(s => !s)
                setTimeout(() => generateImages(), 50)
              }}>
                {showSafeZone ? 'Hide' : 'Show'} Safe Zone
              </button>
            </div>
            <div className={styles.imagesGrid}>
              {VARIATION_LABELS.map((label, i) => (
                <div key={i} className={`${styles.imageCard} slide-in`}
                  style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className={styles.imageCardHeader}>
                    <span className={styles.imageCardTitle}>Variation {i + 1} — {label}</span>
                    <button className={styles.dlBtn} onClick={() => downloadCanvas(i)}>↓ Save</button>
                  </div>
                  <canvas ref={el => { canvasRefs.current[i] = el }} className={styles.imageCanvas} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESET */}
        {phase === 'done' && (
          <button className={styles.resetBtn} onClick={resetAll}>← Analyze another creative</button>
        )}

        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}
