export type NewTagSpec = {
  name: string;
  parentId: string | null;
};

export type ServiceOverride = {
  price?: number;
  duration?: number;
  havePromotion?: boolean;
  porcentageDiscount?: number;
  extraTagUuids?: string[];
};

export type SectionMapping = {
  sectionKey: string;
  serviceType: string;
  priceRange: { min: number; max: number };
  durationRange: { min: number; max: number };
  tagMap: Record<string, string[]>;
  rootTagUuids: string[];
  fallbackGenderTagUuid: string;
  kidsTagUuids: string[];
  perServiceOverrides: Record<number, ServiceOverride>;
};
