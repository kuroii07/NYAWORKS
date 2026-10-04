import type { ComponentType } from "react";
import type { IconProps as PhosphorIconProps } from "@phosphor-icons/react";
import {
  Adjustment,
  Anchor,
  Camera,
  Layers,
  MultiRectangle,
  Square,
  Text,
  Ungroup
} from "@icon-park/react";

export type LayerCreationIcon = ComponentType<PhosphorIconProps>;

type IconParkLayerIcon = typeof Text;

function createLayerCreationIcon(Icon: IconParkLayerIcon): LayerCreationIcon {
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
        theme="outline"
      />
    );
  };
}

export const TextLayerIcon = createLayerCreationIcon(Text);
export const SolidLayerIcon = createLayerCreationIcon(Square);
export const ShapeLayerIcon = createLayerCreationIcon(MultiRectangle);
export const AdjustmentLayerIcon = createLayerCreationIcon(Adjustment);
export const NullObjectIcon = createLayerCreationIcon(Anchor);
export const CameraLayerIcon = createLayerCreationIcon(Camera);
export const PrecomposeIcon = createLayerCreationIcon(Layers);
export const UnprecomposeIcon = createLayerCreationIcon(Ungroup);
