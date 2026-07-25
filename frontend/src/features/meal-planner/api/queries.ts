import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DateKey, DateRange, MealId } from "../model/types";
import { assignMeal, getMeals, getSchedule, moveMeal, removeMeal } from "./client";

interface AssignVariables {
  date: DateKey;
  mealId: MealId;
}

interface MoveVariables {
  fromDate: DateKey;
  toDate: DateKey;
}

interface RemoveVariables {
  date: DateKey;
}

export function useMeals() {
  return useQuery({ queryKey: ["meals"], queryFn: getMeals });
}

export function useSchedule(range: DateRange) {
  return useQuery({
    queryKey: ["schedule", range.from, range.to],
    queryFn: () => getSchedule(range),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
}

export function useScheduleMutations() {
  const queryClient = useQueryClient();
  const invalidateSchedules = () =>
    queryClient.invalidateQueries({ queryKey: ["schedule"] });

  return {
    assign: useMutation({
      mutationFn: ({ date, mealId }: AssignVariables) => assignMeal(date, mealId),
      onSettled: invalidateSchedules
    }),
    move: useMutation({
      mutationFn: ({ fromDate, toDate }: MoveVariables) => moveMeal(fromDate, toDate),
      onSettled: invalidateSchedules
    }),
    remove: useMutation({
      mutationFn: ({ date }: RemoveVariables) => removeMeal(date),
      onSettled: invalidateSchedules
    })
  };
}
