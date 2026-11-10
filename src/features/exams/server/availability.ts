import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { checkPublicationReadiness } from "@/features/questions/server/question-publication";
import { blueprintTotals, parseExamConfiguration, pointUnits } from "./configuration";

export const examWithQuestions = {
  configuration: { select: { targetYear: true, session: true, version: true, verification: true, blueprint: true } },
  questions: {
    orderBy: { position: "asc" },
    include: { question: { include: {
      options: true,
      topics: { select: { topicId: true } },
      works: { select: { work: { select: { status: true, author: { select: { status: true } } } } } },
      provenance: { select: { origin: true, attribution: true, editorName: true, reviewStatus: true } },
    } } },
  },
} satisfies Prisma.ExamInclude;

export type ExamWithQuestions = Prisma.ExamGetPayload<{ include: typeof examWithQuestions }>;

export function checkExamAvailability(exam: ExamWithQuestions, visibleTopics: ReadonlySet<string>) {
  const problems: Record<string, string[]> = {};
  const report = (field: string, problem: string) => (problems[field] ??= []).push(problem);
  const parsed = parseExamConfiguration(exam.configuration);
  if (!parsed.success || parsed.data.verification === "UNVERIFIED") {
    report("configurationId", "Select a valid reviewed or conditional exam configuration.");
  }
  const configuration = parsed.success ? parsed.data : null;
  if (!exam.title.trim()) report("title", "Add an exam title.");
  if (!exam.description.trim()) report("description", "Add an exam description.");
  if (exam.classification !== "ORIGINAL" && !exam.attribution?.trim()) {
    report("attribution", "Attribute the source of the exam.");
  }
  if (exam.classification === "OFFICIAL" && configuration?.verification !== "VERIFIED") {
    report("classification", "Only a verified configuration can be used for an official past paper.");
  }

  const totals = configuration ? blueprintTotals(configuration.blueprint) : null;
  const slots = configuration?.blueprint.sections.flatMap((section) =>
    section.tasks.flatMap((group) => Array.from({ length: group.count }, () => group)));
  if (!exam.questions.length || (totals && exam.questions.length !== totals.taskCount)) {
    report("questions", "Match the number of questions in the selected blueprint.");
  }
  let objectivePointUnits = 0;
  let writtenCount = 0;
  exam.questions.forEach(({ question, position, points }, index) => {
    const field = `questions.${index}`;
    const slot = slots?.[index];
    if (position !== index) report(field, "Question positions must be consecutive.");
    if (slot && (slot.type !== question.type || !points.equals(slot.points))) {
      report(field, "Match the question type and point allocation for this blueprint position.");
    }
    if (question.status !== "PUBLISHED" || !question.topics.some(({ topicId }) => visibleTopics.has(topicId))) {
      report(field, "Use a published question under a published topic.");
    }
    if (question.works.some(({ work }) => work.status !== "PUBLISHED" || work.author.status !== "PUBLISHED")) {
      report(field, "A linked work or author is unpublished.");
    }
    if (exam.classification === "OFFICIAL" && question.provenance?.origin !== "OFFICIAL") {
      report(field, "An official past paper requires official questions.");
    }
    for (const problem of checkPublicationReadiness({ ...question, topicLinkCount: question.topics.length })) {
      report(field, problem.message);
    }
    if (question.assessmentMode === "OBJECTIVE") objectivePointUnits += pointUnits(points.toNumber());
    else writtenCount++;
  });
  return { problems, configuration, totals, objectiveMaximumPoints: objectivePointUnits / 100, writtenCount };
}
