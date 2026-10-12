/**
 * AI Service for Practical 13: AI API Integration
 * Handles generative AI task description requests using Gemini/OpenAI
 * with a resilient local heuristic fallback when external APIs are unreachable or unconfigured.
 */

/**
 * Generate a task description based on title, priority, and category.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.priority="medium"]
 * @param {string} [params.category="general"]
 * @returns {Promise<{ description: string, source: "gemini" | "openai" | "fallback" }>}
 */
export async function generateTaskDescription({ title, priority = "medium", category = "general" }) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  // 1. Try Google Gemini API if configured
  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const prompt = `You are a productivity and task management assistant. 
Generate a clear, professional, actionable description (2-3 concise paragraphs or bullet points) for a task titled "${title}".
Priority: ${priority}. Category: ${category}.
Include:
- Objective/Scope
- Key Action Items
- Definition of Done
Keep it direct and concise without pleasantries or preamble.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300,
            },
          }),
        }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return {
            description: text.trim(),
            source: "gemini",
          };
        }
      }
    } catch (err) {
      console.warn("[AIService] Gemini API request failed or timed out. Falling back to local synthesis:", err.message);
    }
  }

  // 2. Try OpenAI API if configured
  if (openAiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful task management assistant. Output concise, actionable task descriptions.",
            },
            {
              role: "user",
              content: `Write a concise, actionable task description for: "${title}". Priority: ${priority}, Category: ${category}. Include objective and action steps.`,
            },
          ],
          max_tokens: 250,
          temperature: 0.7,
        }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && text.trim()) {
          return {
            description: text.trim(),
            source: "openai",
          };
        }
      }
    } catch (err) {
      console.warn("[AIService] OpenAI API request failed or timed out. Falling back to local synthesis:", err.message);
    }
  }

  // 3. Resilient Heuristic Synthesis Fallback
  // Guarantees zero downtime, offline development capability, and CI test stability
  const fallbackDescription = synthesizeHeuristicDescription(title, priority, category);
  return {
    description: fallbackDescription,
    source: "fallback",
  };
}

/**
 * Intelligent local contextual synthesis when external AI services are offline or unconfigured.
 */
function synthesizeHeuristicDescription(title, priority, category) {
  const cleanTitle = title.trim();
  const titleLower = cleanTitle.toLowerCase();

  let actionSteps = [
    "Review technical specifications and requirements.",
    "Formulate implementation checklist and test criteria.",
    "Validate expected deliverables against project scope.",
  ];

  if (titleLower.includes("bug") || titleLower.includes("fix") || titleLower.includes("error")) {
    actionSteps = [
      "Reproduce error in staging environment and capture stack traces.",
      "Identify root cause in component logic or database query.",
      "Implement defensive fix and verify with automated regression tests.",
    ];
  } else if (titleLower.includes("docker") || titleLower.includes("deploy") || titleLower.includes("ci")) {
    actionSteps = [
      "Inspect configuration manifests, environment variables, and ports.",
      "Verify container build stages and dependency caching layers.",
      "Trigger pipeline and validate automated health checks.",
    ];
  } else if (titleLower.includes("api") || titleLower.includes("backend") || titleLower.includes("route")) {
    actionSteps = [
      "Define request/response schemas and authentication contracts.",
      "Implement controller logic, input validation, and error boundaries.",
      "Execute automated HTTP integration tests with Supertest.",
    ];
  } else if (titleLower.includes("design") || titleLower.includes("ui") || titleLower.includes("frontend")) {
    actionSteps = [
      "Draft UI layout conforming to responsive accessibility guidelines.",
      "Implement React component with memoized state handlers.",
      "Audit bundle size impact and cross-device responsiveness.",
    ];
  }

  const prioNote =
    priority.toLowerCase() === "high"
      ? "High Priority: Complete as early as possible within the current development sprint."
      : priority.toLowerCase() === "low"
      ? "Low Priority: Implement during scheduled maintenance window or as backlog permits."
      : "Standard Priority: Schedule within current sprint milestones.";

  return `### Objective
Execute and deliver deliverables for "${cleanTitle}" under the ${category.toUpperCase()} category.

### Action Plan
${actionSteps.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}

### Delivery Note
${prioNote}`;
}
