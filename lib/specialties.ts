// clinica-crm-mobile/lib/specialties.ts

export type SpecialtyValue = "FISIOTERAPIA" | "GERIATRIA" | "NEUROLOGIA";

export const SPECIALTIES: Array<{ label: string; value: SpecialtyValue }> = [
  { label: "Fisioterapia", value: "FISIOTERAPIA" },
  { label: "Geriatria", value: "GERIATRIA" },
  { label: "Neurologia", value: "NEUROLOGIA" },
];
