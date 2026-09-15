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
      // If candidate is incomplete, proceed to repair
    }
  }

  // 3. Try standard parse first (for 100% valid JSON)
  try {
    return JSON.parse(text);
  } catch (_) {
    // Attempt auto-repair on truncated or malformed JSON
  }

  // 4. Auto-repair truncated JSON
  try {
    let inString = false;
    let escape = false;
    const stack: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
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

    let repaired = text;
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
    if (fallback !== undefined) return fallback;
    throw new Error(`Failed to parse AI JSON response: ${err}`);
  }
}
