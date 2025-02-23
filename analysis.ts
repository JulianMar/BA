type ValidationError = {
    message: string,
    line: number,
    type: string
}

type Validation = {
    name: string,
    valid: boolean,
    error_count?: number,
    errors?: ValidationError[]
}

type NeTExResult = {
    name: string,
    valid: boolean,
    validations: Validation[]
}[]

export const doAnalysis = async (result: NeTExResult) => {
    console.log(result);
}