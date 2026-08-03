/**
 * @file aiService.js
 * @description AI service for parsing emergency text and explaining matches. Integrates with OpenRouter with deterministic fallbacks.
 *
 * Per HLD section 3.5: AI is advisory, never authoritative, over the core matching decision.
 * Both public functions try OpenRouter first; any failure (network error, timeout,
 * invalid JSON, missing API key) activates the deterministic fallback so the app
 * keeps working without the AI layer.
 *
 * Implements exact API contract per LLD section 7.
 */

const BLOOD_GROUPS     = ['AB+', 'AB-', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-'];
const URGENCY_VALUES   = ['critical', 'high', 'moderate'];
const PARSE_TIMEOUT_MS = 8_000;  // 8 s — don't hold up the matching pipeline longer
const EXPLAIN_TIMEOUT_MS = 10_000;

// OpenRouter HTTP helper

/**
 * Single fetch-based OpenRouter wrapper per LLD section 7.
 *
 * @param {Array<Object>} messages - The chat context messages for the AI model.
 * @param {boolean} useJsonMode - Whether to enforce a JSON object response format.
 * @param {number} timeoutMs - Timeout for the AI request in milliseconds.
 * @returns {Promise<string|null>} The raw content string from the model, or null.
 * @throws {Error} On network issues, HTTP errors, or missing API key.
 */
async function _openrouterRequest(messages, useJsonMode, timeoutMs) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      model:    process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages,
      ...(useJsonMode && { response_format: { type: 'json_object' } }),
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lifeline-app.vercel.app', // required by OpenRouter
        'X-Title':      'LifeLine',
      },
      body:   JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 120)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// Deterministic fallback
// Blood groups ordered longest-first so AB+ matches before B+, etc.

/**
 * Parses emergency text using a deterministic fallback approach when AI is unavailable.
 *
 * @param {string} rawText - The unformatted emergency text.
 * @returns {Object} Contains parsed bloodGroup (string|null) and urgency (string).
 */
function parseEmergencyTextFallback(rawText) {
  const upper = rawText.toUpperCase();

  const bloodGroup = BLOOD_GROUPS.find((g) => upper.includes(g)) ?? null;

  let urgency = 'moderate';
  if (/CRITICAL|ICU|LIFE[- ]THREAT|IMMEDIATE|CRASH|EMERGENCY/.test(upper)) {
    urgency = 'critical';
  } else if (/URGENT|SOON|HOSPITAL|SURGERY|OPERATION|IMPORTANT/.test(upper)) {
    urgency = 'high';
  }

  return { bloodGroup, urgency };
}

// Public: parseEmergencyText

/**
 * Parses a free-text emergency description into structured data.
 * Tries OpenRouter first, falls back to deterministic extraction on failure.
 *
 * @param {string} rawText - The unformatted emergency text provided by the user.
 * @returns {Promise<{ bloodGroup: string, urgency: string, source: string }>} The parsed data and source.
 */
async function parseEmergencyText(rawText) {
  try {
    const content = await _openrouterRequest(
      [
        {
          role: 'system',
          // "json" must appear in the prompt when using response_format:json_object
          content:
            'Extract bloodGroup (exactly one of: O+, O-, A+, A-, B+, B-, AB+, AB-) and urgency (critical|high|moderate) as strict JSON with exactly these two keys. No prose, no explanation.',
        },
        { role: 'user', content: rawText },
      ],
      true, // useJsonMode
      PARSE_TIMEOUT_MS
    );

    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);

    // Validate — AI output must be well-formed or we fall back
    if (
      !BLOOD_GROUPS.includes(parsed.bloodGroup) ||
      !URGENCY_VALUES.includes(parsed.urgency)
    ) {
      throw new Error('AI returned invalid bloodGroup or urgency');
    }

    return { bloodGroup: parsed.bloodGroup, urgency: parsed.urgency, source: 'ai' };
  } catch (err) {
    // Log but never let AI failure crash the request pipeline
    // eslint-disable-next-line no-console
    console.warn('[ai] parseEmergencyText fell back to deterministic:', err.message);
    return { ...parseEmergencyTextFallback(rawText), source: 'fallback' };
  }
}

// Public: explainMatch

/**
 * Generates a one-line human-readable explanation for a ranked donor match.
 * Advisory only; the UI will still show the match if this fails.
 *
 * @param {Object} match - The donor match object containing distance, score, and group.
 * @param {string} recipientBloodGroup - The requested blood group.
 * @returns {Promise<string>} A concise explanation sentence.
 */
async function explainMatch(match, recipientBloodGroup) {
  const km = (match.distanceMetres / 1000).toFixed(1);

  try {
    const content = await _openrouterRequest(
      [
        {
          role: 'system',
          content:
            'You are assisting in a medical emergency blood donor search. Write exactly ONE concise sentence (under 25 words) explaining why this donor is a strong match. Be specific and reassuring. No markdown, no quotes.',
        },
        {
          role: 'user',
          content: `Donor blood group: ${match.bloodGroup}. Distance: ${km} km. Reliability score: ${match.reliabilityScore}/100. Recipient needs: ${recipientBloodGroup}.`,
        },
      ],
      false, // plain text response
      EXPLAIN_TIMEOUT_MS
    );

    if (content?.trim()) return content.trim();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ai] explainMatch fell back to deterministic:', err.message);
  }

  // Deterministic fallback — always returns something useful
  return `${match.bloodGroup} donor ${km} km away — compatible with ${recipientBloodGroup}, reliability score ${match.reliabilityScore}/100.`;
}

module.exports = { parseEmergencyText, explainMatch, parseEmergencyTextFallback };
