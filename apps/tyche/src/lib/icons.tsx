import { createElement } from "react";
import {
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Car,
  Circle,
  CirclePlus,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  type LucideIcon,
  PawPrint,
  Percent,
  Plane,
  Receipt,
  Repeat,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Ticket,
  TrainFront,
  Utensils,
  Wifi,
  Wrench,
} from "lucide-react";

// The icons a category can have, by the name stored on it. A name this
// build doesn't know shows as a plain circle.

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  circle: Circle,
  house: House,
  lightbulb: Lightbulb,
  wifi: Wifi,
  smartphone: Smartphone,
  shield: Shield,
  repeat: Repeat,
  landmark: Landmark,
  "shopping-basket": ShoppingBasket,
  utensils: Utensils,
  coffee: Coffee,
  car: Car,
  fuel: Fuel,
  train: TrainFront,
  "heart-pulse": HeartPulse,
  "shopping-bag": ShoppingBag,
  ticket: Ticket,
  plane: Plane,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  "paw-print": PawPrint,
  wrench: Wrench,
  sparkles: Sparkles,
  receipt: Receipt,
  banknote: Banknote,
  briefcase: BriefcaseBusiness,
  percent: Percent,
  "circle-plus": CirclePlus,
};

export const iconFor = (name: string | null | undefined): LucideIcon => (name && CATEGORY_ICONS[name]) || Circle;

/** A category's icon by its name; decorative, as the name is always written beside it. */
export function CategoryIcon({ name, size = 16, className }: { name: string | null | undefined; size?: number; className?: string }) {
  return createElement(iconFor(name), { size, className, "aria-hidden": true });
}
