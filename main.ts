import { exec } from 'node:child_process'
import { readdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { doAnalysis } from './analysis';

const promiseExec = promisify(exec)

const currentPath = import.meta.dir; 
const dataFolder = `${currentPath}/data`


const callDocker = async (command: string, args: string[][]) => {
    const defaults = [["--output", "json"], ["-l", "error"]];
    const finalArgs = [...defaults, ...args].flatMap(arg => arg.join("=")).join(" ");


    const finalCommand = `docker run -v ${dataFolder}:/usr/local/greenlight/testdata -i --rm itxpt/greenlight ${command} ${finalArgs}`;

    try {
        const { stdout, stderr } = await promiseExec(finalCommand, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 });
        console.log('stderr:', stderr);
        if (stderr) {
            throw new Error(stderr);
        }

        return JSON.parse(stdout);
    } catch (error) {
        console.error('error:', error);
    }
}

const runValidation = async (file: string) => {
    const result = await callDocker('validate', [['-i', `testdata/${file}`]]);
    return result;
}



const main = async () => {
    const allFiles = readdirSync(dataFolder)

    allFiles.forEach(async (file) => {
        const result = await runValidation(file);

        const analysisResult = await doAnalysis(result);

        console.log(analysisResult);
    })
}
// const result = await callDocker('validate', [['-i', 'testdata']]);
// const result = await runValidation('testdata');

// console.log(result);

main()