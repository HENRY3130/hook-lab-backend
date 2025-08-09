// api/generate-content.js - 기존 스타일 맞춤 통합 버전 (훅 + 스크립트)
import { OpenAI } from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 언어 설정 및 매핑 (기존 스타일 유지)
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
    'ar': { name: 'arabic', displayName: 'Arabic', code: 'ar' },
    'it': { name: 'italian', displayName: 'Italian', code: 'it' },
    'nl': { name: 'dutch', displayName: 'Dutch', code: 'nl' }
};

const DEFAULT_LANGUAGE = 'en';

// 다국어 메시지 (i18n 구조) - 훅과 스크립트 통합
const i18n = {
    ko: {
        hook_opening: "다음 조건에 맞는 매력적인 영상 훅(Hook) 5개를 한국어로 생성해주세요:",
        script_opening: "다음 조건에 맞는 매력적인 영상 스크립트를 한국어로 생성해주세요:",
        hook_system: "당신은 전문적인 영상 콘텐츠 크리에이터입니다. 시청자의 관심을 즉시 끄는 강력한 훅을 만드는 전문가입니다. 모든 응답은 한국어로 해주세요.",
        script_system: "당신은 전문적인 영상 콘텐츠 크리에이터입니다. 시청자의 관심을 끄는 강력한 스크립트를 만드는 전문가입니다. 모든 응답은 한국어로 해주세요.",
        missing_fields_hook: "필수 정보가 누락되었습니다. (주제, 스타일)",
        missing_fields_script: "필수 정보가 누락되었습니다. (텍스트, 스타일)",
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
        missing_fields_hook: "Missing required fields: topic, style.",
        missing_fields_script: "Missing required fields: text, style.",
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
        missing_fields_hook: "Missing required fields: topic, style.",
        missing_fields_script: "Missing required fields: text, style.",
        invalid_type: "Unsupported content type. Only 'hooks' or 'script' allowed.",
        method_not_allowed: "Method not allowed",
        quota_exceeded: "API quota exceeded.",
        rate_limit: "Rate limit exceeded. Please try again later.",
        invalid_api_key: "Invalid API key.",
        generation_error: "An error occurred during content generation."
    }
};

// 언어 정규화 및 검증 함수 (기존과 동일)
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

// 다국어 메시지 가져오기 (기존과 동일)
function getMessage(langCode, messageKey, ...args) {
    const messages = i18n[langCode] || i18n.default;
    const message = messages[messageKey];
    if (typeof message === 'function') {
        const langConfig = LANGUAGE_CONFIG[langCode];
        return message(langConfig?.displayName || 'the requested language', ...args);
    }
    return message || i18n.default[messageKey];
}

