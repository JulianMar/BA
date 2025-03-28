import { exec } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import {
  doAnalysis,
  severity,
  type NeTExResults,
  type ValidationResult,
  type Validations,
} from "./analysis";
import xlsx from "node-xlsx";
import { downloadNeTExData } from "./download";
import { deepAnalysis } from "./deepAnalysis";

const promiseExec = promisify(exec);

const currentPath = import.meta.dir;
const dataFolder = `${currentPath}/data/testdata`;
const ruleFolder = `${currentPath}/rules`;
const profileFolder = `${currentPath}/profile`;
const cacheFolder = `${currentPath}/.cache`;

const hashKey = async (key: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

const cacheSet = async (key: string, value: any) => {
  const hashedKey = await hashKey(key);

  const cacheFile = `${cacheFolder}/${hashedKey}.json`;
  mkdirSync(`${cacheFolder}`, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(value));
};

const cacheGet = async (key: string) => {
  if (Bun.argv.includes("no-cache")) {
    return null;
  }

  const hashedKey = await hashKey(key);
  try {
    const data = readdirSync(`${cacheFolder}`).find(
      (file) => file === `${hashedKey}.json`
    );
    if (data) {
      const file = `${cacheFolder}/${data}`;
      const fileData = JSON.parse(readFileSync(file, "utf-8"));

      return fileData;
    }
  } catch (error) {
    console.error("Cache not found", error);
  }
  return null;
};

const callDocker = async (
  command: string,
  args: string[][],
  customRules: boolean = false,
  customProfile: boolean = false
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

  const finalCommand = `docker run ${volumes} -i --rm itxpt/greenlight:1.0.7 ${command} ${finalArgs}`;

  const hasCache = await cacheGet(finalCommand);
  if (hasCache) {
    console.log("Cache hit");
    return hasCache;
  }
  console.log("Cache miss");

  try {
    const { stdout, stderr } = await promiseExec(finalCommand, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 1024,
    });
    if (stderr) {
      console.log("stderr:", stderr);
      throw new Error(stderr);
    }

    const result = JSON.parse(stdout);

    cacheSet(finalCommand, result);
    return result;
  } catch (error) {
    console.error("error:", error);
  }
};

const replaceName = (checks: NeTExResults, name: Validations) => {
  return checks.map((item) => {
    item.validations = item.validations.map((validation) => {
      validation.name = name;
      validation.errors = validation.errors?.map((error) => {
        error.type = name;

        return error;
      });
      return validation;
    });
    return item;
  });
};

const addToResult = (result: NeTExResults, additionalResult: NeTExResults) => {
  result.map((res) => {
    const additionalResultItem = additionalResult.find(
      (item) => item.name === res.name
    );
    if (additionalResultItem) {
      res.validations.push(...additionalResultItem.validations);
      if (!res.valid || !additionalResultItem.valid) {
        res.valid = false;
      }
    }
    return res;
  });
  return result;
};

const runValidation = async (file: string): Promise<NeTExResults> => {
  console.log(`Running validation for ${file}`);
  let result = await callDocker(
    "validate",
    [["-i", `testdata/${file}`]],
    true,
    false
  );

  if (Bun.argv.includes("epip")) {
    console.log(`Running epip validation for ${file}`);

    let epipXSD = await callDocker(
      "validate",
      [
        ["-i", `testdata/${file}`],
        ["--profile", "/usr/local/greenlight/profile/epip/profile.json"],
      ],
      false,
      true
    );

    epipXSD = replaceName(epipXSD, "xsdEPIP");
    result = addToResult(result, epipXSD);
  }

  if (Bun.argv.includes("netex-old")) {
    console.log(`Running netex old validation for ${file}`);

    let epipXSD = await callDocker(
      "validate",
      [
        ["-i", `testdata/${file}`],
        ["--profile", "/usr/local/greenlight/profile/netex/profile.json"],
      ],
      false,
      true
    );

    epipXSD = replaceName(epipXSD, "xsdNetex110");
    result = addToResult(result, epipXSD);
  }

  if (Bun.argv.includes("austrian")) {
    console.log(`Running austrian profile validation for ${file}`);
    let austrianXSD = await callDocker(
      "validate",
      [
        ["-i", `testdata/${file}`],
        ["--profile", "/usr/local/greenlight/profile/austrian/profile.json"],
      ],
      false,
      true
    );

    austrianXSD = replaceName(austrianXSD, "xsdAustrian");
    result = addToResult(result, austrianXSD);
  }

  console.log(`Validation done for ${file}`);

  return result as NeTExResults;
};

