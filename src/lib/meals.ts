import { router } from "expo-router";
import { confirmAsync } from "./dialogs";
import { deletePhoto } from "./photo";
import type { Meal } from "./types";

export const newMealId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Ask, then delete a meal and its photo. Resolves true if it was deleted. */
export async function confirmDeleteMeal(meal: Meal, deleteMeal: (id: string) => void): Promise<boolean> {
  if (!(await confirmAsync("Delete this meal?", meal.name))) return false;
  deletePhoto(meal.photoUri);
  deleteMeal(meal.id);
  return true;
}

export const openMeal = (meal: Meal) => router.push({ pathname: "/meal/[id]", params: { id: meal.id } });
export const openDay = (day: string) => router.push({ pathname: "/day/[date]", params: { date: day } });
