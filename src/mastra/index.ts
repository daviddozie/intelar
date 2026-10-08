import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { intelarAgent } from './agents/intelar-agent';
import { factCheckerAgent } from './agents/fact-checker-agent';
import { codeReviewerAgent } from './agents/code-reviewer-agent';
import { lessonTutorAgent } from './agents/lesson-tutor-agent';
import { examAgent } from './agents/exam-agent';
import { researchWorkflow } from './workflows/research-workflow';

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();

export const mastra = new Mastra({
  agents: { intelarAgent, factCheckerAgent, codeReviewerAgent, lessonTutorAgent, examAgent },
  workflows: { researchWorkflow },
  storage: tursoUrl
    ? new LibSQLStore({
        id: "intelar-memory",
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
    : undefined,
  logger: new PinoLogger({
    name: 'Intelar',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'intelar',
        exporters: [
          new DefaultExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});