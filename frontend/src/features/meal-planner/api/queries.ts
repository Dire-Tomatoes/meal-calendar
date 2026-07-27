import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import type { DateKey, DateRange, Meal, MealId } from "../model/types";
import {
  assignMeal,
  createRecipe,
  deleteRecipe,
  getMeals,
  getSchedule,
  moveMeal,
  removeMeal,
  type RecipeFormValues,
  updateRecipe
} from "./client";

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

interface UpdateRecipeVariables {
  id: MealId;
  values: RecipeFormValues;
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

export function useRecipeMutations(): {
  create: UseMutationResult<Meal, Error, RecipeFormValues>;
  update: UseMutationResult<Meal, Error, UpdateRecipeVariables>;
  remove: UseMutationResult<undefined, Error, MealId>;
} {
  const queryClient = useQueryClient();
  const invalidateMeals = () => queryClient.invalidateQueries({ queryKey: ["meals"] });
  const invalidateMealsAndSchedules = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meals"] }),
      queryClient.invalidateQueries({ queryKey: ["schedule"] })
    ]);

  return {
    create: useMutation({
      mutationFn: createRecipe,
      onSettled: invalidateMeals
    }),
    update: useMutation({
      mutationFn: ({ id, values }: UpdateRecipeVariables) => updateRecipe(id, values),
      onSettled: invalidateMeals
    }),
    remove: useMutation({
      mutationFn: deleteRecipe,
      onSettled: invalidateMealsAndSchedules
    })
  };
}
