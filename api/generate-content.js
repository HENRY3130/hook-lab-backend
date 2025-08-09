// api/generate-content.js - 통합 콘텐츠 제네레이터 (훅 + 스크립트)
import { OpenAI } from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 언어 설정 및 매핑
const LANGUAGE_CONFIG = {
    'korean': { name: 'korean', displayName: 'Korean', code: 'ko' },
    'english': { name: 'english', displayName: 'English', code: 'en' },
    'japanese': { name: 'japanese', displayName: 'Japanese', code: 'ja' },
    'chinese': { name: 'chinese', displayName: 'Chinese', code: 'zh' },
    'spanish': { name: 'spanish', displayName: 'Spanish', code: 'es' },
    'french': { name: 'french', displayName: 'French', code: 'fr' },
    'german': { name: 'german', displayName: 'German', code: 'de' },
    'portuguese': { name: 'portuguese', displayName: 'Portuguese', code: 'pt' },
    'dutch': { name: 'dutch', displayName: 'Dutch', code: 'nl' },
    'russian': { name: 'russian', displayName: 'Russian', code: 'ru' },
    'arabic': { name: 'arabic', displayName: 'Arabic', code: 'ar' },
    'italian': { name: 'italian', displayName: 'Italian', code: 'it' }
};

const DEFAULT_LANGUAGE = 'english';

// 다국어 메시지 (i18n 구조)
const i18n = {
    ko: {
        hook_opening: "다음 조건에 맞는 매력적인 영상 훅(Hook) 5개를 한국어로 생성해주세요:",
        script_opening: "다음 조건에 맞는 매력적인 영상 스크립트를 한국어로 생성해주세요:",
        hook_system: "당신은 전문적인 영상 콘텐츠 크리에이터입니다. 시청자의 관심을 즉시 끄는 강력한 훅을 만드는 전문가입니다. 모든 응답은 한국어로 해주세요.",
        script_system: "당신은 전문적인 영상 콘텐츠 크리에이터입니다. 시청자의 관심을 끄는 강력한 스크립트를 만드는 전문가입니다. 모든 응답은 한국어로 해주세요.",
        missing_fields: "필수 정보가 누락되었습니다.",
        invalid_type: "지원하지 않는 콘텐츠 타입입니다. (hooks 또는 script만 가능)",
        method_not_allowed: "허용되지 않은 메서드입니다.",
        quota_exceeded: "API 사용량 한도에 도달했습니다.",
        rate_limit: "요청 속도 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.",
        invalid_api_key: "API 키가 올바르지 않습니다.",
        generation_error: "콘텐츠 생성 중 오류가 발생했습니다."
    },
    en: {
        hook_opening: "Generate 5 engaging video hooks in English that meet the following conditions:",
        script_opening: "Generate an engaging video script in English that meets the following conditions:",
        hook_system: "You are a professional video content creator who specializes in writing compelling hooks that instantly capture viewers' attention.",
        script_system: "You are a professional video content creator who specializes in writing compelling scripts that capture viewers' attention.",
        missing_fields: "Missing required fields.",
        invalid_type: "Unsupported content type. Only 'hooks' or 'script' allowed.",
        method_not_allowed: "Method not allowed",
        quota_exceeded: "API quota exceeded.",
        rate_limit: "Rate limit exceeded. Please try again later.",
        invalid_api_key: "Invalid API key.",
        generation_error: "An error occurred during content generation."
    },
    default: {
        hook_opening: (langName) => `Generate 5 engaging video hooks in ${langName} that meet the following conditions:`,
        script_opening: (langName) => `Generate an engaging video script in ${langName} that meets the following conditions:`,
        hook_system: (langName) => `You are a professional video content creator who specializes in writing compelling hooks that instantly capture viewers' attention. Please respond entirely in ${langName}.`,
        script_system: (langName) => `You are a professional video content creator who specializes in writing compelling scripts that capture viewers' attention. Please respond entirely in ${langName}.`,
        missing_fields: "Missing required fields.",
        invalid_type: "Unsupported content type. Only 'hooks' or 'script' allowed.",
        method_not_allowed: "Method not allowed",
        quota_exceeded: "API quota exceeded.",
        rate_limit: "Rate limit exceeded. Please try again later.",
        invalid_api_key: "Invalid API key.",
        generation_error: "An error occurred during content generation."
    }
};

