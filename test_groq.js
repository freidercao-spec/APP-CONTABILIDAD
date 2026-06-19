async function test() {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": "Bearer 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",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: "hello" }]
        })
    });
    console.log(await res.text());
}
test();
