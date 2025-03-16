import { z } from "zod";

// Common parameters for all progression schemes
const commonParameters = {
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
};

export const stsParameters = z.object({
  scheme: z.literal("STS"),
  minSets: z.number().min(1),
  maxSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  ...commonParameters,
}).strict();

export type STSParameters = z.infer<typeof stsParameters>;

export const doubleProgressionParameters = z.object({
  scheme: z.literal("Double Progression"),
  targetSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  ...commonParameters,
}).strict();

export type DoubleProgressionParameters = z.infer<typeof doubleProgressionParameters>;

export const rptTopSetParameters = z.object({
  scheme: z.literal("RPT Top-Set"),
  sets: z.number().min(2),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  dropPercentages: z.array(z.number().min(0).max(100)),
  ...commonParameters,
}).strict();

export type RPTTopSetParameters = z.infer<typeof rptTopSetParameters>;

export const rptIndividualParameters = z.object({
  scheme: z.literal("RPT Individual"),
  sets: z.number().min(1),
  setConfigs: z.array(z.object({
    min: z.number().min(1),
    max: z.number().min(1),
  })),
  ...commonParameters,
}).strict();

export type RPTIndividualParameters = z.infer<typeof rptIndividualParameters>;