const generateExcel = async (data: ValidationResult[], file: string) => {
  const headers = ["Name", "Severity", ...Object.keys(severity)];

  const rows = data
    .map((item) => {
      const validations = Object.keys(severity).flatMap((key) => {
        return (
          item.validations.find((validation) => validation.name === key)
            ?.score || 0
        );
      });

      let name = item.name;
      if (name.includes("obb")) {
        name = item.name
          .split("/")[2]
          .split(".xml")[0]
          .split("LINE_")[1]
          .split("_")[1];
      } else if (name.includes("LINE_")) {
        name = item.name
          .split("/")[2]
          .split(".xml")[0]
          .split("LINE_")[1]
          .split("_" + file.split("-")[0])[0]; // extract the date from the main file and remove that part from the line name
      }

      return [name, item.score, ...validations];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  const sheetData = [headers, ...rows, ["sum:", {f: `sum(B2:B${rows.length + 1})`}, {f: `count(B2:B${rows.length + 1})`}]];

  let name = file;
  if (name.includes("obb")) {
    name = "obb";
  } else if (name.includes("netex_")) {
    name = name.split("netex_")[1].split("_20")[0];
  }

  return {
    name,
    data: sheetData,
    options: {},
  };
};

const runTest = async (file: string) => {
  const result = await runValidation(file);

  if (Bun.argv.includes("debug")) {
    mkdirSync("output/debug", { recursive: true });
    writeFileSync(`output/debug/${file}.json`, JSON.stringify(result));

    const sheets = deepAnalysis(result)

    const buffer = xlsx.build(sheets);
    const name = `output/debug/${file}-${new Date()
      .toLocaleDateString()
      .replaceAll("/", "-")}.xlsx`;
    writeFileSync(name, buffer);
  }

  console.log(`Running analysis for ${file}`);

  const analysisResult = await doAnalysis(result);

  console.log(`Analysis done for ${file}`);

  return generateExcel(analysisResult, file);
};

const main = async () => {
  if (Bun.argv.includes("download")) {
    console.log("Downloading test data...");
    await downloadNeTExData();
  }

  const allFiles = readdirSync(dataFolder).filter((file) =>
    file.endsWith(".zip")
  );

  let allSheets = [];
  for (const file of allFiles) {
    const result = await runTest(file);
    allSheets.push(result);
  }

  console.log("All files have been processed");

  const summarySheet = {
    name: "Summary",
    data: [
      ["Name", "Sum of Weighted Severity", "files", "severity / files"],
      ...allSheets.map((sheet) => {
        return [sheet.name, {f: `${sheet.name}!B${sheet.data.length}`}, {f: `${sheet.name}!C${sheet.data.length}`}, {f: `${sheet.name}!B${sheet.data.length}/${sheet.name}!C${sheet.data.length}`}];
      }),
    ],
    options: {},
  }

  const summaryByError = {
    name: "Summary by Error",
    data: [
      ["Name", ...Object.keys(severity)],
      ...allSheets.map((sheet) => {
        const validations = Object.keys(severity).flatMap((key) => {
          const row = sheet.data[0].findIndex((validation) => validation === key);
          return sheet.data.reduce((acc, item) => {
              const current = item[row];

              if (current && typeof current !== "object" && typeof current !== "string") {
                return acc + current;
              }

              return acc;
            }, 0)
        });
        return [sheet.name, ...validations];
      }),
      ["sum:", {f: `sum(B2:B${allSheets.length + 1})`}, {f: `sum(C2:C${allSheets.length + 1})`}],
      ["avg:", {f: `average(B2:B${allSheets.length + 1})`}, {f: `average(C2:C${allSheets.length + 1})`}],
      ["min:", {f: `min(B2:B${allSheets.length + 1})`}, {f: `min(C2:C${allSheets.length + 1})`}],
      ["max:", {f: `max(B2:B${allSheets.length + 1})`}, {f: `max(C2:C${allSheets.length + 1})`}],
    ],
    options: {},
  };

  console.log("Generating Excel file...");

  const buffer = xlsx.build([summarySheet, summaryByError, ...allSheets]);
  const name = `output/output-${new Date()
    .toLocaleDateString()
    .replaceAll("/", "-")}.xlsx`;
  writeFileSync(name, buffer);
};

main();