// 언어 정규화 및 검증 함수
function normalizeLanguage(language) {
    if (!language) return LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
    
    const normalized = String(language).trim().toLowerCase();
    if (!normalized) return LANGUAGE_CONFIG[DEFAULT_LANGUAGE];

    if (LANGUAGE_CONFIG[normalized]) return LANGUAGE_CONFIG[normalized];

    const foundEntry = Object.entries(LANGUAGE_CONFIG).find(
        ([key, config]) => key === normalized || config.name === normalized
    );
    if (foundEntry) return foundEntry[1];

    if (process.env.NODE_ENV === "development") {
        console.warn(`Unsupported language: ${language}, fallback to ${LANGUAGE_CONFIG[DEFAULT_LANGUAGE].displayName}`);
    }
    return LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
}

// 다국어 메시지 가져오기
function getMessage(langCode, messageKey, ...args) {
    const messages = i18n[langCode] || i18n.default;
    const message = messages[messageKey];
    
    if (typeof message === 'function') {
        const langConfig = Object.values(LANGUAGE_CONFIG).find(config => config.code === langCode);
        return message(langConfig?.displayName || 'the requested language', ...args);
    }
    
    return message || i18n.default[messageKey] || 'Unknown error';
}

// 길이를 초/분으로 변환
function formatLength(length) {
    if (!length || length < 60) {
        return `${Math.round(length || 45)} seconds`;
    } else {
        return `${Math.round(length / 60)} minutes`;
    }
}

// 훅 프롬프트 생성
function createHookPrompt(topic, style, targetAudience, platform, langCode) {
    const opening = getMessage(langCode, 'hook_opening');
    const langConfig = Object.values(LANGUAGE_CONFIG).find(config => config.code === langCode);
    const needsLanguageInstruction = langCode !== 'en';

    const jsonInstruction = langCode === 'ko' 
        ? "JSON 배열 형태로만 5개의 문자열을 반환해주세요. (번호 매기기 없음, 추가 텍스트 없음)"
        : "Return ONLY a JSON array of 5 strings (no numbering, no extra text).";

    return `${opening}

Topic: ${topic}
Style: ${style}
Target Audience: ${targetAudience}
Platform: ${platform}

Requirements:
1. Hook must capture attention within the first 3 seconds
2. Tone and manner suitable for ${platform}
3. Relevant to the interests of ${targetAudience}
4. Written in a ${style} style

Each hook should be under 15 seconds. ${jsonInstruction}

${needsLanguageInstruction ? `Please respond entirely in ${langConfig?.displayName || 'the requested language'}.` : ''}`;
}

// 스크립트 프롬프트 생성
function createScriptPrompt(text, style, length, tone, language, ctaInclusion, langCode) {
    const opening = getMessage(langCode, 'script_opening');
    const langConfig = normalizeLanguage(language);
    const needsLanguageInstruction = langCode !== 'en';
    const lengthFormatted = formatLength(length);

    return `${opening}

Topic/Keyword: ${text}
Video Style: ${style}
Script Length: ${lengthFormatted}
Tone: ${tone}
Language: ${langConfig.displayName}
Include CTA: ${ctaInclusion ? 'Yes' : 'No'}

Requirements:
1. Create a compelling video script for short-form content
2. Hook viewers within the first 3 seconds
3. Maintain ${tone?.toLowerCase() || 'neutral'} tone throughout
4. Keep the script to approximately ${lengthFormatted}
5. Focus on the topic: ${text}
6. Use ${style?.toLowerCase() || 'engaging'} video style approach
${ctaInclusion ? '7. Include a clear call-to-action at the end' : '7. Natural conclusion without forced CTA'}

Please write a complete, engaging script that can be read aloud. Include natural pauses and emphasis where appropriate.

${needsLanguageInstruction ? `Please respond entirely in ${langConfig?.displayName || 'the requested language'}.` : ''}

Return the script as plain text (no JSON formatting needed).`;
}

// 안전한 훅 파싱
function safeParseHooks(text) {
    if (!text || typeof text !== 'string') {
        return ['Hook 1', 'Hook 2', 'Hook 3', 'Hook 4', 'Hook 5'];
    }

    const trimmed = text.trim();
    
    try {
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.slice(0, 5).map(item => String(item).trim()).filter(Boolean);
            }
        }
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.warn("JSON parsing failed, falling back to text parsing:", error.message);
        }
    }
    
    try {
        const lines = trimmed
            .split('\n')
            .map(line => line.replace(/^\s*[\d\-\*\•]+[\.\)]\s*/g, '').trim())
            .filter(line => line.length > 0 && line.length < 200)
            .slice(0, 5);
        
        return lines.length > 0 ? lines : ['Generated hook'];
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("Text parsing also failed:", error.message);
        }
        return ['Hook generation failed'];
    }
}

