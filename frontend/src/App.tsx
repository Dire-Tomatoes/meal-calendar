import { MealPlannerPage } from "./features/meal-planner/MealPlannerPage";
import { UpdatePrompt } from "./features/meal-planner/components/UpdatePrompt";
import { RecipeManagementPage } from "./features/recipes/RecipeManagementPage";

export default function App() {
  const page =
    window.location.pathname === "/recipes" ? (
      <RecipeManagementPage />
    ) : (
      <MealPlannerPage />
    );

  return (
    <>
      {page}
      <UpdatePrompt />
    </>
  );
}
