/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate-flashcards") {
      const formData = await request.formData();
      let text = formData.get("textContent");
      const file = formData.get("file");
      if (file) {
        text += (text ? '\n\n' : '') + await (file as File).text();
      }
      const worker_response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
        messages: [
          { role: "system", content: "You are a JSON generator that returns EXACTLY the JSON requested." },
          { role: "user", content: `Create exactly 6 flashcards about: ${text}` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" }
              },
              required: ["question", "answer"]
            }
          }
        },
        temperature: 0
      });

      const activities_response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
        messages: [
          { role: "system", content: "You are a JSON generator that returns EXACTLY the JSON requested." },
          { role: "user", content: `Create exactly 3 multiple-choice questions about: ${text}` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                correct_index: { type: "integer" }
              },
              required: ["question", "choices", "correct_index"]
            }
          }
        },
        temperature: 0
      });

      let flashcards;
      if (Array.isArray(worker_response.response)) {
        flashcards = worker_response.response;
      } else {
        try {
          flashcards = JSON.parse(String(worker_response.response));
        } catch (e) {
          const m = String(worker_response.response).match(/\[[\s\S]*\]/);
          try {
            flashcards = m ? JSON.parse(m[0]) : [];
          } catch (_e) {
            flashcards = [];
          }
        }
      }

      let activities;
      if (Array.isArray(activities_response.response)) {
        activities = activities_response.response;
      } else {
        try {
          activities = JSON.parse(String(activities_response.response));
        } catch (e) {
          const m = String(activities_response.response).match(/\[[\s\S]*\]/);
          if (m) {
            try { activities = JSON.parse(m[0]); }
            catch (e2) { activities = []; }
          } else {
            activities = [];
          }
        }
      }
      const res = Response.json({ success: true, flashcards: flashcards, activities: activities });
      return res;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;