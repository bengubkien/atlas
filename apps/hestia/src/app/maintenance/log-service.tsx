import { DialogButton } from "@/components/dialogs";

import { ServiceForm } from "./service-form";

/** "Log": records that a maintenance item was done. */
export function LogService({
  item,
  vendors,
  today,
  currency,
  variant = "secondary",
}: {
  item: { id: string; name: string };
  vendors: string[];
  today: string;
  currency: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <DialogButton
      label={variant === "primary" ? "Log service" : "Log"}
      ariaLabel={`Log service: ${item.name}`}
      title="Log service"
      description={item.name}
      variant={variant}
      size={variant === "primary" ? "md" : "sm"}
    >
      <ServiceForm itemId={item.id} vendors={vendors} today={today} currency={currency} />
    </DialogButton>
  );
}
