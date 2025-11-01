/**
 * Multi-Language Support Service
 * Provides language detection, translation, and multi-language capabilities
 */

export type SupportedLanguage =
	| "en"
	| "es"
	| "fr"
	| "de"
	| "it"
	| "pt"
	| "ru"
	| "zh"
	| "ja"
	| "ko"
	| "ar"
	| "hi"
	| "tr"
	| "nl"
	| "pl"
	| "sv"
	| "da"
	| "fi"
	| "no";

export type LanguageConfig = {
	code: SupportedLanguage;
	name: string;
	nativeName: string;
	rtl: boolean;
};

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
	en: { code: "en", name: "English", nativeName: "English", rtl: false },
	es: { code: "es", name: "Spanish", nativeName: "Español", rtl: false },
	fr: { code: "fr", name: "French", nativeName: "Français", rtl: false },
	de: { code: "de", name: "German", nativeName: "Deutsch", rtl: false },
	it: { code: "it", name: "Italian", nativeName: "Italiano", rtl: false },
	pt: { code: "pt", name: "Portuguese", nativeName: "Português", rtl: false },
	ru: { code: "ru", name: "Russian", nativeName: "Русский", rtl: false },
	zh: { code: "zh", name: "Chinese", nativeName: "中文", rtl: false },
	ja: { code: "ja", name: "Japanese", nativeName: "日本語", rtl: false },
	ko: { code: "ko", name: "Korean", nativeName: "한국어", rtl: false },
	ar: { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
	hi: { code: "hi", name: "Hindi", nativeName: "हिन्दी", rtl: false },
	tr: { code: "tr", name: "Turkish", nativeName: "Türkçe", rtl: false },
	nl: { code: "nl", name: "Dutch", nativeName: "Nederlands", rtl: false },
	pl: { code: "pl", name: "Polish", nativeName: "Polski", rtl: false },
	sv: { code: "sv", name: "Swedish", nativeName: "Svenska", rtl: false },
	da: { code: "da", name: "Danish", nativeName: "Dansk", rtl: false },
	fi: { code: "fi", name: "Finnish", nativeName: "Suomi", rtl: false },
	no: { code: "no", name: "Norwegian", nativeName: "Norsk", rtl: false },
};

/**
 * Language Detection Service
 * Uses pattern matching and common words to detect language
 */
export class LanguageDetectionService {
	private languagePatterns: Map<
		SupportedLanguage,
		{ patterns: RegExp[]; commonWords: string[] }
	>;

	constructor() {
		this.languagePatterns = new Map([
			[
				"en",
				{
					patterns: [/\b(the|is|are|and|or|but|in|on|at|to)\b/i],
					commonWords: ["the", "is", "are", "and", "hello", "yes", "no"],
				},
			],
			[
				"es",
				{
					patterns: [/\b(el|la|los|las|de|en|y|o|pero)\b/i],
					commonWords: ["el", "la", "hola", "sí", "no", "gracias"],
				},
			],
			[
				"fr",
				{
					patterns: [/\b(le|la|les|de|en|et|ou|mais)\b/i],
					commonWords: ["le", "la", "bonjour", "oui", "non", "merci"],
				},
			],
			[
				"de",
				{
					patterns: [/\b(der|die|das|den|und|oder|aber|in)\b/i],
					commonWords: ["der", "die", "hallo", "ja", "nein", "danke"],
				},
			],
			[
				"pt",
				{
					patterns: [/\b(o|a|os|as|de|em|e|ou|mas)\b/i],
					commonWords: ["o", "a", "olá", "sim", "não", "obrigado"],
				},
			],
			[
				"it",
				{
					patterns: [/\b(il|la|i|le|di|in|e|o|ma)\b/i],
					commonWords: ["il", "la", "ciao", "sì", "no", "grazie"],
				},
			],
			[
				"ru",
				{
					patterns: [/[а-яА-Я]/],
					commonWords: ["и", "в", "не", "на", "я", "что"],
				},
			],
			[
				"zh",
				{
					patterns: [/[\u4e00-\u9fff]/],
					commonWords: ["的", "是", "在", "了", "我", "你"],
				},
			],
			[
				"ja",
				{
					patterns: [/[\u3040-\u309f\u30a0-\u30ff]/],
					commonWords: ["は", "の", "が", "を", "に", "です"],
				},
			],
			[
				"ko",
				{
					patterns: [/[\uac00-\ud7af]/],
					commonWords: ["은", "는", "이", "가", "을", "를"],
				},
			],
			[
				"ar",
				{
					patterns: [/[\u0600-\u06ff]/],
					commonWords: ["في", "من", "على", "هو", "أن", "ما"],
				},
			],
			[
				"hi",
				{
					patterns: [/[\u0900-\u097f]/],
					commonWords: ["है", "का", "की", "के", "में", "से"],
				},
			],
			[
				"tr",
				{
					patterns: [/\b(ve|veya|ama|için|bir|bu)\b/i],
					commonWords: ["ve", "bir", "bu", "için", "var", "ile"],
				},
			],
			[
				"nl",
				{
					patterns: [/\b(de|het|een|en|of|maar|in)\b/i],
					commonWords: ["de", "het", "een", "is", "van", "en"],
				},
			],
			[
				"pl",
				{
					patterns: [/\b(i|w|z|na|do|się|jest)\b/i],
					commonWords: ["i", "w", "na", "się", "do", "jest"],
				},
			],
		]);
	}

