import fs from 'node:fs'

let accessToken: string | undefined = undefined;
const year = process.env.YEAR || '2025';

const downloadFile = async (data: any) => {
    const fileName = data.activeVersions[0].dataSetVersion.file.originalName
    console.log(`Downloading data for ${fileName} (${year})`);
    const downloadResponse = await fetch(`https://data.mobilitaetsverbuende.at/api/public/v1/data-sets/${data.id}/${year}/file`, {
        headers: {
            authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/zip',
        }
    })
    if (!downloadResponse.ok) {
        console.error('Failed to download data:', downloadResponse.statusText);
        console.error('Response:', await downloadResponse.text());
        return;
    }
    const file = await downloadResponse.bytes();
    const filePath = `./data/testdata/${fileName}`;
    fs.mkdirSync('./data/testdata', { recursive: true });
    fs.writeFileSync(filePath, file, {});

    const metaData = data
    fs.writeFileSync(`./data/testdata/${fileName}.json`, JSON.stringify(metaData));
}

export const downloadNeTExData = async () => {
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    if (!username || !password) {
        console.error('Username or password not set');
        return;
    }

    const formData = new URLSearchParams()
    formData.append('client_id', 'dbp-public-ui');
    formData.append('scope', 'openid');
    formData.append('grant_type', 'password');
    formData.append('username', username);
    formData.append('password', password);

    const tokenResponse = await fetch('https://user.mobilitaetsverbuende.at/auth/realms/dbp-public/protocol/openid-connect/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
    })

    if (!tokenResponse.ok) {
        console.error('Failed to fetch token:', tokenResponse.statusText);
        console.error('Response:', await tokenResponse.text());
        return;
    }


    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
    

    const dataListResponse = await fetch('https://data.mobilitaetsverbuende.at/api/public/v1/data-sets?tagFilterModeInclusive=true&tagIds=3', {
        headers: {
            authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        }
    })

    if (!dataListResponse.ok) {
        console.error('Failed to fetch data list:', dataListResponse.statusText);
        console.error('Response:', await dataListResponse.text());
        return;
    }
    const dataList = await dataListResponse.json();

    const promises = []
    for (const data of dataList) {
        promises.push(downloadFile(data))
    }

    await Promise.all(promises);

    console.log('All files downloaded');
}
