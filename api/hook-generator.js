// api/generate-hooks.js - 최적화+호환 최종 버전 (Make 패스스루 OK, 원래 스키마 유지)
import { OpenAI } from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 언어 설정 및 매핑 (소문자로 통일)
const LANGUAGE_CONFIG = {
    'ko': { name: 'korean', displayName: 'Korean', code: 'ko' },
    'en': { name: 'english', displayName: 'English', code: 'en' },
    'ja': { name: 'japanese', displayName: 'Japanese', code: 'ja' },
    'zh': { name: 'chinese', displayName: 'Chinese', code: 'zh' },
    'es': { name: 'spanish', displayName: 'Spanish', code: 'es' },
    'fr': { name: 'french', displayName: 'French', code: 'fr' },
    'de': { name: 'german', displayName: 'German', code: 'de' },
    'pt': { name: 'portuguese', displayName: 'Portuguese', code: 'pt' },
    'ru': { name: 'russian', displayName: 'Russian', code: 'ru' },
    'ar': { name: 'arabic', displayName: 'Arabic', code: 'ar' }
};

const DEFAULT_LANGUAGE = 'en';

// 다국어 메시지 (i18n 구조)
const i18n = {
    ko: {
        opening: "다음 조건에 맞는 매력적인 영상 훅(Hook) 5개를 한국어로 생성해주세요:",
        system_message: "당신은 전문적인 영상 콘텐츠 크리에이터입니다. 시청자의 관심을 즉시 끄는 강력한 훅을 만드는 전문가입니다. 모든 응답은 한국어로 해주세요.",
        missing_fields: "필수 정보가 누락되었습니다. (주제, 스타일, 타겟 오디언스, 플랫폼)",
        method_not_allowed: "허용되지 않은 메서드입니다.",
        quota_exceeded: "API 사용량 한도에 도달했습니다.",
        rate_limit: "요청 속도 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.",
        invalid_api_key: "API 키가 올바르지 않습니다.",
        generation_error: "훅 생성 중 오류가 발생했습니다."
    },
    en: {
        opening: "Generate 5 engaging video hooks in English that meet the following conditions:",
        system_message: "You are a professional video content creator who specializes in writing compelling hooks that instantly capture viewers' attention.",
        missing_fields: "Missing required fields: topic, style, targetAudience, platform.",
        method_not_allowed: "Method not allowed",
        quota_exceeded: "API quota exceeded.",
        rate_limit: "Rate limit exceeded. Please try again later.",
        invalid_api_key: "Invalid API key.",
        generation_error: "An error occurred during hook generation."
    },
    default: {
        opening: (langName) => `Generate 5 engaging video hooks in ${langName} that meet the following conditions:`,
        system_message: (langName) => `You are a professional video content creator who specializes in writing compelling hooks that instantly capture viewers' attention. Please respond entirely in ${langName}.`,
        missing_fields: "Missing required fields: topic, style, targetAudience, platform.",
        method_not_allowed: "Method not allowed",
        quota_exceeded: "API quota exceeded.",
        rate_limit: "Rate limit exceeded. Please try again later.",
        invalid_api_key: "Invalid API key.",
        generation_error: "An error occurred during hook generation."
    }
};

// 언어 정규화 및 검증 함수
function normalizeLanguage(language) {
    if (!language) return LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
    const normalized = String(language).trim().toLowerCase();

    if (LANGUAGE_CONFIG[normalized]) return LANGUAGE_CONFIG[normalized];

    const foundEntry = Object.entries(LANGUAGE_CONFIG).find(
        ([, config]) => config.name === normalized
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
        const langConfig = LANGUAGE_CONFIG[langCode];
        return message(langConfig?.displayName || 'the requested language', ...args);
    }
    return message || i18n.default[messageKey];
}

// 공통 프롬프트 템플릿
function createPrompt(topic, style, targetAudience, platform, langCode) {
    const opening = getMessage(langCode, 'opening');
    const langConfig = LANGUAGE_CONFIG[langCode];
    const needsLanguageInstruction = langCode !== 'en';

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

Each hook should be under 15 seconds. Return ONLY a JSON array of 5 strings (no numbering, no extra text).

${needsLanguageInstruction ? `Please respond entirely in ${langConfig?.displayName || 'the requested language'}.` : ''}`;
}

// 모델 응답이 줄글이어도 5개 뽑기
function safeParseHooks(text) {
    try {
        const trimmed = (text || "").trim();
        if (trimmed.startsWith("[")) return JSON.parse(trimmed);
        const lines = trimmed
            .split("\n")
            .map(l => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 5);
        return lines;
    } catch {
        return (text || "")
            .split("\n")
            .map(l => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 5);
    }
}

export default async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*"); // 필요시 특정 도메인으로 제한
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ error: getMessage(DEFAULT_LANGUAGE, 'method_not_allowed') });
    }

    try {
        // 원래 스키마 + 프론트 확장값(무시 가능)
        const {
            topic,
            style,
            targetAudience,
            platform,
            language,
            // 아래는 참고용 확장 필드(무시해도 됨)
            _ext,
        } = req.body || {};

        const _topic = topic;
        const _style = style;
        const _targetAudience = targetAudience || "general audience";
        const _platform = platform || "short-form video (Reels/Shorts/TikTok)";

        const langConfig = normalizeLanguage(language);
        const langCode = langConfig.code;
        const langName = langConfig.displayName;

        if (!_topic || !_style) {
            return res.status(400).json({ error: getMessage(langCode, 'missing_fields') });
        }

        const hookPrompt = createPrompt(_topic, _style, _targetAudience, _platform, langCode);
        const systemMessage = getMessage(langCode, 'system_message');

        const completion = await openai.chat.completions.create({
            model: "gpt-4", // 필요하면 "gpt-4o-mini"로 변경 가능
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: hookPrompt },
            ],
            max_tokens: 1000,
            temperature: 0.8,
        });

        const raw = completion.choices?.[0]?.message?.content || "";
        const hooksArray = safeParseHooks(raw);

        return res.status(200).json({
            success: true,
            hooks: hooksArray,
            metadata: {
                topic: _topic,
                style: _style,
                targetAudience: _targetAudience,
                platform: _platform,
                language: langName,
                languageCode: langCode,
                generatedAt: new Date().toISOString(),
                model: "gpt-4",
            },
        });
    } catch (error) {
        console.error("Hook generation error:", error);
        const errorLangCode = normalizeLanguage(req.body?.language)?.code || DEFAULT_LANGUAGE;

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
            details: process.env.NODE_ENV === "development" ? String(error?.message || error) : undefined,
        });
    }
}
