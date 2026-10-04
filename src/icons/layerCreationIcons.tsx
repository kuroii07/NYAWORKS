import type { ComponentType } from "react";
import type { IconProps as PhosphorIconProps } from "@phosphor-icons/react";
import {
  Adjustment,
  Anchor,
  EditMovie,
  Film,
  RectangleOne,
  Text,
  Videocamera
} from "@icon-park/react";

export type LayerCreationIcon = ComponentType<PhosphorIconProps>;

type IconParkLayerIcon = typeof Text;
type IconParkTheme = "outline" | "filled";

function createLayerCreationIcon(
  Icon: IconParkLayerIcon,
  theme: IconParkTheme = "outline"
): LayerCreationIcon {
  return function LayerCreationIconAdapter({
    size,
    color,
    className,
    "aria-hidden": ariaHidden
  }: PhosphorIconProps) {
    return (
      <Icon
        aria-hidden={ariaHidden}
        className={className}
        fill={color ?? "currentColor"}
        size={size ?? 24}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
        theme={theme}
      />
    );
  };
}

export const TextLayerIcon = createLayerCreationIcon(Text);
export const SolidLayerIcon = createLayerCreationIcon(RectangleOne, "filled");
export const ShapeLayerIcon = createLayerCreationIcon(RectangleOne);
export const AdjustmentLayerIcon = createLayerCreationIcon(Adjustment);
export const NullObjectIcon = createLayerCreationIcon(Anchor);
export const CameraLayerIcon = createLayerCreationIcon(Videocamera);
export const PrecomposeIcon = createLayerCreationIcon(Film);
export const UnprecomposeIcon = createLayerCreationIcon(EditMovie);
