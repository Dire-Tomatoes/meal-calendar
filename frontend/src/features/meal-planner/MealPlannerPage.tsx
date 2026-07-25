import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useMeals, useSchedule, useScheduleMutations } from "./api/queries";
import { CalendarToolbar } from "./components/CalendarToolbar";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { MealDugout } from "./components/MealDugout";
import { MealTile } from "./components/MealTile";
import { MonthCalendar } from "./components/MonthCalendar";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { getGridRange } from "./model/calendar";
import { resolveDragIntent } from "./model/dragIntent";
import { dispatchScheduleCommand } from "./model/scheduleCommand";
import type {
  DateKey,
  DropTargetData,
  Meal,
  MealDragData
} from "./model/types";

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function CalendarSkeleton() {
  return (
    <div
      className="calendar-skeleton"
      role="status"
      aria-label="Loading meal calendar"
    >
      <span>Loading meal calendar</span>
      <div aria-hidden="true" className="skeleton-toolbar" />
      <div aria-hidden="true" className="skeleton-grid">
        {Array.from({ length: 42 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}

export function MealPlannerPage() {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    firstOfMonth(new Date())
  );
  const [activeDrag, setActiveDrag] = useState<MealDragData | null>(null);
  const range = useMemo(() => getGridRange(visibleMonth), [visibleMonth]);
  const mealsQuery = useMeals();
  const scheduleQuery = useSchedule(range);
  const mutations = useScheduleMutations();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 }
    }),
    useSensor(KeyboardSensor)
  );

  const meals = mealsQuery.data ?? [];
  const mealsById = useMemo(
    () => new Map(meals.map((meal) => [meal.id, meal])),
    [meals]
  );
  const mealsByDate = useMemo(() => {
    const scheduledMeals: Partial<Record<DateKey, Meal>> = {};

    for (const [date, mealId] of Object.entries(
      scheduleQuery.data?.days ?? {}
    )) {
      const meal = mealsById.get(mealId);
      if (meal) {
        scheduledMeals[date] = meal;
      }
    }

    return scheduledMeals;
  }, [mealsById, scheduleQuery.data]);
  const activeMeal = activeDrag
    ? mealsById.get(activeDrag.mealId)
    : undefined;
  const isSaving =
    mutations.assign.isPending ||
    mutations.move.isPending ||
    mutations.remove.isPending;
  const mutationError =
    mutations.assign.error ?? mutations.move.error ?? mutations.remove.error;
  const isInitialLoading = mealsQuery.isPending || scheduleQuery.isPending;
  const fatalError =
    (mealsQuery.isError && mealsQuery.data === undefined) ||
    (scheduleQuery.isError && scheduleQuery.data === undefined);
  const refreshError =
    mealsQuery.isError && mealsQuery.data !== undefined
      ? mealsQuery.error
      : scheduleQuery.isError && scheduleQuery.data !== undefined
        ? scheduleQuery.error
        : null;
  const isRefreshing =
    !isInitialLoading && (mealsQuery.isFetching || scheduleQuery.isFetching);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag((active.data.current as MealDragData | undefined) ?? null);
  };

  const clearActiveDrag = (_event?: DragCancelEvent) => {
    setActiveDrag(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const dragData = active.data.current as MealDragData | undefined;
    const targetData = over?.data.current as DropTargetData | undefined;

    setActiveDrag(null);
    if (!dragData) {
      return;
    }

    const command = resolveDragIntent(dragData, targetData);
    dispatchScheduleCommand(
      command,
      { isOnline, isPending: isSaving },
      mutations
    );
  };

  const retry = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meals"] }),
      queryClient.invalidateQueries({ queryKey: ["schedule"] })
    ]);
  };

  return (
    <main
      className="planner-shell"
      aria-busy={isSaving || undefined}
      data-offline={!isOnline || undefined}
      data-pending={isSaving || undefined}
    >
      <CalendarToolbar
        month={visibleMonth}
        onPrevious={() =>
          setVisibleMonth(
            new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
          )
        }
        onToday={() => setVisibleMonth(firstOfMonth(new Date()))}
        onNext={() =>
          setVisibleMonth(
            new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
          )
        }
      />

      <ConnectionStatus
        isOnline={isOnline}
        isSaving={isSaving}
        isRefreshing={isRefreshing}
        error={mutationError}
        refreshError={refreshError}
      />

      {isInitialLoading ? (
        <CalendarSkeleton />
      ) : fatalError ? (
        <section className="load-error" role="alert">
          <h2>We couldn’t load your meal calendar.</h2>
          <p>Check your connection, then try again.</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragCancel={clearActiveDrag}
          onDragEnd={handleDragEnd}
        >
          <div className="planner-layout">
            <div className="calendar-panel">
              <MonthCalendar
                month={visibleMonth}
                mealsByDate={mealsByDate}
              />
            </div>
            <MealDugout meals={meals} />
          </div>
          <DragOverlay>
            {activeMeal && activeDrag ? (
              <MealTile
                meal={activeMeal}
                variant={
                  activeDrag.source === "dugout" ? "dugout" : "scheduled"
                }
                className="drag-overlay-tile"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </main>
  );
}