// Vercel Functions 방식
module.exports = async (req, res) => {
    // CORS 설정
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    
    if (req.method !== "POST") {
        return res.status(405).json({ 
            error: getMessage('en', 'method_not_allowed') 
        });
    }

    try {
        const body = req.body || {};
        const { type, language, ...params } = body;

        // 언어 설정
        const langConfig = normalizeLanguage(language);
        const langCode = langConfig.code;
        const langName = langConfig.displayName;

        // 타입 검증
        if (!type || !['hooks', 'script'].includes(type)) {
            return res.status(400).json({ 
                error: getMessage(langCode, 'invalid_type') 
            });
        }

        let prompt, systemMessage, maxTokens, temperature;

        if (type === 'hooks') {
            // 훅 생성 로직
            const { topic, style, targetAudience, platform } = params;
            
            if (!topic || !style) {
                return res.status(400).json({ 
                    error: getMessage(langCode, 'missing_fields') 
                });
            }

            const normalizedTopic = String(topic).trim();
            const normalizedStyle = String(style).trim();
            const normalizedTargetAudience = targetAudience ? String(targetAudience).trim() : "general audience";
            const normalizedPlatform = platform ? String(platform).trim() : "short-form video";

            prompt = createHookPrompt(normalizedTopic, normalizedStyle, normalizedTargetAudience, normalizedPlatform, langCode);
            systemMessage = getMessage(langCode, 'hook_system');
            maxTokens = 1000;
            temperature = 0.8;

            console.log("Hook generation request:", { topic: normalizedTopic, style: normalizedStyle, language: langName });

        } else if (type === 'script') {
            // 스크립트 생성 로직
            const { text, style, length, tone, ctaInclusion } = params;
            
            if (!text || !style) {
                return res.status(400).json({ 
                    error: getMessage(langCode, 'missing_fields') 
                });
            }

            const normalizedText = String(text).trim();
            const normalizedStyle = String(style).trim();
            const normalizedLength = Number(length) || 45;
            const normalizedTone = tone ? String(tone).trim() : 'Neutral';
            const normalizedCtaInclusion = Boolean(ctaInclusion);

            prompt = createScriptPrompt(normalizedText, normalizedStyle, normalizedLength, normalizedTone, language, normalizedCtaInclusion, langCode);
            systemMessage = getMessage(langCode, 'script_system');
            maxTokens = normalizedLength <= 60 ? 600 : normalizedLength <= 120 ? 1000 : 1500;
            temperature = 0.8;

            console.log("Script generation request:", { text: normalizedText, style: normalizedStyle, length: normalizedLength, language: langName });
        }

        // OpenAI API 호출 (공통)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt },
            ],
            max_tokens: maxTokens,
            temperature: temperature,
        });

        const rawResponse = completion.choices?.[0]?.message?.content || "";

        // 타입별 응답 처리
        if (type === 'hooks') {
            const hooksArray = safeParseHooks(rawResponse);
            return res.status(200).json({
                success: true,
                hooks: hooksArray,
                metadata: {
                    type: 'hooks',
                    topic: params.topic,
                    style: params.style,
                    targetAudience: params.targetAudience || "general audience",
                    platform: params.platform || "short-form video",
                    language: langName,
                    languageCode: langCode,
                    generatedAt: new Date().toISOString(),
                    model: "gpt-4o-mini",
                    hooksCount: hooksArray.length
                },
            });
        } else {
            const cleanedScript = rawResponse.trim();
            const wordCount = cleanedScript.split(/\s+/).length;
            
            return res.status(200).json({
                success: true,
                result: cleanedScript,
                metadata: {
                    type: 'script',
                    topic: params.text,
                    style: params.style,
                    length: `${params.length || 45} seconds`,
                    tone: params.tone || 'Neutral',
                    language: langName,
                    languageCode: langCode,
                    ctaIncluded: Boolean(params.ctaInclusion),
                    generatedAt: new Date().toISOString(),
                    model: "gpt-4o-mini",
                    wordCount: wordCount
                },
            });
        }

    } catch (error) {
        console.error("Content generation error:", error);
        
        const errorLangCode = normalizeLanguage(req.body?.language)?.code || 'en';

        if (error?.code === "insufficient_quota") {
            return res.status(429).json({ error: getMessage(errorLangCode, 'quota_exceeded') });
        }
        if (error?.code === "rate_limit_exceeded") {
            return res.status(429).json({ error: getMessage(errorLangCode, 'rate_limit') });
        }
        if (error?.code === "invalid_api_key") {
            return res.status(401).json({ error: getMessage(errorLangCode, 'invalid_api_key') });
        }

        return res.status(500).json({
            error: getMessage(errorLangCode, 'generation_error'),
            details: process.env.NODE_ENV === "development" ? (error?.message || String(error)) : undefined,
        });
    }
}
