type ValidationError = {
  message: string;
  line: number;
  type: string;
};

type Validations =
  | "everyLineIsReferenced"
  | "everyScheduledStopPointHasAName"
  | "locationsAreReferencingTheSamePoint"
  | "everyStopPlaceHasAName"
  | "stopPlaceQuayDistanceIsReasonable"
  | "everyStopPointIsReferenced"
  | "everyStopPlaceIsReferenced"
  | "everyStopPlaceHasACorrectStopPlaceType"
  | "frameDefaultsHaveALocaleAndTimeZone"
  | "everyStopPointHaveArrivalAndDepartureTime"
  | "passingTimesIsNotDecreasing"
  | "passingTimesHaveIncreasingTimes"
  | "netexUniqueConstraints"
  | "netexKeyRefConstraints"
  | "xsd"
  | "xsdEPIP"
  | "xsdAustrian"
  | "customPublicationTimeStampIsAvailable"
  | "customServiceCalendarIsCurrentYear";

type Validation = {
  name: Validations;
  valid: boolean;
  error_count?: number;
  errors?: ValidationError[];
};

type NeTExResult = {
  name: string;
  valid: boolean;
  validations: Validation[];
}

type NeTExResults = NeTExResult[];

export const severity: Record<Validations, number> = {
  everyStopPlaceIsReferenced: 10,
  everyStopPointIsReferenced: 20,
  everyLineIsReferenced: 20,
  customPublicationTimeStampIsAvailable: 20,
  customServiceCalendarIsCurrentYear: 30,
  everyScheduledStopPointHasAName: 30,
  stopPlaceQuayDistanceIsReasonable: 30,
  locationsAreReferencingTheSamePoint: 30,
  netexKeyRefConstraints: 30,
  netexUniqueConstraints: 30,
  everyStopPlaceHasACorrectStopPlaceType: 30,
  frameDefaultsHaveALocaleAndTimeZone: 30,
  passingTimesHaveIncreasingTimes: 40,
  everyStopPlaceHasAName: 40,
  everyStopPointHaveArrivalAndDepartureTime: 40,
  passingTimesIsNotDecreasing: 50,
  xsd: 50,
  xsdEPIP: 50,
  xsdAustrian: 50,
};

export type ValidationResult = {
  name: string;
  validations: {
    name: Validations;
    score: number;
  }[]
  score: number;
}

const parseValidation = (
  result: NeTExResult
): ValidationResult => {
  const validations = result.validations.map(validation => {
    const severityValue = severity[validation.name] || 0;
    return {name: validation.name, score: severityValue * (validation.error_count || 0)};
  })

  return {
    name: result.name,
    validations: validations,
    score: validations.reduce((acc, validation) => {
      return acc + validation.score;
    }, 0)
  }
}

export const doAnalysis = async (result: NeTExResults) => {
  return result.map(parseValidation)
};
