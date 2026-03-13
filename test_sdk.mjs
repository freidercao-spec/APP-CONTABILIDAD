import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: "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",
});

async function run() {
    try {
        const response = await client.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [{ role: 'user', content: 'hello' }],
            temperature: 0.3,
            max_tokens: 150
        });
        console.log(response.choices[0].message?.content);
    } catch (e) {
        console.error("SDK ERROR:", e.message);
    }
}
run();