	/**
	 * Detect language from text
	 */
	async detectLanguage(text: string): Promise<{
		language: SupportedLanguage;
		confidence: number;
	}> {
		if (!text || text.trim().length === 0) {
			return { language: "en", confidence: 0 };
		}

		const scores = new Map<SupportedLanguage, number>();

		// Score each language
		for (const [lang, { patterns, commonWords }] of this.languagePatterns) {
			let score = 0;

			// Check patterns
			for (const pattern of patterns) {
				if (pattern.test(text)) {
					score += 2;
				}
			}

			// Check common words
			const lowerText = text.toLowerCase();
			for (const word of commonWords) {
				if (lowerText.includes(word)) {
					score += 1;
				}
			}

			if (score > 0) {
				scores.set(lang, score);
			}
		}

		// Find highest scoring language
		let maxScore = 0;
		let detectedLang: SupportedLanguage = "en";

		for (const [lang, score] of scores) {
			if (score > maxScore) {
				maxScore = score;
				detectedLang = lang;
			}
		}

		// Calculate confidence (0-1)
		const confidence = Math.min(maxScore / 10, 1);

		return {
			language: detectedLang,
			confidence,
		};
	}

	/**
	 * Detect if text contains mixed languages
	 */
	async detectMixedLanguages(text: string): Promise<SupportedLanguage[]> {
		const detectedLanguages: SupportedLanguage[] = [];

		for (const [lang, { patterns }] of this.languagePatterns) {
			for (const pattern of patterns) {
				if (pattern.test(text)) {
					detectedLanguages.push(lang);
					break;
				}
			}
		}

		return detectedLanguages;
	}
}

/**
 * Translation Service
 * Integrates with OpenAI for high-quality translations
 */
export class TranslationService {
	private openAIApiKey: string;

	constructor() {
		this.openAIApiKey = process.env.OPENAI_API_KEY || "";
	}

	/**
	 * Translate text from one language to another
	 */
	async translate(
		text: string,
		targetLanguage: SupportedLanguage,
		sourceLanguage?: SupportedLanguage,
	): Promise<string> {
		if (!this.openAIApiKey) {
			throw new Error("OpenAI API key not configured");
		}

		const targetLangName = SUPPORTED_LANGUAGES[targetLanguage].name;
		const sourceLangName = sourceLanguage
			? SUPPORTED_LANGUAGES[sourceLanguage].name
			: "auto-detected";

		const prompt = sourceLanguage
			? `Translate the following text from ${sourceLangName} to ${targetLangName}. Only return the translation, nothing else:\n\n${text}`
			: `Translate the following text to ${targetLangName}. Only return the translation, nothing else:\n\n${text}`;

		try {
			const response = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${this.openAIApiKey}`,
				},
				body: JSON.stringify({
					model: "gpt-4o-mini",
					messages: [
						{
							role: "system",
							content: "You are a professional translator. Translate text accurately while preserving tone and context.",
						},
						{
							role: "user",
							content: prompt,
						},
					],
					temperature: 0.3,
				}),
			});

			if (!response.ok) {
				throw new Error(`Translation API error: ${response.statusText}`);
			}

			const data = await response.json();
			return data.choices[0].message.content.trim();
		} catch (error) {
			console.error("Translation error:", error);
			throw new Error("Translation failed");
		}
	}

	/**
	 * Translate multiple texts in batch
	 */
	async translateBatch(
		texts: string[],
		targetLanguage: SupportedLanguage,
		sourceLanguage?: SupportedLanguage,
	): Promise<string[]> {
		const translations = await Promise.all(
			texts.map((text) =>
				this.translate(text, targetLanguage, sourceLanguage),
			),
		);
		return translations;
	}

	/**
	 * Get multilingual greeting for agent
	 */
	getGreeting(language: SupportedLanguage): string {
		const greetings: Record<SupportedLanguage, string> = {
			en: "Hello! How can I help you today?",
			es: "¡Hola! ¿Cómo puedo ayudarte hoy?",
			fr: "Bonjour! Comment puis-je vous aider aujourd'hui?",
			de: "Hallo! Wie kann ich Ihnen heute helfen?",
			it: "Ciao! Come posso aiutarti oggi?",
			pt: "Olá! Como posso ajudá-lo hoje?",
			ru: "Здравствуйте! Чем я могу вам помочь сегодня?",
			zh: "你好！我今天能帮你什么？",
			ja: "こんにちは！今日はどのようにお手伝いできますか？",
			ko: "안녕하세요! 오늘 무엇을 도와드릴까요?",
			ar: "مرحبا! كيف يمكنني مساعدتك اليوم؟",
			hi: "नमस्ते! आज मैं आपकी कैसे मदद कर सकता हूँ?",
			tr: "Merhaba! Bugün size nasıl yardımcı olabilirim?",
			nl: "Hallo! Hoe kan ik u vandaag helpen?",
			pl: "Cześć! Jak mogę ci dzisiaj pomóc?",
			sv: "Hej! Hur kan jag hjälpa dig idag?",
			da: "Hej! Hvordan kan jeg hjælpe dig i dag?",
			fi: "Hei! Miten voin auttaa sinua tänään?",
			no: "Hei! Hvordan kan jeg hjelpe deg i dag?",
		};

		return greetings[language] || greetings.en;
	}
}

/**
 * Multi-language agent configuration
 */
export type MultiLanguageConfig = {
	primaryLanguage: SupportedLanguage;
	supportedLanguages: SupportedLanguage[];
	autoDetect: boolean;
	autoTranslate: boolean;
	fallbackLanguage: SupportedLanguage;
};

export const languageDetectionService = new LanguageDetectionService();
export const translationService = new TranslationService();
