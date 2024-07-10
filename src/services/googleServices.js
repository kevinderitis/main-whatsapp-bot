import { google } from 'googleapis';

const CREDENTIALS_PATH = './vegas-marketing-dfeaca688327.json';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
});

const formatDate = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
    return formattedDate;
};

export const appendDataToSheet = async (spreadsheetId, values) => {
    const client = await auth.getClient();
    const range = 'Leads!A2';
    try {
        await google.sheets('v4').spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: 0,
                                dimension: 'ROWS',
                                startIndex: 1,
                                endIndex: 2,
                            },
                            inheritFromBefore: false,
                        },
                    },
                ],
            },
            auth: client,
        });

        const formattedDate = formatDate(new Date());
        console.log(formattedDate)
        const request = {
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: {
                values: [[...values, formattedDate]],
            },
            auth: client,
        };


        const response = (await google.sheets('v4').spreadsheets.values.update(request)).data;
        console.log(`Data appended to sheet: ${spreadsheetId}`);
    } catch (error) {
        console.error(`Error appending data: ${error}`);
    }
};

