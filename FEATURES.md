# New Features Implementation

This document describes the new features added to the WA-Agent platform.

## 1. Advanced Analytics and Reporting System

### Overview
Comprehensive analytics system for tracking agent performance, conversation metrics, and business insights.

### Features
- **Organization-wide Metrics**: Track total conversations, sales, customer satisfaction, conversion rates
- **Agent Performance Analytics**: Individual agent metrics including response times, success rates, and conversation counts
- **Real-time Monitoring**: Live dashboard with 24-hour metrics updated every 30 seconds
- **Conversation Trends**: Daily aggregation of conversation patterns
- **Platform Distribution**: Analytics across different platforms (WhatsApp, Shopify, Facebook, etc.)
- **Sentiment Analysis**: Track positive, neutral, and negative customer sentiment
- **Data Export**: Export analytics data to CSV format for external analysis

### API Endpoints

#### Get Organization Metrics
```
GET /api/analytics/metrics?startDate=<ISO_DATE>&endDate=<ISO_DATE>
```

#### Get Agent Performance
```
GET /api/analytics/agent/{agentId}?startDate=<ISO_DATE>&endDate=<ISO_DATE>
```

#### Get Real-time Metrics
```
GET /api/analytics/realtime
```

#### Get Conversation Trends
```
GET /api/analytics/trends?startDate=<ISO_DATE>&endDate=<ISO_DATE>
```

#### Export Analytics
```
GET /api/analytics/export?startDate=<ISO_DATE>&endDate=<ISO_DATE>&type=<conversations|messages|events>
```

### React Hooks
```typescript
import { useAnalyticsMetrics, useAgentMetrics, useRealtimeMetrics } from '@/hooks/use-analytics';

// Usage
const { data: metrics } = useAnalyticsMetrics({ startDate, endDate });
const { data: agentMetrics } = useAgentMetrics(agentId, { startDate, endDate });
const { data: realtime } = useRealtimeMetrics();
```

### Components
- `AnalyticsDashboard`: Full-featured dashboard with charts and metrics visualization

---

## 2. Multi-Language Agent Support

### Overview
Comprehensive multi-language support enabling agents to communicate in 19+ languages with automatic detection and translation.

### Supported Languages
English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Turkish, Dutch, Polish, Swedish, Danish, Finnish, Norwegian

### Features
- **Automatic Language Detection**: Detects user language from message content
- **AI-Powered Translation**: Uses OpenAI GPT-4o-mini for high-quality translations
- **Multi-language Knowledge Base**: Support for knowledge bases in multiple languages
- **RTL Language Support**: Proper handling of right-to-left languages (Arabic)
- **Language-specific Greetings**: Pre-configured greetings in all supported languages
- **Mixed Language Detection**: Identifies when messages contain multiple languages

### Services

#### Language Detection Service
```typescript
import { languageDetectionService } from '@/lib/i18n/language-service';

const result = await languageDetectionService.detectLanguage(text);
// Returns: { language: 'es', confidence: 0.85 }
```

#### Translation Service
```typescript
import { translationService } from '@/lib/i18n/language-service';

const translated = await translationService.translate(
  "Hello, how can I help you?",
  'es' // target language
);
// Returns: "Hola, ¿cómo puedo ayudarte?"
```

### Configuration
Agent language settings can be configured in the agent's settings:
```typescript
{
  settings: {
    language: 'en',
    // ... other settings
  }
}
```

---

## 3. Voice Call Integration

### Overview
Full-featured voice call integration with Twilio, including speech-to-text, text-to-speech, and call analytics.

### Features
- **Inbound & Outbound Calls**: Handle both incoming and outgoing voice calls
- **Call Recording**: Automatic recording of all calls
- **Speech-to-Text**: Convert voice to text using OpenAI Whisper
- **Text-to-Speech**: Generate voice responses using OpenAI TTS
- **Multi-language Support**: Voice recognition and synthesis in multiple languages
- **Call Analytics**: Track duration, sentiment, intent, and outcomes
- **Transcription Storage**: Store full call transcripts with timestamps
- **Cost Tracking**: Monitor costs for calls, transcription, and AI processing

### Database Schema

#### Voice Call Table
```typescript
{
  id: string;
  organizationId: string;
  agentId: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  status: 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed';
  fromNumber: string;
  toNumber: string;
  duration: number; // seconds
  recordingUrl: string;
  transcription: string;
  detectedLanguage: string;
  sentiment: string;
  callCost: decimal;
}
```

### API Endpoints

#### Initiate Call
```
POST /api/voice/initiate
Body: {
  toNumber: string;
  agentId?: string;
  conversationId?: string;
}
```

