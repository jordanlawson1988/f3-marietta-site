export interface AoBeatdownContext {
  terrain: string[];
  landmarks: string[];
  typical_stations: string[];
  available_equipment: string[];
  unavailable_equipment: string[];
  typical_formats: string[];
  constraints: string[];
  notes: string[];
}

const EMPTY_AO_CONTEXT: AoBeatdownContext = {
  terrain: [],
  landmarks: [],
  typical_stations: [],
  available_equipment: [],
  unavailable_equipment: [],
  typical_formats: [],
  constraints: [],
  notes: [],
};

export const AO_BEATDOWN_CONTEXT: Record<string, AoBeatdownContext> = {
  'The Battlefield': {
    ...EMPTY_AO_CONTEXT,
  },
  'The Last Stand': {
    ...EMPTY_AO_CONTEXT,
  },
  'Black Ops': {
    ...EMPTY_AO_CONTEXT,
  },
  CSAUP: {
    ...EMPTY_AO_CONTEXT,
  },
};

export function getAoBeatdownContext(aoName: string): AoBeatdownContext | null {
  const context = AO_BEATDOWN_CONTEXT[aoName];
  if (!context) return null;

  const hasContent = Object.values(context).some((value) => value.length > 0);
  return hasContent ? context : null;
}
