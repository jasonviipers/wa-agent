import { db } from "@wa/db";
import {
	voiceCall,
	voiceTranscriptSegment,
	type NewVoiceCall,
	type VoiceCall,
} from "@wa/db/schema";
import { eq } from "drizzle-orm";
import { languageDetectionService } from "../i18n/language-service";

/**
 * Twilio Voice Service
 * Integrates with Twilio for voice call handling
 */
export class TwilioVoiceService {
	private accountSid: string;
	private authToken: string;
	private phoneNumber: string;
	private baseUrl: string;

	constructor() {
		this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
		this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
		this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || "";
		this.baseUrl = "https://api.twilio.com/2010-04-01";
	}

	/**
	 * Initiate an outbound call
	 */
	async initiateCall(params: {
		to: string;
		organizationId: string;
		agentId?: string;
		conversationId?: string;
	}): Promise<VoiceCall> {
		if (!this.accountSid || !this.authToken || !this.phoneNumber) {
			throw new Error("Twilio credentials not configured");
		}

		try {
			// Create call in database
			const [newCall] = await db
				.insert(voiceCall)
				.values({
					organizationId: params.organizationId,
					agentId: params.agentId,
					conversationId: params.conversationId,
					direction: "outbound",
					status: "initiated",
					fromNumber: this.phoneNumber,
					toNumber: params.to,
					providerData: {
						provider: "twilio",
					},
				})
				.returning();

			// Initiate call via Twilio
			const callbackUrl = `${process.env.NEXT_PUBLIC_SERVER_URL}/api/voice/twilio/callback`;
			const statusCallbackUrl = `${process.env.NEXT_PUBLIC_SERVER_URL}/api/voice/twilio/status`;

			const twilioResponse = await this.makeTwilioRequest(
				`/Accounts/${this.accountSid}/Calls.json`,
				"POST",
				{
					To: params.to,
					From: this.phoneNumber,
					Url: callbackUrl,
					StatusCallback: statusCallbackUrl,
					Record: "true",
					RecordingStatusCallback: `${process.env.NEXT_PUBLIC_SERVER_URL}/api/voice/twilio/recording`,
				},
			);

			// Update call with Twilio SID
			const [updatedCall] = await db
				.update(voiceCall)
				.set({
					callSid: twilioResponse.sid,
					status: "ringing",
				})
				.where(eq(voiceCall.id, newCall.id))
				.returning();

			return updatedCall;
		} catch (error) {
			console.error("Failed to initiate call:", error);
			throw error;
		}
	}

	/**
	 * Handle incoming call webhook from Twilio
	 */
	async handleIncomingCall(params: {
		callSid: string;
		from: string;
		to: string;
		organizationId: string;
		agentId?: string;
	}): Promise<VoiceCall> {
		const [call] = await db
			.insert(voiceCall)
			.values({
				callSid: params.callSid,
				organizationId: params.organizationId,
				agentId: params.agentId,
				direction: "inbound",
				status: "ringing",
				fromNumber: params.from,
				toNumber: params.to,
				providerData: {
					provider: "twilio",
				},
			})
			.returning();

		return call;
	}

	/**
	 * Update call status
	 */
	async updateCallStatus(
		callId: string,
		status: VoiceCall["status"],
		metadata?: {
			duration?: number;
			startedAt?: Date;
			answeredAt?: Date;
			endedAt?: Date;
		},
	): Promise<VoiceCall> {
		const [updatedCall] = await db
			.update(voiceCall)
			.set({
				status,
				...metadata,
			})
			.where(eq(voiceCall.id, callId))
			.returning();

		return updatedCall;
	}

	/**
	 * Process call recording
	 */
	async processRecording(params: {
		callId: string;
		recordingUrl: string;
		recordingSid: string;
		duration: number;
	}): Promise<void> {
		await db
			.update(voiceCall)
			.set({
				recordingUrl: params.recordingUrl,
				duration: params.duration,
			})
			.where(eq(voiceCall.id, params.callId));
	}

	/**
	 * Generate TwiML for voice response
	 */
	generateTwiML(params: {
		message: string;
		voice?: string;
		language?: string;
		gatherInput?: boolean;
	}): string {
		const voice = params.voice || "Polly.Joanna";
		const language = params.language || "en-US";

		let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

		if (params.gatherInput) {
			twiml += `<Gather input="speech" action="/api/voice/twilio/gather" language="${language}" speechTimeout="auto">`;
			twiml += `<Say voice="${voice}" language="${language}">${this.escapeXml(params.message)}</Say>`;
			twiml += "</Gather>";
		} else {
			twiml += `<Say voice="${voice}" language="${language}">${this.escapeXml(params.message)}</Say>`;
		}

		twiml += "</Response>";
		return twiml;
	}

	/**
	 * Get call details from Twilio
	 */
	async getCallDetails(callSid: string): Promise<any> {
		return this.makeTwilioRequest(
			`/Accounts/${this.accountSid}/Calls/${callSid}.json`,
			"GET",
		);
	}

