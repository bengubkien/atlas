"use client";

import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { cn } from "@atlas/ui/cn";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { deleteCategory, saveCategory } from "@/lib/actions";
import { GROUP_NAMES } from "@/lib/categories";
import { CATEGORY_ICONS, CategoryIcon } from "@/lib/icons";
import { CATEGORY_GROUPS, CURRENCIES, type Category, type CategoryGroup, type Currency } from "@/lib/model";

/** Adding or changing a category: its name, group, icon and monthly budget. */
export function CategoryForm({ category, defaultGroup = "daily", onDone }: { category?: Category; defaultGroup?: CategoryGroup; onDone: () => void }) {
  const [group, setGroup] = useState<CategoryGroup>(category?.group ?? defaultGroup);
  const [icon, setIcon] = useState(category?.icon ?? "circle");
  const [error, setError] = useState<string | null>(null);

  const save = async (form: FormData) => {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const typed = String(form.get("budget") ?? "");
    const budget = group === "income" ? null : parseMoney(typed);
    if (!name) return setError("Give it a name.");
    if (budget === "invalid") return setError("The budget isn't a number.");
    await saveCategory({
      ...(category ? { id: category.id } : {}),
      name,
      group,
      icon,
      budget: budget ? { amount: budget, currency: String(form.get("currency")) as Currency } : null,
    });
    toast(category ? "Saved." : `${name} added.`);
    onDone();
  };

  const remove = async () => {
    if (!category) return;
    await deleteCategory(category);
    onDone();
    toast("Deleted. Its transactions stay, without a category.", {
      action: { label: "Undo", onClick: () => void saveCategory({ id: category.id, name: category.name, group: category.group, icon: category.icon, budget: category.budget }) },
    });
  };

  return (
    <form action={save} className="flex flex-col gap-4">
      <Input name="name" label="Name" autoComplete="off" defaultValue={category?.name} required autoFocus={!category} />
      <Select name="group" label="Group" value={group} onChange={(event) => setGroup(event.target.value as CategoryGroup)}>
        {CATEGORY_GROUPS.map((each) => (
          <option key={each} value={each}>
            {GROUP_NAMES[each]}
          </option>
        ))}
      </Select>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-label font-medium">Icon</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
          {Object.keys(CATEGORY_ICONS).map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name.replace(/-/g, " ")}
              aria-pressed={icon === name}
              onClick={() => setIcon(name)}
              className={cn(
                "grid h-11 place-items-center rounded-control border",
                icon === name ? "border-primary bg-selected text-primary-text" : "border-line-field bg-input text-muted hover:bg-hover hover:text-ink",
              )}
            >
              <CategoryIcon name={name} size={18} />
            </button>
          ))}
        </div>
      </fieldset>
      {group !== "income" && (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Input
            name="budget"
            label="Monthly budget"
            hint="Optional. What you mean to spend in a month."
            inputMode="decimal"
            autoComplete="off"
            defaultValue={category?.budget ? (category.budget.amount / 100).toFixed(2) : ""}
          />
          <Select name="currency" label="In" defaultValue={category?.budget?.currency ?? "ARS"}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </div>
      )}
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {category ? (
          <Button variant="danger-text" onClick={() => void remove()}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg">
          {category ? "Save" : "Add category"}
        </Button>
      </div>
    </form>
  );
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  defaultGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  defaultGroup?: CategoryGroup;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={category ? category.name : "Add a category"} description={category ? undefined : "A way to sort what you spend or earn."}>
      {open && <CategoryForm category={category} defaultGroup={defaultGroup} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
