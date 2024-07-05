const CLIENT_ID = '972247015927-uocb4ika9mn940knj91qk6e7r1edsc3i.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAAIFD7oJZMGXdAH84VeYcFFs1MtAqpoD0';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authButton').style.display = 'block';
    }
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('signoutButton').style.display = 'block';
        addEventsToCalendar();
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            document.getElementById('signoutButton').style.display = 'none';
        });
    }
}

async function addEventsToCalendar() {
    const events = JSON.parse(document.getElementById('output').innerText);
    for (const event of events) {
        try {
            const response = await gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event,
            });
            console.log('Event created: ' + response.result.htmlLink);
        } catch (error) {
            console.error('Error creating event', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('authButton').onclick = handleAuthClick;
    document.getElementById('signoutButton').onclick = handleSignoutClick;
    gapiLoaded();
    gisLoaded();
});

function parseSchedule() {
    const startDateInput = document.getElementById('startDateInput').value; // Get start date input value
    const startDate = new Date(startDateInput); // Convert start date input to Date object

    const scheduleInput = document.getElementById('scheduleInput').value;
    const lines = scheduleInput.split('\n').filter(line => line.trim() !== '');
    const events = [];

    for (let i = 0; i < lines.length; i += 7) {
        const classInfo = lines[i].split('\t');
        const timeInfo = lines[i + 3].split(' - ');
        const days = lines[i + 4].trim();
        const location = lines[i + 5].trim();
        const instructor = lines[i + 6].trim();

        if (timeInfo.length === 2 && days !== 'ARRANGED') {
            const [startTime, endTime] = timeInfo;
            const [startHours, startMinutes] = convertTo24Hour(startTime);
            const [endHours, endMinutes] = convertTo24Hour(endTime);
            const startDateInstance = new Date(startDate);
            startDateInstance.setHours(startHours, startMinutes, 0, 0);
            const endDateInstance = new Date(startDate);
            endDateInstance.setHours(endHours, endMinutes, 0, 0);

            days.split('').forEach(day => {
                const event = {
                    summary: `${classInfo[0].trim()} ${classInfo[2].trim()}`,
                    location: location,
                    start: {
                        dateTime: getNextDayOfWeek(startDateInstance, day).toISOString()
                    },
                    end: {
                        dateTime: getNextDayOfWeek(endDateInstance, day).toISOString()
                    },
                    description: instructor
                };
                events.push(event);
            });
        }
    }

    document.getElementById('output').innerText = JSON.stringify(events, null, 2);
    document.getElementById('authButton').style.display = 'block';
}


function convertTo24Hour(time) {
    const [hours, minutesPart] = time.split(':');
    const minutes = minutesPart.substring(0, 2);
    const period = minutesPart.substring(2).trim().toUpperCase();
    let hours24 = parseInt(hours, 10);
    if (period === 'PM' && hours24 < 12) hours24 += 12;
    if (period === 'AM' && hours24 === 12) hours24 = 0;
    return [hours24, parseInt(minutes, 10)];
}

function getNextDayOfWeek(date, day) {
    const dayMap = { 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'S': 6, 'U': 0 };
    const resultDate = new Date(date);
    resultDate.setDate(date.getDate() + (dayMap[day] + 7 - date.getDay()) % 7);
    return resultDate;
}