	/**
	 * End/hangup a call
	 */
	async endCall(callSid: string): Promise<void> {
		await this.makeTwilioRequest(
			`/Accounts/${this.accountSid}/Calls/${callSid}.json`,
			"POST",
			{
				Status: "completed",
			},
		);
	}

	/**
	 * Make a request to Twilio API
	 */
	private async makeTwilioRequest(
		endpoint: string,
		method: "GET" | "POST",
		body?: Record<string, string>,
	): Promise<any> {
		const url = `${this.baseUrl}${endpoint}`;
		const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
			"base64",
		);

		const options: RequestInit = {
			method,
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		};

		if (body && method === "POST") {
			options.body = new URLSearchParams(body).toString();
		}

		const response = await fetch(url, options);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(`Twilio API error: ${error.message || response.statusText}`);
		}

		return response.json();
	}

	private escapeXml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}
}

/**
 * Speech-to-Text Service using OpenAI Whisper
 */
export class SpeechToTextService {
	private apiKey: string;

	constructor() {
		this.apiKey = process.env.OPENAI_API_KEY || "";
	}

	/**
	 * Transcribe audio to text
	 */
	async transcribe(params: {
		audioUrl: string;
		language?: string;
	}): Promise<{
		text: string;
		language: string;
		duration: number;
		segments?: Array<{
			text: string;
			start: number;
			end: number;
		}>;
	}> {
		if (!this.apiKey) {
			throw new Error("OpenAI API key not configured");
		}

		try {
			// Download audio file
			const audioResponse = await fetch(params.audioUrl);
			const audioBlob = await audioResponse.blob();

			// Create form data for Whisper API
			const formData = new FormData();
			formData.append("file", audioBlob, "audio.mp3");
			formData.append("model", "whisper-1");
			formData.append("response_format", "verbose_json");
			if (params.language) {
				formData.append("language", params.language);
			}

			const response = await fetch(
				"https://api.openai.com/v1/audio/transcriptions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: formData,
				},
			);

			if (!response.ok) {
				throw new Error(`Whisper API error: ${response.statusText}`);
			}

			const result = await response.json();

			return {
				text: result.text,
				language: result.language || params.language || "en",
				duration: result.duration || 0,
				segments: result.segments,
			};
		} catch (error) {
			console.error("Transcription error:", error);
			throw error;
		}
	}

	/**
	 * Transcribe and save to database
	 */
	async transcribeAndSave(params: {
		voiceCallId: string;
		audioUrl: string;
		language?: string;
	}): Promise<void> {
		const transcription = await this.transcribe({
			audioUrl: params.audioUrl,
			language: params.language,
		});

		// Update voice call with transcription
		await db
			.update(voiceCall)
			.set({
				transcription: transcription.text,
				detectedLanguage: transcription.language,
			})
			.where(eq(voiceCall.id, params.voiceCallId));

		// Save segments if available
		if (transcription.segments) {
			for (const segment of transcription.segments) {
				await db.insert(voiceTranscriptSegment).values({
					voiceCallId: params.voiceCallId,
					role: "user",
					text: segment.text,
					language: transcription.language,
					startTime: Math.floor(segment.start * 1000),
					endTime: Math.floor(segment.end * 1000),
					audioUrl: params.audioUrl,
				});
			}
		}
	}
}

/**
 * Text-to-Speech Service using OpenAI TTS
 */
export class TextToSpeechService {
	private apiKey: string;

	constructor() {
		this.apiKey = process.env.OPENAI_API_KEY || "";
	}

	/**
	 * Convert text to speech
	 */
	async synthesize(params: {
		text: string;
		voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
		speed?: number;
	}): Promise<Blob> {
		if (!this.apiKey) {
			throw new Error("OpenAI API key not configured");
		}

		try {
			const response = await fetch("https://api.openai.com/v1/audio/speech", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					model: "tts-1",
					input: params.text,
					voice: params.voice || "alloy",
					speed: params.speed || 1.0,
				}),
			});

			if (!response.ok) {
				throw new Error(`TTS API error: ${response.statusText}`);
			}

			return response.blob();
		} catch (error) {
			console.error("Text-to-speech error:", error);
			throw error;
		}
	}

	/**
	 * Get voice based on language
	 */
	getVoiceForLanguage(language: string): string {
		const voiceMap: Record<string, string> = {
			en: "alloy",
			es: "nova",
			fr: "shimmer",
			de: "echo",
			it: "fable",
			pt: "alloy",
			zh: "nova",
			ja: "shimmer",
			ko: "alloy",
		};

		return voiceMap[language] || "alloy";
	}
}

export const twilioVoiceService = new TwilioVoiceService();
export const speechToTextService = new SpeechToTextService();
export const textToSpeechService = new TextToSpeechService();
