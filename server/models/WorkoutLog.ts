import mongoose, { Schema } from 'mongoose';

const WorkoutLogSchema = new Schema({
  workoutDayId: { type: Number, required: true },
  date: { type: Date, required: true },
  sets: [
    {
      exerciseId: { type: Number, required: true },
      sets: [
        {
          reps: { type: Number, required: true },
          weight: { type: Number, required: true },
          timestamp: { type: Date },
        },
      ],
      extraSetReps: { type: Number },
      oneRm: { type: Number },
    },
  ],
  isComplete: { type: Boolean, default: false },
});

export const WorkoutLog = mongoose.model('WorkoutLog', WorkoutLogSchema);