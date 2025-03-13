import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Exercise, InsertExercise, predefinedEquipment, KG_TO_LB } from "../types";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type ExerciseFormProps = {
  exercise?: Exercise;
  onComplete: () => void;
};

export default function ExerciseForm({ exercise, onComplete }: ExerciseFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const units = user?.preferredUnits ?? "kg";

  const form = useForm<InsertExercise>({
    resolver: zodResolver(insertExerciseSchema),
    defaultValues: {
      name: exercise?.name ?? "",
      equipmentName: exercise?.equipmentName ?? "Barbell",
      startingWeight: exercise?.startingWeight ?? (units === "lb" ? predefinedEquipment.Barbell.startingWeight * KG_TO_LB : predefinedEquipment.Barbell.startingWeight),
      increment: exercise?.increment ?? (units === "lb" ? predefinedEquipment.Barbell.increment * KG_TO_LB : predefinedEquipment.Barbell.increment),
      units,
      isArchived: exercise?.isArchived ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertExercise) => {
      const res = await apiRequest(
        exercise ? "PATCH" : "POST",
        exercise ? `/api/exercises/${exercise.id}` : "/api/exercises",
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({
        title: `Exercise ${exercise ? "updated" : "created"}`,
        description: `Successfully ${exercise ? "updated" : "created"} exercise`,
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Watch equipment type to update default values
  const selectedEquipment = form.watch("equipmentName");

  const handleEquipmentChange = (value: string) => {
    form.setValue("equipmentName", value);

    if (value in predefinedEquipment) {
      const equipment = predefinedEquipment[value as keyof typeof predefinedEquipment];
      const startingWeight = units === "lb" ? equipment.startingWeight * KG_TO_LB : equipment.startingWeight;
      const increment = units === "lb" ? equipment.increment * KG_TO_LB : equipment.increment;

      form.setValue("startingWeight", startingWeight);
      form.setValue("increment", increment);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Barbell Squat" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="equipmentName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Equipment</FormLabel>
              <Select
                onValueChange={handleEquipmentChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(predefinedEquipment).map((eq) => (
                    <SelectItem key={eq.name} value={eq.name}>
                      {eq.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom Equipment</SelectItem>
                </SelectContent>
              </Select>
              {field.value === "Custom" && (
                <Input
                  placeholder="Enter custom equipment name"
                  onChange={(e) => form.setValue("equipmentName", e.target.value)}
                />
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startingWeight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Starting Weight ({units})</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.1"
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="increment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weight Increment ({units})</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.1"
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isArchived"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Archived</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : exercise ? "Update Exercise" : "Create Exercise"}
        </Button>
      </form>
    </Form>
  );
}