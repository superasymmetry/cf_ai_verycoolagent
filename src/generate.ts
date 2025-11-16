let latestContent: any = { flashcards: [], activities: [] };

export async function generateScheduledContent(env: any, topic: string = "general knowledge") {
    const questionTypes = [
        "definition",
        "concept", 
        "application",
        "comparison",
        "example",
        "analysis"
    ];

    let flashcards = [];
    let activities = [];
    
    console.log(`Generating scheduled flashcards about: ${topic}`);

    const flashcard = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
            { role: "system", content: "You are a teacher who is trying to create thought-provoking flashcards which are designed to help students learn and retain information effectively. You are to generate JSON for the flashcards. Return EXACTLY the JSON requested." },
            { role: "user", content: `Create exactly 1 flashcard about the following topic: ${topic}. You can use the topic given as reference and make up your own flashcards.` }
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
        }
    });

    const activities_response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
            { role: "system", content: "You are a teacher who is trying to create thought-provoking quiz questions which are designed to help students learn and retain information effectively. You are to generate JSON for the quiz questions. Return EXACTLY the JSON requested." },
            { role: "user", content: `Create exactly 1 multiple-choice question about the following topic: ${topic} You can use the topic given as reference and make up your own questions.` }
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
    
    if (flashcard && flashcard.question && flashcard.answer) {
        flashcards.push(flashcard);
    }
    if (activities_response && activities_response.question && activities_response.choices && activities_response.correct_index !== undefined) {
        activities.push(activities_response);
    }
    
    latestContent = {
        flashcards: [...latestContent.flashcards, ...flashcards],
        activities: [...latestContent.activities, ...activities]
    };
    
    console.log(`Generated ${flashcards.length} flashcards and ${activities.length} activities`);
    return { flashcards, activities };
}

export function getLatestContent() {
    return latestContent;
}
