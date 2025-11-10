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

    // default response when no route matches
    let worker_response;

    if (url.pathname === "/api/generate-flashcards") {
      // Read form data from the incoming request (Request.formData()), not from the Fetcher Response
      const formData = await request.formData();
      const text = formData.get("textContent");
      const file = formData.get("file");
      console.log("Received text for flashcard generation:", text);
      worker_response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as keyof AiModels, {
        prompt: `Create exactly 5 flashcards from this topic: ${text}
        Return ONLY a valid JSON array in this exact format:
        [{"question": "What is...", "answer": "..."}]
        Do not include any other text, explanations, or formatting. Just the JSON array.`,
      });
      console.log("AI worker response:", worker_response);

      const obj = JSON.parse(worker_response.response);
      console.log("Generated flashcards:", obj);
    }

    return new Response(JSON.stringify(worker_response));
  },
} satisfies ExportedHandler<Env>;