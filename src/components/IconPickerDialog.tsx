import { Check } from "@phosphor-icons/react";
import {
  HOME_GROUP_ICON_CATALOG
} from "../homeLayouts/catalog";
import type { HomeGroupIconId } from "../homeLayouts/types";
import { AppDialog } from "./AppDialog";

interface IconPickerDialogProps {
  title: string;
  selectedIconId: HomeGroupIconId;
  iconLabels: Record<HomeGroupIconId, string>;
  confirmLabel: string;
  cancelLabel: string;
  onSelect: (iconId: HomeGroupIconId) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function IconPickerDialog({
  title,
  selectedIconId,
  iconLabels,
  confirmLabel,
  cancelLabel,
  onSelect,
  onConfirm,
  onCancel
}: IconPickerDialogProps) {
  return (
    <AppDialog
      title={title}
      primaryAction={{ label: confirmLabel, onClick: onConfirm }}
      secondaryAction={{ label: cancelLabel, onClick: onCancel }}
      onClose={onCancel}
    >
      <div className="home-icon-picker">
        {(
          Object.entries(HOME_GROUP_ICON_CATALOG) as Array<
            [HomeGroupIconId, (typeof HOME_GROUP_ICON_CATALOG)[HomeGroupIconId]]
          >
        ).map(([iconId, Icon]) => {
          const selected = iconId === selectedIconId;
          return (
            <button
              type="button"
              key={iconId}
              data-icon-option="true"
              data-active={selected || undefined}
              aria-label={iconLabels[iconId]}
              title={iconLabels[iconId]}
              onClick={() => onSelect(iconId)}
            >
              <Icon aria-hidden="true" weight="regular" />
              {selected ? <Check aria-hidden="true" weight="bold" /> : null}
            </button>
          );
        })}
      </div>
    </AppDialog>
  );
}