// 훅 프롬프트 템플릿 (기존과 동일)
function createHookPrompt(topic, style, targetAudience, platform, langCode) {
    const opening = getMessage(langCode, 'hook_opening');
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

// 스크립트 프롬프트 템플릿 (새로 추가)
function createScriptPrompt(text, style, length, tone, language, ctaInclusion, langCode) {
    const opening = getMessage(langCode, 'script_opening');
    const langConfig = LANGUAGE_CONFIG[langCode];
    const needsLanguageInstruction = langCode !== 'en';
    
    const lengthFormatted = length < 60 ? `${Math.round(length)} seconds` : `${Math.round(length / 60)} minutes`;

    return `${opening}

Topic/Keyword: ${text}
Video Style: ${style}
Script Length: ${lengthFormatted}
Tone: ${tone || 'Neutral'}
Language: ${langConfig.displayName}
Include CTA: ${ctaInclusion ? 'Yes' : 'No'}

Requirements:
1. Create a compelling video script for short-form content
2. Hook viewers within the first 3 seconds
3. Maintain ${(tone || 'neutral').toLowerCase()} tone throughout
4. Keep the script to approximately ${lengthFormatted}
5. Focus on the topic: ${text}
6. Use ${style.toLowerCase()} video style approach
${ctaInclusion ? '7. Include a clear call-to-action at the end' : '7. Natural conclusion without forced CTA'}

Please write a complete, engaging script that can be read aloud. Include natural pauses and emphasis where appropriate.

${needsLanguageInstruction ? `Please respond entirely in ${langConfig?.displayName || 'the requested language'}.` : ''}

Return the script as plain text (no JSON formatting needed).`;
}

// 모델 응답이 줄글이어도 5개 뽑기 (기존과 동일)
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
    // CORS (기존과 동일)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ error: getMessage(DEFAULT_LANGUAGE, 'method_not_allowed') });
    }

    try {
        const {
            type, // 새로 추가: 'hooks' 또는 'script'
            // 훅용 필드
            topic,
            style,
            targetAudience,
            platform,
            // 스크립트용 필드
            text,
            length,
            tone,
            ctaInclusion,
            // 공통 필드
            language,
            _ext,
        } = req.body || {};

        const langConfig = normalizeLanguage(language);
        const langCode = langConfig.code;
        const langName = langConfig.displayName;

        // 타입 검증
        if (!type || !['hooks', 'script'].includes(type)) {
            return res.status(400).json({ error: getMessage(langCode, 'invalid_type') });
        }

        let prompt, systemMessage, maxTokens, temperature, result, metadata;

        if (type === 'hooks') {
            // 기존 훅 생성 로직
            const _topic = topic;
            const _style = style;
            const _targetAudience = targetAudience || "general audience";
            const _platform = platform || "short-form video (Reels/Shorts/TikTok)";

            if (!_topic || !_style) {
                return res.status(400).json({ error: getMessage(langCode, 'missing_fields_hook') });
            }

            prompt = createHookPrompt(_topic, _style, _targetAudience, _platform, langCode);
            systemMessage = getMessage(langCode, 'hook_system');
            maxTokens = 1000;
            temperature = 0.8;

            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: prompt },
                ],
                max_tokens: maxTokens,
                temperature: temperature,
            });

            const raw = completion.choices?.[0]?.message?.content || "";
            const hooksArray = safeParseHooks(raw);

            result = { hooks: hooksArray };
            metadata = {
                type: 'hooks',
                topic: _topic,
                style: _style,
                targetAudience: _targetAudience,
                platform: _platform,
                language: langName,
                languageCode: langCode,
                generatedAt: new Date().toISOString(),
                model: "gpt-4",
            };

        } else if (type === 'script') {
            // 새로운 스크립트 생성 로직
            const _text = text;
            const _style = style;
            const _length = length || 45;
            const _tone = tone || 'Neutral';
            const _ctaInclusion = ctaInclusion || false;

            if (!_text || !_style) {
                return res.status(400).json({ error: getMessage(langCode, 'missing_fields_script') });
            }

            prompt = createScriptPrompt(_text, _style, _length, _tone, language, _ctaInclusion, langCode);
            systemMessage = getMessage(langCode, 'script_system');
            maxTokens = _length <= 60 ? 600 : _length <= 120 ? 1000 : 1500;
            temperature = 0.8;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", // 스크립트는 더 비용 효율적인 모델 사용
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: prompt },
                ],
                max_tokens: maxTokens,
                temperature: temperature,
            });

            const scriptContent = completion.choices?.[0]?.message?.content || "";
            const wordCount = scriptContent.trim().split(/\s+/).length;

            result = { result: scriptContent.trim() };
            metadata = {
                type: 'script',
                topic: _text,
                style: _style,
                length: `${_length} seconds`,
                tone: _tone,
                language: langName,
                languageCode: langCode,
                ctaIncluded: _ctaInclusion,
                generatedAt: new Date().toISOString(),
                model: "gpt-4o-mini",
                wordCount: wordCount
            };
        }

        return res.status(200).json({
            success: true,
            ...result,
            metadata: metadata,
        });

    } catch (error) {
        console.error("Content generation error:", error);
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
