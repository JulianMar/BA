import type { WorkSheet } from "node-xlsx";
import type { NeTExResults, Validations } from "./analysis";

type DeepAnalysis = {
  name: string;
  valid: boolean;
  validation: Validations;
  error_count: number;
  error_message: string;
  error_line: number;
};
type DeepAnalysisReport = {
  file: string;
  analysis: DeepAnalysis[];
}[]

export const deepAnalysis = (netexRes: NeTExResults): WorkSheet[] => {
  return netexRes.map((res) => {
    let sheetName = res.name.split('/').pop()?.split('LINE_')[1].split("_2025")[0]!;
    const data = res.validations.flatMap((validation) => {
      return validation.errors?.map((error) => {
        return [
          res.name.split('/').pop(),
          validation.name,
          error.message,
          error.line,
        ];
      });
    }).filter((item) => item !== undefined)

    data.unshift([
      "File",
      "Validation",
      "Error Count",
      "Error Message",
      "Line",
    ])

    return {
      name: sheetName.substring(0, 31),
      data,
      options: {}
    }
  });
  
  // return netexRes
  //   .map((res) => {
  //     return res.validations
  //       .flatMap((validation) => {
  //         return validation.errors?.map((error) => {
  //           return {
  //             name: res.name,
  //             valid: res.valid,
  //             validation: validation.name,
  //             error_count: validation.error_count || 0,
  //             error_message: error.message,
  //             error_line: error.line,
  //           };
  //         });
  //       })
  //       .filter((item) => item !== undefined);
  //   })
  //   .filter((item) => item !== undefined);
};
