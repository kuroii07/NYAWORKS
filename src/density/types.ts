export const DENSITY_IDS = ["large", "medium", "small"] as const;

export type DensityId = (typeof DENSITY_IDS)[number];

export const DEFAULT_DENSITY_ID: DensityId = "medium";

export interface DensityDefinition {
  id: DensityId;
  label: string;
  description: string;
}

export const DENSITIES: readonly DensityDefinition[] = [
  {
    id: "large",
    label: "大",
    description: "舒展展示"
  },
  {
    id: "medium",
    label: "中",
    description: "默认完整"
  },
  {
    id: "small",
    label: "小",
    description: "紧凑停靠"
  }
] as const;
