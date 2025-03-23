import { exec } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { doAnalysis, severity, type ValidationResult } from "./analysis";
import xlsx from "node-xlsx";

const promiseExec = promisify(exec);

const currentPath = import.meta.dir;
const dataFolder = `${currentPath}/data/testdata`;
const ruleFolder = `${currentPath}/rules`;
const profileFolder = `${currentPath}/profile`;

const callDocker = async (
  command: string,
  args: string[][],
  customRules: boolean = false,
  customProfile: boolean = false,
) => {
  const defaults = [
    ["--output", "json"],
    ["-l", "error"],
  ];
  const finalArgs = [...defaults, ...args]
    .flatMap((arg) => arg.join("="))
    .join(" ");

  let volumes = `-v ${dataFolder}:/usr/local/greenlight/testdata`;

  if (customRules) {
    volumes += ` -v ${ruleFolder}:/usr/local/greenlight/builtin`;
  }

  if (customProfile) {
    volumes += ` -v ${profileFolder}:/usr/local/greenlight/profile`;
    volumes += ` -v ${currentPath}/rules:/usr/local/greenlight/builtin`;
  }

  const finalCommand = `docker run ${volumes} -i --rm itxpt/greenlight ${command} ${finalArgs}`;

  try {
    const { stdout, stderr } = await promiseExec(finalCommand, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 1024,
    });
    if (stderr) {
      console.log("stderr:", stderr);
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  } catch (error) {
    console.error("error:", error);
  }
};

const replaceName = (checks: any, name: string) => {
  return checks.map(item => {
    item.validations = item.validations.map(validation => {
      validation.name = name
      validation.errors = validation.errors.map(error => {
        error.type = name

        return error;
      })
      return validation;
    })
    return item;
  })
}

const addToResult = (result: any, additionalResult: any) => {
  result.map((res) => {
    const additionalResultItem = additionalResult.find(
      (item) => item.name === res.name
    );
    console.log(res.name, additionalResultItem);
    if (additionalResultItem) {
      res.validations.push(...additionalResultItem.validations);
      if (!res.valid || !additionalResultItem.valid) {
        res.valid = false;
      }
    }
    return res;
  })
  return result;
}

const runValidation = async (file: string) => {
  console.log(`Running validation for ${file}`);
  let result = await callDocker(
    "validate",
    [["-i", `testdata/${file}`]],
    true
  );

  let epipXSD = await callDocker(
    "validate",
    [["-i", `testdata/${file}`], ["--profile", "/usr/local/greenlight/profile/epip/profile.json"]],
    false,
    true,
  );

  epipXSD = replaceName(epipXSD, 'xsdEPIP')

  console.log(epipXSD)

  let austrianXSD = await callDocker(
    "validate",
    [["-i", `testdata/${file}`], ["--profile", "/usr/local/greenlight/profile/austrian/profile.json"]],
    false,
    true,
  );

  austrianXSD = replaceName(austrianXSD, 'xsdAustrian')
  console.log(austrianXSD)

  result = addToResult(result, epipXSD);
  result = addToResult(result, austrianXSD);

  // additionalResult[1].validations = additionalResult[1].validations.map((validation) =>  {
  //   validation.name = 'xsdAustrian'
  //   return validation;
  // })

  // result.push(...additionalResult);

  return result;
};

const generateExcel = async (data: ValidationResult[], file: string) => {
  const headers = ["Name", "Score", ...Object.keys(severity)];

  const rows = data.map((item) => {
    const validations = Object.keys(severity).flatMap((key) => {
      return (
        item.validations.find((validation) => validation.name === key)?.score ||
        0
      );
    });
    return [
      item.name
        .split("/")[2]
        .split(".xml")[0]
        .split("LINE_")[1]
        .split("_" + file.split("-")[0])[0], // extract the date from the main file and remove that part from the line name
      item.score,
      ...validations,
    ];
  }).sort((a, b) =>  a[0].localeCompare(b[0]));

  const sheetData = [headers, ...rows];

  return {
    name: file.split("netex_")[1].split("_20")[0],
    data: sheetData,
    options: {},
  };
};

const main = async () => {
  const allFiles = readdirSync(dataFolder).filter((file) =>
    file.endsWith(".zip")
  );

  const allSheetsPromises = await allFiles.map(async (file) => {
    const result = await runValidation(file);

    writeFileSync('debug.json', JSON.stringify(result));

    const analysisResult = await doAnalysis(result);

    return generateExcel(analysisResult, file);
  });

  const allSheets = await Promise.all(allSheetsPromises);

  const buffer = xlsx.build(allSheets);
  const name = `output/output-${(new Date().toLocaleDateString()).replaceAll('/', '-')}.xlsx`;
  writeFileSync(name, buffer);
};

main();
