import { useEffect, useState, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners
} from "@dnd-kit/core";
import type { Meal } from "../model/types";

type MealTileVariant = "dugout" | "scheduled";

interface MealTileProps
  extends Omit<ComponentPropsWithoutRef<"article">, "children"> {
  meal: Meal;
  variant: MealTileVariant;
  setNodeRef?: (node: HTMLElement | null) => void;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  transform?: { x: number; y: number; scaleX: number; scaleY: number } | null;
  isDragging?: boolean;
}

export function MealTile({
  meal,
  variant,
  setNodeRef,
  dragAttributes,
  dragListeners,
  transform,
  isDragging = false,
  style,
  ...articleProps
}: MealTileProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [meal.imageUrl]);

  const tileStyle: CSSProperties = {
    ...style,
    opacity: isDragging ? 0.5 : style?.opacity,
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : style?.transform
  };
  const imageIsVisible = meal.imageUrl !== null && !imageFailed;

  return (
    <article
      {...articleProps}
      {...dragAttributes}
      {...dragListeners}
      ref={setNodeRef}
      aria-label={`${variant} meal: ${meal.name}`}
      style={tileStyle}
    >
      {imageIsVisible ? (
        <img
          src={meal.imageUrl ?? undefined}
          alt={`${meal.name} meal`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true" style={{ fontSize: "2rem" }}>
          {meal.emoji}
        </span>
      )}
      <span>{meal.name}</span>
    </article>
  );
}
