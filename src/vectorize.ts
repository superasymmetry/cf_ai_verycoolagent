import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

interface Env {
  AI: Ai;
  VECTORIZE: Vectorize;
  ASSETS: Fetcher;
  GENERATION: Workflow;
  VECTORIZE_WORKFLOW: Workflow;
}


export class VectorizeWorkflow extends WorkflowEntrypoint<Env, any> {
  async run(event: WorkflowEvent<any>, step: WorkflowStep) {
    const { text, metadata } = event.payload;

    const embeddings = await step.do("create-embeddings", async () => {
      const res = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: [text]
      });
      return res.data[0];
    });

    await step.do("store-embeddings", async () => {
      await this.env.VECTORIZE.upsert([
        {
          id: `material-${Date.now()}`,
          values: embeddings,
          metadata: {
            text: text.slice(0, 1000),
            ...metadata
          }
        }
      ]);
      
      console.log("Material vectorized and stored");
      return true;
    });
  }
}