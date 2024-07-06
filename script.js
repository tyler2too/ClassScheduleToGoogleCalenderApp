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

    // Define an array of colorIds to cycle through
    const colorIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
    let colorIndex = 0; // Start with the first colorId

    try {
        for (const event of events) {
            // Set colorId for the event
            event.colorId = colorIds[colorIndex % colorIds.length]; // Cycle through colors

            // Add detailed logging for debugging
            console.log('Event to be created:', event);

            const response = await gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event,
            });

            console.log('Event created: ', response);
            if (response.result) {
                console.log('Event created: ' + response.result.htmlLink);
                showMessage('success', 'Events added successfully!');
            } else {
                console.error('Event creation failed: ', response);
                showMessage('error', 'Event creation failed. Please try again.');
            }

            colorIndex++; // Move to the next colorId
        }
    } catch (error) {
        console.error('Error creating event', error);
        showMessage('error', 'An error occurred while adding events. Please try again.');
        if (error.result) {
            console.error('Detailed error:', error.result.error);
        }
    }
}

function showMessage(type, message) {
    const outputElement = document.getElementById('output');
    const messageElement = document.createElement('div');
    messageElement.classList.add(type === 'error' ? 'error-message' : 'success-message');
    messageElement.textContent = message;
    outputElement.appendChild(messageElement);
}


document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('authButton').onclick = handleAuthClick;
    document.getElementById('signoutButton').onclick = handleSignoutClick;
    gapiLoaded();
    gisLoaded();
});

// Added this to fix UTC problems
function formatDateTime(date) {
    // Extract date components
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);

    // Construct the formatted date-time string
    const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

    return formattedDateTime;
}

// Main function to get data from the schedule
function parseSchedule() {
    const startDateInput = document.getElementById('startDateInput').value;
    const endDateInput = document.getElementById('endDateInput').value;
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    const scheduleInput = document.getElementById('scheduleInput').value;
    const lines = scheduleInput.split('\n').filter(line => line.trim() !== '');
    const events = [];

    // Determine the day of the week for the start date
    const startDayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

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

            // Calculate the start date instance based on the class day
            // This fixed adding events a day before
            let startDateInstance;
            if (days.includes('M') && startDayOfWeek === 1) {
                // If the class starts on Monday and start date is a Monday
                startDateInstance = new Date(startDate);
            } else {
                // Calculate the next occurrence of the class day
                startDateInstance = getNextDayOfWeek(startDate, days.charAt(0));
            }
            startDateInstance.setHours(startHours, startMinutes, 0, 0);

            // Calculate the end date instance
            const endDateInstance = new Date(startDateInstance);
            endDateInstance.setHours(endHours, endMinutes, 0, 0);

            // Convert days to Google Calendar API BYDAY format (MO, TU, etc.)
            const recurrenceDays = days !== 'N/A' && days !== '.' && days !== 'A' ?
                days.split('').map(day => {
                    switch (day.toUpperCase()) {
                        case 'M': return 'MO';
                        case 'T': return 'TU';
                        case 'W': return 'WE';
                        case 'R': return 'TH';
                        case 'F': return 'FR';
                        case 'S': return 'SA';
                        case 'U': return 'SU';
                        default: return ''; // Handle unexpected cases
                    }
                }).filter(day => day !== '').join(',') : '';

            // Calculate UNTIL date in YYYYMMDD format
            const untilDate = endDate.toISOString().slice(0, 10).replace(/-/g, '');

            // Construct the RRULE with start time included
            const recurrenceRule = `RRULE:FREQ=WEEKLY;UNTIL=${untilDate};BYDAY=${recurrenceDays};WKST=SU;INTERVAL=1;BYHOUR=${startHours};BYMINUTE=${startMinutes}`;
            // This got rid of the loop in earlier stages
            
            const event = {
                summary: `${classInfo[0].trim()} ${classInfo[2].trim()}`,
                location: location,
                start: {
                    dateTime: formatDateTime(startDateInstance), // Use dateTime without offset
                    timeZone: 'America/Chicago' // Adjust timezone as needed
                },
                end: {
                    dateTime: formatDateTime(endDateInstance), // Use dateTime without offset
                    timeZone: 'America/Chicago' // Adjust timezone as needed
                },
                description: instructor,
                recurrence: [
                    recurrenceRule
                ]
            };

            events.push(event);
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


