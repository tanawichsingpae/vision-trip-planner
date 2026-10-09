/**
 * jsonRepair.ts
 *
 * Robust JSON extraction and self-healing repair utility.
 * Handles:
 * 1. Markdown code fences (```json ... ```)
 * 2. Conversational prefix/suffix text
 * 3. Truncated JSON input (unterminated strings, unclosed brackets/braces from token limits)
 * 4. Trailing commas before closing brackets
 */

/**
 * Sanitizes broken escape sequences in AI-generated JSON strings:
 * 1. Bad Unicode escapes: \u not followed by 4 valid hex digits (e.g. \u00fussen -> \\u00fussen or \user -> \\user)
 * 2. Unescaped backslashes: \ followed by characters other than " \ / b f n r t u
 */
export function sanitizeJsonEscapes(jsonStr: string): string {
  if (!jsonStr) return "";
  // Fix invalid \u escapes that are NOT followed by 4 hex digits (0-9, a-f, A-F)
  let s = jsonStr.replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");

  // Fix any invalid backslash escapes that are not valid JSON escape sequences (\", \\, \/, \b, \f, \n, \r, \t, \u)
  s = s.replace(/\\([^"\\\/bfnrtu])/g, "\\\\$1");

  return s;
}

export function safeParseJson<T = any>(rawText: string, fallback?: T): T {
  if (!rawText || !rawText.trim()) {
    if (fallback !== undefined) return fallback;
    throw new Error("Empty JSON input");
  }

  let text = rawText.trim();

  // 1. Strip markdown code fences if wrapped in ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 2. Find first { or [
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx !== -1) {
    text = text.slice(startIdx);
  }

  // If there is trailing text after the last matching brace/bracket, trim it
  const lastBrace = text.lastIndexOf("}");
  const lastBracket = text.lastIndexOf("]");
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx !== -1) {
    const candidate = text.slice(0, endIdx + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {
      try {
        return JSON.parse(sanitizeJsonEscapes(candidate));
      } catch (_) {
        // If candidate is incomplete, proceed to repair
      }
    }
  }

  // 3. Try standard parse and sanitized parse
  try {
    return JSON.parse(text);
  } catch (_) {
    try {
      return JSON.parse(sanitizeJsonEscapes(text));
    } catch (_) {
      // Attempt auto-repair on truncated or malformed JSON
    }
  }

  // 4. Auto-repair truncated JSON
  try {
    const sanitizedText = sanitizeJsonEscapes(text);
    let inString = false;
    let escape = false;
    const stack: string[] = [];

    for (let i = 0; i < sanitizedText.length; i++) {
      const ch = sanitizedText[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "{" || ch === "[") {
          stack.push(ch === "{" ? "}" : "]");
        } else if (ch === "}" || ch === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
          }
        }
      }
    }

    let repaired = sanitizedText;
    // Close open string if cut off mid-word
    if (inString) repaired += '"';

    // Remove any trailing commas or dangling colon/key
    repaired = repaired.replace(/,\s*$/, "");
    repaired = repaired.replace(/:\s*$/, ': ""');

    // Close all open brackets in reverse
    while (stack.length > 0) {
      const closing = stack.pop()!;
      repaired = repaired.replace(/,\s*$/, "") + closing;
    }

    return JSON.parse(repaired);
  } catch (err) {
    // 5. Ultimate Regex Extraction Fallback for VPR payload schemas
    try {
      const placeMatch = text.match(/"place"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
      if (placeMatch) {
        const cityMatch = text.match(/"city"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
        const countryMatch = text.match(/"country"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
        const typeMatch = text.match(/"type"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
        const confMatch = text.match(/"confidence"\s*:\s*([0-9.]+)/i);
        const isIdMatch = text.match(/"is_identifiable_place"\s*:\s*(true|false)/i);

        return {
          is_identifiable_place: isIdMatch ? isIdMatch[1].toLowerCase() === "true" : true,
          place: placeMatch[1].replace(/\\u(?![0-9a-fA-F]{4})/g, "u").replace(/\\(.)/g, "$1"),
          city: cityMatch ? cityMatch[1].replace(/\\u(?![0-9a-fA-F]{4})/g, "u").replace(/\\(.)/g, "$1") : "-",
          country: countryMatch ? countryMatch[1].replace(/\\(.)/g, "$1") : "-",
          type: typeMatch ? typeMatch[1] : "landmark",
          confidence: confMatch ? parseFloat(confMatch[1]) : 0.9,
          similar_locations: [],
          ai_reasoning: ["Extracted via resilient regex fallback parser"]
        } as unknown as T;
      }
    } catch (_) {}

    if (fallback !== undefined) return fallback;
    throw new Error(`Failed to parse AI JSON response: ${err}`);
  }
}