#### Twilio Webhooks
- `POST /api/voice/twilio/callback` - Call flow handling
- `POST /api/voice/twilio/status` - Call status updates
- `POST /api/voice/twilio/recording` - Recording processing

### Services

#### Twilio Voice Service
```typescript
import { twilioVoiceService } from '@/lib/voice/twilio-service';

// Initiate a call
const call = await twilioVoiceService.initiateCall({
  to: '+1234567890',
  organizationId: 'org_123',
  agentId: 'agent_456'
});

// Generate TwiML response
const twiml = twilioVoiceService.generateTwiML({
  message: 'Hello! How can I help you?',
  gatherInput: true,
  language: 'en-US'
});
```

#### Speech-to-Text Service
```typescript
import { speechToTextService } from '@/lib/voice/twilio-service';

const transcription = await speechToTextService.transcribe({
  audioUrl: 'https://example.com/recording.mp3',
  language: 'en'
});
```

#### Text-to-Speech Service
```typescript
import { textToSpeechService } from '@/lib/voice/twilio-service';

const audioBlob = await textToSpeechService.synthesize({
  text: 'Hello, how can I help you?',
  voice: 'alloy',
  speed: 1.0
});
```

### Environment Variables
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 4. Custom Model Fine-Tuning

### Overview
Complete model fine-tuning pipeline for creating custom AI models based on your conversation data.

### Features
- **Dataset Creation**: Generate training datasets from conversations
- **Automated Data Processing**: Convert conversations to OpenAI fine-tuning format
- **Training Job Management**: Create, monitor, and cancel fine-tuning jobs
- **Model Versioning**: Track different versions of fine-tuned models
- **Performance Evaluation**: Benchmark and compare model performance
- **Cost Tracking**: Monitor training and inference costs
- **Quality Validation**: Validate training examples before fine-tuning

### Database Schema

#### Fine-Tuning Job
```typescript
{
  id: string;
  organizationId: string;
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  baseModel: string; // e.g., 'gpt-4o-mini'
  fineTunedModel: string; // Provider's model ID
  datasetId: string;
  trainingMetrics: {
    trainLoss: number;
    validLoss: number;
    steps: number;
  };
  estimatedCost: decimal;
  actualCost: decimal;
}
```

#### Training Dataset
```typescript
{
  id: string;
  organizationId: string;
  name: string;
  type: 'conversations' | 'custom' | 'knowledge_base';
  stats: {
    totalExamples: number;
    avgTokensPerExample: number;
  };
  isValidated: boolean;
}
```

### API Endpoints

#### Create Dataset
```
POST /api/fine-tuning/dataset/create
Body: {
  name: string;
  description?: string;
  conversationIds?: string[];
  agentIds?: string[];
  dateRange?: { start: string; end: string; };
}
```

#### List Datasets
```
GET /api/fine-tuning/dataset/list
```

#### Create Fine-Tuning Job
```
POST /api/fine-tuning/job/create
Body: {
  name: string;
  description?: string;
  baseModel: string;
  datasetId: string;
  agentId?: string;
  config?: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
  };
}
```

#### List Jobs
```
GET /api/fine-tuning/job/list
```

#### Check Job Status
```
GET /api/fine-tuning/job/{jobId}/status
```

#### Cancel Job
```
POST /api/fine-tuning/job/{jobId}/cancel
```

### Service Usage

#### Create Dataset from Conversations
```typescript
import { fineTuningService } from '@/lib/fine-tuning/service';

const dataset = await fineTuningService.createDatasetFromConversations({
  organizationId: 'org_123',
  userId: 'user_456',
  name: 'Customer Support Dataset',
  agentIds: ['agent_1', 'agent_2'],
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  }
});
```

#### Start Fine-Tuning Job
```typescript
const job = await fineTuningService.createFineTuningJob({
  organizationId: 'org_123',
  userId: 'user_456',
  name: 'Support Agent v1',
  baseModel: 'gpt-4o-mini',
  datasetId: 'dataset_123',
  config: {
    epochs: 3,
    batchSize: 4,
    learningRate: 0.0001
  }
});
```

#### Monitor Job Progress
```typescript
const job = await fineTuningService.checkJobStatus('job_123');
console.log(job.status); // 'running', 'succeeded', etc.
console.log(job.trainingMetrics);
```

---

## Database Migrations

To use these features, you'll need to run database migrations to create the new tables:

```bash
cd packages/db
bun run db:generate  # Generate migration files
bun run db:migrate   # Apply migrations
```

### New Tables Created
- `voice_call` - Voice call records
- `voice_transcript_segment` - Call transcription segments
- `voice_call_analytics` - Voice call analytics
- `fine_tuning_job` - Fine-tuning job tracking
- `fine_tuning_dataset` - Training datasets
- `training_example` - Individual training examples
- `model_version` - Fine-tuned model versions
- `fine_tuning_evaluation` - Model evaluation results

