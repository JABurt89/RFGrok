import { useForm } from "react-hook-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Exercise } from "../types";
import { useExercises } from "../hooks/useExercises";

interface WorkoutDayFormProps {
  onSubmit: (data: WorkoutDayFormData) => void;
}

interface WorkoutDayFormData {
  name: string;
  exercises: { exerciseId: number; scheme: string }[];
}

export function WorkoutDayForm({ onSubmit }: WorkoutDayFormProps) {
  const { exercises } = useExercises();
  const form = useForm<WorkoutDayFormData>({
    defaultValues: {
      name: "",
      exercises: [{ exerciseId: 0, scheme: "STS" }],
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Workout Day Name
        </label>
        <Input
          id="name"
          {...form.register("name", { required: true })}
          placeholder="e.g., Leg Day"
        />
      </div>

      {form.watch("exercises").map((exercise, index) => (
        <div key={index} className="space-y-4 p-4 border rounded">
          <div>
            <label className="block text-sm font-medium">Exercise</label>
            <Select
              value={exercise.exerciseId.toString()}
              onValueChange={(value) => {
                const exercises = form.getValues("exercises");
                exercises[index].exerciseId = parseInt(value);
                form.setValue("exercises", exercises);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an exercise" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium">Progression Scheme</label>
            <Select
              value={exercise.scheme}
              onValueChange={(value) => {
                const exercises = form.getValues("exercises");
                exercises[index].scheme = value;
                form.setValue("exercises", exercises);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STS">STS</SelectItem>
                <SelectItem value="Double Progression">Double Progression</SelectItem>
                <SelectItem value="RPT Top-Set">RPT Top-Set</SelectItem>
                <SelectItem value="RPT Individual">RPT Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              const exercises = form.getValues("exercises");
              exercises.splice(index, 1);
              form.setValue("exercises", exercises);
            }}
          >
            Remove Exercise
          </Button>
        </div>
      ))}

      <Button
        type="button"
        onClick={() => {
          const exercises = form.getValues("exercises");
          exercises.push({ exerciseId: 0, scheme: "STS" });
          form.setValue("exercises", exercises);
        }}
      >
        Add Exercise
      </Button>

      <Button type="submit" className="w-full">
        Create Workout
      </Button>
    </form>
  );
}