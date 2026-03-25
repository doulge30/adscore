import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'edge'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const placement = formData.get('placement') as string || 'Feed 1:1'
  const industry = formData.get('industry') as string || 'N/A'
  const audience = formData.get('audience') as string || 'N/A'
  const goal = formData.get('goal') as string || 'sales'
  const offer = formData.get('offer') as string || 'N/A'

  if (!file) return new Response('No file', { status: 400 })

  // Convert file to base64
  const bytes = await file.arrayBuffer()
  const b64 = Buffer.from(bytes).toString('base64')
  const mime = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const isReels = placement.includes('9:16')
  const szNote = isReels
    ? 'Safe zone: top 14%, bottom 35%, sides 6% must be free (Meta spec).'
    : 'Safe zone: keep 5% on all edges free from text/logos.'

  const system = `You are an elite Meta Ads creative analyst with $500M+ ad spend experience.
${szNote}

Output ONLY valid JSON in EXACTLY this format, no markdown:
{
  "criteria": [
    {"name":"Call to Action","score":<1-10>,"status":"<strong|ok|weak>","feedback":"<1 sentence>"},
    {"name":"Hook Strength","score":<1-10>,"status":"<strong|ok|weak>","feedback":"<1 sentence>"},
    {"name":"Offer Clarity","score":<1-10>,"status":"<strong|ok|weak>","feedback":"<1 sentence>"},
    {"name":"Copy & Wording","score":<1-10>,"status":"<strong|ok|weak>","feedback":"<1 sentence>"},
    {"name":"Visual Quality","score":<1-10>,"status":"<strong|ok|weak>","feedback":"<1 sentence>"},
    {"name":"Scroll-Stop Power","score":<1-10>,"status":"<strong|ok|weak>","feedback":"<1 sentence>"}
  ],
  "overall_score": <1-10>,
  "overall_title": "<4 words max>",
  "overall_summary": "<2 sentences>",
  "verdict": "<2 sentences>"
}`

  const userText = `Placement:${placement} Industry:${industry} Audience:${audience} Goal:${goal} Offer:${offer}`

  // Create a TransformStream to stream the response
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Start Anthropic streaming in background
  ;(async () => {
    try {
      const anthropicStream = await client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            { type: 'text', text: userText }
          ]
        }]
      })

      for await (const chunk of anthropicStream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          // Stream each text chunk as SSE
          const data = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
          await writer.write(encoder.encode(data))
        }
      }

      await writer.write(encoder.encode('data: [DONE]\n\n'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
