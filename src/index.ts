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
import { generateScheduledContent, getLatestContent } from "./generate";
export { VectorizeWorkflow } from "./vectorize";

export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  VECTORIZE: Vectorize;
  VECTORIZE_WORKFLOW: Workflow;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    const questionTypes = [
      "definition",
      "concept",
      "application",
      "comparison",
      "example",
      "analysis"
    ];

    if (url.pathname === "/api/latest-content") {
      const content = getLatestContent();
      return Response.json({
        success: true,
        flashcards: content.flashcards,
        activities: content.activities,
        lastUpdated: content.timestamp
      });
    }

    if (url.pathname === "/api/generate-flashcards") {
      const formData = await request.formData();
      let text = formData.get("textContent");
      if (null === text) {
        text = "";
      }
      const file = formData.get("file");
      if (file) {
        const fileText = file.slice(0, 1800).toString();
        text += "\n" + fileText;
      }
      if (text){
        await env.VECTORIZE_WORKFLOW.create({
          params: {
            text: text
          }
        });
      }
      let flashcards = [];
      let activities = [];
      for (let i = 0; i < 6; i++) {
        const worker_response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
          messages: [
            { role: "system", content: `You are a teacher who is trying to create thought-provoking flashcards which are designed to help students learn and retain information effectively. Create a flashcard based on this question type ${questionTypes[i]}. You are to generate JSON for the flashcards. Return EXACTLY the JSON requested.` },
            { role: "user", content: `Create exactly 1 flashcard about the following topic: ${text}. You can use the topic given as reference and make up your own flashcards.` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" }
              },
              required: ["question", "answer"]
            }
          },
          temperature: 1
        });
        const activities_response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
          messages: [
            { role: "system", content: `You are a teacher who is trying to create thought-provoking quiz questions which are designed to help students learn and retain information effectively. Create a question based on this question type ${questionTypes[i]}. You are to generate JSON for the quiz questions. Return EXACTLY the JSON requested.` },
            { role: "user", content: `Create exactly 1 multiple-choice question about the following topic: ${text} You can use the topic given as reference and make up your own questions.` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              type: "object",
              properties: {
                question: { type: "string" },
                choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                correct_index: { type: "integer" }
              },
              required: ["question", "choices", "correct_index"]
            }
          },
          temperature: 1
        });
        if (worker_response.response && worker_response.response.question && worker_response.response.answer) flashcards.push(worker_response.response);
        if (activities_response.response && activities_response.response.question && activities_response.response.choices && activities_response.response.correct_index !== undefined) activities.push(activities_response.response);
      }

      const res = Response.json({ success: true, flashcards: flashcards, activities: activities });
      return res;
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("Cron triggered - generating flashcards");
    
    try {
      await generateScheduledContent(env, "general knowledge");
      console.log("Scheduled generation completed successfully");
    } catch (error) {
      console.error("Error in scheduled generation:", error);
    }
  },
} satisfies ExportedHandler<Env>;
