type ValidationError = {
  message: string;
  line: number;
  type: string;
};

export type Validations =
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

export type NeTExResults = NeTExResult[];

const severityMap = {
  low: 1,
  lowMid: 2,
  mid: 3,
  midHigh: 4,
  high: 5
}

export const severity: Record<Validations, number> = {
  everyStopPlaceIsReferenced: severityMap.low,
  everyStopPointIsReferenced: severityMap.lowMid,
  everyLineIsReferenced: severityMap.lowMid,
  customPublicationTimeStampIsAvailable: severityMap.lowMid,
  customServiceCalendarIsCurrentYear: severityMap.mid,
  everyScheduledStopPointHasAName: severityMap.mid,
  stopPlaceQuayDistanceIsReasonable: severityMap.mid,
  locationsAreReferencingTheSamePoint: severityMap.mid,
  netexKeyRefConstraints: severityMap.mid,
  netexUniqueConstraints: severityMap.mid,
  everyStopPlaceHasACorrectStopPlaceType: severityMap.mid,
  frameDefaultsHaveALocaleAndTimeZone: severityMap.mid,
  passingTimesHaveIncreasingTimes: severityMap.midHigh,
  everyStopPlaceHasAName: severityMap.midHigh,
  everyStopPointHaveArrivalAndDepartureTime: severityMap.midHigh,
  passingTimesIsNotDecreasing: severityMap.high,
  xsd: severityMap.high,
  xsdEPIP: severityMap.high,
  xsdAustrian: severityMap.high,
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
