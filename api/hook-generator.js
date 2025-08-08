// api/generate-hooks.js - 최적화된 최종 버전
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
    if (!language) {
        return LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
    }
    
    const normalized = language.trim().toLowerCase();
    
    // 언어 코드로 검색
    if (LANGUAGE_CONFIG[normalized]) {
        return LANGUAGE_CONFIG[normalized];
    }
    
    // 전체 언어명으로 검색 (소문자 비교)
    const foundEntry = Object.entries(LANGUAGE_CONFIG).find(
        ([code, config]) => config.name === normalized
    );
    
    if (foundEntry) {
        return foundEntry[1];
    }
    
    // 개발 환경에서만 경고 로그 출력
    if (process.env.NODE_ENV === "development") {
        console.warn(`Unsupported language: ${language}, fallback to ${LANGUAGE_CONFIG[DEFAULT_LANGUAGE].displayName}`);
    }
    
    return LANGUAGE_CONFIG[DEFAULT_LANGUAGE];
}

// 다국어 메시지 가져오기
function getMessage(langCode, messageKey, ...args) {
    const messages = i18n[langCode] || i18n.default;
    const message = messages[messageKey];
    
    // 함수형 메시지 처리 (default 언어의 경우)
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

Each hook should be under 15 seconds. Number them like this:
1. First hook
2. Second hook
3. Third hook
4. Fourth hook
5. Fifth hook

${needsLanguageInstruction ? `Please respond entirely in ${langConfig?.displayName || 'the requested language'}.` : ''}`;
}

export default async function handler(req, res) {
    // CORS 설정
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    // OPTIONS 요청 처리 (preflight)
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }
    
    // POST 요청만 허용
    if (req.method !== "POST") {
        return res.status(405).json({ 
            error: getMessage(DEFAULT_LANGUAGE, 'method_not_allowed')
        });
    }
    
    try {
        const { topic, style, targetAudience, platform, language } = req.body;
        
        // 언어 정규화 및 검증
        const langConfig = normalizeLanguage(language);
        const langCode = langConfig.code;
        const langName = langConfig.displayName;
        
        // 필수 필드 검증
        if (!topic || !style || !targetAudience || !platform) {
            return res.status(400).json({
                error: getMessage(langCode, 'missing_fields'),
            });
        }
        
        console.log("API request received:", {
            topic,
            style,
            targetAudience,
            platform,
            language: langName,
            langCode
        });
        
        // 프롬프트 및 시스템 메시지 생성
        const hookPrompt = createPrompt(topic, style, targetAudience, platform, langCode);
        const systemMessage = getMessage(langCode, 'system_message');
        
        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: systemMessage,
                },
                {
                    role: "user",
                    content: hookPrompt,
                },
            ],
            max_tokens: 1000,
            temperature: 0.8,
        });
        
        const generatedHooks = completion.choices[0].message.content;
        
        console.log("OpenAI response generated successfully");
        
        // 성공 응답
        res.status(200).json({
            success: true,
            hooks: generatedHooks,
            metadata: {
                topic,
                style,
                targetAudience,
                platform,
                language: langName,
                languageCode: langCode,
                generatedAt: new Date().toISOString(),
            },
        });
        
    } catch (error) {
        console.error("Hook generation error:", error);
        
        // 언어 설정 (에러 상황에서는 기본 언어 사용)
        const errorLangCode = normalizeLanguage(req.body?.language)?.code || DEFAULT_LANGUAGE;
        
        // 에러 타입별 처리
        if (error.code === "insufficient_quota") {
            return res.status(429).json({
                error: getMessage(errorLangCode, 'quota_exceeded'),
            });
        }
        
        if (error.code === "rate_limit_exceeded") {
            return res.status(429).json({
                error: getMessage(errorLangCode, 'rate_limit'),
            });
        }
        
        if (error.code === "invalid_api_key") {
            return res.status(401).json({
                error: getMessage(errorLangCode, 'invalid_api_key'),
            });
        }
        
        res.status(500).json({
            error: getMessage(errorLangCode, 'generation_error'),
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
}
