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

let startDate, endDate; // Global variables to hold start and end dates

function parseSchedule() {
    startDate = new Date(document.getElementById('startDateInput').value);
    endDate = new Date(document.getElementById('endDateInput').value);

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

            const startDateTime = getNextDayOfWeek(startDate, days[0]);
            startDateTime.setHours(startHours, startMinutes, 0, 0);

            const endDateTime = getNextDayOfWeek(startDate, days[0]);
            endDateTime.setHours(endHours, endMinutes, 0, 0);

            if (startDateTime >= startDate && endDateTime <= endDate) {
                days.split('').forEach(day => {
                    const event = {
                        summary: `${classInfo[0].trim()} ${classInfo[2].trim()}`,
                        location: location,
                        start: {
                            dateTime: startDateTime.toISOString()
                        },
                        end: {
                            dateTime: endDateTime.toISOString()
                        },
                        description: instructor
                    };
                    events.push(event);
                });
            } else {
                console.warn('Event skipped because it falls outside the specified start and end dates.');
            }
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
