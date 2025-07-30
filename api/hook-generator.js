// api/generate-hooks.js - 수정된 Framer용 훅 생성 API
import { OpenAI } from "openai" // import 방식 수정

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
    // CORS 설정 - 모든 Framer 도메인 허용
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    // OPTIONS 요청 처리 (preflight)
    if (req.method === "OPTIONS") {
        res.status(200).end()
        return
    }

    // POST 요청만 허용
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" })
    }

    try {
        const { topic, style, targetAudience, platform } = req.body

        // 입력값 검증
        if (!topic || !style || !targetAudience || !platform) {
            return res.status(400).json({
                error: "필수 정보가 누락되었습니다. (주제, 스타일, 타겟 오디언스, 플랫폼)",
            })
        }

        console.log("📥 API 요청 받음:", { topic, style, targetAudience, platform })

        // 훅 생성 프롬프트
        const hookPrompt = `
다음 조건에 맞는 매력적인 영상 훅(Hook) 5개를 생성해주세요:

주제: ${topic}
스타일: ${style}
타겟 오디언스: ${targetAudience}
플랫폼: ${platform}

요구사항:
1. 첫 3초 내에 시청자의 관심을 끌 수 있는 훅
2. ${platform}에 적합한 톤앤매너
3. ${targetAudience}가 관심을 가질만한 내용
4. ${style} 스타일에 맞는 표현

각 훅은 15초 이내로 작성하고, 번호를 매겨서 제시해주세요.
예시:
1. 첫 번째 훅 내용
2. 두 번째 훅 내용
3. 세 번째 훅 내용
4. 네 번째 훅 내용
5. 다섯 번째 훅 내용
`

        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content:
                        "당신은 전문적인 영상 콘텐츠 크리에이터입니다. 시청자의 관심을 즉시 끄는 강력한 훅을 만드는 전문가입니다.",
                },
                {
                    role: "user",
                    content: hookPrompt,
                },
            ],
            max_tokens: 1000,
            temperature: 0.8,
        })

        const generatedHooks = completion.choices[0].message.content
        console.log("✅ OpenAI 응답 생성 완료")

        // 성공 응답 (Framer 코드에 맞는 형태)
        res.status(200).json({
            success: true,
            hooks: generatedHooks,
            metadata: {
                topic,
                style,
                targetAudience,
                platform,
                generatedAt: new Date().toISOString(),
            },
        })
    } catch (error) {
        console.error("❌ Hook generation error:", error)

        // 에러 타입별 처리
        if (error.code === "insufficient_quota") {
            return res.status(429).json({
                error: "API 사용량 한도에 도달했습니다.",
            })
        }

        if (error.code === "rate_limit_exceeded") {
            return res.status(429).json({
                error: "요청 속도 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.",
            })
        }

        if (error.code === "invalid_api_key") {
            return res.status(401).json({
                error: "API 키가 올바르지 않습니다.",
            })
        }

        res.status(500).json({
            error: "훅 생성 중 오류가 발생했습니다.",
            details:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        })
    }
}