---

## Environment Variables

Add these to your `.env` file:

```env
# Twilio (for voice calls)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI (for translations, STT, TTS, fine-tuning)
OPENAI_API_KEY=your_openai_api_key

# Server URL (for webhooks)
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
```

---

## Usage Examples

### 1. Analytics Dashboard
```typescript
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
```

### 2. Multi-language Agent Setup
```typescript
// Detect and translate user message
const detection = await languageDetectionService.detectLanguage(userMessage);

if (detection.language !== 'en') {
  const translated = await translationService.translate(
    userMessage,
    'en',
    detection.language
  );
  // Process translated message
}
```

### 3. Voice Call Integration
```typescript
// Initiate outbound call
const call = await twilioVoiceService.initiateCall({
  to: customer.phoneNumber,
  organizationId: org.id,
  agentId: agent.id
});

// Process recording when complete
await speechToTextService.transcribeAndSave({
  voiceCallId: call.id,
  audioUrl: call.recordingUrl
});
```

### 4. Fine-Tuning Workflow
```typescript
// 1. Create dataset
const dataset = await fineTuningService.createDatasetFromConversations({
  organizationId: org.id,
  userId: user.id,
  name: 'Q4 2024 Support Data',
  dateRange: { start: startDate, end: endDate }
});

// 2. Start fine-tuning
const job = await fineTuningService.createFineTuningJob({
  organizationId: org.id,
  userId: user.id,
  name: 'Support Agent v2.0',
  baseModel: 'gpt-4o-mini',
  datasetId: dataset.id
});

// 3. Monitor progress
const status = await fineTuningService.checkJobStatus(job.id);

// 4. Use fine-tuned model
if (status.status === 'succeeded') {
  // Update agent with fine-tuned model
  await updateAgent(agent.id, {
    model: status.fineTunedModel
  });
}
```

---

## Best Practices

### Analytics
- Set appropriate date ranges to manage data volume
- Use real-time metrics sparingly to avoid excessive API calls
- Export data regularly for long-term analysis
- Monitor agent performance to identify improvement opportunities

### Multi-language
- Always detect language before translating
- Cache translations to reduce API costs
- Use language-specific voices for TTS
- Test with native speakers for quality assurance

### Voice Calls
- Always record calls for quality and compliance
- Transcribe calls asynchronously to avoid blocking
- Monitor call costs and set budgets
- Use appropriate voices for different languages

### Fine-Tuning
- Use high-quality conversation data (resolved, positive sentiment)
- Start with small datasets to validate approach
- Monitor training costs carefully
- Evaluate models before deployment
- Version models systematically
- Keep training data up-to-date

---

## Performance Considerations

### Analytics
- Database queries are optimized with indexes on organizationId, eventType, and createdAt
- Use date ranges to limit data scope
- Consider implementing caching for frequently accessed metrics

### Multi-language
- Translation API calls can be expensive - cache when possible
- Batch translations when appropriate
- Consider implementing a translation cache table

### Voice Calls
- Transcription is performed asynchronously to avoid blocking
- Audio files should be stored in S3 or similar for scalability
- Consider implementing call queuing for high volume

### Fine-Tuning
- Training datasets are validated before upload
- Jobs run asynchronously - monitor via status endpoint
- Consider cost limits and quotas

---

## Troubleshooting

### Analytics not showing data
- Verify analytics events are being tracked
- Check date range parameters
- Ensure user has correct organization permissions

### Translation failing
- Verify OPENAI_API_KEY is set
- Check API quota and rate limits
- Validate language codes

### Voice calls not working
- Verify Twilio credentials
- Check webhook URLs are publicly accessible
- Ensure NEXT_PUBLIC_SERVER_URL is correct
- Verify phone number format (+E.164)

### Fine-tuning job stuck
- Check job status via API
- Verify training file format (JSONL)
- Check OpenAI dashboard for errors
- Ensure sufficient API credits

---

## Future Enhancements

### Analytics
- Real-time streaming analytics
- Custom report builder
- Scheduled email reports
- Advanced visualization charts

### Multi-language
- Automatic language switching per conversation
- Language preference learning
- Multi-language knowledge base search
- Regional dialect support

### Voice Calls
- Real-time transcription during calls
- Voice biometrics for authentication
- Call routing and IVR
- Voicemail handling

### Fine-Tuning
- Automated retraining schedules
- A/B testing framework
- Model performance monitoring
- Automatic dataset curation

---

## Support

For issues or questions about these features, please:
1. Check this documentation
2. Review the API endpoint documentation
3. Check the implementation code in the respective service files
4. Contact the development team

---

## License

These features are part of the WA-Agent platform and follow the same license terms.
